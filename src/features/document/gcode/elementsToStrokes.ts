// Converts document elements to the GStroke representation used by the optimizer.
// Wraps the shared elementsToPlotterStrokes() — closed strokes become LoopStrokes
// (joints derived from move start points), open strokes become OpenStrokes.

import type { Element } from "../types";
import { elementsToPlotterStrokes } from "../plotterMove";
import type { GStroke } from "./types";

export function elementsToGStrokes(elements: Element[]): GStroke[] {
  return elementsToPlotterStrokes(elements).map((stroke): GStroke => {
    if (stroke.closed) {
      return {
        kind: "loop",
        joints: stroke.moves.map(m => [m.x1, m.y1] as [number, number]),
        moves: stroke.moves,
        startIndex: 0,
      };
    } else {
      const last = stroke.moves[stroke.moves.length - 1];
      return {
        kind: "open",
        start: stroke.start,
        end: [last.x2, last.y2],
        moves: stroke.moves,
        reversed: false,
      };
    }
  });
}
