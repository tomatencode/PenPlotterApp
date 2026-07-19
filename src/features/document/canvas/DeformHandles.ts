import type { Element, PageSettings } from "../types";
import { workspaceBounds } from "../utils";

export interface Handle {
  id: string;
  x: number; // doc-space position to draw the circle
  y: number;
}

function drawingBbox(el: Extract<Element, { type: "Drawing" }>) {
  const xs = el.points.map(([x]) => x);
  const ys = el.points.map(([, y]) => y);
  return {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys),
  };
}

/** Returns the handle control points for a selected element. */
export function getHandles(el: Element): Handle[] {
  switch (el.type) {
    case "Drawing": {
      if (el.points.length === 0) return [];
      const { minX, maxX, minY, maxY } = drawingBbox(el);
      return [
        { id: "tl", x: minX, y: minY },
        { id: "tr", x: maxX, y: minY },
        { id: "bl", x: minX, y: maxY },
        { id: "br", x: maxX, y: maxY },
      ];
    }
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
    case "Text":
    case "Handwriting":
      return [
        { id: "tl", x: el.x,        y: el.y        },
        { id: "tr", x: el.x + el.w, y: el.y        },
        { id: "bl", x: el.x,        y: el.y + el.h },
        { id: "br", x: el.x + el.w, y: el.y + el.h },
      ];
  }
}

export function applyHandleDrag(el: Element, handleId: string, x: number, y: number, page: PageSettings): Element {
  switch (el.type) {
    case "Drawing": {
      if (el.points.length === 0) return el;
      const { minX, maxX, minY, maxY } = drawingBbox(el);
      const origW = maxX - minX;
      const origH = maxY - minY;
      // Each handle has its own original position (hx/hy) and the opposite
      // fixed corner (fx/fy). Using a signed linear remap means dragging past
      // the fixed corner produces a natural mirror rather than clamping at zero.
      const handles: Record<string, { hx: number; hy: number; fx: number; fy: number }> = {
        tl: { hx: minX, hy: minY, fx: maxX, fy: maxY },
        tr: { hx: maxX, hy: minY, fx: minX, fy: maxY },
        bl: { hx: minX, hy: maxY, fx: maxX, fy: minY },
        br: { hx: maxX, hy: maxY, fx: minX, fy: minY },
      };
      const h = handles[handleId];
      if (!h) return el;
      return {
        ...el,
        points: el.points.map(([px, py]) => [
          origW > 0 ? h.fx + (px - h.fx) / (h.hx - h.fx) * (x - h.fx) : x,
          origH > 0 ? h.fy + (py - h.fy) / (h.hy - h.fy) * (y - h.fy) : y,
        ]),
      };
    }
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
          el.cx - ws.x,
          ws.x + ws.w - el.cx,
          el.cy - ws.y,
          ws.y + ws.h - el.cy,
        );
        return { ...el, r: Math.max(0.5, Math.min(maxR, Math.hypot(x - el.cx, y - el.cy))) };
      }
      if (handleId === "c") {
        const ws = workspaceBounds(page);
        const maxCx = ws.w + ws.x - el.r;
        const minCx = ws.x + el.r;
        const maxCy = ws.h + ws.y - el.r;
        const minCy = ws.y + el.r;
        return { ...el, cx: Math.max(minCx, Math.min(maxCx, x)), cy: Math.max(minCy, Math.min(maxCy, y)) };
    }
      return el;
    }

    case "Text": {
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

    case "Handwriting": {
      const ratio = el.aspectRatio ?? (el.h > 0 ? el.w / el.h : 1);
      const br = { x: el.x + el.w, y: el.y + el.h };
      const corners: Record<string, { fx: number; fy: number }> = {
        tl: { fx: br.x,  fy: br.y  },
        tr: { fx: el.x,  fy: br.y  },
        bl: { fx: br.x,  fy: el.y  },
        br: { fx: el.x,  fy: el.y  },
      };
      const fixed = corners[handleId];
      if (!fixed) return el;
      const raw_w = Math.abs(x - fixed.fx);
      const raw_h = Math.abs(y - fixed.fy);
      // Lock to the snapshot aspect ratio; the dominant axis wins.
      let eff_w: number, eff_h: number;
      if (raw_w === 0 && raw_h === 0) return el;
      else if (raw_h === 0 || raw_w / raw_h >= ratio) { eff_w = raw_w; eff_h = raw_w / ratio; }
      else                                             { eff_h = raw_h; eff_w = raw_h * ratio; }
      const cx = fixed.fx + (x >= fixed.fx ? 1 : -1) * eff_w;
      const cy = fixed.fy + (y >= fixed.fy ? 1 : -1) * eff_h;
      return {
        ...el,
        x: Math.min(cx, fixed.fx),
        y: Math.min(cy, fixed.fy),
        w: eff_w,
        h: eff_h,
      };
    }
  }
}
