import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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

const BUSY_MIDDLE = `<!doctype html><html><head><style>
  body { margin: 0; font: 18px system-ui; background: #10141c; color: #eee; }
  .band { position: fixed; left: 34%; width: 32%; height: 130px; overflow: hidden; line-height: 1.2; word-break: break-all; }
  #top { top: 40px; } #bottom { bottom: 60px; }
</style></head><body>
  <div class="band" id="top"></div><div class="band" id="bottom"></div>
  <script>for (const b of document.querySelectorAll('.band')) b.textContent = 'cell'.repeat(400);</script>
</body></html>`;

test('a caption goes to a corner when the middle is busy top and bottom, unless corners are off', async ({ page }) => {
  await Demo.prepare(page);
  await page.route('https://smoke.test/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: BUSY_MIDDLE }));
  await page.goto('https://smoke.test/busy');
  const caption = page.locator('#demo-overlay .caption');
  const corners = new Demo(page, { voiced: false });
  await corners.note('A short line.');
  await expect(caption).toHaveClass(/left/);
  const box = (await caption.boundingBox())!;
  expect(box.x).toBeLessThan(VIDEO.width * 0.3);
  // The covers of every position, as the driver sees them: the middle busy, the corners clear.
  const covers = await page.evaluate(() => (window as unknown as { __demo: import('../src/overlay.js').OverlayApi }).__demo.measure('A short line.'));
  expect(covers.bottom.cover).toBeGreaterThan(0.5);
  expect(covers.top.cover).toBeGreaterThan(0.5);
  expect(covers['bottom-left'].cover).toBeLessThan(0.1);
  await corners.clearNote();
  const centred = new Demo(page, { voiced: false, corners: false });
  await centred.note('A short line.');
  await expect(caption).not.toHaveClass(/left|right/);
});

// A stand-in for the voice service on this machine (voice.api), so the voiced path runs with no key and
// no bill: a clip is a tone as long as its words take at 2.5 a second, or, for a line marked RUSHED,
// half a second whatever it says (too fast at every speed).
/** A stand-in for the ElevenLabs API: a tone as long as the line, made after `delay` ms (the real API's wait). */
async function fakeVoice(delay = 0): Promise<{ server: Server; api: string }> {
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url?.startsWith('/v1/voices')) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ voices: [{ voice_id: 'test', name: 'Test Voice' }] }));
      return;
    }
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      const { text } = JSON.parse(body) as { text: string };
      const secs = text.includes('RUSHED') ? 0.5 : Math.max(0.8, text.split(/\s+/).length / 2.5);
      const mp3 = execFileSync('ffmpeg', ['-loglevel', 'error', '-f', 'lavfi', '-i', `sine=frequency=220:duration=${secs}`, '-c:a', 'libmp3lame', '-f', 'mp3', '-']);
      res.setHeader('Content-Type', 'audio/mpeg');
      setTimeout(() => res.end(mp3), delay);
    });
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const port = (server.address() as { port: number }).port;
  return { server, api: `http://127.0.0.1:${port}` };
}

test('voiced: the clips are mixed in one encode, and every line too fast is listed at the end of the take', async ({ page }) => {
  const { server, api } = await fakeVoice(500);
  const cache = mkdtempSync(join(tmpdir(), 'screenplay-voice-'));
  try {
    configure({ api, cache, voiceName: 'Test Voice' });
    await Demo.prepare(page);
    await page.route('https://smoke.test/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: PAGE }));
    await page.goto('https://smoke.test/voiced');
    const durations = join(cache, 'voice.json');
    const demo = new Demo(page, { voiced: true, durationsFile: durations });
    await demo.start();
    await demo.card('Voiced', 'A counter', 'Said by a stand-in voice.', 1500);
    await demo.say('Add one counts up, and the count is shown in large type.', { keep: true });
    await demo.click(page.locator('#add'), 300);
    await demo.clearNote();
    // A cut (a second browser opened off camera), then at once a line whose clip is not made yet: its
    // pause comes before any frame. An earlier version held the still before the first cut across the
    // whole of it (seven seconds in a tutorial recorded on an empty clip cache, 16 October 2026).
    demo.rec.pause();
    await demo.wait(3000);
    demo.rec.resume();
    await demo.note('Made after the cut, and the wait never shows.');
    await demo.clearNote();
    // The last line set and left: save() waits for it to be said, so the picture lasts as long as its clip.
    await demo.note('That is the end of this short and fully voiced recording.');
    const out = join(cache, 'voiced.mp4');
    const said: string[] = [];
    const log = console.log;
    console.log = (...a: unknown[]) => { said.push(a.join(' ')); log(...a); };
    const { length, lines } = await demo.save(out, join(cache, 'voiced'), { title: 'Voiced', spec: 'tests/smoke.spec.ts' }).finally(() => { console.log = log; });
    // The mix had nothing to pad: a voiced take is never encoded twice.
    expect(said.join('\n')).not.toContain('encoded again');
    const probe = (what: string) => execFileSync('ffprobe', ['-v', 'error', '-show_entries', what, '-of', 'csv=p=0', out]).toString().trim();
    expect(probe('stream=codec_type').split('\n').sort()).toEqual(['audio', 'video']);
    const last = lines.at(-1)!;
    const lastClip = 'That is the end of this short and fully voiced recording.'.split(' ').length / 2.5;
    expect(Number(probe('format=duration'))).toBeGreaterThan(last.start + lastClip);
    expect(length).toBeGreaterThan(5);
    const kept = JSON.parse(readFileSync(durations, 'utf8')) as Record<string, number>;
    expect(Object.keys(kept)).toHaveLength(4);
    // Neither the cut nor the clip's second shows: the line after the cut follows the one before at a step's pace.
    expect(lines.map(l => l.kind)).toEqual(['card', 'caption', 'caption', 'caption']);
    expect(lines[2].start - lines[1].end).toBeLessThan(1.5);

    // Two lines over the speed limit in one take: the take goes on, and save() names both.
    await page.goto('https://smoke.test/voiced');
    const rushed = new Demo(page, { voiced: true });
    await rushed.start();
    await rushed.say('RUSHED one, with far too many words for half a second.', { ms: 500 });
    await rushed.say('A line the voice can say.', { ms: 500 });
    await rushed.say('RUSHED two, also with far too many words to fit in.', { ms: 500 });
    const frames = rushed.rec.dir;
    await expect(rushed.save(join(cache, 'rushed.mp4'), join(cache, 'rushed'), { title: 'Rushed', spec: 'tests/smoke.spec.ts' }))
      .rejects.toThrow(/2 lines the voice cannot say under its speed limit[\s\S]*RUSHED one[\s\S]*RUSHED two/);
    expect(existsSync(frames)).toBe(false);
  } finally {
    configure({});
    server.close();
    rmSync(cache, { recursive: true, force: true });
  }
});

const LATE_SCROLL = `<!doctype html><html><head><style>
  body { margin: 0; font: 18px system-ui; background: #10141c; color: #eee; }
  #panel { position: fixed; left: 0; top: 0; bottom: 0; width: 220px; overflow: auto; background: #1b2230; }
  #panel button { display: block; margin: 10px; height: 42px; width: 180px; }
  #stuck { position: fixed; left: 400px; top: 2000px; }
  #count { position: fixed; left: 400px; top: 100px; font-size: 40px; }
  #menu { position: fixed; left: 700px; top: 100px; width: 200px; height: 200px; overflow: auto; background: #223049; }
  #menu div { height: 40px; line-height: 40px; padding: 0 10px; }
  #scene { position: fixed; left: 350px; top: 260px; width: 500px; height: 200px; background: #1b2230; }
  #status { position: fixed; left: 400px; top: 300px; padding: 4px 10px; background: #223049; pointer-events: none; }
</style></head><body>
  <div id="scene"></div><div id="status">Positions are locked</div>
  <div id="panel"></div><div id="count">0</div><button id="stuck">Out of reach</button>
  <div id="menu"><div>One</div><div>Two</div><div>Three</div><div>Four</div><div>Five</div><div id="sixth">Six</div><div>Seven</div></div>
  <script>
    const panel = document.getElementById('panel');
    for (let i = 0; i < 60; i++) { const b = document.createElement('button'); b.textContent = 'Item ' + i; panel.appendChild(b); }
    panel.lastElementChild.id = 'last';
    panel.lastElementChild.onclick = () => { document.getElementById('count').textContent = '1'; };
    // A menu whose list scrolls, closed by a click anywhere else (Plenoview's File menu over its scene).
    const menu = document.getElementById('menu');
    document.getElementById('sixth').onclick = () => { document.getElementById('count').textContent = 'menu'; };
    document.addEventListener('click', e => { if (!menu.contains(e.target)) menu.style.display = 'none'; });
    // A busy page: a smooth scroll starts 400 ms after it is asked for (Plenoview's software-rendered scene).
    const scroll = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (o) { setTimeout(() => scroll.call(this, o), 400); };
  </script>
</body></html>`;

test('a scroll that starts late is waited for, and an action outside the picture fails at once', async ({ page }) => {
  await Demo.prepare(page);
  await page.route('https://smoke.test/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: LATE_SCROLL }));
  await page.goto('https://smoke.test/late');
  const demo = new Demo(page, { voiced: false });
  // An item in the frame but clipped by its menu's own scrolling list, the scroll late: the click lands
  // on it (it used to land on the page behind the list, and that closed the menu). Clipped, it is not
  // in view, though its box is in the frame (it read as wholly in view: the page's body was counted).
  expect(await inView(page.locator('#sixth'))).toBe(0);
  // A status line that takes no pointer events, over a scene (Plenoview's over its canvas), is in view
  // (it read 0%: elementsFromPoint skips it and finds the scene), and keeps taking none.
  expect(await inView(page.locator('#status'))).toBe(1);
  expect(await page.locator('#status').evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  await demo.click(page.locator('#sixth'), 200);
  await expect(page.locator('#count')).toHaveText('menu');
  // The last item of a scrolled panel, its scroll late: the click lands on it (it used to land below the frame).
  await demo.click(page.locator('#last'), 200);
  await expect(page.locator('#count')).toHaveText('1');
  expect(demo.y).toBeLessThan(VIDEO.height);
  // Nothing can scroll this one into the frame: named at once, not a click on nothing.
  const started = Date.now();
  await expect(demo.click(page.locator('#stuck'))).rejects.toThrow(/Not in the picture: .*#stuck.* outside the 1440 × 810 frame/);
  expect(Date.now() - started).toBeLessThan(15_000);
});
