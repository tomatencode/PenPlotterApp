// ── File format mirror ────────────────────────────────────────────────────────
// These interfaces MIRROR pnplttr_file_structure.rs exactly.
// Field names must stay in sync — JSON is parsed directly into these types.
// Canonical source of truth: Rust. If you change one, change the other.

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

export const DEFAULT_PEN: Pen = { color: "#19191a", width: 1.2 };

export function workspaceBounds(page: PageSettings): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.max(page.page_width  / 2 - page.workspace_width  / 2, 0),
    y: Math.max(page.page_height / 2 - page.workspace_height / 2, 0),
    w: Math.min(page.workspace_width,  page.page_width),
    h: Math.min(page.workspace_height, page.page_height),
  };
}

// ── Tool ──────────────────────────────────────────────────────────────────────
export type Tool = "select" | "pen" | "line" | "rect" | "circle";

// ── Page presets ──────────────────────────────────────────────────────────────

export interface PagePreset {
  label: string;
  width: number;  // mm
  height: number; // mm
}

export const PAGE_PRESETS: PagePreset[] = [
  { label: "A4", width: 210, height: 297 },
  { label: "A5", width: 148, height: 210 },
  { label: "A6", width: 105, height: 148 },
];

export interface WorkspacePreset {
  label: string;
  /** null means "match the page exactly" (full coverage) */
  width: number;
  height: number;
}

export const WORKSPACE_PRESETS: WorkspacePreset[] = [
  { label: "V1  185 × 265", width: 185, height: 265 },
  { label: "V2  200 × 280", width: 200, height: 280 },
  { label: "V3  Full A4",   width: 210, height: 297 },
];
