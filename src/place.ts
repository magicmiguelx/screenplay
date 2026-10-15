// Where a caption goes: the position that covers the least of the page's
// own content, measured by the overlay (overlay.ts `measure`), unless the
// line asks for one. Pure, so it is unit-tested.

/** The caption's positions: centred at the bottom or the top, or in one of the four corners (narrower). */
export type Where = 'bottom' | 'top' | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
export type Prefer = Where | 'auto';

/** The corners, in the order a tie is broken (the bottom first, where a reader's eye expects a caption). */
export const CORNERS = ['bottom-left', 'bottom-right', 'top-left', 'top-right'] as const;

/** How much less a position must cover to be taken over the one before it in the order: a near tie keeps the usual place. */
const MARGIN = 0.08;

/**
 * The emptier of the two centred positions; a tie goes to `bottom` (a
 * reader's eye expects a caption there). When even that one covers more
 * than `corners` (a share, 0 to 1) and a corner covers clearly less, the
 * emptiest corner: a dense page with its middle full top and bottom (a
 * table, a toolbar in both bands) often has a corner clear, and the
 * caption had nowhere else to go. A position the caption is asked for is
 * taken whatever it covers.
 */
export function choosePlacement(covers: { bottom: number; top: number } & Partial<Record<Where, number>>, prefer: Prefer = 'auto', opts: { corners?: number } = {}): Where {
  if (prefer !== 'auto') return prefer;
  const centre: Where = covers.top < covers.bottom - MARGIN ? 'top' : 'bottom';
  if (opts.corners === undefined || covers[centre] <= opts.corners) return centre;
  let best: Where = centre;
  for (const corner of CORNERS) {
    const c = covers[corner];
    if (c !== undefined && c < covers[best]! - MARGIN) best = corner;
  }
  return best;
}
