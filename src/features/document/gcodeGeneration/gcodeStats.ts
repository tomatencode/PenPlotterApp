import type { PlotterMove, PlotterStroke } from "../plotterMove";

export interface JobStats {
  travel_mm: number;
  draw_mm: number;
  pen_lifts: number;
  pen_switches: number;
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function moveLength(m: PlotterMove): number {
  switch (m.type) {
    case "Line":
      return dist(m.x1, m.y1, m.x2, m.y2);
    case "Arc": {
      const r = dist(m.cx, m.cy, m.x1, m.y1);
      const a1 = Math.atan2(m.y1 - m.cy, m.x1 - m.cx);
      const a2 = Math.atan2(m.y2 - m.cy, m.x2 - m.cx);
      let angle = a2 - a1;
      if (m.clockwise && angle > 0) angle -= 2 * Math.PI;
      if (!m.clockwise && angle < 0) angle += 2 * Math.PI;
      return r * Math.abs(angle);
    }
    case "QuadBezier":
    case "CubicBezier":
      // chord-length approximation — good enough for a time estimate
      return dist(m.x1, m.y1, m.x2, m.y2);
  }
}

/** Accumulates stats for a set of strokes starting from penPos and returns the new pen position. */
export function accumulateStats(
  stats: JobStats,
  strokes: PlotterStroke[],
  penPos: [number, number],
): [number, number] {
  let [px, py] = penPos;
  for (const stroke of strokes) {
    stats.travel_mm += dist(px, py, stroke.start[0], stroke.start[1]);
    px = stroke.start[0];
    py = stroke.start[1];
    for (const m of stroke.moves) {
      stats.draw_mm += moveLength(m);
    }
    stats.pen_lifts++;
    const last = stroke.moves[stroke.moves.length - 1];
    if (last) { px = last.x2; py = last.y2; }
  }
  return [px, py];
}

export function statsHeader(stats: JobStats): string {
  return (
    `; STATS: travel_mm=${Math.round(stats.travel_mm)} draw_mm=${Math.round(stats.draw_mm)} pen_lifts=${stats.pen_lifts} pen_switches=${stats.pen_switches}\n\n`
  );
}
