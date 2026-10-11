import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Timeline, FRAME } from '../../dist/timeline.js';

const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ''} ${a} ≠ ${b}`);

test('frames follow each other by their wall-clock gaps', () => {
  const t = new Timeline();
  t.add('a', 100.0);
  t.add('b', 100.4);
  t.add('c', 101.0);
  close(t.frames[0].video, 0); close(t.frames[1].video, 0.4); close(t.frames[2].video, 1.0);
  close(t.videoTime(100.2), 0.2, 'inside the first frame');
  close(t.videoTime(100.7), 0.7, 'inside the second');
  close(t.videoTime(99), 0, 'before the first frame');
});

test('a cut keeps the still before it as long as it lasted, then jumps', () => {
  const t = new Timeline();
  t.add('a', 100.0);
  t.add('b', 100.5);
  t.cut(101.0);          // paused at 101: the still (b) was shown 0.5 s
  t.add('c', 110.0);     // resumed much later
  close(t.frames[2].video, 1.0, 'c starts after the 0.5 s still');
  close(t.videoTime(100.8), 0.8, 'a moment before the cut is where it was');
  close(t.videoTime(105.0), 1.0, 'a moment in the pause lands on the cut');
  close(t.videoTime(110.3), 1.3, 'a moment after resume is on the new frames');
});

test('the voice stays on the picture across a cut (the drift the first recorder had)', () => {
  // A line logged at 103.0, after a 2 s cut: the wall clock minus the pause
  // would put it at 1.0; the frames put it where the picture is.
  const t = new Timeline();
  t.add('a', 100.0);
  t.add('b', 100.9);
  t.cut(101.0);
  t.add('c', 103.0);
  t.add('d', 103.5);
  close(t.videoTime(103.0), 1.0, 'the line starts with frame c');
  close(t.videoTime(103.4), 1.4);
});

test('a cut shorter than a frame still steps a frame', () => {
  const t = new Timeline();
  t.add('a', 100.0);
  t.cut(100.001);
  t.add('b', 105.0);
  close(t.frames[1].video, FRAME);
});

test('a frame drawn by hand lasts what it was given', () => {
  const t = new Timeline();
  t.add('a', 100.0);
  t.cut(100.5);
  t.add('o1', 100.5, 1 / 30);
  t.add('o2', 100.5, 1 / 30);
  t.add('b', 120.0);
  close(t.frames[1].video, 0.5, 'the first drawn frame follows the still');
  close(t.frames[2].video, 0.5 + 1 / 30);
  close(t.frames[3].video, 0.5 + 2 / 30, 'the screencast resumes after the drawn frames');
  close(t.videoTime(110), 0.5 + 2 / 30, 'a moment in the pause lands after the drawn frames');
});

test('durations and the concat list hold the last frame to the end plus the tail', () => {
  const t = new Timeline();
  t.add('/f/a.jpg', 100.0);
  t.add('/f/b.jpg', 100.5);
  const d = t.durations(3.0, 0.6);
  assert.deepEqual(d.map(x => Math.round(x * 1000) / 1000), [0.5, 3.1]);
  const list = t.concatList(3.0, 0.6).split('\n');
  assert.equal(list[0], 'ffconcat version 1.0');
  assert.equal(list.at(-1), "file '/f/b.jpg'", 'the last file again, so its duration counts');
  assert.ok(list.includes('duration 3.1000'));
});

test('reset forgets the warm-up frames', () => {
  const t = new Timeline();
  t.add('warm', 100.0);
  t.reset();
  t.add('a', 102.0);
  close(t.frames[0].video, 0);
  close(t.videoTime(102.5), 0.5);
});
