import { useRef, useCallback } from "react";
import type { Element, PnplttrDocument } from "../../components/document/types";
import { translateElement, elementBounds, workspaceBounds } from "../../components/document/types";
import type { DocAction } from "./documentState";

type DragSnap = {
  layerId: string;
  element: Element;
  bounds: ReturnType<typeof elementBounds>;
};

/**
 * Owns the snapshot-and-clamp logic for element move drags.
 * Plugs into useCanvasPointer via onMoveStart / onMoveElement callbacks.
 */
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
