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
        // Strokes are stored in normalised [0,1] space; transform to document space.
        let maxX = 0, maxY = 0;
        for (const s of el.strokes) {
          maxX = Math.max(maxX, s.start[0]);
          maxY = Math.max(maxY, s.start[1]);
          for (const m of s.moves) {
            switch (m.type) {
              case "Line":
                maxX = Math.max(maxX, m.x1, m.x2);
                maxY = Math.max(maxY, m.y1, m.y2);
                break;
              case "Arc":
                maxX = Math.max(maxX, m.x1, m.cx, m.x2);
                maxY = Math.max(maxY, m.y1, m.cy, m.y2);
                break;
              case "QuadBezier":
                maxX = Math.max(maxX, m.x1, m.cx, m.x2);
                maxY = Math.max(maxY, m.y1, m.cy, m.y2);
                break;
              case "CubicBezier":
                maxX = Math.max(maxX, m.x1, m.cx1, m.cx2, m.x2);
                maxY = Math.max(maxY, m.y1, m.cy1, m.cy2, m.y2);
                break;
            }
          }
        }
        if (maxX === 0 || maxY === 0) break; // avoid division by zero

        const tx = (nx: number) => el.x + nx / maxX * el.w;
        const ty = (ny: number) => el.y + ny / maxY * el.h;
        for (const s of el.strokes) {
          strokes.push({
            start: [tx(s.start[0]), ty(s.start[1])],
            moves: s.moves.map((m): PlotterMove => {
              switch (m.type) {
                case "Line":        return { type: "Line", x1: tx(m.x1), y1: ty(m.y1), x2: tx(m.x2), y2: ty(m.y2) };
                case "Arc":         return { ...m, x1: tx(m.x1), y1: ty(m.y1), cx: tx(m.cx), cy: ty(m.cy), x2: tx(m.x2), y2: ty(m.y2) };
                case "QuadBezier":  return { ...m, x1: tx(m.x1), y1: ty(m.y1), cx: tx(m.cx), cy: ty(m.cy), x2: tx(m.x2), y2: ty(m.y2) };
                case "CubicBezier": return { ...m, x1: tx(m.x1), y1: ty(m.y1), cx1: tx(m.cx1), cy1: ty(m.cy1), cx2: tx(m.cx2), cy2: ty(m.cy2), x2: tx(m.x2), y2: ty(m.y2) };
              }
            }),
          });
        }
        break;
      }
    }
  }

  return strokes;
}
