// Shared virtualisation helpers.
//
// Rendering one DOM node per line does not scale: a ~55k-line GCode file
// produces ~166k nodes in the preview panel alone (one row div plus two spans
// per line), and the browser then has to style and lay all of them out. In the
// WebView that takes minutes, so the UI appears to freeze.
//
// These helpers let a component render only the rows inside the visible
// scroll window (plus a small overscan), keeping the DOM size constant
// regardless of file length.

export interface VirtualRange {
  /** First row index to render, inclusive. */
  start: number;
  /** Last row index to render, exclusive. */
  end: number;
  /** Pixel offset of the first rendered row from the top of the list. */
  offsetY: number;
  /** Total height of all rows in pixels (used for the scroll spacer). */
  totalHeight: number;
}

/**
 * Computes which rows are visible for a fixed-height list.
 *
 * @param count          total number of rows
 * @param rowHeight      height of a single row in pixels (must be constant)
 * @param scrollTop      current scroll offset of the container
 * @param viewportHeight visible height of the container
 * @param overscan       extra rows rendered above/below to hide scroll jitter
 */
export function virtualRange(
  count: number,
  rowHeight: number,
  scrollTop: number,
  viewportHeight: number,
  overscan = 12,
): VirtualRange {
  if (count <= 0 || rowHeight <= 0) {
    return { start: 0, end: 0, offsetY: 0, totalHeight: 0 };
  }

  // Clamp so a stale scrollTop (e.g. after the content shrank) can't yield an
  // empty window.
  const firstVisible = Math.min(
    Math.max(0, Math.floor(scrollTop / rowHeight)),
    Math.max(0, count - 1),
  );
  const visibleCount = Math.max(1, Math.ceil(viewportHeight / rowHeight));
  const start = Math.max(0, firstVisible - overscan);
  const end = Math.min(count, firstVisible + visibleCount + overscan);

  return {
    start,
    end,
    offsetY: start * rowHeight,
    totalHeight: count * rowHeight,
  };
}