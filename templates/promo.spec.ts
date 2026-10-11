import { test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Demo, VIDEO, VIDEO_HD, configure } from 'screenplay-kit';
import { orbit } from 'screenplay-kit/three';
import config from '../../screenplay.config.mjs';

// The sales video: about two minutes, in the tutorials' voice, recorded by
// the tutorials' recorder at full HD. Not a test: skipped unless PROMO=1.
// With ELEVENLABS_API_KEY set the lines are voiced as they are recorded;
// the script goes beside the tutorials' as promo-<name>.*.
//
// The story: the problem everyone recognises → the reveal (an orbit, drawn
// frame by frame) → three or four beats, each one line and one action →
// the offer, held to the end. Claim only what is measured.

const ROOT = resolve(import.meta.dirname, '../..');
const OUT = resolve(ROOT, 'public/promo');
const SCRIPTS = resolve(ROOT, 'docs/demo-scripts');
test.skip(!process.env.PROMO, 'Set PROMO=1 to record public/promo');
// The tutorials' layout, drawn at full HD.
test.use({ viewport: VIDEO, deviceScaleFactor: VIDEO_HD.width / VIDEO.width, colorScheme: 'dark' });
test.describe.configure({ timeout: 1_800_000 });
configure(config.voice);

test('the product in two minutes', async ({ page }) => {
  page.on('dialog', d => void d.accept());
  await Demo.prepare(page, { brand: 'Acme · the tagline' });
  await page.goto('/'); // the app's openApp(…) with its mocks
  const demo = new Demo(page, { output: VIDEO_HD, durationsFile: resolve(SCRIPTS, 'voice.json') });
  await demo.start();

  // The problem: a picture of how it is done today.
  // await demo.picture(`data:image/png;base64,${png.toString('base64')}`);
  await demo.note('How everyone draws it today.', { voice: 'This is how it gets drawn today. Accurate... and nobody can see the whole thing.' });
  await demo.wait(5000);
  await demo.clearNote();
  // await demo.picture(null);

  // The reveal, turned a full circle.
  await demo.note('The whole thing in one view.', { voice: 'The whole thing, in one view.' });
  await orbit(demo, 9);
  await demo.clearNote();

  // A beat: one line, one action. The mechanics are cut; the result shows.
  await demo.note('Pick one and see everything it touches.', { voice: 'Pick any one, and see everything it touches.' });
  demo.rec.pause();
  // …select it off camera…
  demo.rec.resume();
  await demo.click(page.locator('#highlight'), 3000);
  await demo.clearNote();

  // The offer.
  await demo.card('acme.example', 'The tagline', 'A month on the full product. No card.', 5000,
    'Acme. The tagline. A month on the full product, no card. Request access at acme dot example.', { hold: true });
  await demo.save(resolve(OUT, 'acme.mp4'), resolve(SCRIPTS, 'promo-acme'), { title: 'Acme in two minutes', spec: 'tests/e2e/promo.spec.ts', root: ROOT });

  // The poster: a good moment, from the finished video (a screenshot of a heavy scene is slow and goes into the recording).
  const lines = JSON.parse(readFileSync(resolve(SCRIPTS, 'promo-acme.json'), 'utf8')) as { caption: string; start: number; end: number }[];
  const at = lines.find(l => l.caption.startsWith('Pick one'))!;
  execFileSync(process.env.FFMPEG ?? 'ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(at.end - 3), '-i', resolve(OUT, 'acme.mp4'), '-frames:v', '1', '-q:v', '4', '-update', '1', resolve(OUT, 'acme.jpg')]);
});
