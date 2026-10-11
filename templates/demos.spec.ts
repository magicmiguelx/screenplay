import { test, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { Demo, VIDEO, configure } from 'screenplay-kit';
import config from '../../screenplay.config.mjs';
import { TUTORIALS, type TutorialId } from '../../src/ui/tutorials';
// The app's own helpers: open it signed in, with its mocks, in a known state.
// import { openApp } from './helpers';

// The tutorial videos. Not tests: skipped unless DEMOS=1
// (DEMOS=1 npx playwright test demos, or one: -g " 2 · "). Each one drives
// the app the way a person would, with a cursor and captions drawn over it,
// and is encoded with the system's ffmpeg; with ELEVENLABS_API_KEY set,
// each line is voiced as it is recorded and the voice mixed in. Mocked
// services only: no real API calls, no real payments.
//
// What is said is written for the ear: a line's `voice` is its spoken text
// when the caption would read badly aloud (docs/writing-for-the-ear.md in
// the screenplay repository).

const ROOT = resolve(import.meta.dirname, '../..');
const VIDEOS = resolve(ROOT, 'public/guide/video');
const SCRIPTS = resolve(ROOT, 'docs/demo-scripts');
test.skip(!process.env.DEMOS, 'Set DEMOS=1 to record public/guide/video');
test.use({ viewport: VIDEO, colorScheme: 'dark' });
test.describe.configure({ timeout: 1_800_000 });
configure(config.voice);

// The app's strings: the same words on the video's card and in the app.
const strings: Record<string, string> = {
  'tutorials.overview.title': 'What is it?',
  'tutorials.overview.blurb': 'The idea in a minute.',
  'tutorials.start.title': 'Getting started',
  'tutorials.start.blurb': 'Open an example and look around.',
  // …
};
const titleOf = (id: TutorialId) => strings[`tutorials.${id}.title`];
const blurbOf = (id: TutorialId) => strings[`tutorials.${id}.blurb`];
/** Titles that read badly aloud as written. */
const SPOKEN_TITLE: Partial<Record<TutorialId, string>> = {
  // metadata: 'dbt, Open Lineage, and Excel',
};
const place = (id: TutorialId) => {
  const i = TUTORIALS.findIndex(t => t.id === id);
  return { tut: TUTORIALS[i], n: i + 1, next: TUTORIALS[i + 1] };
};
const still = (id: TutorialId) => resolve(VIDEOS, `${place(id).tut.file}.jpg`);

/** The opening card: the tutorial's number, title and what it shows. */
async function intro(demo: Demo, id: TutorialId, voice?: string) {
  await demo.card(`Tutorial · ${place(id).n} of ${TUTORIALS.length}`, titleOf(id), blurbOf(id), 4500, voice);
}

/** The closing card (the next tutorial, or the end), then encode and write the script. */
async function finish(demo: Demo, id: TutorialId) {
  const { tut, n, next } = place(id);
  if (next) await demo.card('Next', titleOf(next.id), blurbOf(next.id), 3000, `Next: ${SPOKEN_TITLE[next.id] ?? titleOf(next.id)}.`, { hold: true });
  else await demo.card('That’s the tour', 'Over to you', 'The user guide covers every feature in detail.', 3600, 'Over to you. The user guide covers every feature in detail.', { hold: true });
  const { length } = await demo.save(resolve(VIDEOS, `${tut.file}.mp4`), resolve(SCRIPTS, tut.file), { title: `${n} · ${titleOf(id)}`, spec: 'tests/e2e/demos.spec.ts', root: ROOT });
  console.log(`${tut.file}: ${length.toFixed(1)} s (card says ${tut.length})`);
}

/** Open the app with the overlay installed; `before` runs off camera (an example loaded, data seeded); then record. */
async function begin(page: Page, before?: () => Promise<unknown>) {
  await Demo.prepare(page, { brand: 'Acme · the tagline' });
  await page.goto('/'); // the app's own openApp(page, …) here: signed in, mocks on, storage clean
  if (before) await before();
  const demo = new Demo(page, { durationsFile: resolve(SCRIPTS, 'voice.json') });
  await demo.start();
  return demo;
}

test('1 · what is it', async ({ page }) => {
  const demo = await begin(page);
  await intro(demo, 'overview', 'What is it? The idea, in a minute.');

  await demo.poster(still('overview'));
  await demo.say('Most diagrams are flat boxes and arrows. This one is not.', { voice: 'Most diagrams are flat boxes and arrows. This one is not.' });
  await demo.note('Click any item to read its properties on the right.', { voice: 'Click any item, to read its properties on the right.' });
  await demo.click(page.locator('#some-control'), 1200);
  await demo.spot(page.locator('#properties'));
  await demo.wait(1500);
  await demo.spot(null);
  await demo.clearNote();

  await finish(demo, 'overview');
});
