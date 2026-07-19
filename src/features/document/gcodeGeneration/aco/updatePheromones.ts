import type { Tour } from "./types";

export function updatePheromoneMatrix(n: number, pheromoneMatrix: Float64Array, tour: Tour, rho: number, maxPheromone: number, minPheromone: number): void {

    // Evaporation
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            pheromoneMatrix[i * n + j] *= (1 - rho);
            if (pheromoneMatrix[i * n + j] < minPheromone) {
                pheromoneMatrix[i * n + j] = minPheromone;
            }
        }
    }

    // Deposit
    const tourLength = tour.cost;
    for (let k = 0; k < tour.nodes.length - 1; k++) {
        const i = tour.nodes[k];
        const j = tour.nodes[k + 1];
        pheromoneMatrix[i * n + j] += 1 / tourLength;
        if (pheromoneMatrix[i * n + j] > maxPheromone) {
            pheromoneMatrix[i * n + j] = maxPheromone;
        }
    }
}
