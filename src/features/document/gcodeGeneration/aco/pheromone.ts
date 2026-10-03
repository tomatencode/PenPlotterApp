import type { Pheromone, Problem, Tour } from "./types";
import { findRank } from "./acoHelpers";

/**
 * Safety valve on the sparse side-table. Non-candidate edges are only needed
 * for tour edges that stray outside the candidate lists; the cap stops a long
 * run on a pathological input from growing an unbounded Map.
 */
const MAX_EXTRA_EDGES = 250_000;

export function createPheromone(
    problem: Problem,
    max: number,
    min: number,
    rho: number,
): Pheromone {
    const { n, candidates } = problem;
    return {
        n,
        stride: candidates.stride,
        values: new Float64Array(n * candidates.stride).fill(max),
        extra: new Map<number, number>(),
        untouched: max,
        max,
        min,
        evap: 1 - rho,
    };
}

/** Reset every edge to `max` — the stagnation restart. */
export function resetPheromone(ph: Pheromone): void {
    ph.values.fill(ph.max);
    ph.extra.clear();
    ph.untouched = ph.max;
}

/** τ of edge `i -> j`. `rank` is its candidate rank, or -1 when it is not a candidate. */
export function edgeTau(ph: Pheromone, i: number, j: number, rank: number): number {
    if (rank >= 0) return ph.values[i * ph.stride + rank];
    return ph.extra.get(i * ph.n + j) ?? ph.untouched;
}

/** Evaporate in place: O(n·stride + |extra|), not the old O(n²). */
export function evaporate(ph: Pheromone): void {
    const f = ph.evap;
    const min = ph.min;
    const v = ph.values;
    for (let k = 0; k < v.length; k++) {
        const nv = v[k] * f;
        v[k] = nv < min ? min : nv;
    }
    ph.untouched = Math.max(min, ph.untouched * f);
    for (const [key, tau] of ph.extra) {
        const nv = tau * f;
        ph.extra.set(key, nv <= min ? min : nv);
    }
}

/** Deposit onto a single edge, clamped to `max`. */
export function deposit(ph: Pheromone, i: number, j: number, rank: number, amount: number): void {
    if (rank >= 0) {
        const k = i * ph.stride + rank;
        const nv = ph.values[k] + amount;
        ph.values[k] = nv > ph.max ? ph.max : nv;
        return;
    }
    const key = i * ph.n + j;
    const existing = ph.extra.get(key);
    if (existing === undefined && ph.extra.size >= MAX_EXTRA_EDGES) return;
    let nv = (existing ?? ph.untouched) + amount;
    if (nv > ph.max) nv = ph.max;
    ph.extra.set(key, nv);
}

/**
 * One ACO step: evaporate everything, then deposit onto the tour's edges.
 * Replaces `updatePheromoneMatrix`.
 */
export function applyTour(ph: Pheromone, problem: Problem, tour: Tour): void {
    evaporate(ph);
    if (tour.cost <= 0 || tour.nodes.length < 2) return;

    const q = 1 / tour.cost;
    const nodes = tour.nodes;
    for (let k = 0; k < nodes.length - 1; k++) {
        const i = nodes[k];
        const j = nodes[k + 1];
        deposit(ph, i, j, findRank(problem.candidates, i, j), q);
    }
}

/**
 * True when enough pheromone sits exactly at a bound — i.e. the search has
 * converged and the matrix should be restarted.
 *
 * Replaces `detectStagnation`, scanning candidate entries only (O(n·stride)
 * instead of the old full n × n sweep).
 */
export function isStagnant(ph: Pheromone, threshold: number): boolean {
    const v = ph.values;
    if (v.length === 0) return false;

    const { max, min } = ph;
    let atExtremity = 0;
    for (let k = 0; k < v.length; k++) {
        const tau = v[k];
        if (tau === max || tau === min) atExtremity++;
    }
    return atExtremity / v.length >= threshold;
}