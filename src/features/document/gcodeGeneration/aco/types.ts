
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
}; 

export type Node = {
    start: [number, number];
    end: [number, number];
    strokeIndx: number;
    sameStrokeIndxs: number[];
};

export type Candidate = {
    nodeIndex: number;
    heuristic: number;
};

export type Tour = {
    nodes: number[];
    cost: number;
};