#!/usr/bin/env node
// The voice against the picture (docs/quality-check.md, section 4): for
// every video with a script, the moment its first and its last title card
// are fully in the picture, against the moment their lines start.
//
//   node check-cards.mjs <scripts dir> <videos dir> [<videos dir>…] [name]
//
// A script's video is <dir>/<name>.mp4 in the first dir that has it, else
// the name without its first segment ("promo-plenoview" → plenoview.mp4,
// for a series kept in one folder and the promos in another). A name (or
// part of one) as the last argument checks that video alone.
//
// A card fades in over about half a second: a run of frames each of which
// differs from the one before (ffmpeg's signalstats, the mean luminance
// difference YDIF above 0.8), and the card is in when the run ends. Scene
// detection (`select='gt(scene,0.4)'`) misses the fade, since no single
// frame of it is a cut. The opening card is the first run after the first
// frame (a line at 0.0 s is a hook drawn into the first frame: no fade);
// the closing card is the last run that ends by its line's start, plus
// the two frames `painted()` waits. The line should start within half a
// second of the card; a minus (the voice before the card) is the frame's
// content lagging its timestamp on a heavy scene, up to about 0.25 s.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [scripts, ...rest] = process.argv.slice(2);
if (!scripts || !rest.length) {
  console.error('Usage: node check-cards.mjs <scripts dir> <videos dir> [<videos dir>…] [name]');
  process.exit(1);
}
const dirs = rest.filter(d => existsSync(d) && readdirSync(d).some(f => f.endsWith('.mp4')));
const only = rest.length > dirs.length ? rest.at(-1) : '';
const videoOf = name => {
  for (const d of dirs) for (const n of [name, name.replace(/^[^-]+-/, '')]) if (existsSync(join(d, `${n}.mp4`))) return join(d, `${n}.mp4`);
  return null;
};
const names = readdirSync(scripts).filter(f => f.endsWith('.json') && f !== 'voice.json').map(f => f.slice(0, -5)).filter(n => !only || n.includes(only));
const ffmpeg = process.env.FFMPEG ?? 'ffmpeg', ffprobe = process.env.FFPROBE ?? 'ffprobe';
const seconds = f => Number(execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
const tmp = mkdtempSync(join(tmpdir(), 'cards-'));
const FRAME = 1 / 30;

/** [time, YDIF] for each frame in [from, from + len]. */
function diffs(file, from, len) {
  const out = join(tmp, 'm.txt');
  from = Math.max(0, from);
  execFileSync(ffmpeg, ['-v', 'error', '-y', '-ss', String(from), '-t', String(len), '-i', file, '-vf', `signalstats,metadata=print:key=lavfi.signalstats.YDIF:file=${out}`, '-f', 'null', '-']);
  return [...readFileSync(out, 'utf8').matchAll(/pts_time:([0-9.]+)[\s\S]*?YDIF=([0-9.e-]+)/g)].map(m => [from + Number(m[1]), Number(m[2])]);
}
/** Runs of change, [start, end]: consecutive frames with YDIF over `thr`, gaps of up to `gap` seconds bridged. */
function runs(rows, thr = 0.8, gap = 0.1) {
  const out = [];
  for (const [t, d] of rows) {
    if (d <= thr) continue;
    const last = out.at(-1);
    if (last && t - last[1] <= gap + 0.001) last[1] = t; else out.push([t, t]);
  }
  return out;
}
const fmt = v => (Number.isNaN(v) ? '  ?  ' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}${Math.abs(v) > 0.5 ? ' !!' : ''}`);
let worst = 0, flagged = 0;
for (const name of names) {
  const file = videoOf(name);
  if (!file) { console.log(`${name}: no video`); continue; }
  const lines = JSON.parse(readFileSync(join(scripts, `${name}.json`), 'utf8'));
  if (!lines.length) continue;
  const first = lines[0], last = lines.at(-1);
  // The first run after the first frame that could be the card: the voice is never more than half a second after it.
  const open = runs(diffs(file, 0, first.start + 2)).filter(r => r[0] > 0.05 && r[1] >= first.start - 0.6 && r[0] <= first.start + 1);
  const openAt = first.start < 0.1 ? 0 : open.length ? open[0][1] + FRAME : NaN;
  const close = runs(diffs(file, last.start - 4, 5.5)).filter(r => r[1] <= last.start + 0.3);
  const closeAt = close.length ? close.at(-1)[1] + FRAME : NaN;
  const dOpen = first.start - openAt, dClose = last.start - closeAt;
  for (const d of [dOpen, dClose]) {
    if (Number.isNaN(d)) continue;
    worst = Math.max(worst, Math.abs(d));
    if (Math.abs(d) > 0.5) flagged++;
  }
  console.log(`${name.padEnd(30)} ${seconds(file).toFixed(1).padStart(6)} s  first card ${openAt.toFixed(2).padStart(5)}  voice ${first.start.toFixed(2).padStart(5)}  ${fmt(dOpen).padEnd(8)}  last card ${closeAt.toFixed(2).padStart(6)}  voice ${last.start.toFixed(2).padStart(6)}  ${fmt(dClose)}`);
}
console.log(`${names.length} videos; the voice starts up to ${worst.toFixed(2)} s from its card${flagged ? `; ${flagged} ends more than half a second out (!!)` : ' (every end within half a second)'}. A minus is the voice before the card.`);
