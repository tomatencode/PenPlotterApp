import { elementToStrokes, strokeToSvgPath } from "./Strokes";
import type { Element } from "../types";

export type Ghost =
  | { tool: "drawing"; points: [x: number, y: number][] }
  | { tool: "line";   x1: number; y1: number; x2: number; y2: number }
  | { tool: "rect";   x: number;  y: number;  w: number;  h: number  }
  | { tool: "circle"; cx: number; cy: number; r: number              };

function ghostToElement(g: Ghost): Element {
  const id = "__ghost__";
  switch (g.tool) {
    case "drawing": return { id, type: "Drawing", points: g.points };
    case "line":    return { id, type: "Line",   x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2 };
    case "rect":    return { id, type: "Rect",   x: g.x, y: g.y, w: g.w, h: g.h };
    case "circle":  return { id, type: "Circle", cx: g.cx, cy: g.cy, r: g.r };
  }
}

export function ghostToSvgPaths(ghost: Ghost | null): string[] {
  if (!ghost) return [];
    const el = ghostToElement(ghost);
    const { strokes } = elementToStrokes(el, false);
    return strokes.map(strokeToSvgPath);
}