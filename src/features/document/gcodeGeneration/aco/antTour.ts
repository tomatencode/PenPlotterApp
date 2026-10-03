import type { Problem, Pheromone, Tour } from "./types";
import { tourCost } from "./acoHelpers";
import { edgeTau } from "./pheromone";

type NodeScore = { node: number; score: number };

// ── Scoring ───────────────────────────────────────────────────────────────────

/**
 * Walk node `currentNode`'s candidate list, scoring until
 * `minUniqueStrokes` distinct strokes are represented.
 *
 * Candidate pheromone shares the candidate layout, so both τ and η^β are read
 * straight out of `base + rank` with no lookup at all.
 */
function scoresFromCandidateList(
    currentNode: number,
    problem: Problem,
    pheromone: Pheromone,
    alpha: number,
    minUniqueStrokes: number,
    visited: Uint8Array,
): { scores: NodeScore[]; coveredStrokes: Set<number> } {
    const { graph, candidates } = problem;
    const scores: NodeScore[] = [];
    const coveredStrokes = new Set<number>();
    const base = currentNode * candidates.stride;

    for (let rank = 0; rank < candidates.stride; rank++) {
        if (coveredStrokes.size >= minUniqueStrokes) break;
        const j = candidates.index[base + rank];
        if (visited[j]) continue;

        const tau = pheromone.values[base + rank];
        scores.push({ node: j, score: Math.pow(tau, alpha) * candidates.heuristic[base + rank] });
        coveredStrokes.add(graph.strokeIndx[j]);
    }

    return { scores, coveredStrokes };
}

/**
 * Fallback: scan all unvisited nodes until `minUniqueStrokes` are covered.
 * Used for the first step (`currentNode === -1`) and when the candidate list
 * runs dry. η^β is evaluated on demand instead of being read from a matrix.
 */
function scoresFromFallback(
    currentNode: number,
    currentX: number,
    currentY: number,
    problem: Problem,
    pheromone: Pheromone,
    alpha: number,
    beta: number,
    minUniqueStrokes: number,
    visited: Uint8Array,
    alreadyCovered: Set<number>,
): { scores: NodeScore[]; coveredStrokes: Set<number> } {
    const { graph, n, candidates } = problem;
    const scores: NodeScore[] = [];
    const coveredStrokes = new Set<number>(alreadyCovered);

    // For the first step the "current" position is home; afterwards it is this
    // node's end point.
    const px = currentNode === -1 ? currentX : graph.endX[currentNode];
    const py = currentNode === -1 ? currentY : graph.endY[currentNode];

    for (let j = 0; j < n; j++) {
        if (coveredStrokes.size >= minUniqueStrokes) break;
        if (visited[j]) continue;
        if (alreadyCovered.has(graph.strokeIndx[j])) continue;

        // η^β evaluated on demand — there is no n × n heuristic matrix to read.
        const dx = px - graph.startX[j];
        const dy = py - graph.startY[j];
        const heuristic = Math.pow(1 / Math.sqrt(dx * dx + dy * dy), beta);

        // Non-candidate edges default to the reset value (MMAS convention).
        let rank = -1;
        const base = currentNode * candidates.stride;
        for (let k = 0; k < candidates.stride; k++) {
            if (candidates.index[base + k] === j) { rank = k; break; }
        }
        const tau = currentNode === -1 ? 1 : edgeTau(pheromone, currentNode, j, rank);

        scores.push({ node: j, score: Math.pow(tau, alpha) * heuristic });
        coveredStrokes.add(graph.strokeIndx[j]);
    }

    return { scores, coveredStrokes };
}

// ── Selection ─────────────────────────────────────────────────────────────────

/** Roulette-wheel selection over a set of scores. */
function rouletteSelect(scores: number[]): number {
    const total = scores.reduce((sum, score) => sum + score, 0);
    const rand = Math.random() * total;
    let cumulative = 0;
    for (let i = 0; i < scores.length; i++) {
        cumulative += scores[i];
        if (rand <= cumulative) return i;
    }
    // floating point edge case — return last
    return scores.length - 1;
}

function selectNode(scores: NodeScore[], uniqueStrokes: Set<number>, strokeIndx: Int32Array): number {
    if (scores.length === 0) throw new Error("No nodes to select from");
    if (scores.length === 1) return scores[0].node;

    // randomly select one node per unique stroke, then pick one of those
    const chosen: NodeScore[] = [];
    for (const stroke of uniqueStrokes) {
        const strokeCandidates = scores.filter(s => strokeIndx[s.node] === stroke);
        if (strokeCandidates.length > 0) {
            chosen.push(strokeCandidates[rouletteSelect(strokeCandidates.map(s => s.score))]);
        }
    }

    const pick = chosen[rouletteSelect(chosen.map(s => s.score))];
    return pick.node;
}

// ── Main tour construction ────────────────────────────────────────────────────

export function doAntTour(
    problem: Problem,
    pheromone: Pheromone,
    home: [number, number],
    alpha: number,
    beta: number,
    minUniqueStrokes: number,
): Tour {
    const { graph, n } = problem;
    const visited = new Uint8Array(n);
    let visitedCount = 0;

    const tour: Tour = { nodes: [], cost: 0 };
    let currentNode = -1;
    let currentX = home[0];
    let currentY = home[1];
    let coveredStrokes = new Set<number>();

    while (visitedCount < n) {
        let scores: NodeScore[] = [];

        if (currentNode !== -1) {
            const res = scoresFromCandidateList(
                currentNode, problem, pheromone,
                alpha, minUniqueStrokes, visited,
            );
            scores = res.scores;
            coveredStrokes = res.coveredStrokes;
        }

        if (coveredStrokes.size < minUniqueStrokes) {
            const res = scoresFromFallback(
                currentNode, currentX, currentY, problem, pheromone,
                alpha, beta, minUniqueStrokes, visited, coveredStrokes,
            );
            scores = scores.concat(res.scores);
            coveredStrokes = res.coveredStrokes;
        }

        const selectedNode = selectNode(scores, coveredStrokes, graph.strokeIndx);

        // Mark the whole stroke visited (grouped TSP constraint).
        const g0 = graph.groupFirst[selectedNode];
        const gEnd = g0 + graph.groupCount[selectedNode];
        for (let i = g0; i < gEnd; i++) {
            if (!visited[i]) {
                visited[i] = 1;
                visitedCount++;
            }
        }

        tour.nodes.push(selectedNode);

        currentNode = selectedNode;
        currentX = graph.endX[selectedNode];
        currentY = graph.endY[selectedNode];
    }

    // Recompute rather than accumulating: the cost decides the pheromone deposit
    // and the best-tour comparison, so it must not drift over thousands of steps.
    tour.cost = tourCost(tour, graph, home);

    return tour;
}