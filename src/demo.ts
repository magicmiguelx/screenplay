import type { Locator, Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { overlay, type OverlayApi, type OverlayOptions, type Rect } from './overlay.js';
import { choosePlacement, type Prefer, type Where } from './place.js';
import { Recorder, VIDEO, type RecorderOptions, type Size } from './recorder.js';
import { writeScript, type ScriptLine } from './script.js';
import { Subjects } from './subjects.js';
import { bringIntoView, inView } from './view.js';
import { asSent, clip, clipPath, mix, saidWords, seconds, speakable, voiceAvailable, voiceConfig } from './voice.js';

// The driver: a person driving the app on camera. The overlay's cursor goes
// first, then the real mouse acts; every line is shown as a caption or a
// title card, spoken by the voice when it is on, logged for the script, and
// placed in the video by the recorder's frames.

/** A line of the voice-over script while it is being recorded: its wall-clock span, placed on the frames at save(). */
interface Line { kind: 'card' | 'caption'; text: string; voice: string; from: number; to?: number; at?: Where; cover?: number; seen?: number; subject?: string }

/** What a line is about: the elements it describes (brought into the picture before it is said), or `false` for a line about nothing on the page. */
export type About = Locator | Locator[] | false;

/**
 * How long a line may be up before the element its first action works on
 * is in the picture: a note followed by its click scrolls at once, which
 * the viewer sees as the cursor going to it; a line said in full and then
 * acted on was said over the wrong picture.
 */
const FIRST_ACTION_GRACE_MS = 1500;

/** Where a line asks its caption to sit; neither flag: the emptier position. */
const prefer = (opts: { top?: boolean; bottom?: boolean }): Prefer => (opts.top ? 'top' : opts.bottom ? 'bottom' : 'auto');

/** A breath between one spoken line and the next. */
const BREATH_MS = 400;
/**
 * The overlay's fade-in (the caption's .3 s, the card's .45 s) and the time
 * a drawn frame can lag the page it shows (measured: about half a second
 * over a heavy scene): a line is spoken once it can be read.
 */
const FADE = 1.0;
/** The overlay's longest fade (the card's .45 s), waited out when the screencast is paused. */
const FADE_MS = 500;

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
   * The most of the page's own content a caption may sit over, as a share
   * of its box (0 to 1), at the emptier of its two positions. A line over
   * it fails the take, named, so it can be moved or the screen cleared
   * under it; unset, the cover is only measured and reported (the script's
   * "Over" column, and a note in the log over `coverNote`, default 0.5).
   */
  maxCover?: number;
  coverNote?: number;
  /**
   * Let a caption go to a corner when both centred positions cover more
   * than the line may (`coverNote`, or `maxCover` when lower) and a corner
   * covers clearly less. Default true; the centred positions are always
   * tried first, so a page with room top or bottom looks as before.
   */
  corners?: boolean;
  /**
   * The least of a line's subject that must be in the picture while the
   * line is up, as a share of it (0 to 1; `view.ts` says how a share is
   * measured): the elements given as its `about`, the element in the
   * spotlight, and the element its first action works on (measured before
   * the action scrolls to it). Under it the take fails, named; unset, the
   * share is measured and reported (the script's "Seen" column, and a note
   * in the log under `inViewNote`, default 0.95).
   */
  minInView?: number;
  inViewNote?: number;
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
  /** The lines the voice could not say under its speed limit, failed at save(). */
  private tooFast: string[] = [];
  /** Each spoken text's length, from the durations file and the clips made so far. */
  private spoken: Record<string, number> = {};
  private readonly durationsFile: string | undefined;
  private readonly voiced: boolean;
  /** When the line on screen will have been spoken (ms, this process's clock). */
  private speechEnd = 0;
  /** The caption on screen, to put back after a navigation (a new document has a new overlay) and to keep clear of what a line acts on. */
  private caption: { text: string; prefer: Prefer; at: Where; box: Rect } | null = null;
  private readonly maxCover?: number;
  private readonly coverNote: number;
  private readonly corners: boolean;
  private readonly minInView?: number;
  private readonly inViewNote: number;
  /** A picture card is up: the page behind it is not what a line is about. */
  private pictureUp = false;
  /** Which element each line is about and how much of it was in view (subjects.ts). */
  private readonly subjectsOf: Subjects<Locator>;
  readonly layout: Size;

  constructor(readonly page: Page, opts: DemoOptions = {}) {
    this.layout = opts.layout ?? VIDEO;
    this.rec = new Recorder(page, { ...opts.recorder, size: opts.output ?? VIDEO });
    this.x = this.layout.width / 2;
    this.y = this.layout.height / 2;
    this.durationsFile = opts.durationsFile;
    this.maxCover = opts.maxCover;
    this.coverNote = opts.coverNote ?? 0.5;
    this.corners = opts.corners ?? true;
    this.minInView = opts.minInView;
    this.inViewNote = opts.inViewNote ?? 0.95;
    this.subjectsOf = new Subjects<Locator>({ min: this.minInView, note: this.inViewNote, grace: FIRST_ACTION_GRACE_MS });
    this.voiced = opts.voiced ?? (voiceAvailable() && process.env.DEMOS_VOICE !== '0');
    if (this.durationsFile) {
      try { this.spoken = JSON.parse(readFileSync(this.durationsFile, 'utf8')); } catch { /* a new file */ }
    }
    // A cut while a line is still being spoken takes the cut's length out
    // of the line's room (the wall clock runs on while the picture stops):
    // give it back, so the caption stays up until the voice is done in the
    // video. Frames drawn by hand in the cut already carried the line
    // (drawFrames and still() last at least the rest of it), so a cut with
    // drawn frames extends nothing.
    this.rec.onResume = (cut, drawn) => {
      const pausedAt = Date.now() - cut * 1000;
      if (drawn === 0 && this.speechEnd > pausedAt) this.speechEnd += cut * 1000;
      // A cut after a line ended starts a new picture: what comes next is not what the line was said over.
      this.subjectsOf.resumed(this.open);
    };
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
      // The cut is this method's only when the caller had not already paused:
      // an earlier version resumed either way, and a line set while paused
      // (to be drawn as a still) got a second of live frames before it.
      const cut = !existsSync(clipPath(said)) && !this.rec.paused;
      if (cut) this.rec.pause();
      try {
        const file = await clip(said, { log: false });
        this.spoken[said] = Math.round(seconds(file) * 100) / 100;
      } catch (e) {
        if (!(e instanceof Error) || !e.message.startsWith('Spoken too fast')) throw e;
        // A line over the speed limit is listed and the take goes on, given the room the line would
        // take at the limit: save() fails with every such line, so they are all rewritten at once
        // rather than one take each (the CLI's `speak` does the same over finished scripts).
        this.tooFast.push(e.message);
        console.log(`  ${e.message}`);
        this.spoken[said] = Math.round((saidWords(asSent(said)).length / voiceConfig().maxWordsPerSecond) * 100) / 100;
      } finally {
        if (cut) this.rec.resume();
      }
    }
    return said;
  }

  /** Log a caption (or its end, `text` null) for the script. */
  private logCaption(text: string | null, voice = '') {
    const now = Date.now() / 1000;
    if (this.open) { this.open.to = now; this.open = null; }
    if (text) {
      this.open = { kind: 'caption', text, voice, from: now, ...(this.pendingCover ?? {}) };
      this.pendingCover = null;
      this.lines.push(this.open);
    }
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

  /**
   * Put the cursor, and the caption still up, back after a navigation: a
   * new document has a new, empty overlay, so a note kept across a cut
   * would be in the script yet out of the picture.
   */
  async restore() {
    await this.ui('cursorTo', this.x, this.y, 0);
    if (this.caption) await this.showCaption(this.caption.text, this.caption.prefer);
  }

  /**
   * The overlay has drawn what was just changed, and its fade is over: the
   * line can be read, so it can be spoken. While the screencast is paused
   * there is no frame to wait for: the fade is waited out, so the first
   * frame drawn by hand after it (`still()`, `drawFrames()`, an orbit) has
   * the line fully in, and the line is spoken as that frame starts.
   */
  private async shown() {
    if (this.rec.paused) { await this.wait(FADE_MS); return; }
    await this.rec.painted(Date.now() / 1000, FADE);
  }

  /**
   * A title card over the app; `voice` is what is said, if not the title and
   * the line under it. `hold` leaves the card up: the closing card stays to
   * the end of the video (an earlier version took it down half a second
   * before the end, and a video ended on a flash of the editor). While the
   * screencast is paused the card is set and logged and that is all: it is
   * left up for the frames drawn next (`still()`), which last as long as
   * its line needs, since no frame would show it being held here.
   */
  async card(kicker: string, title: string, sub: string, ms = 4500, voice?: string, opts: { hold?: boolean } = {}) {
    const { line, said } = await this.showCard(kicker, title, sub, voice);
    this.spokenNow(said);
    if (this.rec.paused) return;
    await this.wait(ms);
    await this.waitSpeech();
    if (opts.hold) return;
    await this.ui('card', null);
    line.to = Date.now() / 1000;
    await this.wait(500);
  }

  /**
   * Put a title card up once the line before has been spoken, and log it
   * once it can be read: the start of `card()` and `cardAcross()`.
   */
  private async showCard(kicker: string, title: string, sub: string, voice?: string) {
    await this.waitSpeech();
    this.logCaption(null);
    this.subjectsOf.commit();
    this.subjectsOf.drop();
    this.caption = null; // the card ends the line; a restore() under it must not bring it back
    const said = await this.voiceOf(cardText(title, sub), voice);
    await this.ui('card', kicker, title, sub);
    await this.shown();
    const line: Line = { kind: 'card', text: cardText(title, sub), voice: said, from: Date.now() / 1000 };
    this.lines.push(line);
    return { line, said };
  }

  /**
   * A title card held across something done off camera (a page load, an
   * external site): the card comes up, the video cuts while `between` runs,
   * and the card is back in the new document, settled, before the video
   * resumes.
   */
  async cardAcross(kicker: string, title: string, sub: string, between: () => Promise<unknown>, ms = 4200, voice?: string) {
    const { line, said } = await this.showCard(kicker, title, sub, voice);
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
   * (docs/writing-for-the-ear.md). While the screencast is paused it is a
   * `note()`: set and logged, left up for the frames drawn next.
   */
  async say(text: string, opts: { ms?: number; keep?: boolean; top?: boolean; bottom?: boolean; voice?: string; about?: About } = {}) {
    await this.note(text, opts);
    if (!opts.keep && !this.rec.paused) {
      await this.wait(opts.ms ?? readMs(text));
      await this.waitSpeech();
      await this.showCaption(null);
      this.logCaption(null);
      await this.wait(250);
    }
  }

  /** Show a caption while something else happens; the next say() replaces it. */
  async note(text: string, opts: { top?: boolean; bottom?: boolean; voice?: string; about?: About } = {}) {
    await this.waitSpeech();
    const said = await this.voiceOf(text, opts.voice);
    this.logCaption(null);
    const boxes = await this.subjects(opts.about);
    await this.showCaption(text, prefer(opts), boxes);
    await this.shown();
    this.logCaption(text, said);
    this.spokenNow(said);
    await this.checkSubjects(opts.about);
  }

  /** A line's `about` as a list. */
  private static aboutList(about: About | undefined): Locator[] {
    return !about ? [] : Array.isArray(about) ? about : [about];
  }

  /**
   * Bring what a line is about into the picture before it is said, and
   * return the boxes the caption keeps off (with the spotlit element's).
   * Under a picture card the page is not scrolled: the picture was taken
   * already, so its subject was put in view on its own page before
   * (`bringIntoView`), and is only measured.
   */
  private async subjects(about: About | undefined): Promise<Rect[] | null> {
    const list = Demo.aboutList(about);
    if (!list.length) return null;
    const boxes: Rect[] = this.spotBox ? [this.spotBox] : [];
    for (const target of list) {
      if (!this.pictureUp) await bringIntoView(target);
      if (!this.pictureUp && target.page() === this.page) {
        const box = await target.boundingBox();
        if (box) boxes.push(box);
      }
    }
    return boxes;
  }

  /**
   * The line just shown has its subjects in the picture: its `about`, and
   * the spotlit element. The least share is kept on the line; under
   * `minInView` the take fails. A line with no `about` waits for its first
   * action to name its subject (`firstAction`).
   */
  private async checkSubjects(about: About | undefined) {
    const line = this.open;
    if (!line) return;
    // A spotlight put up after the line before and still on is this line's setup, not the last line's subject.
    this.subjectsOf.shown(this.spotTarget);
    for (const target of Demo.aboutList(about)) this.subjectsOf.record(line, await this.settledInView(target), target, 'about');
    if (this.spotTarget && !this.pictureUp) this.subjectsOf.record(line, await this.settledInView(this.spotTarget), this.spotTarget, 'in the spotlight');
    this.subjectsOf.waitFor(line, Date.now(), about === undefined && !this.pictureUp);
  }

  /**
   * The element an action is about to work on (a click, a field, a
   * spotlight), measured before the action scrolls to it: if it is the
   * first action since a line went up and the line has been up a while,
   * the line was said with this element out of the picture.
   */
  private async firstAction(target: Locator, spotlight = false) {
    const line = this.subjectsOf.acting(Date.now(), this.pictureUp || target.page() !== this.page);
    if (!line) return;
    // A spotlight after a line has ended is either that line's subject or
    // the next line's setup ("spot, then say"): it is held until the next
    // line shows whether that line uses it.
    this.subjectsOf.acted(line, await inView(target), target, { spotlight, open: this.open });
  }

  /**
   * The share of a subject in view once the page has settled: measured
   * again for up to a second while it is short (a page just navigated to
   * can show its content a moment after mounting it), the best kept.
   */
  private async settledInView(target: Locator) {
    let best = await inView(target);
    for (let i = 0; i < 4 && best < (this.minInView ?? this.inViewNote); i++) {
      await this.wait(250);
      best = Math.max(best, await inView(target));
    }
    return best;
  }

  /** Take the caption down, once its line has been spoken. */
  async clearNote() { await this.waitSpeech(); await this.showCaption(null); this.logCaption(null); }

  /**
   * Draw a caption where it covers the least of the page's own content
   * (or take it down, `text` null), clear of `avoid` (the element the line
   * acts on), and remember it for `restore()` and `keepClear()`. The cover
   * is logged on the line; over `maxCover` the take fails, named.
   */
  private async showCaption(text: string | null, prefer: Prefer = 'auto', avoid: Rect | Rect[] | null = null) {
    if (!text) { this.caption = null; await this.ui('caption', null); return; }
    avoid ??= this.spotBox;
    const covers = await this.page.evaluate(([t, a]) => {
      const d = (window as unknown as { __demo?: OverlayApi }).__demo;
      if (!d) throw new Error('The overlay is not in this document: call Demo.prepare(page) before the first navigation.');
      return d.measure(t, a);
    }, [text, avoid] as const);
    const shares = Object.fromEntries(Object.entries(covers).map(([w, p]) => [w, p.cover])) as Record<Where, number>;
    const corners = this.corners ? Math.min(this.coverNote, this.maxCover ?? 1) : undefined;
    const at = choosePlacement(shares, prefer, { corners });
    const cover = covers[at].cover;
    this.caption = { text, prefer, at, box: covers[at].box };
    await this.ui('caption', text, at);
    this.pendingCover = { at, cover };
    if (this.maxCover !== undefined && cover > this.maxCover) {
      throw new Error(`Caption over content: ${Math.round(Math.min(1, cover) * 100)}% of its box at the ${at}${cover > 1 ? ', on the element the line acts on' : ''} (bottom ${Math.round(Math.min(1, covers.bottom.cover) * 100)}%, top ${Math.round(Math.min(1, covers.top.cover) * 100)}%), over ${this.maxCover}: move it, or clear the screen under it: "${text}"`);
    }
    if (cover > this.coverNote) console.log(`  caption over ${Math.round(Math.min(1, cover) * 100)}% content at the ${at}${cover > 1 ? ' and on the target' : ''}: ${text}`);
  }
  /** The cover measured for the caption being logged next. */
  private pendingCover: { at: Where; cover: number } | null = null;

  /**
   * Keep the caption up clear of a box the next action is about: if it
   * sits over it, it moves to the other position (the line's own choice
   * of position is kept, the cover is marked so the script shows it).
   */
  private async keepClear(box: Rect | null) {
    const c = this.caption;
    if (!c || !box) return;
    const b = c.box;
    const over = b.x < box.x + box.width && b.x + b.width > box.x && b.y < box.y + box.height && b.y + b.height > box.y;
    if (!over) return;
    await this.showCaption(c.text, c.prefer, box);
    if (this.open && this.pendingCover) { this.open.at = this.pendingCover.at; this.open.cover = this.pendingCover.cover; }
  }

  /** A picture (a data: URL or an address the page can load) over the app, or none. */
  async picture(src: string | null) { await this.ui('picture', src); this.pictureUp = !!src; }

  /** Outline an element (or nothing) to draw the eye to it. */
  async spot(target: Locator | null) {
    if (target) { await this.firstAction(target, true); await bringIntoView(target); }
    else this.subjectsOf.commit();
    const box = target ? await target.boundingBox() : null;
    await this.keepClear(box);
    await this.ui('spot', box);
    this.spotBox = box;
    this.spotTarget = target;
    // Lit under a line that is up: it is what the line is about now.
    if (target && this.open && !this.pictureUp) this.subjectsOf.record(this.open, await this.settledInView(target), target, 'in the spotlight');
  }
  /** The spotlit element while the spotlight is on: a caption placed meanwhile keeps off it. */
  private spotBox: Rect | null = null;
  private spotTarget: Locator | null = null;

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
    await this.firstAction(target);
    await bringIntoView(target);
    const box = await target.boundingBox();
    if (!box) throw new Error(`Not on screen: ${target}`);
    await this.keepClear(box);
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
    // The video has moved on by `length`: the line on screen has been spoken.
    this.speechEnd = 0;
  }

  /**
   * A still drawn by hand: one screenshot held for `secs`, or longer if the
   * line on screen needs it, with the screencast paused. For a card, a
   * picture or a caption over a page that screencasts slowly (a lit scene
   * on a software renderer sends under a frame a second): set the line
   * while paused, then `still()`, and it is spoken as the still starts
   * rather than whenever the next frame happens to arrive. The video has
   * moved on by `secs` when it is over, so the line counts as spoken.
   */
  async still(secs: number) {
    const length = Math.max(secs, (this.speechEnd - Date.now()) / 1000 + 0.3);
    this.rec.pause();
    this.rec.addFrame(await this.page.screenshot({ type: 'jpeg', quality: 92 }), length);
    this.rec.resume();
    this.speechEnd = 0;
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
    this.subjectsOf.commit();
    if (this.tooFast.length) {
      this.rec.dispose();
      throw new Error(`${this.tooFast.length} line${this.tooFast.length === 1 ? '' : 's'} the voice cannot say under its speed limit; give each a pause or fewer words, then record again:\n${this.tooFast.join('\n')}`);
    }
    mkdirSync(dirname(out), { recursive: true });
    const end = Date.now() / 1000;
    await this.rec.save(out);
    const lines: ScriptLine[] = this.lines.map(l => ({ kind: l.kind, text: l.text, voice: l.voice, start: this.rec.videoTime(l.from), end: this.rec.videoTime(l.to ?? end), ...(l.at ? { at: l.at, cover: l.cover } : {}), ...(l.seen !== undefined ? { seen: l.seen, subject: l.subject } : {}) }));
    const length = this.rec.videoTime(end);
    const busy = lines.filter(l => (l.cover ?? 0) > this.coverNote);
    if (busy.length) console.log(`${busy.length} caption${busy.length === 1 ? '' : 's'} over more than ${Math.round(this.coverNote * 100)}% content (the script's Over column):\n${busy.map(l => `  ${l.at} ${Math.round(Math.min(1, l.cover ?? 0) * 100)}%${(l.cover ?? 0) > 1 ? ' on the target' : ''}  ${l.text}`).join('\n')}`);
    const unseen = lines.filter(l => l.seen !== undefined && l.seen < this.inViewNote);
    if (unseen.length) console.log(`${unseen.length} line${unseen.length === 1 ? '' : 's'} with its subject under ${Math.round(this.inViewNote * 100)}% in view (the script's Seen column):\n${unseen.map(l => `  ${Math.round((l.seen ?? 0) * 100)}%  ${l.text}  (${l.subject})`).join('\n')}`);
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
