// The Plenoview sales video, as recorded on 2026-10-09 (tests/e2e/promo.spec.ts
// in github.com/magicmiguelx/plenoview), with its imports pointed at the kit.
// It will not run here: `openApp`, `mockClaude` and the fixtures are that
// project's. Read it for the shape of a two-minute sales piece:
//
// - a story arc: the problem everyone recognises (a picture card of the flat
//   diagram) → the reveal (full screen, a nine-second orbit drawn frame by
//   frame) → four beats, each one line and one visible action → the offer,
//   a card held to the end;
// - every line has a spoken text written for the ear;
// - the mechanics are cut (`rec.pause()` … `resume()`): selecting a system,
//   the AI dialog's plumbing, clearing a highlight; what shows is the result;
// - the AI beat runs against the app's mock, with a delay so the wait looks real;
// - the poster is cut from the finished file, not screenshotted;
// - AI is a supporting beat with no accuracy claim (the evals decide that).
//
import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openApp } from './helpers';
import { Demo, VIDEO, VIDEO_HD } from 'screenplay-kit';
import { orbit } from 'screenplay-kit/three';
import { nodeScreenPos } from './helpers';
import { AI_WAIT, mockClaude } from './aiMock';
import { FUNDED, PICTURE_DRAFT, estatePicture } from './demoFixtures';

// The sales video (G3): about 80 seconds for systems and data architects,
// in the tutorials' voice, recorded by the tutorials' recorder (demo.ts) at
// full HD into public/promo (the landing page can show it; LinkedIn and
// outbound mail take the file). Not a test: skipped unless PROMO=1
// (PROMO=1 npx playwright test promo). With ELEVENLABS_API_KEY set the lines
// are voiced as they are recorded; the script goes to docs/demo-scripts/
// promo-plenoview.* like the tutorials' (npm run voiceover -- check
// promo-plenoview transcribes its lines). The AI beat runs against aiMock's
// stand-in draft: no real API calls.
//
// The story: the flat diagram everyone draws → the whole estate in one 3D
// view, turned a full circle (drawn frame by frame, so it is smooth) → the
// stages, a path lit across platforms → Today to Target played → a tour
// presented → a whiteboard photo drafted by Claude and reviewed → share and
// export → the offer. AI is a supporting beat, not the headline (G4: no
// accuracy claims until the evals measure them).

const OUT = resolve(import.meta.dirname, '../../public/promo');
const SCRIPTS = resolve(import.meta.dirname, '../../docs/demo-scripts');
test.skip(!process.env.PROMO, 'Set PROMO=1 to record public/promo');
// The tutorials' layout, drawn at full HD (demo.ts, VIDEO_HD).
test.use({ viewport: VIDEO, deviceScaleFactor: VIDEO_HD.width / VIDEO.width, colorScheme: 'dark' });
test.describe.configure({ timeout: 1_800_000 });

const menu = (page: Page, name: 'file' | 'export' | 'view' | 'help') => page.locator(`#toolbar .${name}-menu .menu-button`);

/** The SAP + Fabric example, loaded off camera. */
async function example(page: Page, id: string) {
  await menu(page, 'file').click();
  await page.locator(`#toolbar [data-example="${id}"]`).click();
  await page.waitForTimeout(2500);
}

test('Plenoview in 80 seconds', async ({ page }) => {
  page.on('dialog', d => void d.accept());
  const png = await estatePicture(page);
  await Demo.prepare(page);
  await openApp(page, undefined, { me: FUNDED });
  await mockClaude(page, {
    hosted: true,
    delayMs: kind => (kind === 'draft' ? 1800 : 400),
    answer: kind => (kind === 'draft' ? PICTURE_DRAFT : undefined),
  });
  await example(page, 'sap-fabric');
  const demo = new Demo(page, { output: VIDEO_HD, durationsFile: resolve(SCRIPTS, 'voice.json') });
  await demo.start();

  // The problem: the flat diagram.
  await demo.picture(`data:image/png;base64,${png.toString('base64')}`);
  await demo.wait(600);
  await demo.note('Your estate, as everyone draws it: boxes and arrows, one platform at a time.', {
    voice: 'This is how every estate gets drawn. Boxes and arrows, one platform at a time. Accurate... and nobody in the room can see the whole thing.',
  });
  await demo.wait(5200);
  await demo.clearNote();
  await demo.picture(null);
  await demo.wait(400);

  // The whole estate in one view, full screen, turned a full circle.
  demo.rec.pause();
  await page.keyboard.press('f');
  await demo.wait(2500);
  demo.rec.resume();
  await demo.note('Plenoview shows the whole enterprise in one 3D view. Every platform is a layer.', {
    voice: 'Plenoview shows the whole enterprise, in one 3D view. Every platform is a layer. Here, SAP below, and Microsoft Fabric above.',
  });
  await orbit(demo, 9);
  await demo.clearNote();
  await demo.key('Escape', 1200);

  // The stages.
  await demo.say('The flow runs left to right across every platform: Source, Ingest, Store, Process, Serve, Insight.', {
    voice: 'The flow runs from left to right, across every platform: Source, Ingest, Store, Process, Serve, and Insight.',
  });

  // A path across platforms.
  await demo.note('Pick a system and see everything it feeds, across platforms.', {
    voice: 'Pick any system, and see everything it feeds, across every platform.',
  });
  // Selecting the system is cut (the camera settles, the panel opens): the click on Downstream is what shows.
  demo.rec.pause();
  await demo.clickSettled(() => nodeScreenPos(page, 'SAP S/4HANA'), 400);
  demo.rec.resume();
  await demo.click(page.locator('#properties .highlight-modes button[data-mode="downstream"]'), 3000);
  // Clearing it is cut: the lit scene makes every action slow.
  demo.rec.pause();
  await page.locator('#properties .highlight-modes button[data-mode="off"]').click();
  await page.keyboard.press('Escape');
  await demo.wait(800);
  demo.rec.resume();
  await demo.clearNote();

  // Today to Target.
  await demo.note('The timeline holds Today and the Target. Play it, and the room watches the change happen.', {
    voice: 'The timeline holds Today, and the Target. Play it, and the room watches the change happen.',
  });
  await demo.click(page.locator('.timeline-chips .chip').nth(0).locator('.chip-main'), 1200);
  await demo.click(page.locator('.timeline-row button:has-text("Play")'), 6000);
  await demo.clearNote();

  // The example's own tour, presented (it has captions per stage).
  await demo.note('Present it as a tour: step by step, full screen, with your captions.', {
    voice: 'Present it as a tour. Step by step, full screen, with your captions.',
  });
  await demo.click(page.locator('.tour-panel button.present-tour'), 3200);
  await demo.key('ArrowRight', 3000);
  await demo.key('ArrowRight', 3000);
  await demo.key('Escape', 800);
  await demo.clearNote();

  // From a whiteboard photo, reviewed.
  await demo.note('Start from what you have: a whiteboard photo, a spreadsheet or a sentence. Claude drafts it; you review every system before anything changes.', {
    voice: 'Start from what you already have: a whiteboard photo, a spreadsheet, or a sentence. Claude drafts it. You review every system, and every link, before anything changes.',
  });
  await demo.click(page.locator('#toolbar button.ai-open'), 900);
  const dialog = page.locator('.ai-dialog');
  // The mechanics are cut (the Draft tab, the picture attached, the draft's wait): the review appears.
  demo.rec.pause();
  await dialog.locator('.ai-tab-draft').click();
  const chooser = page.waitForEvent('filechooser');
  await dialog.locator('.ai-picture-attach').click();
  await (await chooser).setFiles({ name: 'order-to-insight-whiteboard.png', mimeType: 'image/png', buffer: png });
  if (await dialog.locator('.ai-research').isChecked()) await dialog.locator('.ai-research').uncheck();
  await dialog.locator('button.ai-draft').click();
  await expect(dialog.locator('.csv-nodes tbody tr').first()).toBeVisible(AI_WAIT);
  await dialog.locator('.ai-widen').click();
  await demo.wait(1200);
  demo.rec.resume();
  await demo.wait(2000);
  await demo.click(dialog.locator('.ai-accept-high'), 600);
  await demo.click(dialog.locator('.ai-accept-all'), 600);
  demo.rec.pause();
  await dialog.locator('.ai-widen').click();
  await dialog.locator('.ai-apply-new').click();
  await demo.wait(2500);
  demo.rec.resume();
  await demo.wait(800);
  await demo.clearNote();
  await demo.note('The whiteboard, as a plenoview.', { voice: 'The whiteboard, as a plenoview.' });
  await orbit(demo, 4);
  await demo.clearNote();

  // Share and export.
  await demo.note('Share a link. Export the tour as a video, or the diagram as a 3D page.', {
    voice: 'Share it as a link. Export the tour as a video, or the whole diagram as a 3D page anyone can turn.',
  });
  await demo.click(menu(page, 'export'), 700);
  await demo.hover(page.locator('#toolbar .export-menu .export-video'), 1200);
  await demo.hover(page.locator('#toolbar .export-menu button.export-html'), 1200);
  await demo.key('Escape', 400);
  await demo.clearNote();

  // The offer.
  await demo.card('plenoview.com', 'A 360° enterprise view', 'A month on the full product. No card.', 5000,
    'Plenoview. A 360 degree enterprise view. A month on the full product, no card. Request access at plenoview dot com.', { hold: true });
  await demo.save(resolve(OUT, 'plenoview.mp4'), resolve(SCRIPTS, 'promo-plenoview'), { title: 'Plenoview in two minutes', spec: 'tests/e2e/promo.spec.ts', root: resolve(import.meta.dirname, '../..') });
  // The poster: the lit path, from the finished video (a screenshot of the lit scene is slow and goes into the recording).
  const lines = JSON.parse(readFileSync(resolve(SCRIPTS, 'promo-plenoview.json'), 'utf8')) as { caption: string; start: number; end: number }[];
  const lit = lines.find(l => l.caption.startsWith('Pick a system'))!;
  execFileSync(process.env.FFMPEG ?? 'ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(lit.end - 3), '-i', resolve(OUT, 'plenoview.mp4'), '-frames:v', '1', '-q:v', '4', '-update', '1', resolve(OUT, 'plenoview.jpg')]);
});
