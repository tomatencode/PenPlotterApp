import { useRef, useCallback } from "react";
import type { Element, PnplttrDocument } from "../types";
import { applyHandleDrag } from "../canvas/DeformHandles";
import type { DocAction } from "../state";

type DeformSnap = {
  layerId: string;
  element: Element; // original element at drag-start
};

export function useElementDeform(
  docRef: React.RefObject<PnplttrDocument>,
  dispatch: React.Dispatch<DocAction>,
  recordHistory: () => void,
) {
  const snapRef = useRef<DeformSnap | null>(null);

  const onDeformStart = useCallback((elementId: string) => {
    const layer = docRef.current.layers.find(l => l.elements.some(el => el.id === elementId));
    if (!layer) return;
    const element = layer.elements.find(el => el.id === elementId)!;
    snapRef.current = { layerId: layer.id, element };
    recordHistory();
  }, [docRef, recordHistory]);

  // x, y are absolute doc-space coordinates (clamped to workspace by useCanvasPointer).
  // Applied to the original snapshot so there is no per-frame drift.
  const onDeformElement = useCallback((elementId: string, handleId: string, x: number, y: number) => {
    const snap = snapRef.current;
    if (!snap || snap.element.id !== elementId) return;
    const updated = applyHandleDrag(snap.element, handleId, x, y, docRef.current.page);
    dispatch({ type: "UPDATE_ELEMENT", layerId: snap.layerId, element: updated });
  }, [dispatch]);

  return { onDeformStart, onDeformElement };
}
