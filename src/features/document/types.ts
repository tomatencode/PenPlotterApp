import type { PlotterStroke } from "./plotterMove";

export interface Pen {
  name: string;
  color: string;
  width: number; // mm
}

export type Element =
  | { id: string; type: "Drawing"; pen: number; z: number; points: [x: number, y: number][] }
  | { id: string; type: "Line";    pen: number; z: number; x1: number; y1: number; x2: number; y2: number }
  | { id: string; type: "Rect";    pen: number; z: number; x: number;  y: number;  w: number;  h: number  }
  | { id: string; type: "Circle";  pen: number; z: number; cx: number; cy: number; r: number              }
  | { id: string; type: "Text";    pen: number; z: number; x: number;  y: number;  w: number;  h: number; text: string; fontName: string; size: number }
  // Handwriting: strokes stored in normalised [0,1] space, transformed to doc space at render time.
  | { id: string; type: "Handwriting"; pen: number; z: number; x: number; y: number; w: number; h: number; text: string; style: number; strokes: PlotterStroke[] };

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
  pens: Pen[];
  elements: Element[];
  /** Custom fonts embedded in the document (default fonts are always available). */
  fonts?: Record<string, PlttrFont>;
}

export interface PlttrFont {
  name: string;
  height: number;
  glyphs: Record<string, { width: number; paths: PlotterStroke[] }>;
}

export type Tool = "select" | "pen" | "line" | "rect" | "circle" | "text" | "handwriting";
