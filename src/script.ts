import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import { words } from './voice.js';

// The voice-over script of a video, written beside it: the captions as
// WebVTT (what voice-over and dubbing tools import), a .json with each
// line's times, caption and spoken text (what the voiceover CLI reads to
// re-mix without recording), and a Markdown table of the same for people.

/** One line of the script: a title card or a caption, what is spoken, and its span in the video (seconds). */
export interface ScriptLine { kind: 'card' | 'caption'; text: string; voice: string; start: number; end: number }

/** 83.5 s → "01:23.500" (WebVTT) */
export const vttTime = (t: number) => {
  const ms = Math.round(t * 1000);
  const m = Math.floor(ms / 60000), sec = Math.floor((ms % 60000) / 1000), rest = ms % 1000;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(rest).padStart(3, '0')}`;
};

/** 83.5 s → "1:23.5" */
export const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

/** 83.5 s → "1:24", as a card shows a video's length. */
export const cardLength = (t: number) => { const s = Math.round(t); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export interface ScriptInfo {
  /** The video's title, the .md's heading. */
  title: string;
  /** The video file, named in the .md relative to `root`. */
  video: string;
  /** The spec that wrote it, named in the .md. */
  spec: string;
  /** The project root the .md's paths are relative to. */
  root: string;
  /** The video's length (seconds). */
  length: number;
  /** Each spoken text's length (seconds), for the Voice column. */
  spoken: Record<string, number>;
}

export const vtt = (lines: ScriptLine[]) => ['WEBVTT', '', ...lines.flatMap((l, i) => [
  String(i + 1), `${vttTime(l.start)} --> ${vttTime(l.end)}`, l.text, '',
])].join('\n');

export const json = (lines: ScriptLine[]) => JSON.stringify(lines.map(l => ({
  kind: l.kind, start: Math.round(l.start * 1000) / 1000, end: Math.round(l.end * 1000) / 1000, caption: l.text, voice: l.voice,
})), null, 2) + '\n';

export function markdown(lines: ScriptLine[], info: ScriptInfo) {
  const cell = (t: string) => t.replace(/\|/g, '\\|').replace(/</g, '&lt;');
  return [
    `# ${info.title}: voice-over script`,
    '',
    `Video: \`${relative(info.root, info.video)}\` (${clock(info.length)}). Written by \`${info.spec}\` with the`,
    'video: re-recording rewrites it. Times are from the start of the video; "Room" is how long the line is',
    'on screen, "Voice" how long it takes spoken. "Spoken" is the text sent to the voice when it differs',
    'from the caption: punctuation for its pauses, words placed so the voice reads them the right way.',
    'The captions, timed, are in the `.vtt` file beside this one; the `.json` has both.',
    '',
    '| # | Start | Room | Voice | Words | Caption | Spoken |',
    '| -: | -: | -: | -: | -: | --- | --- |',
    ...lines.map((l, i) => {
      const caption = l.kind === 'card' ? `**${cell(l.text)}**` : cell(l.text);
      const spoken = l.voice && l.voice !== l.text ? cell(l.voice) : '';
      const voice = info.spoken[l.voice] ? `${info.spoken[l.voice].toFixed(1)} s` : '';
      return `| ${i + 1} | ${clock(l.start)} | ${(l.end - l.start).toFixed(1)} s | ${voice} | ${words(l.voice || l.text).length} | ${caption} | ${spoken} |`;
    }),
    '',
  ].join('\n');
}

/** Write `base`.vtt, `base`.json and `base`.md. */
export function writeScript(base: string, lines: ScriptLine[], info: ScriptInfo) {
  mkdirSync(dirname(base), { recursive: true });
  writeFileSync(`${base}.vtt`, vtt(lines));
  writeFileSync(`${base}.json`, json(lines));
  writeFileSync(`${base}.md`, markdown(lines, info));
}
