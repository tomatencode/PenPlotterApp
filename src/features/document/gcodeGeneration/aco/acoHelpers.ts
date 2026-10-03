import { PlotterStroke } from "../../plotterMove";
import type { CandidateLists, Graph, Tour } from "./types";

export function endPoint(stroke: PlotterStroke): [number, number] {
    if (stroke.moves.length === 0) return stroke.start;
    const last = stroke.moves[stroke.moves.length - 1];
    return [last.x2, last.y2];
}

export function isClosed(stroke: PlotterStroke): boolean {
    if (stroke.moves.length === 0) return true;
    const last = stroke.moves[stroke.moves.length - 1];
    return last.x2 === stroke.start[0] && last.y2 === stroke.start[1];
}

/** Rank of edge `i -> j` in node `i`'s candidate list, or -1 when it is not a candidate. */
export function findRank(candidates: CandidateLists, i: number, j: number): number {
    const base = i * candidates.stride;
    for (let k = 0; k < candidates.stride; k++) {
        if (candidates.index[base + k] === j) return k;
    }
    return -1;
}

/**
 * Total tour cost, from `home` through every node's start then on from its end.
 *
 * Recomputing rather than trusting incremental deltas makes drift impossible —
 * the cost feeds both the pheromone deposit and the best-tour comparison.
 */
export function tourCost(tour: Tour, graph: Graph, home: [number, number]): number {
    let cost = 0;
    let cx = home[0];
    let cy = home[1];
    for (const idx of tour.nodes) {
        const dx = cx - graph.startX[idx];
        const dy = cy - graph.startY[idx];
        cost += Math.sqrt(dx * dx + dy * dy);
        cx = graph.endX[idx];
        cy = graph.endY[idx];
    }
    return cost;
}
