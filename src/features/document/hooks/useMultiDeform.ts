import { useRef, useCallback } from "react";
import type { Element, PnplttrDocument } from "../types";
import { elementBounds, workspaceBounds } from "../utils";
import type { DocAction } from "../docState";

type Snap = {
  element: Element;
  minX: number; minY: number; maxX: number; maxY: number;
};

function combinedBbox(snaps: Snap[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of snaps) {
    if (s.minX < minX) minX = s.minX; if (s.minY < minY) minY = s.minY;
    if (s.maxX > maxX) maxX = s.maxX; if (s.maxY > maxY) maxY = s.maxY;
  }
  return { minX, minY, maxX, maxY };
}

/** Scale a single element about the fixed corner point (fixedX, fixedY) by (sx, sy). */
function scaleElement(el: Element, fixedX: number, fixedY: number, sx: number, sy: number): Element {
  const tx = (px: number) => fixedX + (px - fixedX) * sx;
  const ty = (py: number) => fixedY + (py - fixedY) * sy;
  switch (el.type) {
    case "Drawing":
      return { ...el, points: el.points.map(([px, py]) => [tx(px), ty(py)]) };
    case "Line":
      return { ...el, x1: tx(el.x1), y1: ty(el.y1), x2: tx(el.x2), y2: ty(el.y2) };
    case "Rect": {
      const nx = tx(el.x), ny = ty(el.y);
      const nx2 = tx(el.x + el.w), ny2 = ty(el.y + el.h);
      return { ...el, x: Math.min(nx, nx2), y: Math.min(ny, ny2), w: Math.abs(nx2 - nx), h: Math.abs(ny2 - ny) };
    }
    case "Circle":
      return { ...el, cx: tx(el.cx), cy: ty(el.cy), r: el.r * (Math.abs(sx) + Math.abs(sy)) / 2 };
    case "Text": {
      const nx = tx(el.x), ny = ty(el.y);
      const nx2 = tx(el.x + el.w), ny2 = ty(el.y + el.h);
      return { ...el, x: Math.min(nx, nx2), y: Math.min(ny, ny2), w: Math.abs(nx2 - nx), h: Math.abs(ny2 - ny) };
    }
    case "Handwriting": {
      const nx = tx(el.x), ny = ty(el.y);
      const nx2 = tx(el.x + el.w), ny2 = ty(el.y + el.h);
      return { ...el, x: Math.min(nx, nx2), y: Math.min(ny, ny2), w: Math.abs(nx2 - nx), h: Math.abs(ny2 - ny) };
    }
  }
}

export function useMultiDeform(
  doc: PnplttrDocument,
  dispatch: React.Dispatch<DocAction>,
  recordHistory: () => void,
) {
  const snapsRef = useRef<Snap[]>([]);
  const bboxRef = useRef<ReturnType<typeof combinedBbox> | null>(null);
  const hasHandwritingRef = useRef(false);

  const onMultiDeformStart = useCallback((elementIds: string[]) => {
    const snaps: Snap[] = elementIds.flatMap(id => {
      const el = doc.elements.find(e => e.id === id);
      if (!el) return [];
      const b = elementBounds(el);
      return [{ element: el, ...b }];
    });
    snapsRef.current = snaps;
    bboxRef.current = snaps.length > 0 ? combinedBbox(snaps) : null;
    hasHandwritingRef.current = snaps.some(s => s.element.type === "Handwriting");
    if (snaps.length > 0) recordHistory();
  }, [doc, recordHistory]);

  const onMultiDeformElement = useCallback((handleId: string, x: number, y: number) => {
    const snaps = snapsRef.current;
    const bbox = bboxRef.current;
    if (!bbox || snaps.length === 0) return;

    const origW = bbox.maxX - bbox.minX;
    const origH = bbox.maxY - bbox.minY;
    if (origW === 0 || origH === 0) return;

    // Fixed corner is opposite to the dragged handle
    const corners: Record<string, { fx: number; fy: number }> = {
      tl: { fx: bbox.maxX, fy: bbox.maxY },
      tr: { fx: bbox.minX, fy: bbox.maxY },
      bl: { fx: bbox.maxX, fy: bbox.minY },
      br: { fx: bbox.minX, fy: bbox.minY },
    };
    const fixed = corners[handleId];
    if (!fixed) return;

    const x_dir = x >= fixed.fx ? 1 : -1;
    const y_dir = y >= fixed.fy ? 1 : -1;
    let eff_w = Math.abs(x - fixed.fx);
    let eff_h = Math.abs(y - fixed.fy);
    if (eff_w === 0 && eff_h === 0) return;

    // When a Handwriting element is present, lock the scale to the original aspect ratio
    const ratio = origW / origH;
    if (hasHandwritingRef.current) {
      if (eff_h === 0 || eff_w / eff_h >= ratio) { eff_h = eff_w / ratio; }
      else                                        { eff_w = eff_h * ratio; }
    }

    // Clamp so the new bbox stays within the workspace
    const ws = workspaceBounds(doc.page);
    const max_w = Math.max(0, x_dir > 0 ? ws.x + ws.w - fixed.fx : fixed.fx - ws.x);
    const max_h = Math.max(0, y_dir > 0 ? ws.y + ws.h - fixed.fy : fixed.fy - ws.y);
    if (hasHandwritingRef.current) {
      eff_w = Math.min(eff_w, max_w, max_h * ratio);
      eff_h = eff_w / ratio;
    } else {
      eff_w = Math.min(eff_w, max_w);
      eff_h = Math.min(eff_h, max_h);
    }

    const sx = x_dir * eff_w / origW;
    const sy = y_dir * eff_h / origH;

    for (const snap of snaps) {
      dispatch({ type: "UPDATE_ELEMENT", element: scaleElement(snap.element, fixed.fx, fixed.fy, sx, sy) });
    }
  }, [doc, dispatch]);

  return { onMultiDeformStart, onMultiDeformElement };
}
