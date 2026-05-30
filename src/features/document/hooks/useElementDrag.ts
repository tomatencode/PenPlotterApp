import { useRef, useCallback } from "react";
import type { Element, PnplttrDocument } from "../types";
import { workspaceBounds, elementBounds, type ElementBounds } from "../utils";
import type { DocAction } from "../docState";

function translateElement(el: Element, dx: number, dy: number): Element {
  switch (el.type) {
    case "Drawing": return { ...el, points: el.points.map(([x, y]) => [x + dx, y + dy]) };
    case "Line":   return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
    case "Rect":   return { ...el, x: el.x + dx, y: el.y + dy };
    case "Circle": return { ...el, cx: el.cx + dx, cy: el.cy + dy };
    case "Text":        return { ...el, x: el.x + dx, y: el.y + dy };
    case "Handwriting":  return { ...el, x: el.x + dx, y: el.y + dy };
  }
}

type DragSnap = {
  layerId: string;
  element: Element;
  bounds: ElementBounds;
};

export function useElementDrag(
  docRef: React.RefObject<PnplttrDocument>,
  dispatch: React.Dispatch<DocAction>,
  recordHistory: () => void,
) {
  const snapsRef = useRef<DragSnap[]>([]);

  /** Call once at the start of a drag with all element IDs that should move together. */
  const onMoveStart = useCallback((elementIds: string[]) => {
    snapsRef.current = elementIds.flatMap(elementId => {
      const layer = docRef.current.layers.find(l => l.elements.some(el => el.id === elementId));
      if (!layer) return [];
      const element = layer.elements.find(el => el.id === elementId)!;
      return [{ layerId: layer.id, element, bounds: elementBounds(element) }];
    });
    if (snapsRef.current.length > 0) recordHistory();
  }, [docRef, recordHistory]);

  /**
   * totalDx/totalDy are total displacement from the drag-start position (not per-frame deltas).
   * Applied to the original snapshots so workspace clamping never accumulates drift.
   * Clamping respects the tightest constraint across all elements being moved.
   */
  const onMoveElement = useCallback((totalDx: number, totalDy: number) => {
    const snaps = snapsRef.current;
    if (snaps.length === 0) return;
    const ws = workspaceBounds(docRef.current.page);
    let clampedDx = totalDx;
    let clampedDy = totalDy;
    for (const { bounds: b } of snaps) {
      clampedDx = Math.max(ws.x - b.minX, Math.min(ws.x + ws.w - b.maxX, clampedDx));
      clampedDy = Math.max(ws.y - b.minY, Math.min(ws.y + ws.h - b.maxY, clampedDy));
    }
    for (const { layerId, element } of snaps) {
      dispatch({ type: "UPDATE_ELEMENT", layerId, element: translateElement(element, clampedDx, clampedDy) });
    }
  }, [docRef, dispatch]);

  return { onMoveStart, onMoveElement };
}
