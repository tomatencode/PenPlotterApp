// ── Element → PlotterStroke[] ─────────────────────────────────────────────────
// Single source of truth for how document elements map to plotter geometry.
// Both canvas rendering and gcode generation call this function so the preview
// always matches what the plotter will actually draw.
//
// Lives in its own file (separate from plotterMove.ts) so it can import both
// the plotter types and the text renderer without creating a circular dependency.

import type { Element, PlttrFont } from "./types";
import type { PlotterMove, PlotterStroke } from "./plotterMove";
import { textElementToStrokes } from "./text/textToStrokes";
import { HANDWRITING_DEFAULT_STROKES } from "./text/handwritingDefaultStrokes";
import { handwritingToStrokes } from "./text/handwritingToStrokes";

export function elementsToPlotterStrokes(
  elements: Element[],
  fonts: Map<string, PlttrFont>,
): PlotterStroke[] {
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
        strokes.push({ start: [el.points[0][0], el.points[0][1]], moves });
        break;
      }

      case "Line":
        strokes.push({
          start: [el.x1, el.y1],
          moves: [{ type: "Line", x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2 }],
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
        });
        break;
      }

      case "Text": {
        const font = fonts.get(el.fontName);
        if (font) strokes.push(...textElementToStrokes(el, font));
        break;
      }

      case "Handwriting": {

        strokes.push(...handwritingToStrokes(el));
        break;
      }
    }
  }

  return strokes;
}
