import type { Node, Candidate, Tour } from "./types";
import { dist } from "./acoHelpers";

type NodeScore = { node: number; score: number };

// ── Scoring ───────────────────────────────────────────────────────────────────

function scoreNode(
    fromNode: number,
    toNode: number,
    heuristic: number,
    n: number,
    pheromoneMatrix: Float64Array,
    alpha: number,
): number {
    const pheromone = pheromoneMatrix[fromNode * n + toNode];
    // heuristic is already η^β (precomputed in buildHeuristicMatrix)
    return Math.pow(pheromone, alpha) * heuristic;
}

/** Walk the candidate list from currentNode, collecting scores until
 *  minUniqueStrokes distinct strokes are represented. */
function scoresFromCandidateList(
    currentNode: number,
    candidateList: Candidate[][],
    nodes: Node[],
    pheromoneMatrix: Float64Array,
    n: number,
    alpha: number,
    minUniqueStrokes: number,
    visited: Set<number>,
): { scores: NodeScore[]; coveredStrokes: Set<number> } {
    const scores: NodeScore[] = [];
    const coveredStrokes = new Set<number>();

    for (const candidate of candidateList[currentNode]) {
        if (coveredStrokes.size >= minUniqueStrokes) break;
        const j = candidate.nodeIndex;
        if (visited.has(j)) continue;
        scores.push({ node: j, score: scoreNode(currentNode, j, candidate.heuristic, n, pheromoneMatrix, alpha) });
        coveredStrokes.add(nodes[j].strokeIndx);
    }

    return { scores, coveredStrokes };
}

/** Fallback: scan all unvisited nodes until minUniqueStrokes are covered.
 *  Used for the first step (currentNode === -1) and when candidate list runs dry. */
function scoresFromFallback(
    currentNode: number,
    currentPos: [number, number],
    nodes: Node[],
    pheromoneMatrix: Float64Array,
    heuristicMatrix: Float64Array,
    n: number,
    alpha: number,
    beta: number,
    minUniqueStrokes: number,
    visited: Set<number>,
    alreadyCovered: Set<number>,
): { scores: NodeScore[]; coveredStrokes: Set<number> } {
    const scores: NodeScore[] = [];
    const coveredStrokes = new Set<number>(alreadyCovered);

    for (let j = 0; j < n; j++) {
        if (coveredStrokes.size >= minUniqueStrokes) break;
        if (visited.has(j)) continue;
        if (alreadyCovered.has(nodes[j].strokeIndx)) continue; // already in candidate scores

        // heuristicMatrix already stores η^β; for first step compute it inline
        const heuristic = currentNode === -1
            ? Math.pow(1 / dist(currentPos, nodes[j].start), beta)
            : heuristicMatrix[currentNode * n + j];
        const pheromone = currentNode === -1 ? 1 : pheromoneMatrix[currentNode * n + j];
        const score = Math.pow(pheromone, alpha) * heuristic;

        scores.push({ node: j, score });
        coveredStrokes.add(nodes[j].strokeIndx);
    }

    return { scores, coveredStrokes };
}

// ── Selection ─────────────────────────────────────────────────────────────────

/** Roulette-wheel selection over a set of scored nodes. */
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

function selectNode(scores: NodeScore[], uniqueStrokes: Set<number>, nodes: Node[]): number {
    if (scores.length === 0) throw new Error("No nodes to select from");
    if (scores.length === 1) return scores[0].node;

    // randomly select one node for each unique stroke, then pick one of those
    const candiadates = [];
    for (const stroke of uniqueStrokes) {
        const strokeCandidates = scores.filter(s => nodes[s.node].strokeIndx === stroke);
        if (strokeCandidates.length > 0) {
            const selected = strokeCandidates[rouletteSelect(strokeCandidates.map(s => s.score))];
            candiadates.push(selected);
        }
    }

    const selected = candiadates[rouletteSelect(candiadates.map(s => s.score))]
    return selected.node
}

// ── Main tour construction ────────────────────────────────────────────────────

export function doAntTour(
    nodes: Node[],
    home: [number, number],
    candidateList: Candidate[][],
    pheromoneMatrix: Float64Array,
    heuristicMatrix: Float64Array,
    alpha: number,
    beta: number,
    minUniqueStrokes: number,
): Tour {
    const n = nodes.length;
    const visited = new Set<number>();
    const tour: Tour = { nodes: [], cost: 0 };
    let currentNode = -1;
    let currentPos = home;

    while (visited.size < n) {
        // Build candidate scores
        let scores: NodeScore[] = [];
        let coveredStrokes = new Set<number>();

        if (currentNode !== -1) {
            ({ scores, coveredStrokes } = scoresFromCandidateList(
                currentNode, candidateList, nodes,
                pheromoneMatrix, n, alpha,
                minUniqueStrokes, visited,
            ));
        }

        if (coveredStrokes.size < minUniqueStrokes) {
            const { scores: fallback, coveredStrokes: allCovered } = scoresFromFallback(
                currentNode, currentPos, nodes,
                pheromoneMatrix, heuristicMatrix, n, alpha, beta,
                minUniqueStrokes, visited, coveredStrokes,
            );
            scores = scores.concat(fallback);
            coveredStrokes = allCovered;
        }

        // Select next node
        const selectedNode = selectNode(scores, coveredStrokes, nodes);

        // Mark stroke as visited (grouped TSP constraint)
        visited.add(selectedNode);
        for (const idx of nodes[selectedNode].sameStrokeIndxs) {
            visited.add(idx);
        }

        tour.nodes.push(selectedNode);
        tour.cost += dist(currentPos, nodes[selectedNode].start);
        currentNode = selectedNode;
        currentPos = nodes[currentNode].end;
    }

    return tour;
}
