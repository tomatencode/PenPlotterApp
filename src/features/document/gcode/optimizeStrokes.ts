// Stroke order optimizer — minimises total pen-up travel distance.
//
// Three phases:
//   1. Greedy nearest-neighbour  — builds a good initial order in O(n²)
//   2. 2-opt                     — repeatedly reverses segments to cut travel further
//   3. Commit entry choices      — writes the chosen direction into each stroke

import type { GStroke } from "./types";

// ── Geometry helpers ──────────────────────────────────────────────────────────

function dist(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** The entry point on a stroke that is closest to the current pen position. */
function bestEntry(pen: [number, number], stroke: GStroke): [number, number] {
  if (stroke.kind === "open") {
    return dist(pen, stroke.start) <= dist(pen, stroke.end) ? stroke.start : stroke.end;
  }
  return stroke.joints.reduce<[number, number]>(
    (best, j) => dist(pen, j as [number, number]) < dist(pen, best) ? j as [number, number] : best,
    stroke.joints[0] as [number, number],
  );
}

/** Where the pen ends up after drawing the stroke, given it enters from `pen`. */
function bestExit(pen: [number, number], stroke: GStroke): [number, number] {
  if (stroke.kind === "open") {
    // Enter from the nearer end; exit from the other end.
    return dist(pen, stroke.start) <= dist(pen, stroke.end) ? stroke.end : stroke.start;
  }
  // Loops close back to their entry joint.
  return bestEntry(pen, stroke);
}

function penUpDist(pen: [number, number], stroke: GStroke): number {
  return dist(pen, bestEntry(pen, stroke));
}

// ── Phase 1: greedy nearest-neighbour ─────────────────────────────────────────

function greedyOrder(strokes: GStroke[], home: [number, number]): GStroke[] {
  const remaining = [...strokes];
  const ordered: GStroke[] = [];
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

/** Simulate the pen moving through a sequence of strokes; return total cost and final position. */
function traversalCost(
  strokes: GStroke[],
  from: [number, number],
): { cost: number; exit: [number, number] } {
  let pen = from;
  let cost = 0;
  for (const s of strokes) {
    cost += dist(pen, bestEntry(pen, s));
    pen = bestExit(pen, s);
  }
  return { cost, exit: pen };
}

function computeExits(strokes: GStroke[], home: [number, number]): [number, number][] {
  let pen = home;
  return strokes.map(s => { pen = bestExit(pen, s); return pen; });
}

/**
 * Returns true if visiting strokes[from..to] in reverse order costs less
 * pen-up travel than forward order (including the hop to the next stroke).
 */
function reversingSegmentSavesTravel(
  strokes: GStroke[],
  from: number,
  to: number,
  pen: [number, number],
): boolean {
  const segment = strokes.slice(from, to + 1);
  const { cost: fwdCost, exit: fwdExit } = traversalCost(segment, pen);
  const { cost: revCost, exit: revExit } = traversalCost([...segment].reverse(), pen);

  // The stroke after the segment is also affected by the different exit position.
  const n = strokes.length;
  const hopFwd = to + 1 < n ? penUpDist(fwdExit, strokes[to + 1]) : 0;
  const hopRev = to + 1 < n ? penUpDist(revExit, strokes[to + 1]) : 0;

  return (revCost + hopRev) < (fwdCost + hopFwd);
}

function twoOpt(strokes: GStroke[], home: [number, number]): void {
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
          break outer; // exits cache is stale — restart the scan
        }
      }
    }
  }
}

// ── Phase 3: commit entry choices ─────────────────────────────────────────────

function commitEntry(stroke: GStroke, entry: [number, number]): void {
  if (stroke.kind === "open") {
    stroke.reversed =
      entry[0] === stroke.end[0] && entry[1] === stroke.end[1] &&
      !(entry[0] === stroke.start[0] && entry[1] === stroke.start[1]);
  } else {
    const idx = stroke.joints.findIndex(j => j[0] === entry[0] && j[1] === entry[1]);
    stroke.startIndex = idx === -1 ? 0 : idx;
  }
}

function applyAllEntries(strokes: GStroke[], home: [number, number]): void {
  let pen = home;
  for (const s of strokes) {
    const entry = bestEntry(pen, s);
    commitEntry(s, entry);
    pen = bestExit(pen, s);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function optimizeStrokes(strokes: GStroke[], home: [number, number]): GStroke[] {
  if (strokes.length === 0) return strokes;
  const ordered = greedyOrder(strokes, home);
  twoOpt(ordered, home);
  applyAllEntries(ordered, home);
  return ordered;
}
