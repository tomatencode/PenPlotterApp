import { PlotterStroke } from "../../plotterMove";
import type { Parameters } from "./types";
import { buildNodes, buildHeuristicMatrix, buildPheromoneMatrix, buildCandidateList, buildGreedyTour } from "./acoSetup";
import { doAntTour } from "./antTour";
import { updatePheromoneMatrix } from "./updatePheromones";
import { orOpt } from "./orOpt";
import { tourToStrokes } from "./tourToStrokes";
import { detectStagnation } from "./detectStagnation";

export function runAco(strokes: PlotterStroke[], home: [number, number], params: Parameters): PlotterStroke[] {
    if (strokes.length === 0) return strokes;
  
    const nodes = buildNodes(strokes);
    const n = nodes.length;

    const heuristicMatrix = buildHeuristicMatrix(nodes, params.beta);

    const candidateList = buildCandidateList(n, heuristicMatrix, params.candidateListSize);

    let bestTour = buildGreedyTour(nodes, home, candidateList, params.beta);
    console.log(`Initial greedy tour cost: ${bestTour.cost.toFixed(2)}`);

    let maxPheromone = 1 / (params.rho * bestTour.cost);
    let minPheromone = maxPheromone / (2 * n);

    let pheromoneMatrix = buildPheromoneMatrix(n, maxPheromone);

    let numResets = 0;
    const startTime = Date.now();
    // runn itterations
    while (Date.now() - startTime < params.maxTimeMs) {
        let ItterationBestTour = { nodes: [] as number[], cost: Infinity };
        for (let ant = 0; ant < params.numAnts; ant++) {
            const tour = doAntTour(nodes, home, candidateList, pheromoneMatrix, heuristicMatrix, params.alpha, params.beta, params.minUniqueStrokesInDecision);
            const optimizedTour = orOpt(tour, nodes, home);
            if (optimizedTour.cost < ItterationBestTour.cost) {
                ItterationBestTour = optimizedTour;
            }
        }

        updatePheromoneMatrix(n, pheromoneMatrix, ItterationBestTour, params.rho, maxPheromone, minPheromone);
        
        if (detectStagnation(pheromoneMatrix, n, maxPheromone, minPheromone, params.stagnationThreshold)) {
            console.log("Stagnation detected, resetting pheromone matrix at score: " + ItterationBestTour.cost.toFixed(2));
            pheromoneMatrix = buildPheromoneMatrix(n, maxPheromone);
            if (numResets >= params.maxStagnationResets) {
                console.log("Maximum stagnation resets reached, stopping.");
                break;
            }
            numResets++;
        }

        if (ItterationBestTour.cost < bestTour.cost) {
            bestTour = ItterationBestTour;
            maxPheromone = 1 / (params.rho * bestTour.cost);  // recompute
            minPheromone = maxPheromone / (2 * n);
        }
    }

    console.log(`Best tour cost: ${bestTour.cost.toFixed(2)}`);

    return tourToStrokes(bestTour, nodes, strokes);
}
