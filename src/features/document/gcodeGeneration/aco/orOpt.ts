import type { Node, Tour } from "./types";
import { dist } from "./acoHelpers";

/** One-pass Or-opt: for each node in the tour, try every reinsertion position
 *  and immediately apply the best improvement found before moving on.
 *  One pass is sufficient as a fast post-processing step per ant. */
export function orOpt(tour: Tour, nodes: Node[], home: [number, number]): Tour {
    if (tour.nodes.length <= 1) return tour;

    const t = [...tour.nodes];
    const n = t.length;
    let cost = tour.cost;

    /** Pen-up distance from the exit of tour position `from` to the entry of position `to`.
     *  `from` = -1  → depart from home.
     *  `to`   >= n  → no destination (returns 0). */
    const edge = (from: number, to: number): number => {
        if (to >= n) return 0;
        const fromPt = from < 0 ? home : nodes[t[from]].end;
        return dist(fromPt, nodes[t[to]].start);
    };

    for (let i = 0; i < n; i++) {
        const nodeI  = t[i];
        const startI = nodes[nodeI].start;
        const endI   = nodes[nodeI].end;

        // Net saving from lifting nodeI out of the tour and closing the gap.
        const removeSaving = edge(i - 1, i) + edge(i, i + 1) - edge(i - 1, i + 1);

        let bestDelta = 0;
        let bestK     = -1;

        // Try inserting nodeI before each slot k (0 = before first node, n = after last).
        for (let k = 0; k <= n; k++) {
            if (k === i || k === i + 1) continue; // adjacent slots → no-op

            // Pen-up cost of the existing edge that insertion would break.
            const existing = edge(k - 1, k);

            // Pen-up cost of the two new edges introduced by the insertion.
            const beforePt = k > 0 ? nodes[t[k - 1]].end : home;
            const inserted = dist(beforePt, startI)
                           + (k < n ? dist(endI, nodes[t[k]].start) : 0);

            const delta = inserted - existing - removeSaving;
            if (delta < bestDelta) {
                bestDelta = delta;
                bestK     = k;
            }
        }

        if (bestK !== -1) {
            t.splice(i, 1);
            // After removing position i, everything at bestK..n-1 shifts down by 1
            // if bestK > i, so adjust the insertion index accordingly.
            t.splice(bestK > i ? bestK - 1 : bestK, 0, nodeI);
            cost += bestDelta;
        }
    }

    return { nodes: t, cost };
}
