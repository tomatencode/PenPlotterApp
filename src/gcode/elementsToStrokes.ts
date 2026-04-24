// Converts document elements to the internal GStroke representation.
// Each element type maps to either an OpenStroke (has a distinct start and end)
// or a LoopStroke (closed path that can start at any joint).

import type { Element } from "../components/document/types";
import type { GMove, GStroke } from "./types";

export function elementsToGStrokes(elements: Element[]): GStroke[] {
  const strokes: GStroke[] = [];

  for (const el of elements) {
    switch (el.type) {
      case "Drawing": {
        if (el.points.length < 2) break;
        const moves: GMove[] = el.points.slice(0, -1).map((p, i) => ({
          type: "Line" as const,
          x1: p[0], y1: p[1],
          x2: el.points[i + 1][0], y2: el.points[i + 1][1],
        }));
        strokes.push({
          kind: "open",
          start: [el.points[0][0], el.points[0][1]],
          end:   [el.points[el.points.length - 1][0], el.points[el.points.length - 1][1]],
          moves,
          reversed: false,
        });
        break;
      }

      case "Line":
        strokes.push({
          kind: "open",
          start: [el.x1, el.y1],
          end:   [el.x2, el.y2],
          moves: [{ type: "Line", x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2 }],
          reversed: false,
        });
        break;

      case "Rect": {
        const { x, y, w, h } = el;
        strokes.push({
          kind: "loop",
          joints: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]],
          moves: [
            { type: "Line", x1: x,     y1: y,     x2: x + w, y2: y     },
            { type: "Line", x1: x + w, y1: y,     x2: x + w, y2: y + h },
            { type: "Line", x1: x + w, y1: y + h, x2: x,     y2: y + h },
            { type: "Line", x1: x,     y1: y + h, x2: x,     y2: y     },
          ],
          startIndex: 0,
        });
        break;
      }

      case "Circle": {
        const { cx, cy, r } = el;
        const right: [number, number] = [cx + r, cy];
        const left:  [number, number] = [cx - r, cy];
        // Two semicircle arcs give the optimizer two valid entry joints.
        strokes.push({
          kind: "loop",
          joints: [right, left],
          moves: [
            { type: "Arc", x1: right[0], y1: right[1], cx, cy, x2: left[0],  y2: left[1],  clockwise: true },
            { type: "Arc", x1: left[0],  y1: left[1],  cx, cy, x2: right[0], y2: right[1], clockwise: true },
          ],
          startIndex: 0,
        });
        break;
      }
    }
  }

  return strokes;
}
