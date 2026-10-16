import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, SLOWEST, asSent, configure, clipPath, diffWords, nextSpeed, normalize, saidWords, slower, speakable, withoutTags, words } from '../../dist/voice.js';

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

test('a bare plus or cross is a word wherever it stands; a cross between numbers is "by"', () => {
  assert.equal(speakable('Press + to add'), 'Press plus to add');
  assert.equal(speakable('Add one (+) or two'), 'Add one (+) or two');
  assert.equal(speakable('Close it with ×.'), 'Close it with the cross.');
  assert.equal(speakable('Export at 1920 × 1080'), 'Export at 1920 by 1080');
  assert.equal(speakable('C++ and a+b'), 'C++ and a+b');
});

test('the clip path follows the voice settings, and settings left at the defaults keep the old path', () => {
  configure({});
  const plain = clipPath('Click any item.');
  configure({ settings: { ...DEFAULTS.settings } });
  assert.equal(clipPath('Click any item.'), plain, 'the defaults, given or not, are the same clip');
  configure({ settings: { ...DEFAULTS.settings, speed: 1 } });
  assert.equal(clipPath('Click any item.'), plain, 'speed 1 is the voice\'s own pace');
  configure({ settings: { ...DEFAULTS.settings, stability: 0.3 } });
  assert.notEqual(clipPath('Click any item.'), plain, 'a change of stability is a new clip');
  configure({ settings: { ...DEFAULTS.settings, speed: 0.9 } });
  assert.notEqual(clipPath('Click any item.'), plain, 'a change of speed is a new clip');
  configure({ voiceId: 'abc123' });
  assert.notEqual(clipPath('Click any item.'), plain, 'a voice named by id is its own voice');
  configure({});
});

test('the check compares in order: a word left out, a word added, a word heard once of two', () => {
  const n = t => normalize(t);
  assert.deepEqual(diffWords(n('Click any item to read it'), n('Click any item to read it.')), { missing: [], extra: [] });
  assert.deepEqual(diffWords(n('Present the tour'), n('Present tour')), { missing: ['the'], extra: [] });
  assert.deepEqual(diffWords(n('Open the AI button'), n('Open the OpenAI button')), { missing: ['ai'], extra: ['openai'] });
  assert.deepEqual(diffWords(n('the menu and the map'), n('the menu and map')), { missing: ['the'], extra: [] });
  assert.deepEqual(diffWords(n('Click save'), n('Click save now please')), { missing: [], extra: ['now', 'please'] });
  assert.deepEqual(diffWords([], n('hello')), { missing: [], extra: ['hello'] });
});

test('sound tags are not what was said', () => {
  assert.equal(withoutTags('[outro jingle] Thanks for watching (music)'), 'Thanks for watching');
  assert.equal(withoutTags('[upbeat music]'), '');
});

test('a clip over the ceiling is made again slower until the slowest speed, not three tries', () => {
  // Plenoview's lines: 3.03 words a second at 0.77 had 0.7 still to try.
  assert.equal(nextSpeed(3.03, 3, 0.77, 2), 0.73);
  assert.ok(nextSpeed(3.02, 3, 0.74, 2) <= 0.71);
  // At the slowest speed, or under the ceiling, or out of tries: nothing left.
  assert.equal(nextSpeed(3.5, 3, SLOWEST, 1), null);
  assert.equal(nextSpeed(2.9, 3, 1, 0), null);
  assert.equal(nextSpeed(3.5, 3, 0.9, 5), null);
});
