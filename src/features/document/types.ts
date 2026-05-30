import type { PlotterStroke } from "./plotterMove";

export interface Pen {
  color: string;
  width: number; // mm
}

export type Element =
  | { id: string; type: "Drawing"; points: [x: number, y: number][] }
  | { id: string; type: "Line";    x1: number; y1: number; x2: number; y2: number }
  | { id: string; type: "Rect";    x: number;  y: number;  w: number;  h: number  }
  | { id: string; type: "Circle";  cx: number; cy: number; r: number              }
  | { id: string; type: "Text";    x: number;  y: number;  w: number;  h: number; text: string; fontName: string; size: number }
  // Handwriting: strokes stored in normalised [0,1] space, transformed to doc space at render time.
  | { id: string; type: "Handwriting"; x: number; y: number; w: number; h: number; text: string; style: number; steps: number; strokes: PlotterStroke[] };

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
  /** Custom fonts embedded in the document (default fonts are always available). */
  fonts?: Record<string, PlttrFont>;
}

export interface PlttrFont {
  name: string;
  height: number;
  glyphs: Record<string, { width: number; paths: PlotterStroke[] }>;
}

export type Tool = "select" | "pen" | "line" | "rect" | "circle" | "text" | "handwriting";
