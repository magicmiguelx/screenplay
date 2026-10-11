// The Plenoview hero's cut, a minute, as recorded on 2026-10-11
// (tests/e2e/promo.spec.ts in github.com/magicmiguelx/plenoview, the test
// "Plenoview in a minute"), with its imports pointed at the kit. It will not
// run here: `openApp`, `mockClaude`, `example` and the fixtures are that
// project's. Read it beside plenoview-promo.spec.ts (two minutes, for
// outbound) and plenoview-promo-20.spec.ts (twenty seconds, for social):
// three cuts from one spec, the beats the same functions with fewer lines.
//
// - the sales arc at the length a landing hero wants: the problem, the
//   reveal, six beats of one line and one picture, the offer; no proof
//   beat, since the product has nothing measured to claim yet;
// - drawn frame by frame like the film: orbits where the picture should
//   move, stills where it should not (a tour step, a review table, a menu
//   open), every line set while paused, every mechanic off camera;
// - the view a result opens in is not the view to film it in: the draft
//   applied as a new diagram opens in the Front view, so it is turned to
//   3D off camera before it drifts;
// - a caption goes to the top when the bottom of the screen is what the
//   line is about (the timeline, the review table).
//
import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openApp, nodeScreenPos } from './helpers';
import { Demo, VIDEO, VIDEO_HD } from 'screenplay-kit';
import { orbit } from 'screenplay-kit/three';
import { AI_WAIT, mockClaude } from './aiMock';
import { FUNDED, PICTURE_DRAFT, estatePicture, slidePicture } from './demoFixtures';

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

// The hero's cut: a minute. The sales video's arc (the problem, the reveal,
// the beats, the offer) at the length a landing page's hero wants, between
// the two-minute sales piece and the twenty-second film: problem →
// solution (six beats, one line and one picture each) → the offer. Drawn
// frame by frame like the film, with the lines set while paused: orbits
// where the picture should move, stills where it should not, and every
// mechanic off camera. No proof beat yet: the product has nothing measured
// to claim, so the whiteboard turned into a plenoview stands in for it.
test('Plenoview in a minute', async ({ page }) => {
  page.on('dialog', d => void d.accept());
  const png = await estatePicture(page);
  const slide = await slidePicture(page); // the migration explained as bullet points, drawn in a page
  await Demo.prepare(page);
  await openApp(page, undefined, { me: FUNDED });
  await mockClaude(page, {
    hosted: true,
    delayMs: kind => (kind === 'draft' ? 1800 : 400),
    answer: kind => (kind === 'draft' ? PICTURE_DRAFT : undefined),
  });
  await example(page, 'sap-fabric');
  const demo = new Demo(page, { output: VIDEO_HD, durationsFile: resolve(SCRIPTS, 'voice.json') });
  const park = () => demo.moveTo(VIDEO.width - 24, VIDEO.height - 24, 0);
  // The hook is up before the first frame.
  await demo.picture(`data:image/png;base64,${png.toString('base64')}`);
  await demo.wait(600);
  await demo.start();
  demo.rec.pause();
  await park();

  // The problem, as two questions (the owner's opening): the sea of diagrams, then the slides.
  // The caption is each question's short form; the voice asks it in full.
  await demo.note('Lost in a sea of architecture diagrams?', {
    voice: "Have you ever tried to map out your enterprise's systems... and got lost in a sea of architecture diagrams? Wishing you could see every platform, and how they fit together, in one view?",
  });
  await demo.still(5);
  demo.rec.pause();
  await demo.clearNote();
  await demo.picture(`data:image/png;base64,${slide.toString('base64')}`);
  await demo.wait(600);
  await demo.note('Explaining a migration with slides?', {
    voice: 'Have you ever tried to explain a system, or a data migration, to a client... and struggled to tell the journey with slides?',
  });
  await demo.still(4);
  demo.rec.pause();
  await demo.clearNote();
  await demo.picture(null);

  // The reveal: full screen, the product named over the whole estate turning in 3D; then the stages, drifting.
  await page.keyboard.press('f');
  await demo.wait(2500);
  await demo.note('This is Plenoview: a 3D architecture and planning tool.', {
    voice: 'This is Plenoview. A 3D architecture and planning tool, for system architects and integrators alike.',
  });
  await orbit(demo, 4, { fps: 15 });
  demo.rec.pause();
  await demo.note('Plenoview shows the whole enterprise in one 3D view. Every platform is a layer.', {
    voice: 'Plenoview shows the whole enterprise, in one 3D view. Every platform is a layer.',
  });
  await orbit(demo, 5, { fps: 15 });
  demo.rec.pause();
  await demo.note('The flow runs left to right: Source, Ingest, Store, Process, Serve, Insight.', {
    voice: 'The flow runs from left to right, across every platform: Source, Ingest, Store, Process, Serve, and Insight.',
  });
  await orbit(demo, 4, { turns: 0.06, fps: 15 });
  demo.rec.pause();
  await demo.clearNote();

  // A path lit across platforms (selected off camera).
  await page.keyboard.press('Escape');
  await demo.wait(1200);
  await demo.clickSettled(() => nodeScreenPos(page, 'SAP S/4HANA'), 400);
  await page.locator('#properties .highlight-modes button[data-mode="downstream"]').click();
  await park();
  await demo.wait(3000);
  await demo.note('Pick a system and see everything it feeds, across platforms.', {
    voice: 'Pick any system, and see everything it feeds, across every platform.',
  });
  await orbit(demo, 4, { turns: 0.08, fps: 15 });
  demo.rec.pause();
  await demo.clearNote();

  // Today, then the Target, from the timeline.
  await page.locator('#properties .highlight-modes button[data-mode="off"]').click();
  await page.keyboard.press('Escape');
  await page.locator('.timeline-chips .chip').nth(0).locator('.chip-main').click();
  await demo.wait(2000);
  await demo.note('The timeline holds Today…', { top: true, voice: 'The timeline holds Today...' });
  await orbit(demo, 2, { turns: 0.04, fps: 15 });
  demo.rec.pause();
  await page.locator('.timeline-chips .chip').nth(1).locator('.chip-main').click();
  await demo.wait(2000);
  await demo.note('…and the Target. Play it, and the room watches the change happen.', {
    top: true, voice: '...and the Target. Play it, and the room watches the change happen.',
  });
  await orbit(demo, 3, { turns: 0.04, fps: 15 });
  demo.rec.pause();
  await demo.clearNote();

  // The example's own tour, presented: two steps, each a still.
  await page.locator('.timeline-chips .chip.current .chip-main').click();
  await demo.wait(1200);
  await page.locator('.tour-panel button.present-tour').click();
  await demo.wait(3000);
  await park();
  await demo.note('Present it as a tour: step by step, full screen, with your captions.', {
    voice: 'Present it as a tour. Step by step, full screen, with your captions.',
  });
  await demo.still(2.4);
  demo.rec.pause();
  await page.keyboard.press('ArrowRight');
  await demo.wait(3000);
  await demo.still(2);
  demo.rec.pause();
  await page.keyboard.press('Escape');
  await demo.wait(800);
  await demo.clearNote();

  // The whiteboard photo, drafted by Claude and reviewed (the mechanics off camera: the review is what shows).
  await page.locator('#toolbar button.ai-open').click();
  const dialog = page.locator('.ai-dialog');
  await dialog.locator('.ai-tab-draft').click();
  const chooser = page.waitForEvent('filechooser');
  await dialog.locator('.ai-picture-attach').click();
  await (await chooser).setFiles({ name: 'order-to-insight-whiteboard.png', mimeType: 'image/png', buffer: png });
  if (await dialog.locator('.ai-research').isChecked()) await dialog.locator('.ai-research').uncheck();
  await dialog.locator('button.ai-draft').click();
  await expect(dialog.locator('.csv-nodes tbody tr').first()).toBeVisible(AI_WAIT);
  await dialog.locator('.ai-widen').click();
  await demo.wait(1200);
  await park();
  await demo.note('Start from a whiteboard photo, a spreadsheet or a sentence. Claude drafts it; you review every system.', {
    top: true, voice: 'Start from a whiteboard photo, a spreadsheet, or a sentence. Claude drafts it, and you review every system before anything changes.',
  });
  await demo.still(5);
  demo.rec.pause();
  await dialog.locator('.ai-accept-high').click();
  await dialog.locator('.ai-accept-all').click();
  await dialog.locator('.ai-widen').click();
  await dialog.locator('.ai-apply-new').click();
  await demo.wait(3000);
  // The draft opens in the Front view: turn it to 3D off camera before it drifts.
  await page.locator('#toolbar button[data-view="iso"]').click();
  await demo.wait(2500);
  await demo.clearNote();
  await demo.note('The whiteboard, as a plenoview.', { voice: 'The whiteboard, as a plenoview.' });
  await orbit(demo, 3, { turns: 0.1, fps: 15 });
  demo.rec.pause();
  await demo.clearNote();

  // Share and export: the menu open, a still.
  await menu(page, 'export').click();
  await demo.wait(600);
  await demo.note('Share a link. Export the tour as a video, or the diagram as a 3D page.', {
    voice: 'Share it as a link. Export the tour as a video, or the diagram as a 3D page.',
  });
  await demo.still(3.5);
  demo.rec.pause();
  await page.keyboard.press('Escape');
  await demo.wait(400);
  await demo.clearNote();

  // The offer, held to the end.
  await demo.card('plenoview.com', 'See the whole estate in one picture', 'A month on the full product. No card.', 0,
    'Plenoview. See the whole estate, in one picture. A month on the full product, no card. At plenoview dot com.', { hold: true });
  await demo.still(6);
  await demo.save(resolve(OUT, 'plenoview-60.mp4'), resolve(SCRIPTS, 'promo-plenoview-60'), { title: 'Plenoview in a minute', spec: 'tests/e2e/promo.spec.ts', root: resolve(import.meta.dirname, '../..') });
  // The poster: the lit path, from the finished video.
  const lines = JSON.parse(readFileSync(resolve(SCRIPTS, 'promo-plenoview-60.json'), 'utf8')) as { caption: string; start: number; end: number }[];
  const lit = lines.find(l => l.caption.startsWith('Pick a system'))!;
  execFileSync(process.env.FFMPEG ?? 'ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(lit.end - 1), '-i', resolve(OUT, 'plenoview-60.mp4'), '-frames:v', '1', '-q:v', '4', '-update', '1', resolve(OUT, 'plenoview-60.jpg')]);
});
