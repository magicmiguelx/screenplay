// The Plenoview landing-page film, as recorded on 2026-10-11
// (tests/e2e/promo.spec.ts in github.com/magicmiguelx/plenoview, the test
// "Plenoview in 20 seconds"), with its imports pointed at the kit. It will
// not run here: `openApp`, `example` and the fixtures are that project's.
// Read it for the shape of a twenty-second film, and for how a heavy scene
// is recorded:
//
// - the sales arc cut to its bones: a hook (the flat diagram, three
//   seconds) → the reveal (the estate turned in 3D) → two beats, one line
//   and one moving picture each (a lit path; Today, then the Target) → the
//   offer, held to the end; five lines of three to nine words;
// - the hook is in the first frame: the picture goes up before `start()`;
// - every frame is drawn by hand (`still()`, `orbit()`), every line is set
//   while the screencast is paused, so it is spoken as the frames under it
//   start: the lit scene screencasts at under a frame a second in software,
//   and the first take of this film, off the screencast, ran 39 seconds;
// - every mechanic (full screen, selecting, the highlight, the timeline
//   chips) is off camera; what shows is the result, moving;
// - the timeline played is shown as before and after, each drawn: the
//   screencast would have caught no more of the morph.
//
import { test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openApp, nodeScreenPos } from './helpers';
import { Demo, VIDEO, VIDEO_HD } from 'screenplay-kit';
import { orbit } from 'screenplay-kit/three';
import { FUNDED, estatePicture } from './demoFixtures';

const OUT = resolve(import.meta.dirname, '../../public/promo');
const SCRIPTS = resolve(import.meta.dirname, '../../docs/demo-scripts');
test.skip(!process.env.PROMO, 'Set PROMO=1 to record public/promo');
test.use({ viewport: VIDEO, deviceScaleFactor: VIDEO_HD.width / VIDEO.width, colorScheme: 'dark' });
test.describe.configure({ timeout: 1_800_000 });

const menu = (page: Page, name: 'file' | 'export' | 'view' | 'help') => page.locator(`#toolbar .${name}-menu .menu-button`);

/** The SAP + Fabric example, loaded off camera. */
async function example(page: Page, id: string) {
  await menu(page, 'file').click();
  await page.locator(`#toolbar [data-example="${id}"]`).click();
  await page.waitForTimeout(2500);
}

test('Plenoview in 20 seconds', async ({ page }) => {
  page.on('dialog', d => void d.accept());
  const png = await estatePicture(page);
  await Demo.prepare(page);
  await openApp(page, undefined, { me: FUNDED });
  await example(page, 'sap-fabric');
  const demo = new Demo(page, { output: VIDEO_HD, durationsFile: resolve(SCRIPTS, 'voice.json') });
  // The hook is up before the first frame: the film opens on the flat diagram, not on the editor.
  await demo.picture(`data:image/png;base64,${png.toString('base64')}`);
  await demo.wait(600);
  await demo.start();
  demo.rec.pause();
  // Nothing is clicked on camera: the cursor is parked in a corner for the whole film.
  await demo.moveTo(VIDEO.width - 24, VIDEO.height - 24, 0);

  // The hook: the flat diagram everyone draws.
  await demo.note('Boxes and arrows. One platform at a time.', { voice: 'Boxes and arrows. One platform at a time.' });
  await demo.still(2.8);
  demo.rec.pause();
  await demo.clearNote();
  await demo.picture(null);

  // The reveal: full screen, the whole estate turned in 3D.
  await page.keyboard.press('f');
  await demo.wait(2500);
  await demo.note('The whole estate, in one 3D view.', { voice: 'Plenoview shows the whole estate... in one 3D view.' });
  await orbit(demo, 4.5, { fps: 20 });
  demo.rec.pause();
  await demo.clearNote();

  // A beat: a path lit across platforms (selected and lit off camera), drifting.
  await page.keyboard.press('Escape');
  await demo.wait(1200);
  await demo.clickSettled(() => nodeScreenPos(page, 'SAP S/4HANA'), 400);
  await page.locator('#properties .highlight-modes button[data-mode="downstream"]').click();
  // The off-camera click moved the cursor to the node: park it again.
  await demo.moveTo(VIDEO.width - 24, VIDEO.height - 24, 0);
  await demo.wait(3000);
  await demo.note('Pick a system. See everything it feeds.', { voice: 'Pick any system... and see everything it feeds.' });
  await orbit(demo, 2.8, { turns: 0.08, fps: 20 });
  demo.rec.pause();
  await demo.clearNote();

  // A beat: Today, then the Target, from the timeline.
  await page.locator('#properties .highlight-modes button[data-mode="off"]').click();
  await page.keyboard.press('Escape');
  await page.locator('.timeline-chips .chip').nth(0).locator('.chip-main').click();
  await demo.wait(2000);
  await demo.note('Today…', { top: true, voice: 'Today...' });
  await orbit(demo, 1.3, { turns: 0.04, fps: 20 });
  demo.rec.pause();
  await page.locator('.timeline-chips .chip').nth(1).locator('.chip-main').click();
  await demo.wait(2000);
  await demo.note('…and the Target.', { top: true, voice: '...and the Target.' });
  await orbit(demo, 1.6, { turns: 0.04, fps: 20 });
  demo.rec.pause();
  await demo.clearNote();

  // The offer, held to the end.
  await demo.card('plenoview.com', 'See the whole estate in one picture', 'A month on the full product. No card.', 0,
    'Plenoview. See the whole estate, in one picture. A month free, at plenoview dot com.', { hold: true });
  await demo.still(5);
  await demo.save(resolve(OUT, 'plenoview-20.mp4'), resolve(SCRIPTS, 'promo-plenoview-20'), { title: 'Plenoview in 20 seconds', spec: 'tests/e2e/promo.spec.ts', root: resolve(import.meta.dirname, '../..') });
  // The poster: the lit path, from the finished video.
  const lines = JSON.parse(readFileSync(resolve(SCRIPTS, 'promo-plenoview-20.json'), 'utf8')) as { caption: string; start: number; end: number }[];
  const lit = lines.find(l => l.caption.startsWith('Pick a system'))!;
  execFileSync(process.env.FFMPEG ?? 'ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(lit.end - 1), '-i', resolve(OUT, 'plenoview-20.mp4'), '-frames:v', '1', '-q:v', '4', '-update', '1', resolve(OUT, 'plenoview-20.jpg')]);
});
