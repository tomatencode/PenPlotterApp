// Converts the compact simplex glyph data into proper PlttrFont format.

import type { PlttrFont } from "../types";
import type { PlotterMove, PlotterStroke } from "../plotterMove";
import { SIMPLEX_GLYPHS, SIMPLEX_HEIGHT } from "./simplexData";

function rawToPlotterStrokes(rawStrokes: number[][][]): PlotterStroke[] {
  return rawStrokes.map((pts) => {
    const start: [number, number] = [pts[0][0], pts[0][1]];
    const moves: PlotterMove[] = pts.slice(1).map((pt, i) => ({
      type:  "Line" as const,
      x1: pts[i][0], y1: pts[i][1],
      x2: pt[0],     y2: pt[1],
    }));
    return { start, moves };
  });
}

export const SIMPLEX_FONT: PlttrFont = {
  name:   "Simplex",
  height: SIMPLEX_HEIGHT,
  glyphs: Object.fromEntries(
    Object.entries(SIMPLEX_GLYPHS).map(([char, [width, ...rawStrokes]]) => [
      char,
      { width, paths: rawToPlotterStrokes(rawStrokes as number[][][]) },
    ]),
  ),
};

/** All fonts available by default — no file needed. */
export const DEFAULT_FONTS: Map<string, PlttrFont> = new Map([
  [SIMPLEX_FONT.name, SIMPLEX_FONT],
]);
