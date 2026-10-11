// The Plenoview film at 9:16, as recorded on 2026-10-11 (tests/e2e/promo.spec.ts
// in github.com/magicmiguelx/plenoview, "Plenoview in 20 seconds, vertical"),
// with its imports pointed at the kit. It will not run here: `openApp`,
// `chooseExample` and the fixtures are that project's. Read it for a video at
// a phone's size:
//
// - the page is laid out at the phone's size (`layout: PHONE`, 390 × 693)
//   and drawn at full HD portrait (`output: PHONE_HD`, 1080 × 1920, the
//   device scale factor in `test.use`), with `isMobile` and `hasTouch` so the
//   app shows its phone viewer;
// - the overlay is sized for it (`Demo.prepare(page, { css })`: smaller
//   type, a caption nearly the width of the screen, a card whose title
//   fits), and every caption is at the top, clear of the app's tour bar;
// - the share link is read once the app has computed it (a take went to
//   "Preparing the link…" as a URL), and opened on a fresh page;
// - the beats are the film's: the tour's own steps light the path and show
//   the Target, so nothing needs the editor's panels.
//
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chooseExample, openApp } from './helpers';
import { Demo } from 'screenplay-kit';
import { orbit } from 'screenplay-kit/three';
import { PHONE, PHONE_CSS, PHONE_HD, estatePicture } from './demoFixtures';

const OUT = resolve(import.meta.dirname, '../../public/promo');
const SCRIPTS = resolve(import.meta.dirname, '../../docs/demo-scripts');
test.skip(!process.env.PROMO, 'Set PROMO=1 to record public/promo');
test.describe.configure({ timeout: 1_800_000 });

test.describe('vertical', () => {
  // The film at 9:16, for Reels, Shorts and LinkedIn on a phone: the phone viewer of a share link, drawn at 1080 × 1920.
  test.use({ viewport: PHONE, isMobile: true, hasTouch: true, deviceScaleFactor: PHONE_HD.width / PHONE.width });

  test('Plenoview in 20 seconds, vertical', async ({ page, browser }) => {
    const desk = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const deskPage = await desk.newPage();
    await openApp(deskPage);
    await chooseExample(deskPage, 'sap-fabric');
    await deskPage.click('#toolbar button.share');
    const share = deskPage.locator('.share-dialog');
    await share.locator('.opt-timeline').check();
    // The link is computed after the tick: read it once it is one (a take went to "Preparing the link…" as a URL).
    await expect(share.locator('.share-link')).toHaveValue(/#\/view\?d=/);
    const url = await share.locator('.share-link').inputValue();
    await desk.close();
    const png = await estatePicture(page);
    await Demo.prepare(page, { css: PHONE_CSS });
    await page.goto(url);
    await page.waitForFunction(() => (window as any).shared?.getState().loaded === true);
    await page.waitForTimeout(2500);
    const demo = new Demo(page, { layout: PHONE, output: PHONE_HD, durationsFile: resolve(SCRIPTS, 'voice.json') });
    await demo.picture(`data:image/png;base64,${png.toString('base64')}`);
    await demo.wait(600);
    await demo.start();
    demo.rec.pause();
    await demo.moveTo(PHONE.width - 16, PHONE.height - 16, 0);
    await demo.note('Boxes and arrows. One platform at a time.', { top: true });
    await demo.still(2.8);
    demo.rec.pause();
    await demo.clearNote();
    await demo.picture(null);
    await demo.note('The whole estate, in one 3D view.', { top: true, voice: 'Plenoview shows the whole estate... in one 3D view.' });
    await orbit(demo, 4.5, { fps: 20 });
    demo.rec.pause();
    await demo.clearNote();
    // The tour's second step lights the path from S/4HANA; its fourth is the Target.
    const next = page.locator('.tour-bar button[title^="Next step"]');
    await next.tap();
    await demo.wait(3000);
    await demo.note('Pick a system. See everything it feeds.', { top: true, voice: 'Pick any system... and see everything it feeds.' });
    await orbit(demo, 2.8, { turns: 0.08, fps: 20 });
    demo.rec.pause();
    await demo.clearNote();
    await next.tap();
    await next.tap();
    await demo.wait(3000);
    await demo.note('…and the Target.', { top: true, voice: 'Today... and the Target.' });
    await orbit(demo, 2.2, { turns: 0.05, fps: 20 });
    demo.rec.pause();
    await demo.clearNote();
    await demo.card('plenoview.com', 'See the whole estate in one picture', 'A month on the full product. No card.', 0,
      'Plenoview. See the whole estate, in one picture. A month free, at plenoview dot com.', { hold: true });
    await demo.still(5);
    await demo.save(resolve(OUT, 'plenoview-20-vertical.mp4'), resolve(SCRIPTS, 'promo-plenoview-20-vertical'), { title: 'Plenoview in 20 seconds, vertical', spec: 'tests/e2e/promo.spec.ts', root: resolve(import.meta.dirname, '../..') });
    const lines = JSON.parse(readFileSync(resolve(SCRIPTS, 'promo-plenoview-20-vertical.json'), 'utf8')) as { caption: string; start: number; end: number }[];
    execFileSync(process.env.FFMPEG ?? 'ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(lines[1].end - 1), '-i', resolve(OUT, 'plenoview-20-vertical.mp4'), '-frames:v', '1', '-q:v', '4', '-update', '1', resolve(OUT, 'plenoview-20-vertical.jpg')]);
  });
});
