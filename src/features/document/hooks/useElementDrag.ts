import { useRef, useCallback } from "react";
import type { Element, PnplttrDocument } from "../types";
import { workspaceBounds } from "../utils";
import type { DocAction } from "../docState";

function elementBounds(el: Element): { minX: number; minY: number; maxX: number; maxY: number } {
  switch (el.type) {
    case "Drawing": {
      const xs = el.points.map(p => p[0]);
      const ys = el.points.map(p => p[1]);
      return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
    }
    case "Line":   return { minX: Math.min(el.x1, el.x2), minY: Math.min(el.y1, el.y2), maxX: Math.max(el.x1, el.x2), maxY: Math.max(el.y1, el.y2) };
    case "Rect":   return { minX: el.x, minY: el.y, maxX: el.x + el.w, maxY: el.y + el.h };
    case "Circle": return { minX: el.cx - el.r, minY: el.cy - el.r, maxX: el.cx + el.r, maxY: el.cy + el.r };
    case "Text":   return { minX: el.x, minY: el.y, maxX: el.x + el.w, maxY: el.y + el.h };
  }
}

function translateElement(el: Element, dx: number, dy: number): Element {
  switch (el.type) {
    case "Drawing": return { ...el, points: el.points.map(([x, y]) => [x + dx, y + dy]) };
    case "Line":   return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
    case "Rect":   return { ...el, x: el.x + dx, y: el.y + dy };
    case "Circle": return { ...el, cx: el.cx + dx, cy: el.cy + dy };
    case "Text":   return { ...el, x: el.x + dx, y: el.y + dy };
  }
}

type DragSnap = {
  layerId: string;
  element: Element;
  bounds: ReturnType<typeof elementBounds>;
};

export function useElementDrag(
  docRef: React.RefObject<PnplttrDocument>,
  dispatch: React.Dispatch<DocAction>,
  recordHistory: () => void,
) {
  const snapRef = useRef<DragSnap | null>(null);

  const onMoveStart = useCallback((elementId: string) => {
    const layer = docRef.current.layers.find(l => l.elements.some(el => el.id === elementId));
    if (!layer) return;
    const element = layer.elements.find(el => el.id === elementId)!;
    snapRef.current = { layerId: layer.id, element, bounds: elementBounds(element) };
    recordHistory();
  }, [docRef, recordHistory]);

  // totalDx/totalDy are total displacement from drag-start, not per-frame deltas.
  // Applying to the original snapshot means workspace clamping never accumulates drift.
  const onMoveElement = useCallback((id: string, totalDx: number, totalDy: number) => {
    const snap = snapRef.current;
    if (!snap || snap.element.id !== id) return;
    const { layerId, element, bounds: b } = snap;
    const ws = workspaceBounds(docRef.current.page);
    const clampedDx = Math.max(ws.x - b.minX, Math.min(ws.x + ws.w - b.maxX, totalDx));
    const clampedDy = Math.max(ws.y - b.minY, Math.min(ws.y + ws.h - b.maxY, totalDy));
    dispatch({ type: "UPDATE_ELEMENT", layerId, element: translateElement(element, clampedDx, clampedDy) });
  }, [docRef, dispatch]);

  return { onMoveStart, onMoveElement };
}
