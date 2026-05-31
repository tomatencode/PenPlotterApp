// ── Shape tool descriptors ────────────────────────────────────────────────────
// Each shape tool (all drawing tools except "pen") follows the same interaction:
//   pointerDown  → record start point
//   pointerMove  → show a ghost preview
//   pointerUp    → commit the final element
//
// Adding a new shape tool means adding one entry here. useCanvasPointer never
// needs to change.

import type { Element, PageSettings } from "../types";
import type { Ghost } from "./Ghost";
import { workspaceBounds } from "../utils";

export type ShapeTool = "line" | "rect" | "text" | "handwriting" | "circle";

export function isShapeTool(tool: string): tool is ShapeTool {
  return tool in SHAPE_TOOLS;
}

interface ShapeDescriptor {
  /** Ghost shown while dragging. Always a simple preview shape. */
  makeGhost(sx: number, sy: number, mx: number, my: number, page: PageSettings): Ghost;
  /** Final element committed on pointerUp. */
  makeElement(id: string, sx: number, sy: number, mx: number, my: number, page: PageSettings): Element;
}

function boxCoords(sx: number, sy: number, mx: number, my: number) {
  return { x: Math.min(sx, mx), y: Math.min(sy, my), w: Math.abs(mx - sx), h: Math.abs(my - sy) };
}

function circleRadius(sx: number, sy: number, mx: number, my: number, page: PageSettings): number {
  const ws = workspaceBounds(page);
  return Math.min(
    Math.hypot(mx - sx, my - sy),
    sx - ws.x, ws.x + ws.w - sx,
    sy - ws.y, ws.y + ws.h - sy,
  );
}

export const SHAPE_TOOLS: Record<ShapeTool, ShapeDescriptor> = {
  line: {
    makeGhost:   (sx, sy, mx, my)       => ({ type: "Line", x1: sx, y1: sy, x2: mx, y2: my }),
    makeElement: (id, sx, sy, mx, my)   => ({ id, type: "Line", x1: sx, y1: sy, x2: mx, y2: my }),
  },

  rect: {
    makeGhost:   (sx, sy, mx, my)       => ({ type: "Rect", ...boxCoords(sx, sy, mx, my) }),
    makeElement: (id, sx, sy, mx, my)   => ({ id, type: "Rect", ...boxCoords(sx, sy, mx, my) }),
  },

  text: {
    makeGhost:   (sx, sy, mx, my)       => ({ type: "Rect", ...boxCoords(sx, sy, mx, my) }),
    makeElement: (id, sx, sy, mx, my)   => ({ id, type: "Text", ...boxCoords(sx, sy, mx, my), text: "Text", fontName: "Rowmans", size: 10 }),
  },

  handwriting: {
    makeGhost:   (sx, sy, mx, my)       => ({ type: "Rect", ...boxCoords(sx, sy, mx, my) }),
    makeElement: (id, sx, sy, mx, my)   => ({ id, type: "Handwriting", ...boxCoords(sx, sy, mx, my), text: "text...", style: 5, strokes: [] }),
  },

  circle: {
    makeGhost:   (sx, sy, mx, my, page) => ({ type: "Circle", cx: sx, cy: sy, r: circleRadius(sx, sy, mx, my, page) }),
    makeElement: (id, sx, sy, mx, my, page) => ({ id, type: "Circle", cx: sx, cy: sy, r: circleRadius(sx, sy, mx, my, page) }),
  },
};
