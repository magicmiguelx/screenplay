import type { CDPSession, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Timeline, type Frame } from './timeline.js';

// The recorder. Playwright's own video is a 1 Mbit/s VP8 that blurs the
// panels' text, so the frames come from the DevTools screencast as JPEGs,
// timed by the browser, and are encoded here with ffmpeg (H.264, the
// system's ffmpeg with libx264). The video has one timeline, made from the
// frames (Timeline): the voice-over script and the clips are placed by the
// same frames, so the voice stays on the picture across every cut.

export type Size = { width: number; height: number };

/**
 * The frame folders of the recorders not yet saved or disposed: removed
 * when the process exits, so a take that failed (a line too fast, a
 * caption over content, a subject out of the picture) does not leave its
 * frames behind. A three-minute take at full HD is hundreds of megabytes
 * of JPEGs, and the take fails on purpose.
 */
const live = new Set<string>();
let exitHook = false;
function track(dir: string) {
  live.add(dir);
  if (exitHook) return;
  exitHook = true;
  process.once('exit', () => { for (const d of live) rmSync(d, { recursive: true, force: true }); });
}

/** Every video is laid out at this size (16:9; wide enough that an app's side panels stay pinned). */
export const VIDEO: Size = { width: 1440, height: 810 };
/**
 * A full-HD frame. The page keeps the layout size (`VIDEO`, so every
 * control and coordinate is where the other videos have them) and is drawn
 * at a higher pixel density (Playwright's `deviceScaleFactor`,
 * VIDEO_HD.width / VIDEO.width); the screencast and the screenshots then
 * come out at this size.
 */
export const VIDEO_HD: Size = { width: 1920, height: 1080 };

export interface RecorderOptions {
  /** The frame size the screencast is capped to and the video is scaled to. Default VIDEO. */
  size?: Size;
  /** JPEG quality of the screencast frames and the frames drawn by hand. Default 92. */
  quality?: number;
  /** Frames a second of the encoded video. Default 30. */
  fps?: number;
  /** libx264's constant rate factor. Default 25 (sharp text at a modest size). */
  crf?: number;
  /** The ffmpeg binary. Default $FFMPEG, else `ffmpeg` on the PATH. */
  ffmpeg?: string;
  /** Prefix of the temporary frames folder. */
  tmpPrefix?: string;
}

/**
 * The page's screencast, kept as numbered JPEGs with the browser's
 * timestamps, cut with pause() / resume(), with frames drawn by hand added
 * while paused (addFrame), and encoded on save().
 */
export class Recorder {
  private cdp: CDPSession | null = null;
  readonly timeline = new Timeline();
  /** Where the frames are kept until the video is encoded (removed on save(), dispose(), the page closing or the process exiting). */
  readonly dir: string;
  private n = 0;
  private recording = false;
  /** While paused: when the picture stopped. */
  private pausedAt: number | null = null;
  /** Seconds of frames drawn by hand in the current pause. */
  private drawnInPause = 0;
  /**
   * Called on resume() with the cut's length and the seconds of frames
   * drawn by hand in it (wall-clock seconds, video seconds): the driver
   * gives a line spoken across the cut the cut's length back.
   */
  onResume?: (cut: number, drawn: number) => void;
  /** Waiting for a frame to be drawn (painted()). */
  private painters: ((frame: Frame) => void)[] = [];
  /** When recording started, by this process's clock (seconds). */
  startedAt = 0;
  readonly size: Size;
  private readonly opts: Required<Omit<RecorderOptions, 'size' | 'tmpPrefix'>>;

  constructor(private page: Page, opts: RecorderOptions = {}) {
    this.size = opts.size ?? VIDEO;
    this.opts = { quality: opts.quality ?? 92, fps: opts.fps ?? 30, crf: opts.crf ?? 25, ffmpeg: opts.ffmpeg ?? process.env.FFMPEG ?? 'ffmpeg' };
    this.dir = mkdtempSync(join(tmpdir(), opts.tmpPrefix ?? 'screenplay-'));
    track(this.dir);
    // The page closes when its test ends, failed or not: its frames go with it.
    page.once('close', () => this.dispose());
  }

  /** Stop the screencast and remove the frames; save() calls it once the video is encoded. Safe to call again. */
  dispose() {
    this.recording = false;
    this.disposed = true;
    void this.cdp?.send('Page.stopScreencast').catch(() => {});
    rmSync(this.dir, { recursive: true, force: true });
    live.delete(this.dir);
  }
  private disposed = false;

  get frames(): readonly Frame[] { return this.timeline.frames; }

  private async startCast() {
    await this.cdp!.send('Page.startScreencast', { format: 'jpeg', quality: this.opts.quality, maxWidth: this.size.width, maxHeight: this.size.height, everyNthFrame: 1 });
  }

  private keep(file: string, wall: number, hold?: number) {
    const frame = this.timeline.add(file, wall, hold);
    const painters = this.painters;
    this.painters = [];
    for (const done of painters) done(frame);
  }

  private nextFile() {
    return join(this.dir, `f${String(this.n++).padStart(6, '0')}.jpg`);
  }

  async start() {
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on('Page.screencastFrame', f => {
      if (this.recording && !this.disposed) {
        const file = this.nextFile();
        writeFileSync(file, Buffer.from(f.data, 'base64'));
        this.keep(file, f.metadata.timestamp ?? Date.now() / 1000);
      }
      void this.cdp?.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    // A navigation (back from an external page) can end the screencast: start it again.
    this.page.on('framenavigated', frame => { if (this.recording && !this.disposed && frame === this.page.mainFrame()) void this.startCast().catch(() => {}); });
    this.recording = true;
    this.startedAt = Date.now() / 1000;
    await this.startCast();
  }

  /** Forget the frames so far: the video starts with the next one. */
  discard() {
    this.timeline.reset();
  }

  /** Leave out what happens until resume(): a slow redraw, a page load, a wait the viewer need not sit through. */
  pause() {
    if (!this.recording) return;
    this.recording = false;
    this.pausedAt = Date.now() / 1000;
    this.timeline.cut(this.pausedAt);
  }

  resume() {
    if (this.disposed) return;
    const pausedAt = this.pausedAt;
    const drawn = this.drawnInPause;
    this.recording = true;
    this.pausedAt = null;
    this.drawnInPause = 0;
    if (pausedAt !== null) this.onResume?.(Date.now() / 1000 - pausedAt, drawn);
  }

  get paused() { return !this.recording; }

  /**
   * Resolves once the browser has drawn two frames timed at or after `wall`
   * (seconds, Date.now() / 1000) plus `fade` (counted from the first frame
   * timed after `wall`), so what the page looked like then is in the
   * picture: a software renderer can take a second over a heavy scene, a
   * frame shows the page as it was when the frame began, up to a frame
   * earlier than its timestamp, and a fade is only in the picture once a
   * frame begun after it ends is drawn. After `ms` without them, resolves
   * anyway (paused, or a page that cannot paint). With the heartbeat the
   * page sends frames whenever it can paint, so no frames means it is busy
   * and the wait is long: a closing card over a table view waited five
   * seconds for its paint, and a four-second limit logged its line a
   * second before the card was in the picture (Plenoview, 12 October 2026).
   */
  painted(wall: number, fade = 0, ms = 12000): Promise<void> {
    if (!this.recording) return Promise.resolve();
    return new Promise(resolve => {
      const timer = setTimeout(() => { this.painters = this.painters.filter(p => p !== done); resolve(); }, ms);
      // The fade is counted from the first frame timed after the change, not from the change itself: when
      // the page could not paint for a while, the fade only began with that frame (a closing card's line
      // was logged on two frames that showed the fade's first instant, half a second before the card).
      let due: number | null = fade ? null : wall;
      let after = 0;
      const done = (frame: Frame) => {
        if (due === null) {
          if (frame.wall >= wall) due = Math.max(wall, frame.wall) + fade;
          this.painters.push(done);
          return;
        }
        if (frame.wall >= due) after++;
        if (after < 2) { this.painters.push(done); return; }
        clearTimeout(timer);
        resolve();
      };
      this.painters.push(done);
    });
  }


  /**
   * A frame drawn by hand, shown for `duration` seconds, while the screencast
   * is paused: a smooth move the software renderer could never screencast at
   * 30 frames a second is drawn one frame at a time (a screenshot per frame)
   * and the video is that long, however long drawing it took. The frame is
   * stamped with the moment it was drawn, so a line logged in the pause
   * lands on the frames drawn after it, not after them all (a caption set
   * while paused, then an orbit drawn under it, is spoken as the orbit
   * starts).
   */
  addFrame(data: Buffer, duration: number) {
    if (this.disposed) throw new Error('addFrame() after the recorder was disposed.');
    if (this.recording || this.pausedAt === null) throw new Error('addFrame() needs the screencast paused.');
    const file = this.nextFile();
    writeFileSync(file, data);
    this.drawnInPause += duration;
    this.keep(file, Date.now() / 1000, duration);
  }

  /** A moment (Date.now() / 1000) as a time in the finished video. */
  videoTime(wall: number) {
    return this.timeline.videoTime(wall);
  }

  /**
   * Stop and encode to `out` (.mp4); `tail` holds the last frame a little
   * longer. A still screen sends no frames, so the last one is also held
   * until now: the video lasts as long as the recording did.
   */
  async save(out: string, tail = 0.6) {
    if (this.disposed) throw new Error('save() after the recorder was disposed (its page closed).');
    const length = this.videoTime(Date.now() / 1000);
    this.recording = false;
    await this.cdp?.send('Page.stopScreencast').catch(() => {});
    if (this.frames.length < 2) throw new Error('The screencast sent no frames.');
    const list = join(this.dir, 'frames.txt');
    writeFileSync(list, this.timeline.concatList(length, tail));
    execFileSync(this.opts.ffmpeg, [
      '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
      '-vf', `fps=${this.opts.fps},scale=${this.size.width}:${this.size.height}:flags=lanczos,format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(this.opts.crf), '-tune', 'stillimage', '-movflags', '+faststart', '-an', out,
    ]);
    this.dispose();
  }
}
