import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inViewShare, TALL } from '../../dist/view.js';

const viewport = { width: 1440, height: 810 };
const at = (y, height, hit = 1, width = 400) => {
  const top = Math.max(0, y), bottom = Math.min(viewport.height, y + height);
  return { box: { x: 100, y, width, height }, viewport, inside: Math.max(0, bottom - top) * width, hit };
};

test('an element wholly in the picture is all in view', () => {
  assert.equal(inViewShare(at(200, 100)), 1);
});

test('an element cut at the bottom edge is the share of it above the edge', () => {
  assert.equal(inViewShare(at(760, 100)), 0.5);
  assert.equal(inViewShare(at(900, 100)), 0);
});

test('a part under the page\'s own layer (a sticky header) is not seen', () => {
  assert.equal(inViewShare(at(200, 100, 0.75)), 0.75);
});

test('a subject taller than the frame is in view once it fills three quarters of it', () => {
  // 2000 px tall, from the top of the frame down: fills the whole frame.
  assert.equal(inViewShare(at(0, 2000)), 1);
  // Its top at the bottom third: a third of the frame, under the three quarters asked for.
  const s = inViewShare(at(540, 2000));
  assert.ok(Math.abs(s - 270 / (810 * TALL)) < 1e-9);
});

test('an element with no box is not in view', () => {
  assert.equal(inViewShare({ box: { x: 0, y: 0, width: 0, height: 0 }, viewport, inside: 0, hit: 0 }), 0);
});
