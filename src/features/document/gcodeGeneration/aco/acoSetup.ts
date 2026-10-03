import { PlotterStroke } from "../../plotterMove";
import type { Graph, Node, Problem, CandidateLists, Tour } from "./types";
import { endPoint, isClosed } from "./acoHelpers";

// ── Graph ─────────────────────────────────────────────────────────────────────

/**
 * Builds the node set: two nodes per open stroke (forward / reversed), one per
 * move per closed stroke (every rotation). Each stroke's nodes are kept
 * contiguous so a group is `[groupFirst, groupFirst + groupCount)`.
 */
function buildGraph(strokes: PlotterStroke[]): Graph {
    const nodes: Node[] = [];
    const rangeStart: number[] = [];
    const rangeCount: number[] = [];

    for (let s = 0; s < strokes.length; s++) {
        const stroke = strokes[s];
        const first = nodes.length;
        if (!isClosed(stroke)) {
            const end = endPoint(stroke);
            nodes.push({ start: stroke.start, end, strokeIndx: s });
            nodes.push({ start: end, end: stroke.start, strokeIndx: s });
        } else {
            for (const move of stroke.moves) {
                nodes.push({ start: [move.x1, move.y1], end: [move.x1, move.y1], strokeIndx: s });
            }
        }
        rangeStart[s] = first;
        rangeCount[s] = nodes.length - first;
    }

    const n = nodes.length;
    const startX = new Float64Array(n);
    const startY = new Float64Array(n);
    const endX = new Float64Array(n);
    const endY = new Float64Array(n);
    const strokeIndx = new Int32Array(n);
    const groupFirst = new Int32Array(n);
    const groupCount = new Int32Array(n);

    for (let s = 0; s < strokes.length; s++) {
        const first = rangeStart[s];
        const last = first + rangeCount[s];
        for (let i = first; i < last; i++) {
            startX[i] = nodes[i].start[0];
            startY[i] = nodes[i].start[1];
            endX[i] = nodes[i].end[0];
            endY[i] = nodes[i].end[1];
            strokeIndx[i] = nodes[i].strokeIndx;
            groupFirst[i] = first;
            groupCount[i] = last - first;
        }
    }

    return { n, nodes, startX, startY, endX, endY, strokeIndx, groupFirst, groupCount };
}

// ── Candidate lists ───────────────────────────────────────────────────────────

/**
 * Bounded max-heap over `cap` entries keyed on distance: the worst kept item
 * sits at index 0, so a new distance replaces it in O(log cap) when smaller.
 *
 * Ordering is by distance *only*. The spatial-grid search terminates early once
 * the ring being entered is provably farther than the worst entry held, and that
 * argument holds only for distance — a tie on index could otherwise be resolved
 * differently than an exhaustive scan would, i.e. the early exit would no
 * longer be exact. Equal distances may therefore be picked in any order;
 * `drain` sorts by index afterwards purely so the output is deterministic.
 *
 * Allocation-free by design — the previous version materialised n objects per
 * row and sorted them, which cost ~128 s and ~271 M allocations at n = 16 475.
 */
class NearestHeap {
    readonly cap: number;
    private readonly d: Float64Array;
    private readonly i: Int32Array;
    size = 0;

    constructor(cap: number) {
        this.cap = cap;
        this.d = new Float64Array(cap);
        this.i = new Int32Array(cap);
    }

    reset(): void {
        this.size = 0;
    }

    /** Offer a candidate; keeps the `cap` smallest seen. */
    push(index: number, distance: number): void {
        const d = this.d;
        if (this.size < this.cap) {
            let p = this.size++;
            d[p] = distance;
            this.i[p] = index;
            while (p > 0) {
                const parent = (p - 1) >> 1;
                if (d[parent] >= d[p]) break;
                const td = d[parent]; d[parent] = d[p]; d[p] = td;
                const ti = this.i[parent]; this.i[parent] = this.i[p]; this.i[p] = ti;
                p = parent;
            }
            return;
        }
        if (distance >= d[0]) return;
        d[0] = distance;
        this.i[0] = index;
        let p = 0;
        for (;;) {
            const l = p * 2 + 1;
            const r = l + 1;
            let big = p;
            if (l < this.size && d[l] > d[big]) big = l;
            if (r < this.size && d[r] > d[big]) big = r;
            if (big === p) break;
            const td = d[p]; d[p] = d[big]; d[big] = td;
            const ti = this.i[p]; this.i[p] = this.i[big]; this.i[big] = ti;
            p = big;
        }
    }

    /** Distance of the worst kept item — the bound used to stop expanding rings. */
    get worst(): number {
        return this.size === 0 ? Infinity : this.d[0];
    }

    /**
     * Write the kept entries ascending by distance, ties by index so the output
     * is reproducible. η^β = d^-β, so ascending distance is descending
     * heuristic — the order the tour builder expects.
     */
    drain(outIndex: Int32Array, outHeuristic: Float64Array, beta: number, base: number): void {
        const size = this.size;
        const order: number[] = new Array(size);
        for (let k = 0; k < size; k++) order[k] = k;
        order.sort((a, b) => this.d[a] - this.d[b] || this.i[a] - this.i[b]);
        for (let k = 0; k < size; k++) {
            const pick = order[k];
            outIndex[base + k] = this.i[pick];
            outHeuristic[base + k] = Math.pow(1 / this.d[pick], beta);
        }
    }
}

/**
 * For every node, the `stride = min(n - 1, c)` nearest nodes by start point,
 * with η^β precomputed, laid out as `[i * stride + rank]`.
 *
 * A uniform spatial grid over the start points makes this O(n·c) instead of
 * O(n²): nodes are bucketed into cells and the search expands outward ring by
 * ring, stopping as soon as the ring's guaranteed minimum distance exceeds the
 * worst distance currently held in the heap. That stop rule keeps the result
 * *exact* — identical to a brute-force nearest-`stride` scan — while touching
 * only a small neighbourhood.
 *
 * Degenerate layouts (every point landing in one cell) would defeat the ring
 * expansion, so those fall back to a full scan.
 */
function buildCandidateLists(graph: Graph, beta: number, c: number): CandidateLists {
    const n = graph.n;
    const stride = Math.max(0, Math.min(n - 1, c));
    const index = new Int32Array(n * stride);
    const heuristic = new Float64Array(n * stride);
    if (stride === 0) return { index, heuristic, stride };

    // ── Bucket the start points into a uniform grid ──────────────────────────
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) {
        const x = graph.startX[i], y = graph.startY[i];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }
    const spanX = maxX - minX, spanY = maxY - minY;

    // Aim for ~2 points per cell: enough that each query ring touches few
    // points, few enough that the ring count stays low.
    const cellSize = Math.max(Math.max(spanX, spanY) / Math.sqrt(n / 2), 1e-6);
    const nx = Math.max(1, Math.min(Math.ceil(spanX / cellSize) + 1, n));
    const ny = Math.max(1, Math.min(Math.ceil(spanY / cellSize) + 1, n));
    const nCells = nx * ny;

    // CSR layout: cellStart[c]..cellStart[c + 1] indexes into cellItems.
    const cellStart = new Int32Array(nCells + 1);
    const cellItems = new Int32Array(n);
    const cellOf = new Int32Array(n);
    for (let i = 0; i < n; i++) {
        let cx = Math.floor((graph.startX[i] - minX) / cellSize);
        let cy = Math.floor((graph.startY[i] - minY) / cellSize);
        if (cx < 0) cx = 0; else if (cx >= nx) cx = nx - 1;
        if (cy < 0) cy = 0; else if (cy >= ny) cy = ny - 1;
        const idx = cy * nx + cx;
        cellOf[i] = idx;
        cellStart[idx + 1]++;
    }
    for (let i = 0; i < nCells; i++) cellStart[i + 1] += cellStart[i];
    const cursor = cellStart.slice(0, nCells);
    for (let i = 0; i < n; i++) cellItems[cursor[cellOf[i]]++] = i;

    let occupied = 0;
    for (let i = 0; i < nCells; i++) if (cellStart[i + 1] > cellStart[i]) occupied++;
    const useGrid = occupied >= Math.min(n, 8);

    const heap = new NearestHeap(stride);

    for (let i = 0; i < n; i++) {
        const qx = graph.endX[i];
        const qy = graph.endY[i];
        heap.reset();

        if (!useGrid) {
            for (let j = 0; j < n; j++) {
                if (i === j) continue;
                const dx = qx - graph.startX[j], dy = qy - graph.startY[j];
                heap.push(j, Math.sqrt(dx * dx + dy * dy));
            }
        } else {
            let cx = Math.floor((qx - minX) / cellSize);
            let cy = Math.floor((qy - minY) / cellSize);
            if (cx < 0) cx = 0; else if (cx >= nx) cx = nx - 1;
            if (cy < 0) cy = 0; else if (cy >= ny) cy = ny - 1;

            const maxRing = Math.max(nx, ny);
            for (let r = 0; r < maxRing; r++) {
                // Anything in this ring is at least (r - 1) cells away. Once that
                // exceeds the worst distance held, no later ring can improve it.
                if (r > 0 && heap.size === stride && (r - 1) * cellSize > heap.worst) break;

                const x0 = cx - r, x1 = cx + r, y0 = cy - r, y1 = cy + r;
                for (let gy = y0; gy <= y1; gy++) {
                    if (gy < 0 || gy >= ny) continue;
                    const onEdgeRow = gy === y0 || gy === y1;
                    for (let gx = x0; gx <= x1; gx++) {
                        if (gx < 0 || gx >= nx) continue;
                        // Only this ring's perimeter; the interior belongs to
                        // rings already visited.
                        if (!onEdgeRow && gx !== x0 && gx !== x1) continue;
                        const cell = gy * nx + gx;
                        const to = cellStart[cell + 1];
                        for (let k = cellStart[cell]; k < to; k++) {
                            const j = cellItems[k];
                            if (i === j) continue;
                            const dx = qx - graph.startX[j], dy = qy - graph.startY[j];
                            heap.push(j, Math.sqrt(dx * dx + dy * dy));
                        }
                    }
                }
            }

            // If the rings ran out before filling the list, top it up with a full
            // scan so the result is always exactly `stride` long.
            if (heap.size < stride) {
                for (let j = 0; j < n; j++) {
                    if (i === j) continue;
                    const dx = qx - graph.startX[j], dy = qy - graph.startY[j];
                    heap.push(j, Math.sqrt(dx * dx + dy * dy));
                }
            }
        }

        heap.drain(index, heuristic, beta, i * stride);
    }

    return { index, heuristic, stride };
}

// ── Greedy nearest-neighbour tour ─────────────────────────────────────────────

/**
 * Initial solution: nearest neighbour over the candidate lists, falling back to
 * a full scan when every candidate is already visited. Serves both as a seed
 * for the pheromone bounds and as the answer when the budget is too small for
 * any ACO iteration.
 */
export function buildGreedyTour(problem: Problem, home: [number, number], beta: number): Tour {
    const { graph, n, candidates } = problem;
    const visited = new Uint8Array(n);
    let visitedCount = 0;

    const tour: Tour = { nodes: [], cost: 0 };
    let currentNode = -1;
    let curX = home[0];
    let curY = home[1];
    const stride = candidates.stride;

    while (visitedCount < n) {
        let bestNode = -1;
        let bestScore = -Infinity;

        if (currentNode >= 0 && stride > 0) {
            const base = currentNode * stride;
            for (let k = 0; k < stride; k++) {
                const j = candidates.index[base + k];
                if (visited[j]) continue;
                const h = candidates.heuristic[base + k];
                if (h > bestScore) {
                    bestScore = h;
                    bestNode = j;
                }
            }
        }

        if (bestNode === -1) {
            // Fallback: scan every unvisited node.
            for (let j = 0; j < n; j++) {
                if (visited[j]) continue;
                const dx = curX - graph.startX[j];
                const dy = curY - graph.startY[j];
                const h = Math.pow(1 / Math.sqrt(dx * dx + dy * dy), beta);
                if (h > bestScore) {
                    bestScore = h;
                    bestNode = j;
                }
            }
        }

        if (bestNode === -1) break;

        // Visit the whole stroke at once (grouped TSP constraint).
        const g0 = graph.groupFirst[bestNode];
        const gEnd = g0 + graph.groupCount[bestNode];
        for (let i = g0; i < gEnd; i++) {
            if (!visited[i]) {
                visited[i] = 1;
                visitedCount++;
            }
        }

        const dx = curX - graph.startX[bestNode];
        const dy = curY - graph.startY[bestNode];
        tour.cost += Math.sqrt(dx * dx + dy * dy);
        tour.nodes.push(bestNode);

        currentNode = bestNode;
        curX = graph.endX[bestNode];
        curY = graph.endY[bestNode];
    }

    return tour;
}

// ── Public entry point ────────────────────────────────────────────────────────

export function buildProblem(
    strokes: PlotterStroke[],
    beta: number,
    candidateListSize: number,
): Problem {
    const graph = buildGraph(strokes);
    const candidates = buildCandidateLists(graph, beta, candidateListSize);
    return { graph, n: graph.n, candidates };
}