// ── Plotter stroke types ──────────────────────────────────────────────────────
// MIRROR of pnplttr_file_structure.rs :: PlotterMove / Stroke
// Canonical source of truth: Rust. If you change one, change the other.
//
// All coordinates are in millimetres, absolute document space.

export type PlotterMove =
  | { type: "Line";        x2: number; y2: number }
  | { type: "QuadBezier";  cx: number; cy: number; x2: number; y2: number }
  | { type: "CubicBezier"; cx1: number; cy1: number; cx2: number; cy2: number; x2: number; y2: number };

export interface Stroke {
  start: [number, number]; // pen-down position in mm
  moves: PlotterMove[];
}

// ── Element → Strokes conversion ──────────────────────────────────────────────
// MIRROR of pnplttr_file_structure.rs :: Element::to_strokes()
// Canonical source of truth: Rust. If you change one, change the other.

import type { Element } from "../components/document/types";

// A Line produces one stroke: pen down at (x1,y1), one line move to (x2,y2).
function lineToStrokes(el: Extract<Element, { type: "Line" }>): Stroke[] {
  return [{
    start: [el.x1, el.y1],
    moves: [{ type: "Line", x2: el.x2, y2: el.y2 }],
  }];
}

// A Rect produces one stroke: start top-left, go clockwise, close back to start.
function rectToStrokes(el: Extract<Element, { type: "Rect" }>): Stroke[] {
  return [{
    start: [el.x, el.y],
    moves: [
      { type: "Line", x2: el.x + el.w, y2: el.y           },
      { type: "Line", x2: el.x + el.w, y2: el.y + el.h    },
      { type: "Line", x2: el.x,        y2: el.y + el.h    },
      { type: "Line", x2: el.x,        y2: el.y           },
    ],
  }];
}

// A Circle is approximated as 4 cubic bezier strokes forming a closed loop.
// Approximation constant k = 0.5522847 gives a good circle via cubic beziers.
// Starts at the top (cx, cy - r) and goes clockwise: top→right→bottom→left→top.
// This produces one stroke (no pen lift needed — the end connects to the start).
function circleToStrokes(el: Extract<Element, { type: "Circle" }>): Stroke[] {
  const { cx, cy, r } = el;
  const k = 0.5522847 * r;
  return [{
    start: [cx, cy - r],
    moves: [
      { type: "CubicBezier", cx1: cx + k, cy1: cy - r, cx2: cx + r, cy2: cy - k, x2: cx + r, y2: cy     },
      { type: "CubicBezier", cx1: cx + r, cy1: cy + k, cx2: cx + k, cy2: cy + r, x2: cx,     y2: cy + r },
      { type: "CubicBezier", cx1: cx - k, cy1: cy + r, cx2: cx - r, cy2: cy + k, x2: cx - r, y2: cy     },
      { type: "CubicBezier", cx1: cx - r, cy1: cy - k, cx2: cx - k, cy2: cy - r, x2: cx,     y2: cy - r },
    ],
  }];
}

export function elementToStrokes(el: Element): Stroke[] {
  switch (el.type) {
    case "Line":   return lineToStrokes(el);
    case "Rect":   return rectToStrokes(el);
    case "Circle": return circleToStrokes(el);
  }
}

// ── Stroke → SVG path string ──────────────────────────────────────────────────
// Converts a single Stroke to an SVG path `d` attribute string.
// Used by CanvasArea to render strokes as <path> elements.

export function strokeToSvgPath(stroke: Stroke): string {
  const parts: string[] = [`M ${stroke.start[0]} ${stroke.start[1]}`];
  for (const move of stroke.moves) {
    switch (move.type) {
      case "Line":
        parts.push(`L ${move.x2} ${move.y2}`);
        break;
      case "QuadBezier":
        parts.push(`Q ${move.cx} ${move.cy} ${move.x2} ${move.y2}`);
        break;
      case "CubicBezier":
        parts.push(`C ${move.cx1} ${move.cy1} ${move.cx2} ${move.cy2} ${move.x2} ${move.y2}`);
        break;
    }
  }
  return parts.join(" ");
}
