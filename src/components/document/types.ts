// ── File format mirror ────────────────────────────────────────────────────────
// These interfaces MIRROR pnplttr_file_structure.rs exactly.
// Field names must stay in sync — JSON is parsed directly into these types.
// Canonical source of truth: Rust. If you change one, change the other.

export interface Pen {
  name: string;
  color: string;
  width: number; // mm
}

export type Element =
  | { id: string; type: "Line";   x1: number; y1: number; x2: number; y2: number }
  | { id: string; type: "Rect";   x: number;  y: number;  w: number;  h: number  }
  | { id: string; type: "Circle"; cx: number; cy: number; r: number              };

export interface Layer {
  id: string;       // UI-only, not in file format — stripped on save
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

// ── UI helpers ────────────────────────────────────────────────────────────────

export function newId(): string {
  return Math.random().toString(36).slice(2, 9);
}

export const DEFAULT_PEN: Pen = { name: "Black 0.3 mm", color: "#e2e8f0", width: 0.3 };

// Preset pens shown in the layer pen picker
export const PRESET_PENS: Pen[] = [
  { name: "Black 0.3 mm",  color: "#e2e8f0", width: 0.3 },
  { name: "Black 0.5 mm",  color: "#e2e8f0", width: 0.5 },
  { name: "Blue 0.3 mm",   color: "#60a5fa", width: 0.3 },
  { name: "Green 0.5 mm",  color: "#4ade80", width: 0.5 },
  { name: "Red 0.5 mm",    color: "#f87171", width: 0.5 },
  { name: "Purple 0.8 mm", color: "#c084fc", width: 0.8 },
];

// ── Tool ──────────────────────────────────────────────────────────────────────
export type Tool = "select" | "line" | "rect" | "circle";
