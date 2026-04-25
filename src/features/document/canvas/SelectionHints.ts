import type { Element } from "../types";
import type { SvgStroke } from "./Strokes";


export function getHints(el: Element): SvgStroke[] {
  switch (el.type) {
    case "Text":
        // For text elements, show a hint of the text bounding box.
        return [
            {
                start: [el.x, el.y],
                moves: [
                    { type: "L", x: el.x + el.w, y: el.y },
                    { type: "L", x: el.x + el.w, y: el.y + el.h },
                    { type: "L", x: el.x, y: el.y + el.h },
                    { type: "L", x: el.x, y: el.y}
                ]
            }
        ];
  }
  return [];
}