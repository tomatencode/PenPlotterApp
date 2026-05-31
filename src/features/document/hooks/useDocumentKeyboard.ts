import { useEffect, useRef, type Dispatch } from "react";
import type { Layer, Tool } from "../types";
import type { HistoryAction } from "../docState";

interface Options {
  dispatch: Dispatch<HistoryAction>;
  layers: Layer[];
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  setActiveTool: (tool: Tool) => void;
  onSave: () => void;
}

export function useDocumentKeyboard({
  dispatch,
  layers,
  selectedIds,
  setSelectedIds,
  setActiveTool,
  onSave,
}: Options) {
  // Keep a ref to the latest values so the event listener never needs to be
  // re-registered. Without this, adding/removing a selection would tear down
  // and re-attach the listener on every pointer event.
  const latest = useRef({ layers, selectedIds, setSelectedIds, setActiveTool, onSave });
  useEffect(() => { latest.current = { layers, selectedIds, setSelectedIds, setActiveTool, onSave }; });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const { layers, selectedIds, setSelectedIds, setActiveTool, onSave } = latest.current;

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
        for (const layer of layers) {
          for (const el of layer.elements) {
            if (toDelete.has(el.id)) {
              dispatch({ type: "DELETE_ELEMENT", layerId: layer.id, elementId: el.id });
            }
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
