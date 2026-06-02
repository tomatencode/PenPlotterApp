import type { Dispatch } from "react";
import type { Pen, PageSettings } from "../types";
import type { HistoryAction } from "../docState";

export function usePenActions(
  penCount: number,
  activePenIndex: number,
  setActivePenIndex: (idx: number) => void,
  dispatch: Dispatch<HistoryAction>,
) {
  function addPen() {
    dispatch({ type: "SNAPSHOT" });
    dispatch({ type: "ADD_PEN", pen: { ...{ name: `Pen ${penCount + 1}`, color: "#19191a", width: 1.2 } } });
    setActivePenIndex(penCount); // new pen will be at this index
  }

  function deletePen(index: number) {
    if (activePenIndex === index) {
      setActivePenIndex(Math.max(0, index - 1));
    } else if (activePenIndex > index) {
      setActivePenIndex(activePenIndex - 1);
    }
    dispatch({ type: "SNAPSHOT" });
    dispatch({ type: "DELETE_PEN", penIndex: index });
  }


  function setPen(index: number, pen: Pen) {
    dispatch({ type: "SNAPSHOT" });
    dispatch({ type: "SET_PEN", penIndex: index, pen });
  }

  function updatePage(page: PageSettings) {
    dispatch({ type: "SNAPSHOT" });
    dispatch({ type: "UPDATE_PAGE", page });
  }

  return { addPen, deletePen, setPen, updatePage };
}
