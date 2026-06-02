import { useRef, useCallback } from "react";
import type { Element, PnplttrDocument } from "../types";
import { applyHandleDrag } from "../canvas/DeformHandles";
import type { DocAction } from "../docState";

type DeformSnap = {
  element: Element; // original element at drag-start
};

export function useElementDeform(
  doc: PnplttrDocument,
  dispatch: React.Dispatch<DocAction>,
  recordHistory: () => void,
) {
  const snapRef = useRef<DeformSnap | null>(null);

  const onDeformStart = useCallback((elementId: string) => {
    const element = doc.elements.find(el => el.id === elementId);
    if (!element) return;
    snapRef.current = { element };
    recordHistory();
  }, [doc, recordHistory]);

  // x, y are absolute doc-space coordinates (clamped to workspace by useCanvasPointer).
  // Applied to the original snapshot so there is no per-frame drift.
  const onDeformElement = useCallback((elementId: string, handleId: string, x: number, y: number) => {
    const snap = snapRef.current;
    if (!snap || snap.element.id !== elementId) return;
    const updated = applyHandleDrag(snap.element, handleId, x, y, doc.page);
    dispatch({ type: "UPDATE_ELEMENT", element: updated });
  }, [doc, dispatch]);

  return { onDeformStart, onDeformElement };
}
