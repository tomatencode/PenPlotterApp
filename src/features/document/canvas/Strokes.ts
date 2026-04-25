import type { Element, PlttrFont } from "../types";
import { type PlotterMove, type PlotterStroke } from "../plotterMove";
import { allElementsToPlotterStrokes } from "../fonts/textToStrokes";

// ── SvgMove / SvgStroke ───────────────────────────────────────────────────────
// SVG-specific rendering types derived from PlotterStroke.
// Pipeline: Element → PlotterStroke (plotter.ts) → SvgStroke → path string

export type SvgMove =
  | { type: "L"; x: number; y: number }
  | { type: "A"; r: number; largeArc: 0 | 1; sweep: 0 | 1; x: number; y: number }
  | { type: "Q"; cx: number; cy: number; x: number; y: number }
  | { type: "C"; cx1: number; cy1: number; cx2: number; cy2: number; x: number; y: number };

export interface SvgStroke {
  start: [number, number];
  moves: SvgMove[];
}

// ── PlotterMove → SvgMove ─────────────────────────────────────────────────────

function plotterMoveToSvgMove(move: PlotterMove): SvgMove {
  switch (move.type) {
    case "Line":
      return { type: "L", x: move.x2, y: move.y2 };

    case "Arc": {
      const r = Math.hypot(move.x1 - move.cx, move.y1 - move.cy);
      const startAngle = Math.atan2(move.y1 - move.cy, move.x1 - move.cx);
      const endAngle   = Math.atan2(move.y2 - move.cy, move.x2 - move.cx);
      // Angular span in the direction of travel, normalised to (0, 2π]
      let span = move.clockwise
        ? (endAngle - startAngle + 2 * Math.PI) % (2 * Math.PI)
        : (startAngle - endAngle + 2 * Math.PI) % (2 * Math.PI);
      if (span === 0) span = 2 * Math.PI;
      return { type: "A", r, largeArc: span > Math.PI ? 1 : 0, sweep: move.clockwise ? 1 : 0, x: move.x2, y: move.y2 };
    }

    case "QuadBezier":
      return { type: "Q", cx: move.cx, cy: move.cy, x: move.x2, y: move.y2 };

    case "CubicBezier":
      return { type: "C", cx1: move.cx1, cy1: move.cy1, cx2: move.cx2, cy2: move.cy2, x: move.x2, y: move.y2 };
  }
}

// ── PlotterStroke → SvgStroke ─────────────────────────────────────────────────

export function plotterStrokeToSvgStroke(stroke: PlotterStroke): SvgStroke {
  return { start: stroke.start, moves: stroke.moves.map(plotterMoveToSvgMove) };
}

// ── Public API for canvas components ─────────────────────────────────────────

export function elementToStrokes(el: Element, fonts: Map<string, PlttrFont> = new Map()): SvgStroke[] {
  return allElementsToPlotterStrokes([el], fonts).map(plotterStrokeToSvgStroke);
}

export function strokeToSvgPath(stroke: SvgStroke): string {
  const parts: string[] = [`M ${stroke.start[0]} ${stroke.start[1]}`];
  for (const move of stroke.moves) {
    switch (move.type) {
      case "L": parts.push(`L ${move.x} ${move.y}`); break;
      case "A": parts.push(`A ${move.r} ${move.r} 0 ${move.largeArc} ${move.sweep} ${move.x} ${move.y}`); break;
      case "Q": parts.push(`Q ${move.cx} ${move.cy} ${move.x} ${move.y}`); break;
      case "C": parts.push(`C ${move.cx1} ${move.cy1} ${move.cx2} ${move.cy2} ${move.x} ${move.y}`); break;
    }
  }
  return parts.join(" ");
}
