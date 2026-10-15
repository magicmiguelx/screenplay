// Which element each line is about, and how much of it was in the picture
// while the line was up: the bookkeeping behind the script's "Seen" column
// and `minInView`. The driver measures (view.ts); this decides which line
// a measurement belongs to. Pure (no browser, no clock: the caller passes
// the time), so it is unit-tested (tests/unit/subjects.test.mjs).
//
// A line's subjects are the elements it names (`about`), the element in
// the spotlight while it is up, and, for a line with no `about`, the
// element its first action works on, measured before the action scrolls
// to it: a note followed at once by its click is the cursor going to it,
// but a line said in full and then acted on was said over the wrong
// picture. A spotlight put up after a line has ended is either that line's
// subject or the next line's setup ("spot, then say"): it is held until the
// next line shows which.

/** A line as the subjects see it: its text, and the least share of a subject seen while it was up. */
export interface SubjectLine { text: string; seen?: number; subject?: string }

export interface SubjectsOptions<T> {
  /** Under this share the take fails, named. Unset: measured and reported only. */
  min?: number;
  /** Under this share the line is listed in the log. */
  note: number;
  /** How long (ms) a line may be up before its first action and still have that action's element measured as not yet in view. */
  grace: number;
  /** How a subject is named in the log and the script. Default String(target). */
  name?: (target: T) => string;
  /** Where the notes go. Default console.log. */
  log?: (message: string) => void;
}

export class Subjects<T> {
  /** The caption line whose first action has not come yet, and when (ms) its subjects were measured. */
  private pending: { line: SubjectLine; at: number } | null = null;
  /** A spotlight measured for a line that had ended, not yet known to be its subject. */
  private candidate: { line: SubjectLine; share: number; target: T } | null = null;

  constructor(private readonly opts: SubjectsOptions<T>) {}

  /**
   * A line went up with `spot` in the spotlight (or none): a spotlight held
   * from the line before is this line's setup if it is the same one, else
   * it was the line before's subject.
   */
  shown(spot: T | null) {
    if (this.candidate && this.candidate.target === spot) this.candidate = null;
    else this.commit();
  }

  /** After a line's subjects were measured at `at` (ms): its first action names one when `waits`. */
  waitFor(line: SubjectLine, at: number, waits: boolean) {
    this.pending = waits ? { line, at } : null;
  }

  /**
   * An action on an element is about to start at `now` (ms): the line to
   * measure that element for (before the action scrolls to it), or null.
   * `ignored` when the element cannot be the line's subject (a picture
   * card is up, it is on another page).
   */
  acting(now: number, ignored: boolean): SubjectLine | null {
    this.commit();
    const p = this.pending;
    this.pending = null;
    if (!p || ignored || now - p.at < this.opts.grace) return null;
    return p.line;
  }

  /** The element of an action measured for `line` (from `acting`); a spotlight on an ended line is held. */
  acted(line: SubjectLine, share: number, target: T, opts: { spotlight: boolean; open: SubjectLine | null }) {
    if (opts.spotlight && line !== opts.open) { this.candidate = { line, share, target }; return; }
    this.record(line, share, target, 'acted on next');
  }

  /** A held spotlight is the line before's subject after all (the next line, a card or the end came instead). */
  commit() {
    const c = this.candidate;
    this.candidate = null;
    if (c) this.record(c.line, c.share, c.target, 'spotlit next');
  }

  /** A card went up: no line waits for its first action. */
  drop() { this.pending = null; }

  /** A cut ended with `open` up: a line that ended before it is not what the next picture is about. */
  resumed(open: SubjectLine | null) {
    if (this.pending && this.pending.line !== open) this.pending = null;
  }

  /** Keep the least share of a line's subjects; under `min` the take fails, named; under `note` it is logged. */
  record(line: SubjectLine, share: number, target: T, how: string) {
    const subject = `${how}: ${(this.opts.name ?? String)(target)}`;
    if (line.seen === undefined || share < line.seen) { line.seen = share; line.subject = subject; }
    const pct = Math.round(share * 100);
    if (this.opts.min !== undefined && share < this.opts.min) {
      throw new Error(`Subject out of the picture: ${pct}% of it in view (${subject}), under ${this.opts.min}, while the line was up: "${line.text}". Put it in view before the line (say(…, { about }), or act first and then say it), or name the right subject.`);
    }
    if (share < this.opts.note) (this.opts.log ?? console.log)(`  subject ${pct}% in view (${subject}): ${line.text}`);
  }
}
