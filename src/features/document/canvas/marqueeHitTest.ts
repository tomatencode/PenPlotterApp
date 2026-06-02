import type { Element } from "../types";
import { elementBounds } from "../utils";

// ── Geometry primitives ───────────────────────────────────────────────────────

function pointInRect(px: number, py: number, rx: number, ry: number, rw: number, rh: number): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

function segsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const d1x = bx - ax, d1y = by - ay;
  const d2x = dx - cx, d2y = dy - cy;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-10) return false; // parallel / collinear
  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / denom;
  const u = ((cx - ax) * d1y - (cy - ay) * d1x) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function segmentCrossesRect(
  x1: number, y1: number, x2: number, y2: number,
  rx: number, ry: number, rw: number, rh: number,
): boolean {
  if (pointInRect(x1, y1, rx, ry, rw, rh) || pointInRect(x2, y2, rx, ry, rw, rh)) return true;
  const r2 = rx + rw, b2 = ry + rh;
  return segsIntersect(x1, y1, x2, y2, rx, ry, r2, ry)   // top edge
      || segsIntersect(x1, y1, x2, y2, r2, ry, r2, b2)   // right edge
      || segsIntersect(x1, y1, x2, y2, rx, b2, r2, b2)   // bottom edge
      || segsIntersect(x1, y1, x2, y2, rx, ry, rx, b2);  // left edge
}

// ── Per-element crossing test ─────────────────────────────────────────────────

/**
 * Returns true if any stroke of the element's geometry intersects or lies inside
 * the rectangle [rx, ry, rw, rh].
 *
 * - Drawing / Line / Rect: exact segment tests
 * - Circle: 24-segment polygon approximation (sub-15° error)
 * - Text: bbox-edge test (glyph geometry is font-dependent; bbox is sufficient)
 */
function elementCrossesRect(el: Element, rx: number, ry: number, rw: number, rh: number): boolean {
  switch (el.type) {
    case "Drawing": {
      if (el.points.length === 0) return false;
      if (el.points.length === 1) return pointInRect(el.points[0][0], el.points[0][1], rx, ry, rw, rh);
      for (let i = 1; i < el.points.length; i++) {
        if (segmentCrossesRect(
          el.points[i - 1][0], el.points[i - 1][1],
          el.points[i][0],     el.points[i][1],
          rx, ry, rw, rh,
        )) return true;
      }
      return false;
    }
    case "Line":
      return segmentCrossesRect(el.x1, el.y1, el.x2, el.y2, rx, ry, rw, rh);
    case "Rect": {
      const x2 = el.x + el.w, y2 = el.y + el.h;
      return segmentCrossesRect(el.x, el.y, x2, el.y,  rx, ry, rw, rh)  // top
          || segmentCrossesRect(x2,  el.y, x2, y2,     rx, ry, rw, rh)  // right
          || segmentCrossesRect(el.x, y2,  x2, y2,     rx, ry, rw, rh)  // bottom
          || segmentCrossesRect(el.x, el.y, el.x, y2,  rx, ry, rw, rh); // left
    }
    case "Circle": {
      const N = 24;
      for (let i = 0; i < N; i++) {
        const a1 = (i       / N) * 2 * Math.PI;
        const a2 = ((i + 1) / N) * 2 * Math.PI;
        if (segmentCrossesRect(
          el.cx + el.r * Math.cos(a1), el.cy + el.r * Math.sin(a1),
          el.cx + el.r * Math.cos(a2), el.cy + el.r * Math.sin(a2),
          rx, ry, rw, rh,
        )) return true;
      }
      return false;
    }
    case "Text":
    case "Handwriting": {
      const x2 = el.x + el.w, y2 = el.y + el.h;
      return segmentCrossesRect(el.x, el.y, x2, el.y,  rx, ry, rw, rh)
          || segmentCrossesRect(x2,  el.y, x2, y2,     rx, ry, rw, rh)
          || segmentCrossesRect(el.x, y2,  x2, y2,     rx, ry, rw, rh)
          || segmentCrossesRect(el.x, el.y, el.x, y2,  rx, ry, rw, rh);
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the IDs of all elements that fall inside the marquee rectangle.
 *
 * mode "enclosed"  (right-drag): element bounding-box must be fully contained.
 *                                Bbox containment is exact for all element types.
 * mode "crossing"  (left-drag):  any stroke of the element must intersect the rect.
 */
export function elementsInMarquee(
  elements: Element[],
  selX: number,
  selY: number,
  selW: number,
  selH: number,
  mode: "enclosed" | "crossing",
): string[] {
  const ids: string[] = [];
  for (const el of elements) {
    if (mode === "enclosed") {
      const b = elementBounds(el);
      if (b.minX >= selX && b.minY >= selY && b.maxX <= selX + selW && b.maxY <= selY + selH)
        ids.push(el.id);
    } else {
      if (elementCrossesRect(el, selX, selY, selW, selH))
        ids.push(el.id);
    }
  }
  return ids;
}
