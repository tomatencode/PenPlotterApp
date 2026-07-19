import { PlotterStroke } from "../../plotterMove";

export function dist(a: [number, number], b: [number, number]): number {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function endPoint(stroke: PlotterStroke): [number, number] {
    if (stroke.moves.length === 0) return stroke.start;
    const last = stroke.moves[stroke.moves.length - 1];
    return [last.x2, last.y2];
}

export function isClosed(stroke: PlotterStroke): boolean {
    if (stroke.moves.length === 0) return true;
    const last = stroke.moves[stroke.moves.length - 1];
    return last.x2 === stroke.start[0] && last.y2 === stroke.start[1];
}
