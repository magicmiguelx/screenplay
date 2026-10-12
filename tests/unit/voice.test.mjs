import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asSent, configure, clipPath, normalize, saidWords, slower, speakable, words } from '../../dist/voice.js';

test('speakable turns symbols into words', () => {
  assert.equal(speakable('File → Custom node types'), 'File, then Custom node types');
  assert.equal(speakable('✨ Draft it'), 'Draft it');
  assert.equal(speakable('Lock it (K)'), 'Lock it');
  assert.equal(speakable('Ctrl+Shift+F searches; Ctrl+Z undoes'), 'Control Shift F searches; Control Z undoes');
  assert.equal(speakable('Add a stage with +, remove one with ×'), 'Add a stage with plus, remove one with the cross');
  assert.equal(speakable('Accept everything ≥ 80%'), 'Accept everything at least 80 percent');
  assert.equal(speakable('Search, click, name, drag…'), 'Search, click, name, drag...');
});

test('say rules apply to what is sent, and the clip path follows them', () => {
  configure({ say: [[/\bPlenoview\b/g, 'Plen-oh-view'], [/\bSAP\b/g, 'S-A-P']] });
  assert.equal(asSent('Plenoview shows SAP'), 'Plen-oh-view shows S-A-P');
  const a = clipPath('Plenoview shows SAP');
  const b = clipPath('Plen-oh-view shows S-A-P');
  assert.equal(a, b, 'the same sent text is the same clip');
  configure({ say: [] });
  assert.notEqual(clipPath('Plenoview shows SAP'), a, 'a rule change makes a new clip');
});

test('words leaves out break tags', () => {
  assert.deepEqual(words('Today... <break time="0.4s" /> and the Target.'), ['Today...', 'and', 'the', 'Target.']);
});

test('normalize compares a transcript with its text', () => {
  configure({ say: [[/\bPlenoview\b/g, 'Plen-oh-view']] });
  const undo = [[/plen-oh-view/g, 'plenoview'], [/\bplano view\b/g, 'plenoview']];
  assert.deepEqual(normalize('Open the C S V import in Plenoview', undo), ['open', 'the', 'csv', 'import', 'in', 'plenoview']);
  assert.deepEqual(normalize('Accept everything at 80 percent, or more', undo), ['accept', 'everything', 'at', '80', 'percent', 'or', 'more']);
  assert.deepEqual(normalize('A plano view of it', undo), ['a', 'plenoview', 'of', 'it']);
  assert.deepEqual(normalize('twenty pounds’ worth'), ['20', 'pounds', 'worth']);
  configure({ say: [] });
});

test('normalize folds number words as a transcript writes them', () => {
  assert.deepEqual(normalize('Built from nineteen source books. Five thousand, six hundred pages.'), ['built', 'from', '19', 'source', 'books', '5600', 'pages']);
  assert.deepEqual(normalize('Built from 19 source books, 5,600 pages'), ['built', 'from', '19', 'source', 'books', '5600', 'pages']);
  assert.deepEqual(normalize('A hundred and nine thousand builds'), ['109000', 'builds']);
  assert.deepEqual(normalize('109,311 builds, two dollars a month'), ['109311', 'builds', '2', 'dollars', 'a', 'month']);
  assert.deepEqual(normalize('feats, and monsters; one and two'), ['feats', 'and', 'monsters', '1', 'and', '2']);
});

test('the speed limit: a faster clip is made again slower, within the voice\'s range', () => {
  // 4.4 words a second at speed 1, ceiling 3: aim just under, 0.65 clamps to 0.7.
  assert.equal(slower(4.4, 3, 1), 0.7);
  // 3.3 at speed 1: 0.87.
  assert.equal(slower(3.3, 3, 1), 0.87);
  // Already under: no faster than it was (the caller stops when next >= speed).
  assert.ok(slower(2.8, 3, 1) >= 1);
  // A second pass from a lowered speed goes lower still.
  assert.ok(slower(3.2, 3, 0.87) < 0.87);
});

test('the words that are said leave out a bare pause', () => {
  assert.deepEqual(saidWords('Describe it... and the assistant drafts the form.'), ['Describe', 'it...', 'and', 'the', 'assistant', 'drafts', 'the', 'form.']);
  assert.equal(saidWords('Six players. — Forty tabs. ...').length, 4);
});
