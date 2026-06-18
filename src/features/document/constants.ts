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
  width: number;
  height: number;
}

export const WORKSPACE_PRESETS: WorkspacePreset[] = [
  { label: "V1  185 × 265", width: 185, height: 265 },
  { label: "V2  200 × 285", width: 200, height: 285 },
];

export const DEFAULT_DOCUMENT = {
  meta: {
    created: new Date().toISOString(),
    doctype_version: 2,
  },
  page: {
    page_width: 210,
    page_height: 297,
    workspace_width: 200,
    workspace_height: 285,
  },
  pens: [
    { name: "Pen 1", color: "#19191a", width: 1.2 }
  ],
  elements: [],
};