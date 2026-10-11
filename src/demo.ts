import type { Locator, Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { overlay, type OverlayApi, type OverlayOptions } from './overlay.js';
import { Recorder, VIDEO, type RecorderOptions, type Size } from './recorder.js';
import { writeScript, type ScriptLine } from './script.js';
import { clip, clipPath, mix, seconds, speakable, voiceAvailable } from './voice.js';

// The driver: a person driving the app on camera. The overlay's cursor goes
// first, then the real mouse acts; every line is shown as a caption or a
// title card, spoken by the voice when it is on, logged for the script, and
// placed in the video by the recorder's frames.

/** A line of the voice-over script while it is being recorded: its wall-clock span, placed on the frames at save(). */
interface Line { kind: 'card' | 'caption'; text: string; voice: string; from: number; to?: number }

/** A breath between one spoken line and the next. */
const BREATH_MS = 400;
/**
 * The overlay's fade-in (the caption's .3 s, the card's .45 s) and the time
 * a drawn frame can lag the page it shows (measured: about half a second
 * over a heavy scene): a line is spoken once it can be read.
 */
const FADE = 1.0;

/** A title card's line: the title and the line under it, as one text. */
export const cardText = (title: string, sub: string) => (/[.?!]$/.test(title) ? `${title} ${sub}` : `${title}. ${sub}`);

/** Milliseconds a caption needs on screen to be read: a second plus a third of one per word. */
export const readMs = (text: string) => 1200 + text.split(/\s+/).length * 330;

export interface DemoOptions {
  /** The video's frame (VIDEO, or VIDEO_HD drawn at a higher device scale factor). Default VIDEO. */
  output?: Size;
  /** The page's layout size: the cursor's coordinates are the page's. Default VIDEO. */
  layout?: Size;
  /**
   * How long each spoken line takes (seconds, by its spoken text), kept in
   * this JSON file: the recording waits for it, so the voice has room for
   * every line, and a re-recording without the key keeps the same room.
   */
  durationsFile?: string;
  /** Make and mix the voice. Default: ELEVENLABS_API_KEY set and DEMOS_VOICE not "0". */
  voiced?: boolean;
  recorder?: Omit<RecorderOptions, 'size'>;
}

export class Demo {
  x: number;
  y: number;
  readonly rec: Recorder;
  /** Everything said on screen, for the voice-over script. */
  private lines: Line[] = [];
  private open: Line | null = null;
  /** Each spoken text's length, from the durations file and the clips made so far. */
  private spoken: Record<string, number> = {};
  private readonly durationsFile: string | undefined;
  private readonly voiced: boolean;
  /** When the line on screen will have been spoken (ms, this process's clock). */
  private speechEnd = 0;
  readonly layout: Size;

  constructor(readonly page: Page, opts: DemoOptions = {}) {
    this.layout = opts.layout ?? VIDEO;
    this.rec = new Recorder(page, { ...opts.recorder, size: opts.output ?? VIDEO });
    this.x = this.layout.width / 2;
    this.y = this.layout.height / 2;
    this.durationsFile = opts.durationsFile;
    this.voiced = opts.voiced ?? (voiceAvailable() && process.env.DEMOS_VOICE !== '0');
    if (this.durationsFile) {
      try { this.spoken = JSON.parse(readFileSync(this.durationsFile, 'utf8')); } catch { /* a new file */ }
    }
  }

  /** Install the overlay in this and every later document; call before the first navigation. */
  static async prepare(page: Page, opts: OverlayOptions = {}) {
    await page.addInitScript(overlay, opts);
  }

  private ui<K extends keyof OverlayApi>(fn: K, ...args: Parameters<OverlayApi[K]>) {
    return this.page.evaluate(([fn, args]) => {
      const d = (window as unknown as { __demo?: Record<string, (...a: unknown[]) => void> }).__demo;
      // Loud, not silent: an earlier version drew nothing and recorded an invisible overlay.
      if (!d) throw new Error('The overlay is not in this document: call Demo.prepare(page) before the first navigation, and load the page with page.goto() (init scripts do not run for setContent()).');
      d[fn as string](...(args as unknown[]));
    }, [fn, args] as const);
  }

  wait(ms: number) { return this.page.waitForTimeout(ms); }

  /** Wait until the line being spoken has finished, before the next one replaces it. */
  private async waitSpeech() {
    const left = this.speechEnd - Date.now();
    if (left > 0) await this.wait(left);
  }

  /** A line starts now: it is spoken for this long. */
  private spokenNow(voice: string) {
    const s = this.spoken[voice];
    this.speechEnd = s ? Date.now() + s * 1000 + BREATH_MS : 0;
  }

  /**
   * What a line says aloud (its own spoken text, else the caption's
   * symbols in words), its clip made first when the voice is on: the video
   * is cut while the clip is made, so the wait never shows.
   */
  private async voiceOf(caption: string, voice?: string) {
    const said = voice ?? speakable(caption);
    if (this.voiced) {
      const cached = existsSync(clipPath(said));
      if (!cached) this.rec.pause();
      const file = await clip(said, { log: false });
      if (!cached) this.rec.resume();
      this.spoken[said] = Math.round(seconds(file) * 100) / 100;
    }
    return said;
  }

  /** Log a caption (or its end, `text` null) for the script. */
  private logCaption(text: string | null, voice = '') {
    const now = Date.now() / 1000;
    if (this.open) { this.open.to = now; this.open = null; }
    if (text) { this.open = { kind: 'caption', text, voice, from: now }; this.lines.push(this.open); }
  }

  /** Start recording, the cursor parked mid-screen; the first frames are in before anything is shown. */
  async start() {
    await this.ui('cursorTo', this.x, this.y, 0);
    await this.rec.start();
    // The screencast's first frames can carry what the page looked like
    // before it started: the stream warms up off camera, so the opening
    // card's painted() can tell when the card is in the picture.
    await this.rec.painted(Date.now() / 1000 + 0.5);
    this.rec.discard();
  }

  /** Put the cursor back where it was after a navigation (a new document has a new overlay). */
  async restore() { await this.ui('cursorTo', this.x, this.y, 0); }

  /** The overlay has drawn what was just changed, and its fade is over: the line can be read, so it can be spoken. */
  private async shown() {
    await this.rec.painted(Date.now() / 1000 + FADE);
  }

  /**
   * A title card over the app; `voice` is what is said, if not the title and
   * the line under it. `hold` leaves the card up: the closing card stays to
   * the end of the video (an earlier version took it down half a second
   * before the end, and a video ended on a flash of the editor).
   */
  async card(kicker: string, title: string, sub: string, ms = 4500, voice?: string, opts: { hold?: boolean } = {}) {
    await this.waitSpeech();
    this.logCaption(null);
    const said = await this.voiceOf(cardText(title, sub), voice);
    await this.ui('card', kicker, title, sub);
    await this.shown();
    const line: Line = { kind: 'card', text: cardText(title, sub), voice: said, from: Date.now() / 1000 };
    this.lines.push(line);
    this.spokenNow(said);
    await this.wait(ms);
    await this.waitSpeech();
    if (opts.hold) return;
    await this.ui('card', null);
    line.to = Date.now() / 1000;
    await this.wait(500);
  }

  /**
   * A title card held across something done off camera (a page load, an
   * external site): the card comes up, the video cuts while `between` runs,
   * and the card is back in the new document, settled, before the video
   * resumes.
   */
  async cardAcross(kicker: string, title: string, sub: string, between: () => Promise<unknown>, ms = 4200, voice?: string) {
    await this.waitSpeech();
    this.logCaption(null);
    const said = await this.voiceOf(cardText(title, sub), voice);
    await this.ui('card', kicker, title, sub);
    await this.shown();
    const line: Line = { kind: 'card', text: cardText(title, sub), voice: said, from: Date.now() / 1000 };
    this.lines.push(line);
    // The voice runs on the video's timeline: what is cut out doesn't count towards it.
    const voiceMs = (this.spoken[said] ?? 0) * 1000 + BREATH_MS;
    const before = Math.max(ms * 0.6, voiceMs - ms * 0.4);
    await this.wait(before);
    this.rec.pause();
    await between();
    await this.ui('card', kicker, title, sub);
    await this.restore();
    await this.wait(900);
    this.rec.resume();
    await this.wait(ms * 0.4);
    await this.ui('card', null);
    line.to = Date.now() / 1000;
    await this.wait(500);
  }

  /**
   * A caption, held long enough to read (or `ms`) and to be spoken; `keep`
   * leaves it up while the next actions run. `voice` is what is said when
   * it should differ from the caption: written for the ear
   * (docs/writing-for-the-ear.md).
   */
  async say(text: string, opts: { ms?: number; keep?: boolean; top?: boolean; voice?: string } = {}) {
    await this.waitSpeech();
    const said = await this.voiceOf(text, opts.voice);
    this.logCaption(null);
    await this.ui('caption', text, !!opts.top);
    await this.shown();
    this.logCaption(text, said);
    this.spokenNow(said);
    if (!opts.keep) {
      await this.wait(opts.ms ?? readMs(text));
      await this.waitSpeech();
      await this.ui('caption', null);
      this.logCaption(null);
      await this.wait(250);
    }
  }

  /** Show a caption while something else happens; the next say() replaces it. */
  async note(text: string, opts: { top?: boolean; voice?: string } = {}) {
    await this.waitSpeech();
    const said = await this.voiceOf(text, opts.voice);
    this.logCaption(null);
    await this.ui('caption', text, !!opts.top);
    await this.shown();
    this.logCaption(text, said);
    this.spokenNow(said);
  }

  /** Take the caption down, once its line has been spoken. */
  async clearNote() { await this.waitSpeech(); await this.ui('caption', null); this.logCaption(null); }

  /** A picture (a data: URL or an address the page can load) over the app, or none. */
  async picture(src: string | null) { await this.ui('picture', src); }

  /** Outline an element (or nothing) to draw the eye to it. */
  async spot(target: Locator | null) {
    if (target) await target.scrollIntoViewIfNeeded();
    await this.ui('spot', target ? await target.boundingBox() : null);
  }

  /** Glide the cursor to a point, then move the real mouse there (hover effects follow the cursor). */
  async moveTo(x: number, y: number, ms?: number) {
    const dist = Math.hypot(x - this.x, y - this.y);
    const time = ms ?? Math.round(Math.min(1100, Math.max(350, dist * 1.1)));
    await this.ui('cursorTo', x, y, time);
    await this.wait(time);
    await this.page.mouse.move(x, y, { steps: 2 });
    this.x = x;
    this.y = y;
  }

  /** The middle of an element, scrolled into view first. */
  async center(target: Locator): Promise<[number, number]> {
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error(`Not on screen: ${target}`);
    return [box.x + box.width / 2, box.y + box.height / 2];
  }

  async hover(target: Locator, pause = 400) {
    const [x, y] = await this.center(target);
    await this.moveTo(x, y);
    await this.wait(pause);
  }

  /** Glide to a point, ring it, click it. */
  async clickAt(x: number, y: number, pause = 600) {
    await this.moveTo(x, y);
    await this.wait(180);
    await this.ui('press', x, y);
    await this.page.mouse.click(x, y, { delay: 70 });
    await this.wait(pause);
  }

  async click(target: Locator, pause = 600) {
    const [x, y] = await this.center(target);
    await this.clickAt(x, y, pause);
  }

  async clickAtPoint(p: [number, number], pause = 700) { await this.clickAt(p[0], p[1], pause); }

  /**
   * Click a point that may still be moving (an object in a scene whose
   * camera is settling after a view change): `where` is asked again until
   * it answers the same place twice, then the click lands.
   */
  async clickSettled(where: () => Promise<[number, number]>, pause = 900) {
    let pos = await where();
    for (let i = 0; i < 20; i++) {
      await this.wait(150);
      const next = await where();
      const moved = Math.hypot(next[0] - pos[0], next[1] - pos[1]);
      pos = next;
      if (moved < 1) break;
    }
    await this.clickAt(pos[0], pos[1], pause);
  }

  /** Click into a field and type, a key at a time; `replace` selects what is there first. */
  async type(target: Locator, text: string, opts: { replace?: boolean; delay?: number } = {}) {
    await this.click(target, 250);
    if (opts.replace) await this.page.keyboard.press('ControlOrMeta+a');
    if (opts.replace && !text) await this.page.keyboard.press('Backspace');
    await target.pressSequentially(text, { delay: opts.delay ?? 40 });
    await this.wait(400);
  }

  /** Choose in a <select> (headless Chromium never draws the open list, so the choice lands at once). */
  async choose(target: Locator, value: string, pause = 700) {
    const [x, y] = await this.center(target);
    await this.moveTo(x, y);
    await this.wait(200);
    await this.ui('press', x, y);
    await target.selectOption(value);
    await this.wait(pause);
  }

  /** Drag a range input's thumb to `value`. */
  async slide(target: Locator, value: number, pause = 600) {
    const box = (await target.boundingBox())!;
    const [min, max, now] = await target.evaluate((el: HTMLInputElement) => [Number(el.min || 0), Number(el.max || 100), Number(el.value)]);
    const at = (v: number) => box.x + 8 + ((v - min) / (max - min)) * (box.width - 16);
    const y = box.y + box.height / 2;
    await this.moveTo(at(now), y);
    await this.ui('press', at(now), y);
    await this.page.mouse.down();
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const x = at(now + ((value - now) * i) / steps);
      await this.ui('cursorTo', x, y, 70);
      await this.page.mouse.move(x, y);
      await this.wait(70);
      this.x = x;
    }
    await this.page.mouse.up();
    // Land exactly on the value (the thumb's pixels round).
    await target.fill(String(value));
    await this.wait(pause);
  }

  /** Press and drag from one point to another in small steps, the cursor along. */
  async drag(from: [number, number], to: [number, number], steps = 14, pause = 700) {
    await this.moveTo(from[0], from[1]);
    await this.ui('press', from[0], from[1]);
    await this.page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      const x = from[0] + ((to[0] - from[0]) * i) / steps;
      const y = from[1] + ((to[1] - from[1]) * i) / steps;
      await this.ui('cursorTo', x, y, 60);
      await this.page.mouse.move(x, y);
      await this.wait(60);
    }
    await this.page.mouse.up();
    [this.x, this.y] = to;
    await this.wait(pause);
  }

  /**
   * A smooth move drawn frame by frame while the screencast is paused, so
   * it is smooth however slowly the page renders (a software-rendered
   * scene screencasts at a few frames a second): `draw(u)` puts the page at
   * fraction `u` (0..1, eased in and out) of the move and resolves once it
   * is rendered; a screenshot is then kept as a frame of 1 / fps seconds.
   * A line being spoken gets the room it needs: the move lasts at least as
   * long as what is left of it. The video has moved on by `seconds` when it
   * is over, so the line on screen counts as spoken.
   */
  async drawFrames(secs: number, draw: (u: number, i: number, frames: number) => Promise<void>, opts: { fps?: number; ease?: boolean } = {}) {
    const fps = opts.fps ?? 30;
    const length = Math.max(secs, (this.speechEnd - Date.now()) / 1000 + 0.3);
    const frames = Math.round(length * fps);
    this.rec.pause();
    for (let i = 1; i <= frames; i++) {
      const u = i / frames;
      const eased = opts.ease === false ? u : u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      await draw(eased, i, frames);
      this.rec.addFrame(await this.page.screenshot({ type: 'jpeg', quality: 92 }), 1 / fps);
    }
    this.rec.resume();
    this.speechEnd = Math.min(this.speechEnd, Date.now());
  }

  /** A key press, then a pause. */
  async key(key: string, pause = 900) {
    await this.page.keyboard.press(key);
    await this.wait(pause);
  }

  /** A still for a <video poster>. */
  async poster(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    await this.page.screenshot({ path, type: 'jpeg', quality: 78 });
  }

  /** The video's length so far (seconds), by the frames. */
  get length() { return this.rec.videoTime(Date.now() / 1000); }

  /**
   * Encode the video to `out`, and write its voice-over script to
   * `scriptBase`.vtt, .json and .md (script.ts). With the voice on, the
   * clips are mixed in. Each spoken line's length goes to the durations
   * file, for a re-recording without the voice.
   */
  async save(out: string, scriptBase: string, info: { title: string; spec: string; root?: string }) {
    await this.waitSpeech();
    this.logCaption(null);
    mkdirSync(dirname(out), { recursive: true });
    const end = Date.now() / 1000;
    await this.rec.save(out);
    const lines: ScriptLine[] = this.lines.map(l => ({ kind: l.kind, text: l.text, voice: l.voice, start: this.rec.videoTime(l.from), end: this.rec.videoTime(l.to ?? end) }));
    const length = this.rec.videoTime(end);
    writeScript(scriptBase, lines, { title: info.title, spec: info.spec, root: info.root ?? process.cwd(), video: resolve(out), length, spoken: this.spoken });
    if (this.durationsFile) {
      let durations: Record<string, number> = {};
      try { durations = JSON.parse(readFileSync(this.durationsFile, 'utf8')); } catch { /* a new file */ }
      for (const l of lines) if (this.spoken[l.voice]) durations[l.voice] = this.spoken[l.voice];
      mkdirSync(dirname(this.durationsFile), { recursive: true });
      writeFileSync(this.durationsFile, JSON.stringify(Object.fromEntries(Object.entries(durations).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n');
    }
    if (this.voiced && lines.length) mix(out, await Promise.all(lines.map(async l => ({ file: await clip(l.voice, { log: false }), at: Math.round(l.start * 1000) }))));
    return { length, lines };
  }
}
