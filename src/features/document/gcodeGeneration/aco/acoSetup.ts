import { PlotterStroke } from "../../plotterMove";
import type { Node, Candidate, Tour } from "./types";
import { dist, endPoint, isClosed } from "./acoHelpers";

// ── Nodes ─────────────────────────────────────────────────────────────────────

export function buildNodes(strokes: PlotterStroke[]): Node[] {
    const nodes: Node[] = [];
    for (let strokeIndx = 0; strokeIndx < strokes.length; strokeIndx++) {
        const stroke = strokes[strokeIndx];
        if (!isClosed(stroke)) {
            const forwardIdx = nodes.length;
            const backwardIdx = nodes.length + 1;
            const end = endPoint(stroke);
            nodes.push({ start: stroke.start, end, strokeIndx, sameStrokeIndxs: [backwardIdx] });
            nodes.push({ start: end, end: stroke.start, strokeIndx, sameStrokeIndxs: [forwardIdx] });
        } else {
            const baseIdx = nodes.length;
            const numMoves = stroke.moves.length;
            for (let i = 0; i < numMoves; i++) {
                const move = stroke.moves[i];
                const sameStrokeIndxs: number[] = [];
                for (let j = 0; j < numMoves; j++) {
                    if (i !== j) sameStrokeIndxs.push(baseIdx + j);
                }
                nodes.push({ start: [move.x1, move.y1], end: [move.x1, move.y1], strokeIndx, sameStrokeIndxs });
            }
        }
    }

    return nodes;
}

// ── Matrices ──────────────────────────────────────────────────────────────────

export function buildHeuristicMatrix(nodes: Node[], beta: number): Float64Array {
    const n = nodes.length;
    const heuristicMatrix = new Float64Array(n * n);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (i !== j) {
                heuristicMatrix[i * n + j] = Math.pow(dist(nodes[i].end, nodes[j].start), -beta);
            }
        }
    }
    return heuristicMatrix;
}

export function buildPheromoneMatrix(n: number, initialPheromone: number): Float64Array {
    return new Float64Array(n * n).fill(initialPheromone);
}

// ── Candidate list ────────────────────────────────────────────────────────────

export function buildCandidateList(n: number, heuristicMatrix: Float64Array, c: number): Candidate[][] {
    const candidateList: Candidate[][] = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
        const row: { j: number; value: number }[] = [];
        for (let j = 0; j < n; j++) {
            if (i !== j) row.push({ j, value: heuristicMatrix[i * n + j] });
        }
        row.sort((a, b) => b.value - a.value);
        candidateList[i] = row.slice(0, c).map(d => ({ nodeIndex: d.j, heuristic: d.value }));
    }
    return candidateList;
}

// ── Greedy nearest-neighbour tour ─────────────────────────────────────────────

export function buildGreedyTour(nodes: Node[], home: [number, number], candidateList: Candidate[][], beta: number): Tour {
    const n = nodes.length;
    const visited = new Set<number>();
    const tour: Tour = { nodes: [], cost: 0 };
    let currentNode = -1;
    let currentPos = home;

    while (visited.size < n) {
        let bestNode = -1;
        let bestScore = -Infinity;

        if (currentNode !== -1) {
            for (const candidate of candidateList[currentNode]) {
                const j = candidate.nodeIndex;
                if (!visited.has(j) && candidate.heuristic > bestScore) {
                    bestScore = candidate.heuristic;
                    bestNode = j;
                }
            }
        }

        if (bestNode === -1) {
            // Fallback: scan all unvisited nodes
            for (let j = 0; j < n; j++) {
                if (!visited.has(j)) {
                    const d = Math.pow(dist(currentPos, nodes[j].start), -beta);
                    if (d > bestScore) { bestScore = d; bestNode = j; }
                }
            }
        }

        visited.add(bestNode);
        for (const idx of nodes[bestNode].sameStrokeIndxs) visited.add(idx);

        tour.nodes.push(bestNode);
        tour.cost += dist(currentPos, nodes[bestNode].start);
        currentNode = bestNode;
        currentPos = nodes[currentNode].end;
    }

    return tour;
}
