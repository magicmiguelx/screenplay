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
