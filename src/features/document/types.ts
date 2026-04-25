export interface Pen {
  color: string;
  width: number; // mm
}

export type Element =
  | { id: string; type: "Drawing"; points: [x: number, y: number][] }
  | { id: string; type: "Line";    x1: number; y1: number; x2: number; y2: number }
  | { id: string; type: "Rect";    x: number;  y: number;  w: number;  h: number  }
  | { id: string; type: "Circle";  cx: number; cy: number; r: number              };

export interface Layer {
  id: string;
  name: string;
  pen: Pen;
  elements: Element[];
}

export interface PageSettings {
  page_width: number;
  page_height: number;
  workspace_width: number;
  workspace_height: number;
}

export interface MetaSettings {
  created: string;
  doctype_version: number;
}

export interface PnplttrDocument {
  meta: MetaSettings;
  page: PageSettings;
  layers: Layer[];
}

export type Tool = "select" | "pen" | "line" | "rect" | "circle";
