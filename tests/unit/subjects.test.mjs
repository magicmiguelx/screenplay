import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Subjects } from '../../dist/subjects.js';

// The bookkeeping behind the "Seen" column: which line a measurement of an
// element belongs to. Targets are strings here; the driver's are locators.

const make = (opts = {}) => {
  const logged = [];
  const s = new Subjects({ note: 0.95, grace: 1500, log: m => logged.push(m), ...opts });
  return { s, logged };
};
const line = text => ({ text });

test('a line keeps the least share of its subjects, and which subject that was', () => {
  const { s, logged } = make();
  const l = line('The table and its filter.');
  s.record(l, 1, '#table', 'about');
  s.record(l, 0.6, '#filter', 'about');
  s.record(l, 0.8, '#spot', 'in the spotlight');
  assert.equal(l.seen, 0.6);
  assert.equal(l.subject, 'about: #filter');
  assert.deepEqual(logged, ['  subject 60% in view (about: #filter): The table and its filter.', '  subject 80% in view (in the spotlight: #spot): The table and its filter.']);
});

test('under the least share allowed the take fails, the line and the subject named', () => {
  const { s } = make({ min: 0.9 });
  assert.throws(() => s.record(line('Then the button far below.'), 0, '#far', 'acted on next'),
    /Subject out of the picture: 0% of it in view \(acted on next: #far\), under 0\.9, while the line was up: "Then the button far below\."/);
});

test('a line said in full and then acted on has the action\'s element measured for it', () => {
  const { s } = make();
  const l = line('Then the button far below.');
  s.waitFor(l, 1000, true);
  const measured = s.acting(1000 + 1800, false);
  assert.equal(measured, l);
  s.acted(l, 0.2, '#far', { spotlight: false, open: l });
  assert.equal(l.seen, 0.2);
  assert.equal(l.subject, 'acted on next: #far');
  // Only the first action counts.
  assert.equal(s.acting(5000, false), null);
});

test('an action straight after its line is the cursor going to it: not measured', () => {
  const { s } = make();
  const l = line('Add one counts up.');
  s.waitFor(l, 1000, true);
  assert.equal(s.acting(1000 + 400, false), null);
  assert.equal(l.seen, undefined);
});

test('nothing waits for an action: a line with an about, a picture card, a card, a cut to a new picture', () => {
  const { s } = make();
  const l = line('The box below.');
  s.waitFor(l, 0, false);
  assert.equal(s.acting(9000, false), null, 'a line with its own about');
  s.waitFor(l, 0, true);
  assert.equal(s.acting(9000, true), null, 'an element on another page, or under a picture card');
  s.waitFor(l, 0, true);
  s.drop();
  assert.equal(s.acting(9000, false), null, 'a card went up');
  s.waitFor(l, 0, true);
  s.resumed(null);
  assert.equal(s.acting(9000, false), null, 'a cut after the line ended');
  s.waitFor(l, 0, true);
  s.resumed(l);
  assert.equal(s.acting(9000, false), l, 'a cut while the line is still up keeps it waiting');
});

test('spot, then say: a spotlight after a line ended belongs to the next line that uses it', () => {
  const { s } = make();
  const before = line('The top of the page.');
  const next = line('Far below, lit.');
  s.waitFor(before, 0, true);
  const l = s.acting(2000, false);
  assert.equal(l, before);
  // The spotlight goes up after the line before ended (no line open): held.
  s.acted(before, 0, '#far', { spotlight: true, open: null });
  assert.equal(before.seen, undefined);
  // The next line goes up with that spotlight still on: it was this line's setup.
  s.shown('#far');
  s.commit();
  assert.equal(before.seen, undefined, 'never charged to the line before');
  assert.equal(next.seen, undefined);
});

test('a spotlight after a line, with the next line about something else, was the line before\'s subject', () => {
  const { s } = make();
  const before = line('The top of the page.');
  s.waitFor(before, 0, true);
  s.acted(s.acting(2000, false), 0.3, '#far', { spotlight: true, open: null });
  s.shown(null);
  assert.equal(before.seen, 0.3);
  assert.equal(before.subject, 'spotlit next: #far');
});

test('a held spotlight is settled by the next action, a card or the end', () => {
  for (const settle of [s => s.acting(0, false), s => s.commit()]) {
    const { s } = make();
    const before = line('The top of the page.');
    s.waitFor(before, 0, true);
    s.acted(s.acting(2000, false), 0.5, '#far', { spotlight: true, open: null });
    settle(s);
    assert.equal(before.seen, 0.5);
  }
});

test('a spotlight under the line that is still up is measured for it at once', () => {
  const { s } = make();
  const l = line('This one.');
  s.waitFor(l, 0, true);
  s.acted(s.acting(2000, false), 0.7, '#one', { spotlight: true, open: l });
  assert.equal(l.seen, 0.7);
  assert.equal(l.subject, 'acted on next: #one');
});
