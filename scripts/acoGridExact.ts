// Checks the spatial-grid candidate builder returns the EXACT nearest-`stride`
// neighbours of every node, identical to a brute-force scan. Run with:
//
//   npx esbuild scripts/acoGridExact.ts --bundle --platform=node --format=esm \
//     --outfile=/tmp/acoGridExact.mjs && node /tmp/acoGridExact.mjs
// Proves the spatial-grid candidate builder finds the EXACT nearest-`stride`
// neighbours of every node — identical to a brute-force scan.
//
// The contract is the multiset of distances per row, not the identities: with
// many equidistant neighbours (a lattice, duplicate points) any of them is a
// correct answer, so requiring the same index would test more than is claimed.
// Distances are also required to be non-decreasing down each row.
import { buildProblem } from "../src/features/document/gcodeGeneration/aco/acoSetup";

function bruteForce(sx: Float64Array, sy: Float64Array, ex: Float64Array, ey: Float64Array, n: number, c: number) {
  const stride = Math.max(0, Math.min(n - 1, c));
  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: { j: number; d: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dx = ex[i] - sx[j], dy = ey[i] - sy[j];
      row.push({ j, d: Math.sqrt(dx * dx + dy * dy) });
    }
    row.sort((a, b) => a.d - b.d || a.j - b.j);
    out.push(row.slice(0, stride).map((r) => r.d));
  }
  return { stride, out };
}

const BETA = 4;
const C = 30;

/** Build the graph through the real code path so this tests production wiring. */
function check(name: string, pts: [number, number][]) {
  // One zero-length open stroke per point: node i starts and ends at pts[i].
  const strokes = pts.map((p) => ({ start: p, moves: [{ type: "Line", x1: p[0], y1: p[1], x2: p[0], y2: p[1] }] }));
  const problem = buildProblem(strokes as never, BETA, C);
  const { candidates, graph, n } = problem;
  const bf = bruteForce(graph.startX, graph.startY, graph.endX, graph.endY, n, C);

  if (candidates.stride !== bf.stride) return `${name}: stride ${candidates.stride} != ${bf.stride}`;

  for (let i = 0; i < n; i++) {
    const base = i * candidates.stride;
    // η^β = d^-β is monotonically decreasing in d, so comparing the published
    // heuristics is the same as comparing distances.
    for (let k = 1; k < candidates.stride; k++) {
      if (candidates.heuristic[base + k] > candidates.heuristic[base + k - 1]) {
        return `${name}: node ${i} rank ${k}: heuristic not descending`;
      }
    }
    for (let k = 0; k < candidates.stride; k++) {
      // h = d^-β  ⇒  d = h^(-1/β)
      const got = Math.pow(candidates.heuristic[base + k], -1 / BETA);
      const want = bf.out[i][k];
      const tol = 1e-6 * Math.max(1, want);
      if (Math.abs(got - want) > tol) {
        return `${name}: node ${i} rank ${k}: distance ${got} want ${want}`;
      }
    }
  }
  return null;
}

// mulberry32 — a correct 32-bit PRNG. A naive LCG overflows JS doubles above
// 2^53 and degenerates into massive duplicate points, which would make this
// test measure tie-breaking rather than correctness.
const rnd = (() => { let a = 0x9e3779b9; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();

const cases: [string, [number, number][]][] = [
  ["empty", []],
  ["single", [[1, 1]]],
  ["two", [[0, 0], [1, 1]]],
  ["all-identical", Array.from({ length: 50 }, () => [5, 5])],
  ["collinear", Array.from({ length: 80 }, (_, i) => [i, 0])],
  ["vertical-collinear", Array.from({ length: 80 }, (_, i) => [0, i])],
  ["random-100", Array.from({ length: 100 }, () => [rnd() * 200, rnd() * 200])],
  ["random-500", Array.from({ length: 500 }, () => [rnd() * 1000, rnd() * 1000])],
  ["random-2000", Array.from({ length: 2000 }, () => [rnd() * 5000, rnd() * 5000])],
  ["two-tight-clusters", Array.from({ length: 200 }, (_, i) => (i % 2 ? [rnd() * 0.01, rnd() * 0.01] : [100 + rnd() * 0.01, 100 + rnd() * 0.01]))],
  ["grid-lattice", Array.from({ length: 144 }, (_, i) => [i % 12, Math.floor(i / 12)])],
  ["duplicates-halves", Array.from({ length: 90 }, (_, i) => [Math.floor(i / 2), Math.floor(i / 3)])],
  ["tiny-span", Array.from({ length: 60 }, () => [rnd() * 1e-6, rnd() * 1e-6])],
  ["one-dominant-axis", Array.from({ length: 120 }, () => [rnd() * 1e4, 42])],
];

let bad = 0;
for (const [name, pts] of cases) {
  const err = check(name, pts);
  if (err) { bad++; console.log("MISMATCH", err); }
  else console.log(`ok  ${name} (n=${pts.length})`);
}
console.log(bad === 0 ? "\nALL EXACT vs brute force" : `\n${bad} MISMATCH(ES)`);
if (bad > 0) process.exitCode = 1;