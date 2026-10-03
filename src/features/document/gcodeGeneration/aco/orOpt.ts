import type { Graph, Tour } from "./types";
import { tourCost } from "./acoHelpers";

/**
 * One-pass Or-opt: for each node in the tour, try re-inserting it at a nearby
 * slot and apply the best improvement found before moving on.
 *
 * The re-insertion search is restricted to a window of `window` slots either
 * side of the node instead of every slot in the tour, which turns this from
 * O(n²) — the single largest cost in the optimiser, ~23 s per ant at
 * n = 16 475 — into O(n · window). Nearby moves capture almost all of the
 * improvement: long jumps across the tour are precisely the ones already
 * rejected by the preceding construction.
 */
export function orOpt(
    tour: Tour,
    graph: Graph,
    home: [number, number],
    window: number,
): Tour {
    if (tour.nodes.length <= 1) return tour;

    const t = [...tour.nodes];
    const n = t.length;

    const startX = graph.startX;
    const startY = graph.startY;
    const endX = graph.endX;
    const endY = graph.endY;

    /** Pen-up distance from the exit of position `from` to the entry of position `to`.
     *  `from` = -1  → depart from home.
     *  `to`   >= n  → no destination (returns 0). */
    const edge = (from: number, to: number): number => {
        if (to >= n) return 0;
        let fx: number;
        let fy: number;
        if (from < 0) {
            fx = home[0];
            fy = home[1];
        } else {
            fx = endX[t[from]];
            fy = endY[t[from]];
        }
        const dx = fx - startX[t[to]];
        const dy = fy - startY[t[to]];
        return Math.sqrt(dx * dx + dy * dy);
    };

    for (let i = 0; i < n; i++) {
        const nodeI = t[i];
        const sx = startX[nodeI];
        const sy = startY[nodeI];
        const ex = endX[nodeI];
        const ey = endY[nodeI];

        // Net saving from lifting nodeI out of the tour and closing the gap.
        const removeSaving = edge(i - 1, i) + edge(i, i + 1) - edge(i - 1, i + 1);

        let bestDelta = 0;
        let bestK = -1;

        const lo = Math.max(0, i - window);
        const hi = Math.min(n, i + window);

        // Try inserting nodeI before each slot in the window (0 = before the
        // first node, n = after the last).
        for (let k = lo; k <= hi; k++) {
            if (k === i || k === i + 1) continue; // adjacent slots → no-op

            // Pen-up cost of the existing edge that the insertion would break.
            const existing = edge(k - 1, k);

            // Pen-up cost of the two new edges introduced by the insertion.
            let bx: number;
            let by: number;
            if (k > 0) {
                bx = endX[t[k - 1]];
                by = endY[t[k - 1]];
            } else {
                bx = home[0];
                by = home[1];
            }
            const dx1 = bx - sx;
            const dy1 = by - sy;
            let inserted = Math.sqrt(dx1 * dx1 + dy1 * dy1);
            if (k < n) {
                const dx2 = ex - startX[t[k]];
                const dy2 = ey - startY[t[k]];
                inserted += Math.sqrt(dx2 * dx2 + dy2 * dy2);
            }

            const delta = inserted - existing - removeSaving;
            if (delta < bestDelta) {
                bestDelta = delta;
                bestK = k;
            }
        }

        if (bestK !== -1) {
            t.splice(i, 1);
            // After removing position i, everything at bestK..n-1 shifts down by
            // 1 if bestK > i, so adjust the insertion index accordingly.
            t.splice(bestK > i ? bestK - 1 : bestK, 0, nodeI);
        }
    }

    const result: Tour = { nodes: t, cost: tourCost({ nodes: t, cost: 0 }, graph, home) };
    return result;
}