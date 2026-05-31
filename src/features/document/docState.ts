import type { Layer, Element, Pen, PageSettings, PnplttrDocument } from "./types";
import { newId } from "./utils";
import { DEFAULT_DOCUMENT } from "./constants";

export type HistoryAction =
  | { type: "SNAPSHOT" }   // save present → past, clear future
  | { type: "UNDO" }
  | { type: "REDO" }
  | DocAction;             // all existing actions pass through unchanged


export type DocAction =
  | { type: "LOAD"; doc: PnplttrDocument }
  | { type: "ADD_ELEMENT"; layerId: string; element: Element }
  | { type: "DELETE_ELEMENT"; layerId: string; elementId: string }
  | { type: "UPDATE_ELEMENT"; layerId: string; element: Element }
  | { type: "ADD_LAYER"; layer: Layer }
  | { type: "DELETE_LAYER"; layerId: string }
  | { type: "MOVE_LAYER"; layerId: string; direction: -1 | 1 }
  | { type: "SET_LAYER_PEN"; layerId: string; pen: Pen }
  | { type: "RENAME_LAYER"; layerId: string; name: string }
  | { type: "SET_LAYERS"; layers: Layer[] }
  | { type: "UPDATE_PAGE"; page: PageSettings };

export interface HistoryState {
  present: PnplttrDocument;
  past: PnplttrDocument[];
  future: PnplttrDocument[];
}

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "SNAPSHOT":
      return { ...state, past: [...state.past, state.present], future: [] };

    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        present: previous,
        past: state.past.slice(0, -1),
        future: [state.present, ...state.future],
      };
    }

    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        present: next,
        past: [...state.past, state.present],
        future: state.future.slice(1),
      };
    }

    default:
      // All DocActions pass through to the inner reducer
      return { ...state, present: docReducer(state.present, action) };
  }
}

export function docReducer(doc: PnplttrDocument, action: DocAction): PnplttrDocument {
  switch (action.type) {
    case "LOAD":
      return action.doc;
    case "ADD_ELEMENT":
      return {
        ...doc,
        layers: doc.layers.map((l) =>
          l.id === action.layerId
            ? { ...l, elements: [...l.elements, action.element] }
            : l,
        ),
      };
    case "DELETE_ELEMENT":
      return {
        ...doc,
        layers: doc.layers.map((l) =>
          l.id === action.layerId
            ? { ...l, elements: l.elements.filter((e) => e.id !== action.elementId) }
            : l,
        ),
      };
    case "UPDATE_ELEMENT":
      return {
        ...doc,
        layers: doc.layers.map((l) =>
          l.id === action.layerId
            ? { ...l, elements: l.elements.map((e) => (e.id === action.element.id ? action.element : e)) }
            : l,
        ),
      };
    case "ADD_LAYER":
      return { ...doc, layers: [...doc.layers, action.layer] };
    case "DELETE_LAYER": {
      if (doc.layers.length === 1) return doc;
      return { ...doc, layers: doc.layers.filter((l) => l.id !== action.layerId) };
    }
    case "MOVE_LAYER": {
      const idx = doc.layers.findIndex((l) => l.id === action.layerId);
      const target = idx + action.direction;
      if (target < 0 || target >= doc.layers.length) return doc;
      const next = [...doc.layers];
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...doc, layers: next };
    }
    case "RENAME_LAYER":
      return {
        ...doc,
        layers: doc.layers.map((l) =>
          l.id === action.layerId ? { ...l, name: action.name || l.name } : l,
        ),
      };
    case "SET_LAYER_PEN":
      return {
        ...doc,
        layers: doc.layers.map((l) => (l.id === action.layerId ? { ...l, pen: action.pen } : l)),
      };
    case "SET_LAYERS":
      return { ...doc, layers: action.layers };
    case "UPDATE_PAGE":
      return { ...doc, page: action.page };
    default:
      return doc;
  }
}

export function initialDoc(json: string): PnplttrDocument {
  try {
    const doc = JSON.parse(json) as PnplttrDocument;
    if (doc.layers && doc.layers.length > 0) {
      // Assign UI ids to layers (not stored in file)
      return { ...doc, layers: doc.layers.map((l) => ({ ...l, id: newId() })) };
    }
  } catch {
    // Fall back to default document on error
  }
  return DEFAULT_DOCUMENT;
}

export function initialHistoryState(json: string): HistoryState {
  return { present: initialDoc(json), past: [], future: [] };
}

export function docToJson(doc: PnplttrDocument): string {
  return JSON.stringify(doc, null, 2);
}