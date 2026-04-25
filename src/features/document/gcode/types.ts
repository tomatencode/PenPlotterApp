import type { PlotterMove } from "../plotterMove";
export type { PlotterMove };

export type OpenStroke = {
  kind: "open";
  start: [number, number];
  end: [number, number];
  moves: PlotterMove[];
  reversed: boolean; // set by optimizer
};

export type LoopStroke = {
  kind: "loop";
  /** joints[i] = pen position at the start of moves[i]; loop closes back to joints[0]. */
  joints: [number, number][];
  moves: PlotterMove[];
  startIndex: number; // set by optimizer
};

export type GStroke = OpenStroke | LoopStroke;
