import type { Element, Pen, PageSettings, PnplttrDocument } from "./types";
import { DEFAULT_DOCUMENT } from "./constants";

export type HistoryAction =
  | { type: "SNAPSHOT" }   // save present → past, clear future
  | { type: "UNDO" }
  | { type: "REDO" }
  | DocAction;             // all existing actions pass through unchanged


export type DocAction =
  | { type: "LOAD"; doc: PnplttrDocument }
  | { type: "ADD_ELEMENT"; element: Element }
  | { type: "DELETE_ELEMENT"; elementId: string }
  | { type: "UPDATE_ELEMENT"; element: Element }
  | { type: "ADD_PEN"; pen: Pen }
  | { type: "DELETE_PEN"; penIndex: number }
  | { type: "SET_PEN"; penIndex: number; pen: Pen }
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
      return { ...doc, elements: [...doc.elements, action.element] };
    case "DELETE_ELEMENT":
      return { ...doc, elements: doc.elements.filter((e) => e.id !== action.elementId) };
    case "UPDATE_ELEMENT":
      return { ...doc, elements: doc.elements.map((e) => e.id === action.element.id ? action.element : e) };
    case "ADD_PEN":
      return { ...doc, pens: [...doc.pens, action.pen] };
    case "DELETE_PEN": {
      if (doc.pens.length === 1) return doc;
      const newPens = doc.pens.filter((_, i) => i !== action.penIndex);
      const newElements = doc.elements.map((el) => {
        if (el.pen === action.penIndex) return { ...el, pen: 0 };
        if (el.pen > action.penIndex) return { ...el, pen: el.pen - 1 };
        return el;
      });
      return { ...doc, pens: newPens, elements: newElements };
    }
    case "SET_PEN":
      return { ...doc, pens: doc.pens.map((p, i) => i === action.penIndex ? action.pen : p) };
    case "UPDATE_PAGE":
      return { ...doc, page: action.page };
    default:
      return doc;
  }
}

export function initialDoc(json: string): PnplttrDocument {
  try {
    const doc = JSON.parse(json) as PnplttrDocument;
    if (doc.pens && doc.pens.length > 0) {
      return doc;
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