// ── Drag handles ──────────────────────────────────────────────────────────────
// Defines the control points shown on a selected element and how dragging them
// deforms the element. Add a case here for every new element type.

import type { Element, PageSettings } from "../types";
import { workspaceBounds } from "../types";

export interface Handle {
  id: string;
  x: number; // doc-space position to draw the circle
  y: number;
}

/** Returns the handle control points for a selected element. */
export function getHandles(el: Element): Handle[] {
  switch (el.type) {
    case "Drawing":
      return []
    case "Line":
      return [
        { id: "p1", x: el.x1, y: el.y1 },
        { id: "p2", x: el.x2, y: el.y2 },
      ];
    case "Rect":
      return [
        { id: "tl", x: el.x,        y: el.y        },
        { id: "tr", x: el.x + el.w, y: el.y        },
        { id: "bl", x: el.x,        y: el.y + el.h },
        { id: "br", x: el.x + el.w, y: el.y + el.h },
      ];
    case "Circle":
      return [
        { id: "c", x: el.cx, y: el.cy },
        { id: "r", x: el.cx + el.r, y: el.cy }
    ];
  }
}

/** Returns the updated element after dragging `handleId` to doc-space (x, y). */
export function applyHandleDrag(el: Element, handleId: string, x: number, y: number, page: PageSettings): Element {
  switch (el.type) {
    case "Drawing":
      return el;
    case "Line":
      if (handleId === "p1") return { ...el, x1: x, y1: y };
      if (handleId === "p2") return { ...el, x2: x, y2: y };
      return el;

    case "Rect": {
      // Each corner handle keeps its opposite corner fixed.
      const br = { x: el.x + el.w, y: el.y + el.h };
      const corners: Record<string, { fx: number; fy: number }> = {
        tl: { fx: br.x,  fy: br.y  },
        tr: { fx: el.x,  fy: br.y  },
        bl: { fx: br.x,  fy: el.y  },
        br: { fx: el.x,  fy: el.y  },
      };
      const fixed = corners[handleId];
      if (!fixed) return el;
      return {
        ...el,
        x: Math.min(x, fixed.fx),
        y: Math.min(y, fixed.fy),
        w: Math.abs(x - fixed.fx),
        h: Math.abs(y - fixed.fy),
      };
    }

    case "Circle": {
      if (handleId === "r") {
        const ws = workspaceBounds(page);
        const maxR = Math.min(
          el.cx - ws.x,           // distance to left edge
          ws.x + ws.w - el.cx,    // distance to right edge
          el.cy - ws.y,           // distance to top edge
          ws.y + ws.h - el.cy,    // distance to bottom edge
        );
        return { ...el, r: Math.max(0.5, Math.min(maxR, Math.hypot(x - el.cx, y - el.cy))) };
      }
      if (handleId === "c") {
        const ws = workspaceBounds(page);
        const maxCx = ws.w + ws.x - el.r; // right edge minus radius
        const minCx = ws.x + el.r;      // left edge plus radius
        const maxCy = ws.h + ws.y - el.r; // bottom edge minus radius
        const minCy = ws.y + el.r;      // top edge plus radius
        return { ...el, cx: Math.max(minCx, Math.min(maxCx, x)), cy: Math.max(minCy, Math.min(maxCy, y)) };
    }
      return el;
    }
  }
}
