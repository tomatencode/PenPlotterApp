import { PlotterStroke } from "../../plotterMove";
import { DEFAULT_OR_OPT_WINDOW } from "./types";
import type { Parameters, Tour } from "./types";
import { buildProblem, buildGreedyTour } from "./acoSetup";
import { doAntTour } from "./antTour";
import { orOpt } from "./orOpt";
import { applyTour, createPheromone, isStagnant, resetPheromone } from "./pheromone";
import { tourToStrokes } from "./tourToStrokes";

/**
 * Order a batch of strokes into a short pen-up travel path.
 *
 * Complexity notes (the reasons this is fast enough for large files):
 *  - one O(n²) pass builds the candidate lists, allocation-free;
 *  - everything else is O(n·stride) or O(n·window) — no n × n matrices;
 *  - or-opt runs once per *iteration* on the iteration-best tour, not once
 *    per ant;
 *  - `maxTimeMs` bounds setup *and* iterations together, so a large input
 *    degrades to a greedy tour instead of running unbounded.
 */
export function runAco(
    strokes: PlotterStroke[],
    home: [number, number],
    params: Parameters,
): PlotterStroke[] {
    if (strokes.length === 0) return strokes;

    const startTime = Date.now();
    const verbose = params.verbose ?? false;
    const window = params.orOptWindow ?? DEFAULT_OR_OPT_WINDOW;

    const problem = buildProblem(strokes, params.beta, params.candidateListSize);
    const { graph, n } = problem;
    if (n === 0) return strokes;

    let bestTour = buildGreedyTour(problem, home, params.beta);
    if (verbose) console.log(`Initial greedy tour cost: ${bestTour.cost.toFixed(2)}`);

    // Pheromone bounds come from the seed tour; guard the degenerate case where
    // every stroke starts at home (cost 0 would produce infinite bounds).
    let maxPheromone = 1 / (params.rho * (bestTour.cost > 0 ? bestTour.cost : 1));
    let minPheromone = maxPheromone / (2 * n);
    const pheromone = createPheromone(problem, maxPheromone, minPheromone, params.rho);

    let numResets = 0;
    let iterations = 0;

    while (Date.now() - startTime < params.maxTimeMs) {
        // Construct all ant tours and keep the cheapest.
        let iterationBest: Tour | null = null;
        for (let ant = 0; ant < params.numAnts; ant++) {
            const tour = doAntTour(
                problem, pheromone, home,
                params.alpha, params.beta, params.minUniqueStrokesInDecision,
            );
            if (iterationBest === null || tour.cost < iterationBest.cost) {
                iterationBest = tour;
            }
        }
        if (iterationBest === null) break;

        // Polish the iteration-best tour only: or-opt is O(n·window), and
        // running it for all numAnts used to dominate the whole optimiser.
        const polished = orOpt(iterationBest, graph, home, window);

        // Evaporate, then deposit onto this tour.
        applyTour(pheromone, problem, polished);

        if (isStagnant(pheromone, params.stagnationThreshold)) {
            if (verbose) {
                console.log(`Stagnation detected, resetting pheromone at cost ${polished.cost.toFixed(2)}`);
            }
            resetPheromone(pheromone);
            if (numResets >= params.maxStagnationResets) {
                if (verbose) console.log("Maximum stagnation resets reached, stopping.");
                break;
            }
            numResets++;
        }

        if (polished.cost < bestTour.cost) {
            bestTour = polished;
            maxPheromone = 1 / (params.rho * bestTour.cost);
            minPheromone = maxPheromone / (2 * n);
            pheromone.max = maxPheromone;
            pheromone.min = minPheromone;
        }

        iterations++;
        if (verbose && iterations % 50 === 0) {
            console.log(`Iteration ${iterations}, best tour cost ${bestTour.cost.toFixed(2)}`);
        }
    }

    if (verbose) {
        const elapsed = Date.now() - startTime;
        console.log(`Best tour cost ${bestTour.cost.toFixed(2)} after ${iterations} iterations in ${elapsed}ms`);
    }

    return tourToStrokes(bestTour, graph.nodes, strokes);
}