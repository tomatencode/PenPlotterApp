// Stroke order optimizer — minimises total pen-up travel distance.
//
// Three phases:
//   1. Greedy nearest-neighbour  — builds a good initial order in O(n²)
//   2. 2-opt                     — repeatedly reverses segments to cut travel further
//   3. Commit entry choices      — returns NEW PlotterStrokes with moves already
//                                  reversed/rotated into their final traversal order
//
// The output strokes are self-contained: strokeToGcode just walks moves[] in order.

import type { PlotterStroke, PlotterMove } from "../plotterMove";

// ── Geometry helpers ──────────────────────────────────────────────────────────

function dist(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function endPoint(stroke: PlotterStroke): [number, number] {
  const last = stroke.moves[stroke.moves.length - 1];
  return [last.x2, last.y2];
}

/** The entry point on a stroke closest to the current pen position. */
function bestEntry(pen: [number, number], stroke: PlotterStroke): [number, number] {
  if (!stroke.closed) {
    const end = endPoint(stroke);
    return dist(pen, stroke.start) <= dist(pen, end) ? stroke.start : end;
  }
  return stroke.moves.reduce<[number, number]>(
    (best, m) => dist(pen, [m.x1, m.y1]) < dist(pen, best) ? [m.x1, m.y1] : best,
    [stroke.moves[0].x1, stroke.moves[0].y1],
  );
}

/** Where the pen ends up after drawing the stroke, given it enters from `pen`. */
function bestExit(pen: [number, number], stroke: PlotterStroke): [number, number] {
  if (!stroke.closed) {
    const end = endPoint(stroke);
    return dist(pen, stroke.start) <= dist(pen, end) ? end : stroke.start;
  }
  return bestEntry(pen, stroke); // loops close back to entry
}

function penUpDist(pen: [number, number], stroke: PlotterStroke): number {
  return dist(pen, bestEntry(pen, stroke));
}

// ── Phase 1: greedy nearest-neighbour ─────────────────────────────────────────

function greedyOrder(strokes: PlotterStroke[], home: [number, number]): PlotterStroke[] {
  const remaining = [...strokes];
  const ordered: PlotterStroke[] = [];
  let pen = home;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = penUpDist(pen, remaining[i]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    const [stroke] = remaining.splice(bestIdx, 1);
    pen = bestExit(pen, stroke);
    ordered.push(stroke);
  }

  return ordered;
}

// ── Phase 2: 2-opt ────────────────────────────────────────────────────────────

function traversalCost(strokes: PlotterStroke[], from: [number, number]): { cost: number; exit: [number, number] } {
  let pen = from;
  let cost = 0;
  for (const s of strokes) {
    cost += dist(pen, bestEntry(pen, s));
    pen = bestExit(pen, s);
  }
  return { cost, exit: pen };
}

function computeExits(strokes: PlotterStroke[], home: [number, number]): [number, number][] {
  let pen = home;
  return strokes.map(s => { pen = bestExit(pen, s); return pen; });
}

function reversingSegmentSavesTravel(
  strokes: PlotterStroke[],
  from: number,
  to: number,
  pen: [number, number],
): boolean {
  const segment = strokes.slice(from, to + 1);
  const { cost: fwdCost, exit: fwdExit } = traversalCost(segment, pen);
  const { cost: revCost, exit: revExit } = traversalCost([...segment].reverse(), pen);
  const n = strokes.length;
  const hopFwd = to + 1 < n ? penUpDist(fwdExit, strokes[to + 1]) : 0;
  const hopRev = to + 1 < n ? penUpDist(revExit, strokes[to + 1]) : 0;
  return (revCost + hopRev) < (fwdCost + hopFwd);
}

function twoOpt(strokes: PlotterStroke[], home: [number, number]): void {
  const n = strokes.length;
  if (n < 3) return;
  let improved = true;
  while (improved) {
    improved = false;
    const exits = computeExits(strokes, home);
    outer:
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        if (reversingSegmentSavesTravel(strokes, i + 1, j, exits[i])) {
          strokes.splice(i + 1, j - i, ...strokes.slice(i + 1, j + 1).reverse());
          improved = true;
          break outer;
        }
      }
    }
  }
}

// ── Phase 3: commit entry choices ─────────────────────────────────────────────
// Returns a NEW PlotterStroke with moves reversed/rotated so traversal is
// always forward — strokeToGcode needs no reversal logic at all.

function reverseMove(m: PlotterMove): PlotterMove {
  switch (m.type) {
    case "Line":        return { ...m, x1: m.x2, y1: m.y2, x2: m.x1, y2: m.y1 };
    case "Arc":         return { ...m, x1: m.x2, y1: m.y2, x2: m.x1, y2: m.y1, clockwise: !m.clockwise };
    case "QuadBezier":  return { ...m, x1: m.x2, y1: m.y2, x2: m.x1, y2: m.y1 };
    case "CubicBezier": return { ...m, x1: m.x2, y1: m.y2, x2: m.x1, y2: m.y1, cx1: m.cx2, cy1: m.cy2, cx2: m.cx1, cy2: m.cy1 };
  }
}

function commitEntry(stroke: PlotterStroke, entry: [number, number]): PlotterStroke {
  if (!stroke.closed) {
    const end = endPoint(stroke);
    const reversed =
      entry[0] === end[0] && entry[1] === end[1] &&
      !(entry[0] === stroke.start[0] && entry[1] === stroke.start[1]);
    if (!reversed) return stroke;
    return { ...stroke, start: end, moves: [...stroke.moves].reverse().map(reverseMove) };
  } else {
    const idx = stroke.moves.findIndex(m => m.x1 === entry[0] && m.y1 === entry[1]);
    const startIndex = idx === -1 ? 0 : idx;
    if (startIndex === 0) return stroke;
    return {
      ...stroke,
      start: entry,
      moves: [...stroke.moves.slice(startIndex), ...stroke.moves.slice(0, startIndex)],
    };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function optimizeStrokes(strokes: PlotterStroke[], home: [number, number]): PlotterStroke[] {
  if (strokes.length === 0) return strokes;
  const ordered = greedyOrder(strokes, home);
  twoOpt(ordered, home);
  let pen = home;
  return ordered.map(s => {
    const entry = bestEntry(pen, s);
    pen = bestExit(pen, s); // use original s — exit point is the same before/after commit
    return commitEntry(s, entry);
  });
}
