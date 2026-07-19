import { HANDWRITING_DEFAULT_STROKES } from "./handwritingDefaultStrokes";
import type { Element } from "../types";
import type { PlotterMove, PlotterStroke } from "../plotterMove";

type HandwritingEl = Extract<Element, { type: "Handwriting" }>;

export function handwritingToStrokes(handwritingEl: HandwritingEl): PlotterStroke[] {
    const strokes: PlotterStroke[] = [];
    const hasGenerated = handwritingEl.strokes.length > 0;
    const plotterStrokes = hasGenerated ? handwritingEl.strokes : HANDWRITING_DEFAULT_STROKES;

    let tx: (nx: number) => number;
    let ty: (ny: number) => number;

    if (hasGenerated) {
        // Generated strokes are independently normalised to [0, 1] × [0, 1].
        tx = (nx) => handwritingEl.x + nx * handwritingEl.w;
        ty = (ny) => handwritingEl.y + ny * handwritingEl.h;
    } else {
        // Default placeholder strokes use the old uniform-scale normalisation;
        // recover the extent by scanning maxX / maxY so they fill the box correctly.
        let maxX = 0, maxY = 0;
        for (const s of plotterStrokes) {
            maxX = Math.max(maxX, s.start[0]);
            maxY = Math.max(maxY, s.start[1]);
            for (const m of s.moves) {
                switch (m.type) {
                    case "Line":       maxX = Math.max(maxX, m.x1, m.x2);             maxY = Math.max(maxY, m.y1, m.y2);             break;
                    case "Arc":        maxX = Math.max(maxX, m.x1, m.cx, m.x2);       maxY = Math.max(maxY, m.y1, m.cy, m.y2);       break;
                    case "QuadBezier": maxX = Math.max(maxX, m.x1, m.cx, m.x2);       maxY = Math.max(maxY, m.y1, m.cy, m.y2);       break;
                    case "CubicBezier":maxX = Math.max(maxX, m.x1, m.cx1, m.cx2, m.x2); maxY = Math.max(maxY, m.y1, m.cy1, m.cy2, m.y2); break;
                }
            }
        }
        if (maxX === 0 || maxY === 0) return [];
        tx = (nx) => handwritingEl.x + (nx / maxX) * handwritingEl.w;
        ty = (ny) => handwritingEl.y + (ny / maxY) * handwritingEl.h;
    }
    for (const s of plotterStrokes) {
        strokes.push({
        start: [tx(s.start[0]), ty(s.start[1])],
        moves: s.moves.map((m): PlotterMove => {
            switch (m.type) {
            case "Line":        return { type: "Line", x1: tx(m.x1), y1: ty(m.y1), x2: tx(m.x2), y2: ty(m.y2) };
            case "Arc":         return { ...m, x1: tx(m.x1), y1: ty(m.y1), cx: tx(m.cx), cy: ty(m.cy), x2: tx(m.x2), y2: ty(m.y2) };
            case "QuadBezier":  return { ...m, x1: tx(m.x1), y1: ty(m.y1), cx: tx(m.cx), cy: ty(m.cy), x2: tx(m.x2), y2: ty(m.y2) };
            case "CubicBezier": return { ...m, x1: tx(m.x1), y1: ty(m.y1), cx1: tx(m.cx1), cy1: ty(m.cy1), cx2: tx(m.cx2), cy2: ty(m.cy2), x2: tx(m.x2), y2: ty(m.y2) };
            }
        }),
        });
    }

    return strokes;
}