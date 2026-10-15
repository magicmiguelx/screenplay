#!/usr/bin/env node
// The voice-over without recording. Real API calls, billed to
// ELEVENLABS_API_KEY: never in CI (`cover` and `seen` make none).
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
//                                        (or adds one); fails when a line differs
//   screenplay-voiceover cover [name…]   every caption's place and cover, from the scripts;
//                                        fails on a line over --over (default 0.5)
//   screenplay-voiceover seen [name…]    how much of each line's subject was in the
//                                        picture; fails on a line under --under (default 0.9)
//   --dry                                stand-in clips (a quiet tone as long as the
//                                        line takes at 150 words a minute), no API
//   --config <file>                      the project's config (default ./screenplay.config.mjs)
//
// The config file exports (default) a ScreenplayConfig: where the scripts
// and the videos are, the voice and its `say` rules (templates/screenplay.config.mjs).

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { asSent, clip, configure, diffWords, mix, normalize, pace, seconds, speakable, transcribe, voiceAvailable, withoutTags, type SayRule, type VoiceConfig } from './voice.js';

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
  const usage = 'Usage: screenplay-voiceover speak|mix|check|cover|seen [name…] [--dry] [--config file] [--over 0.5] [--under 0.9]';
  let parsed;
  try {
    parsed = parseArgs({
      args: process.argv.slice(2),
      allowPositionals: true,
      options: { dry: { type: 'boolean' }, config: { type: 'string' }, over: { type: 'string' }, under: { type: 'string' } },
    });
  } catch (e) {
    console.error(`${e instanceof Error ? e.message : e}\n${usage}`);
    process.exit(1);
  }
  const { values, positionals } = parsed;
  const dry = values.dry ?? false;
  const configFile = resolve(values.config ?? 'screenplay.config.mjs');
  const share = (flag: 'over' | 'under', fallback: number) => {
    const v = values[flag] === undefined ? fallback : Number(values[flag]);
    if (!(v >= 0 && v <= 1)) { console.error(`--${flag} takes a share from 0 to 1, not "${values[flag]}".\n${usage}`); process.exit(1); }
    return v;
  };
  const over = share('over', 0.5);
  const under = share('under', 0.9);
  const [command, ...names] = positionals;
  if (!['speak', 'mix', 'check', 'cover', 'seen'].includes(command)) {
    console.error(usage);
    process.exit(1);
  }
  if (!existsSync(configFile)) {
    console.error(`No config at ${configFile} (templates/screenplay.config.mjs is a start).`);
    process.exit(1);
  }
  const cfg = (await import(pathToFileURL(configFile).href)).default as ScreenplayConfig;
  const root = resolve(configFile, '..');
  configure(cfg.voice);
  if (command !== 'cover' && command !== 'seen' && !dry && !voiceAvailable()) {
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

  // Where every caption sat and what it covered, from the scripts: the lines over `--over` (default 0.5), per video.
  if (command === 'cover') {
    let flagged = 0, measured = 0;
    for (const name of videos) {
      const jsonFile = join(SCRIPTS, `${name}.json`);
      if (!existsSync(jsonFile)) continue;
      const rows = (JSON.parse(readFileSync(jsonFile, 'utf8')) as { caption: string; at?: string; cover?: number }[]).filter(l => l.at);
      measured += rows.length;
      const bad = rows.filter(l => (l.cover ?? 0) > over);
      flagged += bad.length;
      const worst = rows.reduce((m, l) => Math.max(m, l.cover ?? 0), 0);
      console.log(`${name}: ${rows.length} captions, worst ${Math.round(Math.min(1, worst) * 100)}%${bad.length ? `, ${bad.length} over ${Math.round(over * 100)}%:` : ''}`);
      for (const l of bad) console.log(`  ${l.at} ${Math.round(Math.min(1, l.cover ?? 0) * 100)}%${(l.cover ?? 0) > 1 ? ' on the target' : ''}  ${l.caption}`);
    }
    console.log(flagged ? `${flagged} of ${measured} captions over ${Math.round(over * 100)}% content.` : `Every caption (${measured}) under ${Math.round(over * 100)}% content.`);
    if (flagged) process.exit(1);
  }

  // How much of what each line is about was in the picture, from the scripts: the lines under `--under` (default 0.9), per video.
  if (command === 'seen') {
    let flagged = 0, measured = 0;
    for (const name of videos) {
      const jsonFile = join(SCRIPTS, `${name}.json`);
      if (!existsSync(jsonFile)) continue;
      const all = JSON.parse(readFileSync(jsonFile, 'utf8')) as { kind: string; caption: string; seen?: number; subject?: string }[];
      const rows = all.filter(l => l.seen !== undefined);
      const captions = all.filter(l => l.kind === 'caption').length;
      measured += rows.length;
      const bad = rows.filter(l => (l.seen ?? 1) < under);
      flagged += bad.length;
      console.log(`${name}: ${rows.length} of ${captions} captions with a subject measured${bad.length ? `, ${bad.length} under ${Math.round(under * 100)}% in view:` : ''}`);
      for (const l of bad) console.log(`  ${Math.round((l.seen ?? 0) * 100)}%  ${l.caption}  (${l.subject})`);
    }
    console.log(flagged ? `${flagged} of ${measured} lines with their subject under ${Math.round(under * 100)}% in view.` : `Every measured line (${measured}) had its subject in view.`);
    if (flagged) process.exit(1);
  }

  if (command === 'check') {
    let differ = 0;
    for (const name of videos) {
      let fastest = 0;
      for (const [i, line] of lines(name).entries()) {
        const file = await clip(line.voice);
        fastest = Math.max(fastest, pace(file, line.voice));
        const heard = await transcribe(file);
        const { missing, extra } = diffWords(normalize(line.voice, cfg.undo), normalize(withoutTags(heard), cfg.undo));
        if (missing.length || extra.length) {
          differ++;
          console.log(`${name} line ${i + 1}\n  sent:  ${asSent(line.voice)}\n  heard: ${heard}${missing.length ? `\n  not heard: ${missing.join(', ')}` : ''}${extra.length ? `\n  heard, not sent: ${extra.join(', ')}` : ''}`);
        }
      }
      console.log(`${name}: fastest line ${fastest.toFixed(2)} words a second (ceiling ${cfg.voice?.maxWordsPerSecond ?? 3}).`);
    }
    console.log(differ ? `${differ} lines to listen to.` : 'Every line was heard as written.');
    // Like cover and seen: a line to listen to fails the command, so a script or a checklist can tell.
    if (differ) process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
