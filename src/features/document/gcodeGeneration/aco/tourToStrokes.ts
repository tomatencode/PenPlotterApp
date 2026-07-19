import { PlotterStroke, PlotterMove } from "../../plotterMove";
import type { Node, Tour } from "./types";
import { isClosed, endPoint } from "./acoHelpers";

function reverseMove(m: PlotterMove): PlotterMove {
    switch (m.type) {
        case "Line":        return { ...m, x1: m.x2, y1: m.y2, x2: m.x1, y2: m.y1 };
        case "Arc":         return { ...m, x1: m.x2, y1: m.y2, x2: m.x1, y2: m.y1, clockwise: !m.clockwise };
        case "QuadBezier":  return { ...m, x1: m.x2, y1: m.y2, x2: m.x1, y2: m.y1 };
        case "CubicBezier": return { ...m, x1: m.x2, y1: m.y2, x2: m.x1, y2: m.y1, cx1: m.cx2, cy1: m.cy2, cx2: m.cx1, cy2: m.cy1 };
    }
}

function commitEntry(stroke: PlotterStroke, entry: [number, number]): PlotterStroke {
    if (!isClosed(stroke)) {
        const end = endPoint(stroke);
        const reversed =
            entry[0] === end[0] && entry[1] === end[1] &&
            !(entry[0] === stroke.start[0] && entry[1] === stroke.start[1]);
        if (!reversed) return stroke;
        return { ...stroke, start: end, moves: [...stroke.moves].reverse().map(reverseMove) };
    } else {
        const idx = stroke.moves.findIndex(m => m.x1 === entry[0] && m.y1 === entry[1]);
        const startIndex = idx === -1 ? 0 : idx;
        if (startIndex === 0) return stroke;
        return {
            ...stroke,
            start: entry,
            moves: [...stroke.moves.slice(startIndex), ...stroke.moves.slice(0, startIndex)],
        };
    }
}

export function tourToStrokes(tour: Tour, nodes: Node[], strokes: PlotterStroke[]): PlotterStroke[] {
    return tour.nodes.map(nodeIndex => {
        const node = nodes[nodeIndex];
        return commitEntry(strokes[node.strokeIndx], node.start);
    });
}
