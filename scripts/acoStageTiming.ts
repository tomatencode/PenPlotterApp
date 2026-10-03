// Per-stage timing for the real converted drawing, showing where the ACO
// time budget now goes. Run with:
//
 //   npx esbuild scripts/acoStageTiming.ts --bundle --platform=node --format=esm \
//     --outfile=/tmp/acoStageTiming.mjs && node --max-old-space-size=8000 /tmp/acoStageTiming.mjs
// Checks the spatial-grid candidate builder returns the EXACT nearest-`stride`
// neighbours of every node, identical to a brute-force scan. Run with:
//
//   npx esbuild scripts/acoGridExact.ts --bundle --platform=node --format=esm \
//     --outfile=/tmp/acoGridExact.mjs && node /tmp/acoGridExact.mjs
// Per-stage timing for the real drawing, showing where the budget now goes.
import { readFileSync } from "node:fs";
import { buildProblem, buildGreedyTour } from "../src/features/document/gcodeGeneration/aco/acoSetup";
import { doAntTour } from "../src/features/document/gcodeGeneration/aco/antTour";
import { createPheromone } from "../src/features/document/gcodeGeneration/aco/pheromone";
import { orOpt } from "../src/features/document/gcodeGeneration/aco/orOpt";

const doc = JSON.parse(readFileSync("/home/simon/Downloads/Drawing.pnplttr", "utf8"));
const batches = new Map<number, any[]>();
for (const el of doc.elements as any[]) {
  if (el.type !== "Drawing") continue;
  const pts = el.points; const moves: any[] = [];
  for (let i = 0; i + 1 < pts.length; i++) moves.push({ type: "Line", x1: pts[i][0], y1: pts[i][1], x2: pts[i + 1][0], y2: pts[i + 1][1] });
  if (!batches.has(el.pen)) batches.set(el.pen, []);
  batches.get(el.pen)!.push({ start: pts[0], moves });
}
const home: [number, number] = [0, 0];
const BETA = 4, C = 30, ALPHA = 1, RHO = 0.12;
console.log("pen  strokes    nodes   build(ms)  mem(MB)  greedy(ms)  ant1(ms)  orOpt(ms)  iters/3s");
for (const [pen, strokes] of [...batches.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const t0 = Date.now();
  const problem = buildProblem(strokes as never, BETA, C);
  const buildMs = Date.now() - t0;
  const { n } = problem;
  const mem = ((n * C * 4) + (n * C * 8) + (n * 8 * 4)) / 1048576;

  const t1 = Date.now();
  const greedy = buildGreedyTour(problem, home, BETA);
  const greedyMs = Date.now() - t1;

  const max = 1 / (RHO * greedy.cost);
  const ph = createPheromone(problem, max, max / (2 * n), RHO);

  const t2 = Date.now();
  doAntTour(problem, ph, home, ALPHA, BETA, 5);
  const antMs = Date.now() - t2;

  const t3 = Date.now();
  orOpt(greedy, problem.graph, home, 64);
  const orMs = Date.now() - t3;

  const t4 = Date.now();
  let iters = 0;
  while (Date.now() - t4 < 3000) {
    for (let a = 0; a < 50; a++) doAntTour(problem, ph, home, ALPHA, BETA, 5);
    orOpt(greedy, problem.graph, home, 64);
    iters++;
  }
  console.log(
    String(pen).padStart(3), String(strokes.length).padStart(8), String(n).padStart(8),
    String(buildMs).padStart(10), mem.toFixed(1).padStart(8), String(greedyMs).padStart(11),
    String(antMs).padStart(9), String(orMs).padStart(10), String(iters).padStart(9));
}