
export function detectStagnation(pheromoneMatrix: Float64Array, n: number, maxPheromone: number, minPheromone: number, stagnationThreshold: number): boolean {
    
    let countAtExtrem = 0;

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const pheromone = pheromoneMatrix[i * n + j];
            if (pheromone === maxPheromone || pheromone === minPheromone) {
                countAtExtrem++;
            }
        }
    }

    return countAtExtrem / (n * n) >= stagnationThreshold;
}
