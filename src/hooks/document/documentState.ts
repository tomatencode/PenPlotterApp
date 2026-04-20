import {
  type Layer,
  type Element,
  type Pen,
  type PageSettings,
  type PnplttrDocument,
  newId,
  DEFAULT_PEN,
} from "../../components/document/types";

export type DocAction =
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

export function docReducer(doc: PnplttrDocument, action: DocAction): PnplttrDocument {
  switch (action.type) {
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
    // Fall through to default doc.
  }

  return {
    meta: { created: new Date().toISOString(), doctype_version: 1 },
    page: { page_width: 210, page_height: 297, workspace_width: 210, workspace_height: 297 },
    layers: [{ id: newId(), name: "Pen 1", pen: { ...DEFAULT_PEN }, elements: [] }],
  } as PnplttrDocument;
}

export function docToJson(doc: PnplttrDocument): string {
  return JSON.stringify(doc, null, 2);
}