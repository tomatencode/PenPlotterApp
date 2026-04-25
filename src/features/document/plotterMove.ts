// ── PlotterMove ───────────────────────────────────────────────────────────────
// Canonical move type shared by canvas rendering and gcode generation.
// Every move carries absolute start + end coordinates so both subsystems have
// the full geometry without needing to track a running pen position.
//
// MIRROR of the Rust PlotterMove in pnplttr_file_structure.rs.
// Canonical source of truth: here (TS) and Rust. Keep in sync.

import type { Element } from "./types";

export type PlotterMove =
  | { type: "Line";        x1: number; y1: number; x2: number; y2: number }
  | { type: "Arc";         x1: number; y1: number; cx: number; cy: number; x2: number; y2: number; clockwise: boolean }
  | { type: "QuadBezier";  x1: number; y1: number; cx: number; cy: number; x2: number; y2: number }
  | { type: "CubicBezier"; x1: number; y1: number; cx1: number; cy1: number; cx2: number; cy2: number; x2: number; y2: number };

// ── PlotterStroke ─────────────────────────────────────────────────────────────
// A pen-down stroke: move to start, put pen down, execute moves, lift pen.
// closed = true means the last move ends at start (Rect, Circle) — the gcode
// optimizer uses this to pick the best loop entry point.

export interface PlotterStroke {
  start: [number, number];
  moves: PlotterMove[];
  closed: boolean;
}

// ── Element → PlotterStroke[] ─────────────────────────────────────────────────
// Single source of truth for how document elements map to plotter geometry.
// Both canvas rendering and gcode generation call this function so the preview
// always matches what the plotter will actually draw.

export function elementsToPlotterStrokes(elements: Element[]): PlotterStroke[] {
  const strokes: PlotterStroke[] = [];

  for (const el of elements) {
    switch (el.type) {
      case "Drawing": {
        if (el.points.length < 2) break;
        const moves: PlotterMove[] = el.points.slice(0, -1).map((p, i) => ({
          type: "Line" as const,
          x1: p[0], y1: p[1],
          x2: el.points[i + 1][0], y2: el.points[i + 1][1],
        }));
        strokes.push({ start: [el.points[0][0], el.points[0][1]], moves, closed: false });
        break;
      }

      case "Line":
        strokes.push({
          start: [el.x1, el.y1],
          moves: [{ type: "Line", x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2 }],
          closed: false,
        });
        break;

      case "Rect": {
        const { x, y, w, h } = el;
        strokes.push({
          start: [x, y],
          moves: [
            { type: "Line", x1: x,     y1: y,     x2: x + w, y2: y     },
            { type: "Line", x1: x + w, y1: y,     x2: x + w, y2: y + h },
            { type: "Line", x1: x + w, y1: y + h, x2: x,     y2: y + h },
            { type: "Line", x1: x,     y1: y + h, x2: x,     y2: y     },
          ],
          closed: true,
        });
        break;
      }

      case "Circle": {
        const { cx, cy, r } = el;
        const right: [number, number] = [cx + r, cy];
        const left:  [number, number] = [cx - r, cy];
        strokes.push({
          start: right,
          moves: [
            { type: "Arc", x1: right[0], y1: right[1], cx, cy, x2: left[0],  y2: left[1],  clockwise: true },
            { type: "Arc", x1: left[0],  y1: left[1],  cx, cy, x2: right[0], y2: right[1], clockwise: true },
          ],
          closed: true,
        });
        break;
      }
    }
  }

  return strokes;
}
