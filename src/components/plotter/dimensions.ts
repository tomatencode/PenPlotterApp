// ── Head position in workspace coordinates (mm) ──────────────────────────────
export interface PlotterPosition {
  x: number; // mm from left edge of workspace
  y: number; // mm from top edge of workspace
}

export const X_AXIS_BEAM_HEIGHT_MM = 10;
export const X_AXIS_TO_PEN_MM = -15;

export const HEAD_WIDTH_MM = 25;

export const BODY_BEAM_MARGIN_MM = 35;
export const BODY_BEAM_WIDTH_MM = 15;
export const BODY_BEAM_OVERSHOOT_TOP_MM = 12 - X_AXIS_TO_PEN_MM;
export const BODY_FRONT_MARGIN_MM = 12;
export const BODY_FRONT_HEIGHT_MM = 40;