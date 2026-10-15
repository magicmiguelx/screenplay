import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Demo, VIDEO, configure, inView } from '../src/index.js';

// Records a short video of a small page, no voice (no key needed): the
// recorder, the overlay, the driver, the script files and ffmpeg all work
// together. Skipped unless SMOKE=1 (it takes about a minute and needs
// ffmpeg with libx264).

const OUT = resolve(import.meta.dirname, 'out');
test.skip(!process.env.SMOKE, 'Set SMOKE=1 to record tests/out/smoke.mp4');
test.use({ viewport: VIDEO, colorScheme: 'dark' });

const PAGE = `<!doctype html><html><head><style>
  body { margin: 0; font: 18px system-ui; background: #10141c; color: #eee; }
  header { padding: 20px 28px; background: #1b2230; display: flex; gap: 16px; align-items: center; }
  main { padding: 28px; display: grid; gap: 16px; max-width: 640px; }
  button { font: inherit; padding: 8px 16px; border-radius: 8px; border: 1px solid #3a4a66; background: #223049; color: #fff; }
  button:hover { background: #2d4066; }
  input, select { font: inherit; padding: 8px; border-radius: 6px; border: 1px solid #3a4a66; background: #0d1119; color: #fff; }
  #count { font-size: 40px; font-weight: 700; }
</style></head><body>
  <header><strong>Counter</strong><button id="add">Add one</button><button id="reset">Reset</button></header>
  <main>
    <div id="count">0</div>
    <label>Name <input id="name" placeholder="Type a name"></label>
    <label>Mood <select id="mood"><option value="calm">Calm</option><option value="busy">Busy</option></select></label>
    <label>Level <input id="level" type="range" min="0" max="100" value="20"></label>
  </main>
  <script>
    let n = 0; const c = document.getElementById('count');
    document.getElementById('add').onclick = () => { c.textContent = String(++n); };
    document.getElementById('reset').onclick = () => { n = 0; c.textContent = '0'; };
  </script>
</body></html>`;

test('a small page, recorded with captions, a card and the script files', async ({ page }) => {
  configure({ say: [[/\bScreenplay\b/g, 'Screen-play']] });
  await Demo.prepare(page, { brand: 'Screenplay · the smoke test' });
  // A real navigation: init scripts (the overlay) do not run for setContent().
  await page.route('https://smoke.test/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: PAGE }));
  await page.goto('https://smoke.test/');
  // A spoken length for one line, as a voiced recording would have kept: the recording waits for it.
  mkdirSync(OUT, { recursive: true });
  writeFileSync(resolve(OUT, 'voice.json'), JSON.stringify({ 'Add one counts up.': 3.0 }));
  const demo = new Demo(page, { durationsFile: resolve(OUT, 'voice.json'), voiced: false });
  await demo.start();

  await demo.card('Screenplay · smoke test', 'A counter', 'Two buttons, a field and a slider, driven on camera.', 2500);
  await demo.say('Add one counts up.', { keep: true });
  await demo.click(page.locator('#add'), 400);
  // A cut while the line is still being spoken: the line keeps its room (an earlier version lost the cut's length of it).
  demo.rec.pause();
  await demo.wait(1500);
  demo.rec.resume();
  await demo.click(page.locator('#add'), 400);
  await demo.clearNote();
  await expect(page.locator('#count')).toHaveText('2');
  await demo.note('Type a name, choose a mood, set the level.', { top: true });
  await demo.type(page.locator('#name'), 'Ada', { delay: 30 });
  await demo.choose(page.locator('#mood'), 'busy', 400);
  await demo.slide(page.locator('#level'), 70, 400);
  await demo.clearNote();
  // A cut: the reset happens off camera.
  demo.rec.pause();
  await page.locator('#reset').click();
  await demo.wait(300);
  demo.rec.resume();
  // Frames drawn by hand: the counter counts up smoothly whatever the renderer does.
  await demo.drawFrames(1, async u => { await page.evaluate(u => { document.getElementById('count')!.textContent = String(Math.round(u * 10)); }, u); });
  await demo.spot(page.locator('#count'));
  await demo.say('Ten, drawn frame by frame.', { ms: 1200 });
  await demo.spot(null);
  await demo.poster(resolve(OUT, 'smoke.jpg'));
  // The closing card set while paused and drawn as a still: logged after the fade, placed where the still starts.
  demo.rec.pause();
  await demo.card('The end', 'That is the kit', 'Thanks for watching.', 0, undefined, { hold: true });
  await demo.still(1.5);
  const frames = demo.rec.dir;
  const { length, lines } = await demo.save(resolve(OUT, 'smoke.mp4'), resolve(OUT, 'smoke'), { title: 'Smoke test', spec: 'tests/smoke.spec.ts', root: resolve(import.meta.dirname, '..') });

  expect(existsSync(resolve(OUT, 'smoke.mp4'))).toBe(true);
  expect(existsSync(frames)).toBe(false);
  expect(existsSync(resolve(OUT, 'smoke.jpg'))).toBe(true);
  const probed = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', resolve(OUT, 'smoke.mp4')]).toString().trim());
  expect(probed).toBeGreaterThan(8);
  expect(Math.abs(probed - length)).toBeLessThan(1.5);
  expect(lines.map(l => l.kind)).toEqual(['card', 'caption', 'caption', 'caption', 'card']);
  // The spoken line's room, in the video, covers its 3 s of voice despite the 1.5 s cut inside it.
  expect(lines[1].end - lines[1].start).toBeGreaterThan(3.0);
  // Every caption was placed by what it would cover: a position and a measured cover, never on the spotlit element.
  for (const l of lines.filter(l => l.kind === 'caption')) {
    expect(['top', 'bottom']).toContain(l.at);
    expect(l.cover).toBeGreaterThanOrEqual(0);
    expect(l.cover).toBeLessThanOrEqual(1);
  }
  expect(lines[2].at).toBe('top');
  expect(readFileSync(resolve(OUT, 'smoke.md'), 'utf8')).toContain('| Over |');
  // The opening card is in the picture within a second and a half, and stays its 2.5 s.
  expect(lines[0].start).toBeGreaterThan(0.2);
  expect(lines[0].start).toBeLessThan(1.5);
  expect(lines[0].end - lines[0].start).toBeGreaterThan(2.3);
  // Lines cost no dead time: the whole video is under 25 s.
  expect(length).toBeLessThan(25);
  expect(lines.at(-1)!.end).toBeGreaterThan(lines.at(-1)!.start + 1);
  // The card set in the pause starts where the still starts: at the cut, a poster's screenshot after the line before it, not after the still.
  expect(lines.at(-1)!.start).toBeLessThan(lines.at(-2)!.end + 1.2);
  expect(lines.at(-1)!.end - lines.at(-1)!.start).toBeGreaterThan(1.4);
  // The script files.
  const vtt = readFileSync(resolve(OUT, 'smoke.vtt'), 'utf8');
  expect(vtt.startsWith('WEBVTT')).toBe(true);
  expect(vtt).toContain('Add one counts up.');
  const md = readFileSync(resolve(OUT, 'smoke.md'), 'utf8');
  expect(md).toContain('# Smoke test: voice-over script');
  expect(md).toContain('Written by `tests/smoke.spec.ts`');
  const json = JSON.parse(readFileSync(resolve(OUT, 'smoke.json'), 'utf8')) as { caption: string; voice: string }[];
  expect(json[0].voice).toBe('A counter. Two buttons, a field and a slider, driven on camera.');
  // The lines are in order and never overlap.
  for (let i = 1; i < lines.length; i++) expect(lines[i].start).toBeGreaterThanOrEqual(lines[i - 1].end - 0.01);
});

const TALL_PAGE = `<!doctype html><html><head><style>
  body { margin: 0; font: 18px system-ui; background: #10141c; color: #eee; }
  header { position: sticky; top: 0; height: 64px; background: #1b2230; z-index: 5; display: flex; align-items: center; padding: 0 28px; }
  section { margin: 24px 28px; padding: 16px; border: 1px solid #3a4a66; border-radius: 8px; }
  #tall { height: 2000px; }
  button { font: inherit; padding: 8px 16px; }
</style></head><body>
  <header><strong>A long page</strong></header>
  <section style="height: 900px">The top of the page.</section>
  <section id="below">A box below the fold.</section>
  <section id="tall">A section taller than the frame.</section>
  <section><button id="far">Far below</button></section>
</body></html>`;

test('what a line is about is in the picture, or the take fails', async ({ page }) => {
  await Demo.prepare(page);
  await page.route('https://smoke.test/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: TALL_PAGE }));
  await page.goto('https://smoke.test/long');
  const demo = new Demo(page, { voiced: false, minInView: 0.9 });
  await demo.start();
  // Named as the line's subject, the box below the fold is brought into the picture before the line is said.
  expect(await inView(page.locator('#below'))).toBeLessThan(0.5);
  await demo.say('The box below.', { about: page.locator('#below'), ms: 1200 });
  expect(await inView(page.locator('#below'))).toBe(1);
  // A section taller than the frame comes to the top, clear of the sticky header, and fills the picture.
  await demo.say('The tall section.', { about: page.locator('#tall'), ms: 1200 });
  expect(await inView(page.locator('#tall'))).toBeGreaterThanOrEqual(0.9);
  const top = await page.locator('#tall').evaluate(el => el.getBoundingClientRect().top);
  expect(top).toBeGreaterThanOrEqual(64);
  // A spotlight put up after a line, for the next line ("spot, then say"), is the next line's subject.
  await page.evaluate(() => window.scrollTo(0, 0));
  await demo.say('The top of the page.', { ms: 1800 });
  await demo.spot(page.locator('#far'));
  await demo.say('Far below, lit.', { ms: 1200 });
  await demo.spot(null);
  // A line said in full and then acted on, with what it acts on out of the picture: the take fails, named.
  await page.evaluate(() => window.scrollTo(0, 0));
  await demo.say('Then the button far below.', { ms: 1800 });
  await expect(demo.click(page.locator('#far'))).rejects.toThrow(/Subject out of the picture: 0% .*Then the button far below/);
  // The failed take's frames go with its page (they were left in the temp folder, hundreds of MB a take).
  expect(existsSync(demo.rec.dir)).toBe(true);
  await page.close();
  expect(existsSync(demo.rec.dir)).toBe(false);
});
