import type { Dispatch } from "react";
import type { Layer, Pen, PageSettings } from "../types";
import type { HistoryAction } from "../docState";
import { newId } from "../utils";
import { DEFAULT_PEN } from "../constants";

export function useLayerActions(
  layers: Layer[],
  activeLayerId: string,
  setActiveLayerId: (id: string) => void,
  dispatch: Dispatch<HistoryAction>,
) {
  function addLayer() {
    const layer: Layer = {
      id: newId(),
      name: `Pen ${layers.length + 1}`,
      pen: { ...DEFAULT_PEN },
      elements: [],
    };
    dispatch({ type: "SNAPSHOT" });
    dispatch({ type: "ADD_LAYER", layer });
    setActiveLayerId(layer.id);
  }

  function deleteLayer(id: string) {
    if (activeLayerId === id) {
      const idx = layers.findIndex((l) => l.id === id);
      const remaining = layers.filter((l) => l.id !== id);
      setActiveLayerId(remaining[Math.max(0, idx - 1)].id);
    }
    dispatch({ type: "SNAPSHOT" });
    dispatch({ type: "DELETE_LAYER", layerId: id });
  }

  function moveLayer(id: string, direction: -1 | 1) {
    dispatch({ type: "SNAPSHOT" });
    dispatch({ type: "MOVE_LAYER", layerId: id, direction });
  }

  function setLayerPen(id: string, pen: Pen) {
    dispatch({ type: "SNAPSHOT" });
    dispatch({ type: "SET_LAYER_PEN", layerId: id, pen });
  }

  function renameLayer(id: string, name: string) {
    dispatch({ type: "SNAPSHOT" });
    dispatch({ type: "RENAME_LAYER", layerId: id, name });
  }

  function updatePage(page: PageSettings) {
    dispatch({ type: "SNAPSHOT" });
    dispatch({ type: "UPDATE_PAGE", page });
  }

  return { addLayer, deleteLayer, moveLayer, setLayerPen, renameLayer, updatePage };
}
