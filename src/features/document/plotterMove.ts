// ── PlotterMove ───────────────────────────────────────────────────────────────
// Canonical move type shared by canvas rendering and gcode generation.
// Every move carries absolute start + end coordinates so both subsystems have
// the full geometry without needing to track a running pen position.
//
// MIRROR of the Rust PlotterMove in pnplttr_file_structure.rs.
// Canonical source of truth: here (TS) and Rust. Keep in sync.

export type PlotterMove =
  | { type: "Line";        x1: number; y1: number; x2: number; y2: number }
  | { type: "Arc";         x1: number; y1: number; cx: number; cy: number; x2: number; y2: number; clockwise: boolean }
  | { type: "QuadBezier";  x1: number; y1: number; cx: number; cy: number; x2: number; y2: number }
  | { type: "CubicBezier"; x1: number; y1: number; cx1: number; cy1: number; cx2: number; cy2: number; x2: number; y2: number };

// ── PlotterStroke ─────────────────────────────────────────────────────────────
// A pen-down stroke: move to start, put pen down, execute moves, lift pen.

export interface PlotterStroke {
  start: [number, number];
  moves: PlotterMove[];
}
