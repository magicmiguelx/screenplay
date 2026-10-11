import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardLength, clock, markdown, vtt, vttTime } from '../../dist/script.js';

const lines = [
  { kind: 'card', text: 'What is it? The idea in a minute.', voice: 'What is it? The idea, in a minute.', start: 1.1, end: 8.6 },
  { kind: 'caption', text: 'Press ? | for help', voice: 'Press the question mark key, for help', start: 12.05, end: 19.0 },
];

test('times are formatted for WebVTT, the table and the cards', () => {
  assert.equal(vttTime(83.5), '01:23.500');
  assert.equal(vttTime(0.0004), '00:00.000');
  assert.equal(clock(83.5), '1:23.5');
  assert.equal(cardLength(103.1), '1:43');
  assert.equal(cardLength(119.6), '2:00');
});

test('the vtt has a numbered cue per line', () => {
  const out = vtt(lines).split('\n');
  assert.equal(out[0], 'WEBVTT');
  assert.ok(out.includes('00:01.100 --> 00:08.600'));
  assert.ok(out.includes('Press ? | for help'));
});

test('the markdown table escapes pipes and shows the spoken text only when it differs', () => {
  const md = markdown(lines, { title: 'Test', video: '/p/out/v.mp4', spec: 'tests/x.spec.ts', root: '/p', length: 19.0, spoken: { 'What is it? The idea, in a minute.': 6.2 } });
  assert.ok(md.startsWith('# Test: voice-over script'));
  assert.ok(md.includes('`out/v.mp4` (0:19.0)'));
  assert.ok(md.includes('| 1 | 0:01.1 | 7.5 s | 6.2 s | 8 | **What is it? The idea in a minute.** | What is it? The idea, in a minute. |'));
  assert.ok(md.includes('Press ? \\| for help'));
});
