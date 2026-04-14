// ── Pen ──────────────────────────────────────────────────────────────────────
export interface Pen {
  id: string;
  label: string;
  color: string;
  widthMm: number;
}

// Stub data — will come from backend / user settings later
export const PENS: Pen[] = [
  { id: "pen-black-03",  label: "Black 0.3 mm",  color: "#e2e8f0", widthMm: 0.3  },
  { id: "pen-black-05",  label: "Black 0.5 mm",  color: "#e2e8f0", widthMm: 0.5  },
  { id: "pen-blue-03",   label: "Blue 0.3 mm",   color: "#60a5fa", widthMm: 0.3  },
  { id: "pen-green-05",  label: "Green 0.5 mm",  color: "#4ade80", widthMm: 0.5  },
  { id: "pen-red-05",    label: "Red 0.5 mm",    color: "#f87171", widthMm: 0.5  },
  { id: "pen-purple-08", label: "Purple 0.8 mm", color: "#c084fc", widthMm: 0.8  },
];

// ── Layer ─────────────────────────────────────────────────────────────────────
export interface Layer {
  id: string;
  penId: string;
  name: string;
}

export function newLayerId(): string {
  return Math.random().toString(36).slice(2, 9);
}

// ── Tool ──────────────────────────────────────────────────────────────────────
export type Tool = "select" | "line" | "rect" | "circle" | "text";
