// Internal move and stroke types for GCode conversion.
// Every move carries absolute start + end coords so the optimizer can reverse moves correctly.

export type GMove =
  | { type: "Line";        x1: number; y1: number; x2: number; y2: number }
  | { type: "Arc";         x1: number; y1: number; cx: number; cy: number; x2: number; y2: number; clockwise: boolean }
  | { type: "QuadBezier";  x1: number; y1: number; cx: number; cy: number; x2: number; y2: number }
  | { type: "CubicBezier"; x1: number; y1: number; cx1: number; cy1: number; cx2: number; cy2: number; x2: number; y2: number };

export type OpenStroke = {
  kind: "open";
  start: [number, number];
  end: [number, number];
  moves: GMove[];
  reversed: boolean; // set by optimizer
};

export type LoopStroke = {
  kind: "loop";
  /** joints[i] = pen position at the start of moves[i]; loop closes back to joints[0]. */
  joints: [number, number][];
  moves: GMove[];
  startIndex: number; // set by optimizer
};

export type GStroke = OpenStroke | LoopStroke;
