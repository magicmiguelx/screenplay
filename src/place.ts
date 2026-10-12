// Where a caption goes: the position that covers the least of the page's
// own content, measured by the overlay (overlay.ts `measure`), unless the
// line asks for one. Pure, so it is unit-tested.

export type Where = 'bottom' | 'top';
export type Prefer = Where | 'auto';

/**
 * The emptier of the two positions; a tie goes to `bottom` (a reader's
 * eye expects a caption there). A position the caption is asked for is
 * taken whatever it covers.
 */
export function choosePlacement(covers: { bottom: number; top: number }, prefer: Prefer = 'auto'): Where {
  if (prefer !== 'auto') return prefer;
  return covers.top < covers.bottom - 0.08 ? 'top' : 'bottom';
}
