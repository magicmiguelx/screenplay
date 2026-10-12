// The voice-over, with ElevenLabs text to speech: used by the driver
// (demo.ts, which makes each line's clip as it records, so the caption
// stays up exactly as long as the voice needs) and by the voiceover CLI
// (voiceover.ts: the clips again, or the mix, or a transcription check,
// without recording). Real API calls, billed to ELEVENLABS_API_KEY: never
// in CI.
//
// What is spoken is not always the caption. Each line can carry its own
// spoken text (demo.say(caption, { voice })), written for the ear: commas
// and full stops where the voice should pause, <break time="0.4s" /> for a
// longer one, and words with two pronunciations put where the sentence
// decides them: "Present the tour" (a verb, pre-ZENT), never "click
// Present", which the voice reads as the noun (PREZ-ent). That was measured
// (the louder syllable of each clip's word, from Scribe's timings): the
// model takes no phoneme tags and capitalised respellings ("pre-ZENT") did
// not move its stress, so the sentence has to. Brand and acronym fixes go in
// the project's `say` rules (docs/writing-for-the-ear.md). Without its own
// text a line is spoken as `speakable(caption)`.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** A word the voice says wrongly as written, and what to send instead. */
export type SayRule = [RegExp, string | ((match: string) => string)];

export interface VoiceConfig {
  /** Where the clips are cached (a hash of the voice, the model and what is sent). Default ./.voice-cache. */
  cache: string;
  /** The ElevenLabs voice, by name: one of the account's voices, else found in the voice library and added. */
  voiceName: string;
  /** The ElevenLabs model. */
  model: string;
  /** ElevenLabs voice settings; `speed` (0.7 to 1.2, default 1) is the starting pace, lowered per line as the ceiling needs. */
  settings: { stability: number; similarity_boost: number; style: number; use_speaker_boost: boolean; speed?: number };
  /**
   * The fastest a line may be spoken, in words a second. A clip faster
   * than this is made again at a slower voice speed until it fits, and a
   * line still faster at the slowest speed fails the take, named, so it
   * is given a pause or fewer words. Default 3 (180 words a minute); the
   * first series ran at a median 2.97 with lines up to 4.4, and the
   * fast ones were heard as sped up.
   */
  maxWordsPerSecond: number;
  /** Applied to every spoken text, the line's own or the caption's, so scripts can be written plainly. */
  say: SayRule[];
  /** The ffmpeg and ffprobe binaries. */
  ffmpeg: string;
  ffprobe: string;
  /** The API base. */
  api: string;
}

export const DEFAULTS: VoiceConfig = {
  cache: resolve(process.cwd(), '.voice-cache'),
  voiceName: process.env.ELEVENLABS_VOICE || 'James - Professional Male',
  model: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
  // Measured on the first series: a steady read, a little expression, no drift between lines.
  settings: { stability: 0.55, similarity_boost: 0.75, style: 0.1, use_speaker_boost: true },
  maxWordsPerSecond: 3,
  say: [],
  ffmpeg: process.env.FFMPEG ?? 'ffmpeg',
  ffprobe: process.env.FFPROBE ?? 'ffprobe',
  api: 'https://api.elevenlabs.io',
};

let config: VoiceConfig = { ...DEFAULTS };

/** Set the project's voice: its cache, voice, model and `say` rules. Returns the config in force. */
export function configure(partial: Partial<VoiceConfig> = {}): VoiceConfig {
  config = { ...DEFAULTS, ...partial, say: partial.say ?? [] };
  voiceId = null;
  return config;
}

export const voiceConfig = () => config;

/** A spoken text as sent to the voice: the project's `say` rules applied. */
export const asSent = (text: string) => config.say.reduce((t, [re, to]) => t.replace(re, to as string), text);

/**
 * The caption as it is read aloud when the line has no spoken text of its
 * own: symbols in words. Arrows become "then", keyboard chords are spelled
 * ("Control Shift F"), a bare "+" is "plus", "%" is "percent", "≥" is "at
 * least", sparkles and "(K)" key hints are dropped, "…" becomes "..." (a
 * pause the voice honours).
 */
export function speakable(text: string) {
  return text
    .replace(/\s*→\s*/g, ', then ')
    .replace(/✨\s*/g, '')
    .replace(/\s*\(([A-Z])\)/g, '')
    .replace(/Ctrl\+Shift\+(\w)/g, 'Control Shift $1')
    .replace(/Ctrl\+(\w)/g, 'Control $1')
    .replace(/(^|\s)\+(\s)/g, '$1plus$2')
    .replace(/with \+,/g, 'with plus,')
    .replace(/with ×/g, 'with the cross')
    .replace(/(\d+)%/g, '$1 percent')
    .replace(/≥\s*/g, 'at least ')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The words of a spoken text, without break tags or respelling marks: for counts and checks. */
export const words = (text: string) => text.replace(/<break[^>]*\/>/g, ' ').split(/\s+/).filter(Boolean);

const key = () => process.env.ELEVENLABS_API_KEY;
export const voiceAvailable = () => !!key();

/** Where a spoken text's clip is kept (a hash of the voice, the model and what is sent). */
export const clipPath = (spoken: string, dry = false) =>
  join(config.cache, `${createHash('sha1').update(`${config.voiceName}|${config.model}|${dry}|${asSent(spoken)}`).digest('hex').slice(0, 16)}.mp3`);

/** A media file's length in seconds (ffprobe). */
export const seconds = (file: string) => Number(execFileSync(config.ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());

/** The words that are said: tokens with a letter or a digit (a bare "..." is a pause, not a word). */
export const saidWords = (text: string) => words(text).filter(w => /[\p{L}\p{N}]/u.test(w));

/** How fast a clip is spoken: the words of its text a second. */
export const pace = (file: string, spoken: string) => saidWords(asSent(spoken)).length / Math.max(0.1, seconds(file));

/**
 * The voice speed to try next for a clip spoken at `p` words a second
 * with `speed`, to land under `max` with a little margin; ElevenLabs
 * takes 0.7 to 1.2. Pure, for the test.
 */
export const slower = (p: number, max: number, speed: number) =>
  Math.max(0.7, Math.min(1.2, Math.round(speed * (max / p) * 0.96 * 100) / 100));

async function api(path: string, init: RequestInit & { body?: string } = {}): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${config.api}${path}`, { ...init, headers: { 'xi-api-key': key() ?? '', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers as Record<string, string> | undefined) } });
    if (res.ok) return res;
    // Busy or rate-limited: wait and try again, a few times.
    if ((res.status === 429 || res.status >= 500) && attempt < 4) { await new Promise(r => setTimeout(r, 2000 * 2 ** attempt)); continue; }
    throw new Error(`ElevenLabs ${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
}

interface VoiceRow { voice_id: string; name: string; public_owner_id?: string }

let voiceId: string | null = null;
/** The voice's id: one of the account's voices, else found in the library and added to them. */
async function voice(): Promise<string> {
  if (voiceId) return voiceId;
  const wanted = config.voiceName.toLowerCase();
  const mine: VoiceRow[] = ((await (await api('/v1/voices')).json()) as { voices?: VoiceRow[] }).voices ?? [];
  const own = mine.find(v => v.name.toLowerCase() === wanted) ?? mine.find(v => v.name.toLowerCase().startsWith(wanted.split(' - ')[0]) && v.name.toLowerCase().includes('professional'));
  if (own) return (voiceId = own.voice_id);
  const query = encodeURIComponent(config.voiceName.split(' - ')[0]);
  const shared: VoiceRow[] = ((await (await api(`/v1/shared-voices?page_size=100&search=${query}`)).json()) as { voices?: VoiceRow[] }).voices ?? [];
  const found = shared.find(v => v.name.toLowerCase() === wanted);
  if (!found) throw new Error(`No voice named "${config.voiceName}" in the account or the voice library. Close matches: ${shared.slice(0, 8).map(v => v.name).join(', ')}`);
  const added = (await (await api(`/v1/voices/add/${found.public_owner_id}/${found.voice_id}`, { method: 'POST', body: JSON.stringify({ new_name: found.name }) })).json()) as { voice_id: string };
  console.log(`Added "${found.name}" to the account's voices.`);
  return (voiceId = added.voice_id);
}

/** A spoken text's clip, made once and kept in the cache; `dry` makes a quiet tone as long as the line takes at 150 words a minute. */
export async function clip(spoken: string, { dry = false, log = true } = {}): Promise<string> {
  const file = clipPath(spoken, dry);
  const max = config.maxWordsPerSecond;
  if (existsSync(file)) {
    if (dry || pace(file, spoken) <= max) return file;
    // Made before the ceiling, or at a speed since lowered: made again under it.
    unlinkSync(file);
  }
  mkdirSync(config.cache, { recursive: true });
  if (dry) {
    const length = Math.max(0.8, words(spoken).length * 0.4);
    execFileSync(config.ffmpeg, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `sine=frequency=330:duration=${length}`, '-af', 'volume=0.05', '-c:a', 'libmp3lame', file]);
    return file;
  }
  // The ceiling: a clip faster than it is made again slower, three times at most;
  // a line still too fast at the slowest speed fails, named, to be rewritten.
  let speed = config.settings.speed ?? 1;
  for (let attempt = 0; ; attempt++) {
    const res = await api(`/v1/text-to-speech/${await voice()}?output_format=mp3_44100_128`, {
      method: 'POST',
      body: JSON.stringify({ text: asSent(spoken), model_id: config.model, voice_settings: { ...config.settings, speed } }),
    });
    writeFileSync(`${file}.part`, Buffer.from(await res.arrayBuffer()));
    renameSync(`${file}.part`, file);
    const p = pace(file, spoken);
    if (p <= max) {
      if (log) console.log(`  ${seconds(file).toFixed(1)} s  ${p.toFixed(1)} w/s${speed !== 1 ? ` at speed ${speed}` : ''}  ${asSent(spoken)}`);
      return file;
    }
    const next = slower(p, max, speed);
    if (next >= speed || attempt >= 2) {
      unlinkSync(file);
      throw new Error(`Spoken too fast: ${p.toFixed(2)} words a second at speed ${speed}, the ceiling is ${max}. Give the line a pause or fewer words: "${asSent(spoken)}"`);
    }
    if (log) console.log(`  ${p.toFixed(1)} w/s at speed ${speed}, over ${max}: again at ${next}  ${asSent(spoken)}`);
    speed = next;
  }
}

/** Transcribe a clip with ElevenLabs Scribe: what the voice was heard to say. */
export async function transcribe(file: string): Promise<string> {
  const { readFileSync } = await import('node:fs');
  const form = new FormData();
  form.append('model_id', 'scribe_v1');
  form.append('file', new Blob([readFileSync(file)], { type: 'audio/mpeg' }), 'clip.mp3');
  const res = await fetch(`${config.api}/v1/speech-to-text`, { method: 'POST', headers: { 'xi-api-key': key() ?? '' }, body: form });
  if (!res.ok) throw new Error(`Scribe: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { text: string }).text;
}

export interface Placed { file: string; at: number }

/**
 * Lay the clips over a video's own picture, each at its time (ms), and write
 * the result over the video. Warns about a clip that runs into the next.
 */
export function mix(video: string, clips: Placed[], opts: { crf?: number } = {}) {
  // The last line can outlast the picture (a still screen sends no frames): hold the last frame until it is said.
  const end = Math.max(...clips.map(c => c.at / 1000 + seconds(c.file)));
  const short = end + 0.6 - seconds(video);
  if (short > 0) {
    const held = `${video}.held.mp4`;
    execFileSync(config.ffmpeg, [
      '-y', '-loglevel', 'error', '-i', video, '-vf', `tpad=stop_mode=clone:stop_duration=${short.toFixed(2)}`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(opts.crf ?? 25), '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', held,
    ]);
    renameSync(held, video);
  }
  const length = seconds(video);
  clips.forEach((c, i) => {
    const next = clips[i + 1]?.at ?? length * 1000;
    const over = c.at + seconds(c.file) * 1000 - next;
    if (over > 50) console.warn(`  ${video.split('/').at(-1)}: line ${i + 1} runs ${(over / 1000).toFixed(1)} s into the next.`);
  });
  const filter = clips.map((c, i) => `[${i + 1}:a]adelay=${c.at}|${c.at}[a${i}]`).join(';')
    + `;${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:normalize=0:dropout_transition=0[voice]`;
  const tmp = `${video}.voice.mp4`;
  execFileSync(config.ffmpeg, [
    '-y', '-loglevel', 'error', '-i', video, ...clips.flatMap(c => ['-i', c.file]),
    '-filter_complex', filter, '-map', '0:v', '-map', '[voice]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-t', String(length), '-movflags', '+faststart', tmp,
  ]);
  renameSync(tmp, video);
}

/** Number words a transcript may write as digits. */
const UNITS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES: Record<string, number> = { hundred: 100, thousand: 1000, million: 1000000 };
const isNumberWord = (w: string) => w in UNITS || w in TENS || w in SCALES;

/**
 * Number words folded to one integer, as a transcript writes them: "five
 * thousand, six hundred" and "5,600" both come out "5600", "nineteen" is
 * "19", "a hundred and nine thousand" is "109000". An "and" is part of a
 * number only after a scale word; "a" only before one.
 */
function foldNumbers(ws: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < ws.length; ) {
    const startsOne = ws[i] === 'a' && i + 1 < ws.length && ws[i + 1] in SCALES;
    if (!isNumberWord(ws[i]) && !startsOne) { out.push(ws[i++]); continue; }
    let total = 0, current = startsOne ? 1 : 0, afterScale = false;
    if (startsOne) i++;
    for (; i < ws.length; i++) {
      const w = ws[i];
      if (w === 'and' && afterScale && i + 1 < ws.length && isNumberWord(ws[i + 1])) continue;
      afterScale = false;
      if (w in UNITS) current += UNITS[w];
      else if (w in TENS) current += TENS[w];
      else if (w === 'hundred') { current = (current || 1) * 100; afterScale = true; }
      else if (w in SCALES) { total += (current || 1) * SCALES[w]; current = 0; afterScale = true; }
      else break;
    }
    out.push(String(total + current));
  }
  return out;
}

/**
 * Lower-case words without punctuation, for comparing a transcript with its
 * text: letters spelled out ("C S V") joined as the transcript writes them,
 * numbers as digits ("five thousand, six hundred" and "5,600" both "5600"),
 * "%" as "percent", `undo` rules (a project's respellings written back:
 * "plen-oh-view" → "plenoview") applied first.
 */
export function normalize(text: string, undo: SayRule[] = []): string[] {
  let t = asSent(text).replace(/<break[^>]*\/>/g, ' ').toLowerCase();
  for (const [re, to] of undo) t = t.replace(re, to as string);
  const ws = foldNumbers(t
    .replace(/(\d)%/g, '$1 percent').replace(/(\d),(?=\d{3}\b)/g, '$1').replace(/[’']/g, '').replace(/[^a-z0-9.]+/g, ' ').replace(/\.(?!\d)/g, ' ')
    .split(/\s+/).filter(Boolean));
  const out: string[] = [];
  let spelled = false;
  for (const w of ws) {
    const letter = w.length === 1 && /[a-z]/.test(w) && w !== 'a';
    // A run of single letters is one spelled-out word.
    if (letter && spelled && out.length) out[out.length - 1] += w;
    else out.push(w);
    spelled = letter;
  }
  return out;
}
