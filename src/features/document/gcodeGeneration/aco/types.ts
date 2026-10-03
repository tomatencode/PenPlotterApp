export type Parameters = {
    maxTimeMs: number;
    numAnts: number;
    alpha: number;
    beta: number;
    rho: number;
    candidateListSize: number;
    minUniqueStrokesInDecision: number;
    stagnationThreshold: number;
    maxStagnationResets: number;
    /**
     * Or-opt re-insertion radius. Or-opt is O(n · window) per call instead of
     * O(n²); larger gives better tours at proportionally higher cost.
     * Defaults to `DEFAULT_OR_OPT_WINDOW`.
     */
    orOptWindow?: number;
    /** Emit ACO progress logs (off by default — per-iteration logging is costly). */
    verbose?: boolean;
};

export const DEFAULT_OR_OPT_WINDOW = 64;

/**
 * One node per possible entry point into a stroke: two for an open stroke
 * (forward / reversed), one per move for a closed stroke (rotation).
 *
 * Nodes of the same stroke are stored contiguously, so the group is addressed
 * by `groupFirst`/`groupCount` rather than a per-node index array, which was
 * O(m²) of storage per closed stroke.
 */
export type Node = {
    start: [number, number];
    end: [number, number];
    strokeIndx: number;
};

/**
 * The node set in two forms: `nodes` for the occasional entry-point rewrite in
 * `tourToStrokes`, and flat typed arrays for the hot loops (candidate build,
 * ant tours, or-opt) where double indirection and tuple access dominate.
 */
export type Graph = {
    n: number;
    nodes: Node[];
    startX: Float64Array;
    startY: Float64Array;
    endX: Float64Array;
    endY: Float64Array;
    strokeIndx: Int32Array;
    /** First node index of the stroke this node belongs to. */
    groupFirst: Int32Array;
    /** Number of nodes belonging to that stroke. */
    groupCount: Int32Array;
};

/**
 * Candidate lists laid out as `[i * stride + rank]`, sorted by descending
 * heuristic. There are exactly `stride = min(n - 1, c)` candidates per node, so
 * the layout is dense and pheromone can share it.
 */
export type CandidateLists = {
    index: Int32Array;
    /** Precomputed η^β aligned with `index`. */
    heuristic: Float64Array;
    stride: number;
};

export type Problem = {
    graph: Graph;
    n: number;
    candidates: CandidateLists;
};

/**
 * Pheromone stored only where it is ever read: on candidate edges, which share
 * the candidate list's `i * stride + rank` layout, plus a sparse map for edges
 * outside the candidate lists that a tour happened to use.
 *
 * This replaces two n × n Float64Arrays (6.8 GB at n = 29 266 for this app's
 * typical file) with ~4 MB, and drops evaporation from O(n²) to O(n·stride).
 */
export type Pheromone = {
    n: number;
    stride: number;
    values: Float64Array;
    /** Non-candidate edges that received a deposit: `(i * n + j) -> τ`. */
    extra: Map<number, number>;
    /** τ of a never-deposited edge after all evaporations so far. */
    untouched: number;
    max: number;
    min: number;
    evap: number;
};

export type Tour = {
    nodes: number[];
    cost: number;
};
