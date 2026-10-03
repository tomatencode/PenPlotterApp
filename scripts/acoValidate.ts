// Correctness check for the ACO optimiser. Dev-only — deliberately kept outside
// src/ so it is not part of the app's TypeScript build. Run with:
//
//   npx esbuild scripts/acoValidate.ts --bundle --platform=node --format=esm \
//     --outfile=/tmp/acoValidate.mjs && node --max-old-space-size=8000 /tmp/acoValidate.mjs
//
// It optimises every pen batch of the real converted drawing and asserts that
// each input stroke comes back with its geometry intact.
//
// runAco legitimately rewrites a stroke's entry point (reversing open strokes,
// rotating closed ones), so the output is not signature-identical to the input.
// Validity is checked on the geometry each stroke covers instead: the undirected
// edge set, which both rewrites preserve.
import { readFileSync } from "node:fs";
import { runAco } from "../src/features/document/gcodeGeneration/aco/runAco";
import type { Parameters } from "../src/features/document/gcodeGeneration/aco/types";

const PARAMETERS: Parameters = {
  maxTimeMs: 3000,
  alpha: 1,
  beta: 4,
  rho: 0.12,
  candidateListSize: 30,
  minUniqueStrokesInDecision: 5,
  numAnts: 50,
  stagnationThreshold: 0.9,
  maxStagnationResets: 7,
};

type Stroke = { start: [number, number]; moves: { x2: number; y2: number }[] };

function points(s: Stroke): [number, number][] {
  const pts: [number, number][] = [s.start];
  for (const m of s.moves) pts.push([m.x2, m.y2]);
  return pts;
}

function edgeSet(s: Stroke): string {
  const pts = points(s);
  const edges: string[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = `${pts[i][0]},${pts[i][1]}`;
    const b = `${pts[i + 1][0]},${pts[i + 1][1]}`;
    edges.push(a < b ? `${a}|${b}` : `${b}|${a}`);
  }
  return edges.sort().join(";");
}

function endpoints(s: Stroke): string {
  const pts = points(s);
  const a = `${pts[0][0]},${pts[0][1]}`;
  const b = `${pts[pts.length - 1][0]},${pts[pts.length - 1][1]}`;
  return a < b ? `${a}..${b}` : `${b}..${a}`;
}

function isClosed(s: Stroke): boolean {
  const pts = points(s);
  const last = pts[pts.length - 1];
  return last[0] === pts[0][0] && last[1] === pts[0][1];
}

/**
 * Identity of a stroke under the rewrites commitEntry performs.
 *
 * Both rewrites preserve the undirected edge set: reversing an open stroke
 * swaps its ends, rotating a closed one just moves which vertex comes first.
 * So the edge set alone identifies a closed stroke. An open stroke additionally
 * needs its endpoint pair, because the same edges read as two different chains
 * with the ends swapped — which is exactly what a reversal produces.
 */
function key(s: Stroke): string {
  const edges = `${edgeSet(s)}#${s.moves.length}`;
  return isClosed(s) ? edges : `${edges}#${endpoints(s)}`;
}

function validate(input: Stroke[], output: Stroke[]): string {
  if (input.length !== output.length) return `FAIL length ${output.length} != ${input.length}`;
  const want = new Map<string, number>();
  for (const s of input) {
    const k = key(s);
    want.set(k, (want.get(k) ?? 0) + 1);
  }
  for (const s of output) {
    const k = key(s);
    const c = want.get(k);
    if (!c) return `FAIL unexpected stroke ${k.slice(0, 50)}...`;
    if (c === 1) want.delete(k);
    else want.set(k, c - 1);
  }
  if (want.size > 0) return `FAIL ${want.size} stroke(s) missing`;
  return "ok";
}

function travelCost(strokes: Stroke[], home: [number, number]): number {
  let cost = 0;
  let cx = home[0];
  let cy = home[1];
  for (const s of strokes) {
    cost += Math.hypot(cx - s.start[0], cy - s.start[1]);
    const pts = points(s);
    cx = pts[pts.length - 1][0];
    cy = pts[pts.length - 1][1];
  }
  return cost;
}

const doc = JSON.parse(readFileSync("/home/simon/Downloads/Drawing.pnplttr", "utf8"));

// Group by pen, as the app does when it optimises each pen batch separately.
const batches = new Map<number, Stroke[]>();
for (const el of doc.elements) {
  if (el.type !== "Drawing") continue;
  const pts = el.points;
  const moves = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    moves.push({ type: "Line", x1: pts[i][0], y1: pts[i][1], x2: pts[i + 1][0], y2: pts[i + 1][1] });
  }
  if (!batches.has(el.pen)) batches.set(el.pen, []);
  batches.get(el.pen)!.push({ start: pts[0], moves } as Stroke);
}

const home: [number, number] = [0, 0];
let totalMs = 0;
let failures = 0;
console.log("pen   strokes       time(ms)   travel(mm)   valid");

for (const [pen, strokes] of [...batches.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const t0 = Date.now();
  const out = runAco(strokes as never, home, PARAMETERS);
  const ms = Date.now() - t0;
  totalMs += ms;
  const v = validate(strokes, out);
  if (v !== "ok") failures++;
  console.log(
    `${String(pen).padStart(3)}  ${String(strokes.length).padStart(8)}  ${String(ms).padStart(12)}   ${travelCost(out, home).toFixed(1).padStart(12)}   ${v}`,
  );
}

console.log(`\ntotal ${totalMs}ms, ${failures === 0 ? "ALL VALID" : `${failures} FAILURE(S)`}`);
if (failures > 0) process.exitCode = 1;