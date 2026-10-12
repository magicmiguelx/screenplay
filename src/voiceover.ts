#!/usr/bin/env node
// The voice-over without recording. Real API calls, billed to
// ELEVENLABS_API_KEY: never in CI.
//
// Recording with the key set already voices the videos: the driver makes
// each line's clip as it goes, holds the caption for it and mixes the clips
// in. This is for the rest:
//
//   screenplay-voiceover speak [name…]   a clip for every line of each video's
//                                        script (<name>.json, cached), and each
//                                        line's spoken length in the durations file
//   screenplay-voiceover mix [name…]     each video with its clips placed at their
//                                        lines' start times, written over the .mp4
//                                        (after recording without the voice)
//   screenplay-voiceover check [name…]   each clip transcribed (ElevenLabs Scribe)
//                                        and compared with what it should say:
//                                        catches a word the voice says as something else
//   --dry                                stand-in clips (a quiet tone as long as the
//                                        line takes at 150 words a minute), no API
//   --config <file>                      the project's config (default ./screenplay.config.mjs)
//
// The config file exports (default) a ScreenplayConfig: where the scripts
// and the videos are, the voice and its `say` rules (templates/screenplay.config.mjs).

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { asSent, clip, configure, mix, normalize, pace, seconds, speakable, transcribe, voiceAvailable, type SayRule, type VoiceConfig } from './voice.js';

export interface ScreenplayConfig {
  /** The folder of the scripts (<name>.vtt / .json / .md, and the durations file). */
  scripts: string;
  /** Where a script's video is: a folder, or a function of the script's name. */
  videos: string | ((name: string) => string);
  /** The durations file (each spoken line's length). Default <scripts>/voice.json. */
  durations?: string;
  voice?: Partial<VoiceConfig>;
  /** Rules that write the `say` respellings back for the transcription check ("plen-oh-view" → "plenoview"), and the transcriber's own spellings. */
  undo?: SayRule[];
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const at = args.indexOf('--config');
  const configFile = resolve(at >= 0 ? args[at + 1] : 'screenplay.config.mjs');
  const rest = args.filter((a, i) => a !== '--dry' && a !== '--config' && i !== at + 1);
  const [command, ...names] = rest;
  if (!['speak', 'mix', 'check'].includes(command)) {
    console.error('Usage: screenplay-voiceover speak|mix|check [name…] [--dry] [--config file]');
    process.exit(1);
  }
  if (!existsSync(configFile)) {
    console.error(`No config at ${configFile} (templates/screenplay.config.mjs is a start).`);
    process.exit(1);
  }
  const cfg = (await import(pathToFileURL(configFile).href)).default as ScreenplayConfig;
  const root = resolve(configFile, '..');
  configure(cfg.voice);
  if (!dry && !voiceAvailable()) {
    console.error('Set ELEVENLABS_API_KEY (or use --dry for stand-in clips).');
    process.exit(1);
  }
  const SCRIPTS = resolve(root, cfg.scripts);
  const DURATIONS = cfg.durations ? resolve(root, cfg.durations) : join(SCRIPTS, 'voice.json');
  const videoOf = (name: string) => (typeof cfg.videos === 'function' ? resolve(root, cfg.videos(name)) : resolve(root, cfg.videos, `${name}.mp4`));

  /** Every video with a script, or the ones named (by file name, with or without the number). */
  const videos = readdirSync(SCRIPTS).filter(f => f.endsWith('.vtt')).map(f => f.slice(0, -4))
    .filter(v => !names.length || names.some(n => v === n || v.includes(n)));

  /** A video's lines: from its .json (start in seconds, the spoken text), else its .vtt's captions spoken as written. */
  function lines(name: string): { start: number; voice: string }[] {
    const jsonFile = join(SCRIPTS, `${name}.json`);
    if (existsSync(jsonFile)) return (JSON.parse(readFileSync(jsonFile, 'utf8')) as { start: number; voice?: string; caption: string }[]).map(l => ({ start: l.start, voice: l.voice || speakable(l.caption) }));
    const text = readFileSync(join(SCRIPTS, `${name}.vtt`), 'utf8');
    const out: { start: number; voice: string }[] = [];
    const time = (t: string) => { const [m, s] = t.split(':'); return Number(m) * 60 + Number(s); };
    for (const block of text.split(/\n\n+/)) {
      const rows = block.trim().split('\n');
      const i = rows.findIndex(l => l.includes('-->'));
      if (i < 0) continue;
      out.push({ start: time(rows[i].split('-->')[0].trim()), voice: speakable(rows.slice(i + 1).join(' ').trim()) });
    }
    return out;
  }

  if (command === 'speak') {
    const durations: Record<string, number> = existsSync(DURATIONS) ? JSON.parse(readFileSync(DURATIONS, 'utf8')) : {};
    // A line the ceiling cannot fit is listed, not fatal here: the rest are made, and all the rewrites come at once.
    const tooFast: string[] = [];
    for (const name of videos) {
      console.log(name);
      for (const line of lines(name)) {
        try {
          durations[line.voice] = Math.round(seconds(await clip(line.voice, { dry })) * 100) / 100;
        } catch (e) {
          if (!(e instanceof Error) || !e.message.startsWith('Spoken too fast')) throw e;
          tooFast.push(`${name}: ${e.message}`);
          console.log(`  ${e.message}`);
        }
      }
    }
    writeFileSync(DURATIONS, JSON.stringify(Object.fromEntries(Object.entries(durations).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n');
    console.log(`Wrote ${DURATIONS}: re-record so each line has room, then mix.`);
    if (tooFast.length) {
      console.log(`${tooFast.length} lines the ceiling cannot fit; give each a pause or fewer words:\n${tooFast.join('\n')}`);
      process.exit(1);
    }
  }

  if (command === 'mix') {
    for (const name of videos) {
      const clips = [];
      for (const line of lines(name)) clips.push({ file: await clip(line.voice, { dry }), at: Math.round(line.start * 1000) });
      mix(videoOf(name), clips);
      console.log(`${name}: ${clips.length} lines mixed in.`);
    }
  }

  if (command === 'check') {
    let differ = 0;
    for (const name of videos) {
      let fastest = 0;
      for (const [i, line] of lines(name).entries()) {
        const file = await clip(line.voice);
        fastest = Math.max(fastest, pace(file, line.voice));
        const heard = await transcribe(file);
        const want = normalize(line.voice, cfg.undo), got = normalize(heard, cfg.undo);
        const missing = want.filter(w => !got.includes(w));
        if (missing.length) {
          differ++;
          console.log(`${name} line ${i + 1}\n  sent:  ${asSent(line.voice)}\n  heard: ${heard}\n  not heard: ${missing.join(', ')}`);
        }
      }
      console.log(`${name}: fastest line ${fastest.toFixed(2)} words a second (ceiling ${cfg.voice?.maxWordsPerSecond ?? 3}).`);
    }
    console.log(differ ? `${differ} lines to listen to.` : 'Every line was heard as written.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
