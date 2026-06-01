import type { Element } from "../types";
import type { SvgStroke } from "./Strokes";


function boxHint(x: number, y: number, w: number, h: number): SvgStroke[] {
  return [{
    start: [x, y],
    moves: [
      { type: "L", x: x + w, y: y },
      { type: "L", x: x + w, y: y + h },
      { type: "L", x: x,     y: y + h },
      { type: "L", x: x,     y: y },
    ],
  }];
}

export function getHints(el: Element): SvgStroke[] {
  switch (el.type) {
    case "Text":        return boxHint(el.x, el.y, el.w, el.h);
    case "Handwriting": return boxHint(el.x, el.y, el.w, el.h);
    case "Drawing": {
      if (el.points.length === 0) return [];
      const xs = el.points.map(([x]) => x);
      const ys = el.points.map(([, y]) => y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      return boxHint(minX, minY, maxX - minX, maxY - minY);
    }
  }
  return [];
}