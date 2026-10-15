import { test } from 'node:test';
import assert from 'node:assert/strict';
import { choosePlacement } from '../../dist/place.js';

test('a caption goes where it covers the least, the bottom on a near tie', () => {
  assert.equal(choosePlacement({ bottom: 0.6, top: 0.1 }), 'top');
  assert.equal(choosePlacement({ bottom: 0.2, top: 0.15 }), 'bottom');
  assert.equal(choosePlacement({ bottom: 0, top: 0 }), 'bottom');
  // Over the element the line acts on (cover + 1) loses to any plain cover.
  assert.equal(choosePlacement({ bottom: 1.3, top: 0.9 }), 'top');
});

test('a position the line asks for is taken whatever it covers', () => {
  assert.equal(choosePlacement({ bottom: 0, top: 0.9 }, 'top'), 'top');
  assert.equal(choosePlacement({ bottom: 0.9, top: 0 }, 'bottom'), 'bottom');
});

test('a corner only when both centred positions are busy and the corner clearly less so', () => {
  const busy = { bottom: 0.7, top: 0.65, 'bottom-left': 0.1, 'bottom-right': 0.05, 'top-left': 0, 'top-right': 0.3 };
  // Corners off (no threshold): the centred positions only, as before.
  assert.equal(choosePlacement(busy), 'bottom');
  // Corners on: the emptiest corner, ties to the earlier in the order (bottom first).
  assert.equal(choosePlacement(busy, 'auto', { corners: 0.5 }), 'top-left');
  assert.equal(choosePlacement({ ...busy, 'top-left': 0.1 }, 'auto', { corners: 0.5 }), 'bottom-left');
  // A centred position under the threshold is kept, whatever the corners.
  assert.equal(choosePlacement({ ...busy, bottom: 0.4 }, 'auto', { corners: 0.5 }), 'bottom');
  // A corner no clearer than the centre (within the margin) leaves the caption centred.
  assert.equal(choosePlacement({ bottom: 0.7, top: 0.7, 'bottom-left': 0.65 }, 'auto', { corners: 0.5 }), 'bottom');
  // Over the element the line acts on (cover + 1) in the middle, a clear corner wins.
  assert.equal(choosePlacement({ bottom: 1.2, top: 1.4, 'bottom-right': 0.2 }, 'auto', { corners: 0.5 }), 'bottom-right');
  // Asked for, a position is taken.
  assert.equal(choosePlacement(busy, 'bottom', { corners: 0.5 }), 'bottom');
});
