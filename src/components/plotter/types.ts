// ── Head position in workspace coordinates (mm) ──────────────────────────────
export interface PlotterPosition {
  x: number; // mm from left edge of workspace
  y: number; // mm from top edge of workspace
}

// How far the machine body visually extends beyond the workspace rectangle (mm)
export const BODY_MARGIN_MM = 24;
