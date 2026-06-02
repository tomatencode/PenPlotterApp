import { useEffect, useRef, type Dispatch } from "react";
import type { Element, Tool } from "../types";
import type { HistoryAction } from "../docState";
import { newId } from "../utils";

const PASTE_OFFSET = 10;

function offsetElement(el: Element): Element {
  switch (el.type) {
    case "Drawing":
      return { ...el, id: newId(), points: el.points.map(([x, y]) => [x + PASTE_OFFSET, y + PASTE_OFFSET]) };
    case "Line":
      return { ...el, id: newId(), x1: el.x1 + PASTE_OFFSET, y1: el.y1 + PASTE_OFFSET, x2: el.x2 + PASTE_OFFSET, y2: el.y2 + PASTE_OFFSET };
    case "Rect":
    case "Text":
    case "Handwriting":
      return { ...el, id: newId(), x: el.x + PASTE_OFFSET, y: el.y + PASTE_OFFSET };
    case "Circle":
      return { ...el, id: newId(), cx: el.cx + PASTE_OFFSET, cy: el.cy + PASTE_OFFSET };
  }
}

interface Options {
  dispatch: Dispatch<HistoryAction>;
  elements: Element[];
  activePenIndex: number;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  setActiveTool: (tool: Tool) => void;
  onSave: () => void;
}

export function useDocumentKeyboard({
  dispatch,
  elements,
  activePenIndex,
  selectedIds,
  setSelectedIds,
  setActiveTool,
  onSave,
}: Options) {
  // Keep a ref to the latest values so the event listener never needs to be
  // re-registered. Without this, adding/removing a selection would tear down
  // and re-attach the listener on every pointer event.
  const latest = useRef({ elements, activePenIndex, selectedIds, setSelectedIds, setActiveTool, onSave });
  useEffect(() => { latest.current = { elements, activePenIndex, selectedIds, setSelectedIds, setActiveTool, onSave }; });

  const clipboard = useRef<Element[]>([]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const { elements, activePenIndex, selectedIds, setSelectedIds, setActiveTool, onSave } = latest.current;

      if ((e.ctrlKey || e.metaKey) && e.key === "c" && selectedIds.length > 0) {
        if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
        e.preventDefault();
        const selected = new Set(selectedIds);
        clipboard.current = elements.filter((el) => selected.has(el.id));
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "v" && clipboard.current.length > 0) {
        if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
        e.preventDefault();
        const pasted = clipboard.current.map(offsetElement);
        dispatch({ type: "SNAPSHOT" });
        for (const el of pasted) {
          dispatch({ type: "ADD_ELEMENT", element: { ...el, pen: activePenIndex } });
        }
        setSelectedIds(pasted.map((el) => el.id));
        // Shift clipboard so subsequent pastes cascade
        clipboard.current = pasted;
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        onSave();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "UNDO" });
        return;
      }

      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") ||
           (e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        dispatch({ type: "REDO" });
        return;
      }

      if (e.key === "Backspace" && selectedIds.length > 0) {
        if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
        dispatch({ type: "SNAPSHOT" });
        const toDelete = new Set(selectedIds);
        for (const el of elements) {
          if (toDelete.has(el.id)) {
            dispatch({ type: "DELETE_ELEMENT", elementId: el.id });
          }
        }
        setSelectedIds([]);
        return;
      }

      if (e.key === "Escape") {
        setActiveTool("select");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch]); // dispatch is stable — listener is registered exactly once
}
