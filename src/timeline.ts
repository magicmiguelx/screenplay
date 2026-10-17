// The video's one timeline, built from its frames. Pure: no browser, no
// files, so it is unit-tested (tests/unit/timeline.test.mjs).
//
// Why a timeline of frames and not the wall clock: the first recorder kept
// the voice-over script on the wall clock minus the pauses, and every cut
// moved the voice a fraction of a second later than the picture, up to two
// seconds by the end of a three-minute video. Here each frame starts where
// the one before it ended, a cut keeps the still before it as long as it
// lasted and then jumps, a frame drawn by hand lasts what it was given, and
// a moment in time is placed on those same frames (videoTime), so the voice
// lands on the picture it was recorded with.

/**
 * A frame of the video: when the browser drew it (wall clock, seconds),
 * where it starts in the video (seconds), and its file. `hold` is set on a
 * frame drawn by hand (an orbit, a transition): how long it is shown.
 */
export interface Frame { wall: number; video: number; file: string; hold?: number }

/** The least a frame is shown: the step from the last frame before a cut to the first after it. */
export const FRAME = 1 / 30;

export class Timeline {
  frames: Frame[] = [];
  /** The moment of the first cut() not yet followed by a frame: the still before it ends there. */
  private cutFrom: number | null = null;
  /** Since that cut: the last resume() not yet followed by a cut or a frame. */
  private resumedAt: number | null = null;
  /** Since that cut: the seconds on camera between a resume() and a second cut() with no frame in between. */
  private live = 0;

  /** Where a frame drawn at `wall` starts, after the frame before it. */
  private after(last: Frame | undefined, wall: number): number {
    const cutFrom = this.cutFrom, live = this.live;
    this.cutFrom = this.resumedAt = null;
    this.live = 0;
    if (!last) return 0;
    if (last.hold !== undefined) return last.video + last.hold + live;
    // After a cut: the still before the pause is kept as long as it was on camera, then the picture jumps.
    if (cutFrom !== null) return last.video + Math.max(FRAME, cutFrom - last.wall + live);
    return last.video + Math.max(0, wall - last.wall);
  }

  /** A frame the browser drew at `wall`, or one drawn by hand shown for `hold` seconds. */
  add(file: string, wall: number, hold?: number): Frame {
    const frame: Frame = { wall, video: this.after(this.frames.at(-1), wall), file, hold };
    this.frames.push(frame);
    return frame;
  }

  /**
   * The picture stops here (pause): what happens until the next frame is
   * left out. A second cut before any frame (a pause just after a resume:
   * an uncached clip made just after a cut to a second browser) keeps the
   * first: an earlier version took the second's moment, and the still
   * before the first cut was held across the whole of it.
   */
  cut(at: number) {
    if (this.cutFrom === null) this.cutFrom = at;
    else if (this.resumedAt !== null) this.live += Math.max(0, at - this.resumedAt);
    this.resumedAt = null;
  }

  /** The picture goes on (resume): until the next frame, the still before the cut is on camera again. */
  resume(at: number) {
    if (this.cutFrom !== null) this.resumedAt = at;
  }

  /** Forget the frames so far: the video starts with the next one. */
  reset() {
    this.frames = [];
    this.cutFrom = this.resumedAt = null;
    this.live = 0;
  }

  /**
   * A moment (wall clock, seconds) as a time in the finished video: on the
   * frame being shown then, as far into it as the moment is. A moment in a
   * pause lands on the cut, or, when frames were drawn by hand in the pause,
   * on the first frame drawn after it (each drawn frame carries the moment
   * it was drawn): a line logged while paused is spoken as the frames drawn
   * under it start.
   */
  videoTime(wall: number): number {
    const frames = this.frames;
    if (!frames.length || wall <= frames[0].wall) return 0;
    let lo = 0, hi = frames.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (frames[mid].wall <= wall) lo = mid; else hi = mid - 1;
    }
    const frame = frames[lo];
    if (frame.hold !== undefined) return frame.video + frame.hold;
    const next = frames[lo + 1];
    const shown = next ? next.video - frame.video : Infinity;
    return frame.video + Math.min(wall - frame.wall, shown);
  }

  /**
   * How long each frame is shown, the last one until `length` (the video's
   * length so far: a still screen sends no frames, so the last frame is held
   * until the recording ended) plus `tail`.
   */
  durations(length: number, tail = 0.6): number[] {
    return this.frames.map((f, i) => {
      const next = this.frames[i + 1];
      return Math.max(0.001, next ? next.video - f.video : Math.max(tail, length - f.video + tail));
    });
  }

  /** The ffmpeg concat demuxer's list: each file with its duration, the last file again so its duration counts. */
  concatList(length: number, tail = 0.6): string {
    const lines = ['ffconcat version 1.0'];
    const shown = this.durations(length, tail);
    this.frames.forEach((f, i) => lines.push(`file '${f.file}'`, `duration ${shown[i].toFixed(4)}`));
    // The concat demuxer needs the last file again to honour its duration.
    if (this.frames.length) lines.push(`file '${this.frames.at(-1)!.file}'`);
    return lines.join('\n');
  }
}
