export type PlotterState = "idle" | "running" | "paused" | "error" | "offline";

export interface Plotter {
  id: string;
  name: string;
  url: string;
  state: PlotterState;
}

export const STATE_STYLES: Record<PlotterState, { dot: string; label: string; text: string }> = {
  idle:    { dot: "bg-green-400",              label: "Idle",    text: "text-green-400"  },
  running: { dot: "bg-blue-400 animate-pulse", label: "Running", text: "text-blue-400"  },
  paused:  { dot: "bg-yellow-400",             label: "Paused",  text: "text-yellow-400" },
  error:   { dot: "bg-red-500",                label: "Error",   text: "text-red-400"   },
  offline: { dot: "bg-slate-600",              label: "Offline", text: "text-slate-500"  },
};

// Placeholder — replace with real fetch later
export const STUB_PLOTTERS: Plotter[] = [
  { id: "plotter-1", name: "Plotter 1", url: "http://plotter.local", state: "idle" },
];
