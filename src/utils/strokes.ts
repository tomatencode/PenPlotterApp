// ── Plotter stroke types ──────────────────────────────────────────────────────
// MIRROR of pnplttr_file_structure.rs :: PlotterMove / Stroke
// Canonical source of truth: Rust. If you change one, change the other.
//
// All coordinates are in millimetres, absolute document space.

export type PlotterMove =
  | { type: "Line";        x2: number; y2: number }
  | { type: "Arc";         cx: number; cy: number; r: number; startAngle: number; endAngle: number }
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

// A Circle produces one stroke: two semicircle arcs (top→bottom, bottom→top).
// A single SVG arc cannot draw a full circle because start and end XY would coincide.
function circleToStrokes(el: Extract<Element, { type: "Circle" }>): Stroke[] {
  return [{
    start: [el.cx, el.cy - el.r],
    moves: [
      { type: "Arc", cx: el.cx, cy: el.cy, r: el.r, startAngle: -Math.PI / 2, endAngle:  Math.PI / 2 },
      { type: "Arc", cx: el.cx, cy: el.cy, r: el.r, startAngle:  Math.PI / 2, endAngle:  Math.PI * 1.5 },
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

export function transformStroke(strokes: Stroke, dx: number, dy: number): Stroke {
  return {
    start: [strokes.start[0] + dx, strokes.start[1] + dy],
    moves: strokes.moves.map(move => {
      switch (move.type) {
        case "Line":
          return { type: "Line", x2: move.x2 + dx, y2: move.y2 + dy };
        case "Arc":
          return { type: "Arc", cx: move.cx + dx, cy: move.cy + dy, r: move.r, startAngle: move.startAngle, endAngle: move.endAngle };
        case "QuadBezier":
          return { type: "QuadBezier", cx: move.cx + dx, cy: move.cy + dy, x2: move.x2 + dx, y2: move.y2 + dy };
        case "CubicBezier":
          return {
            type: "CubicBezier",
            cx1: move.cx1 + dx, cy1: move.cy1 + dy,
            cx2: move.cx2 + dx, cy2: move.cy2 + dy,
            x2: move.x2 + dx,   y2: move.y2 + dy,
          };
      }
    }),
  };
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
      case "Arc": {
        // Normalise span into (0, 2π] so wrapping angles and full circles work correctly.
        const span = (move.endAngle - move.startAngle + 2 * Math.PI) % (2 * Math.PI) || 2 * Math.PI;
        const largeArcFlag = span > Math.PI ? 1 : 0;
        const sweepFlag = 1; // Always clockwise
        const endX = move.cx + move.r * Math.cos(move.endAngle);
        const endY = move.cy + move.r * Math.sin(move.endAngle);
        parts.push(`A ${move.r} ${move.r} 0 ${largeArcFlag} ${sweepFlag} ${endX} ${endY}`);
        break;
      }
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
