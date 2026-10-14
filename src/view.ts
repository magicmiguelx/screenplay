import type { Locator } from '@playwright/test';

// What a line is about must be in the picture while it is said. A caption
// spoken over a page whose subject sits below the fold (a section's header
// at the bottom edge, its rows cut off; a button the next click scrolls
// to) says one thing over another (the owner of PF1e Campaigner's note,
// 14 October 2026). The share of an element in the picture is measured in
// the page by hit-testing a grid of points over its box, so the page's own
// layers count (a sticky header, a dialog over it) and the overlay does
// not; the share itself is pure, so it is unit-tested.

/** What the page answers about an element: its box, the part of it inside the viewport, and how much of that part is not under something else. */
export interface Seen {
  /** The element's box, in the viewport's coordinates. */
  box: { x: number; y: number; width: number; height: number };
  /** The viewport's size. */
  viewport: { width: number; height: number };
  /** The area of the box inside the viewport. */
  inside: number;
  /** The share of grid points inside the viewport that land on the element (or inside it), 0 to 1. */
  hit: number;
}

/**
 * The most of the frame's height a tall subject is asked to fill: a
 * section taller than the picture is in view once it fills three quarters
 * of it (a sticky header and the section's own margins take the rest).
 */
export const TALL = 0.75;

/**
 * The share of an element in the picture, 0 to 1: the area of it seen
 * (inside the viewport, not under the page's own layers) against the most
 * of it the frame can hold (the whole element when it fits, else three
 * quarters of the frame's height by its width). A small element cut at the
 * bottom edge reads as the share of it above the edge.
 */
export function inViewShare(s: Seen): number {
  const { width, height } = s.box;
  if (width <= 0 || height <= 0) return 0;
  const room = Math.min(width, s.viewport.width) * Math.min(height, s.viewport.height * TALL);
  return Math.min(1, (s.inside * s.hit) / room);
}

/** Runs in the page (Locator.evaluate): no closures, no imports. */
export function measureSeen(el: Element): Seen {
  const r = el.getBoundingClientRect();
  const vw = innerWidth, vh = innerHeight;
  const left = Math.max(0, r.left), right = Math.min(vw, r.right), top = Math.max(0, r.top), bottom = Math.min(vh, r.bottom);
  const w = Math.max(0, right - left), h = Math.max(0, bottom - top);
  let hit = 0, n = 0;
  if (w > 0 && h > 0) {
    const cols = 10, rows = 8;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const x = left + ((i + 0.5) * w) / cols, y = top + ((j + 0.5) * h) / rows;
      n++;
      const at = document.elementsFromPoint(x, y).find(e => !e.closest('#demo-overlay'));
      // On the element, inside it, or on a box it sits in (outside its painted shape: a clip-path, a
      // rounded corner); anything else on top there (a sticky header, a dialog) hides it.
      if (at && (at === el || el.contains(at) || at.contains(el))) hit++;
    }
  }
  return { box: { x: r.left, y: r.top, width: r.width, height: r.height }, viewport: { width: vw, height: vh }, inside: w * h, hit: n ? hit / n : 0 };
}

/** The share of `target` in the picture of its own page, 0 to 1 (0 when it is not in the document). */
export async function inView(target: Locator): Promise<number> {
  const seen = await target.evaluate(measureSeen).catch(() => null);
  return seen ? inViewShare(seen) : 0;
}

/**
 * The band at the top and the bottom of the frame (a share of its height)
 * a subject is not left in: an element wholly in view but on the bottom
 * edge is where the caption goes and where the eye does not look (PF1e
 * Campaigner's point-buy line was said with its select on the last row of
 * the frame).
 */
export const EDGE = 0.1;

/**
 * Bring `target` into the picture if it is not already well in it: a
 * smooth scroll that puts it in the middle of the frame (or, when it is
 * taller than the frame, its top just under whatever the page keeps over
 * the top edge, a sticky header), waited out. A subject already wholly in
 * view and clear of the frame's top and bottom bands (`EDGE`) is left
 * where it is, so the picture does not move under a line for nothing.
 * Returns the share in view afterwards.
 */
export async function bringIntoView(target: Locator, opts: { smooth?: boolean } = {}): Promise<number> {
  // Visible, not only attached: a page being navigated to can mount its content hidden before it shows it.
  await target.waitFor({ state: 'visible' });
  if ((await inView(target)) >= 0.999) {
    const clear = await target.evaluate((el, edge) => {
      const r = el.getBoundingClientRect();
      // A subject that fills most of the frame cannot clear both bands, and need not.
      return r.height > innerHeight * (1 - 2 * edge) || (r.top >= innerHeight * edge && r.bottom <= innerHeight * (1 - edge));
    }, EDGE);
    if (clear) return 1;
  }
  await target.evaluate((el, smooth) => {
    const r = el.getBoundingClientRect();
    const behavior = (smooth ? 'smooth' : 'instant') as ScrollBehavior;
    el.scrollIntoView({ block: r.height <= innerHeight * 0.8 ? 'center' : 'start', inline: 'nearest', behavior });
  }, opts.smooth !== false);
  await settle(target);
  // A tall subject scrolled to the top lies under a sticky header: step it down until its top edge is its own.
  await target.evaluate(el => {
    const r = el.getBoundingClientRect();
    if (r.height <= innerHeight * 0.8) return;
    const x = Math.min(innerWidth - 1, Math.max(0, r.left + Math.min(r.width / 2, 40)));
    let y = Math.max(0, r.top) + 1;
    while (y < innerHeight * 0.4) {
      const at = document.elementsFromPoint(x, y).find(e => !e.closest('#demo-overlay'));
      if (at && (at === el || el.contains(at) || at.contains(el))) break;
      y += 8;
    }
    const covered = y - Math.max(0, r.top);
    if (covered > 1) window.scrollBy({ top: -(covered + 12), behavior: 'instant' as ScrollBehavior });
  });
  await settle(target);
  return inView(target);
}

/** Wait until the element stops moving (a smooth scroll is over), at most two seconds. */
async function settle(target: Locator) {
  let last = '';
  for (let i = 0; i < 20; i++) {
    const now = await target.evaluate(el => { const r = el.getBoundingClientRect(); return `${Math.round(r.top)},${Math.round(r.left)}`; });
    if (now === last) return;
    last = now;
    await target.page().waitForTimeout(100);
  }
}
