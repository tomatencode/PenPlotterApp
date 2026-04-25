import type { PlotterState } from "../plotter/context";

export const STATE_STYLES: Record<PlotterState, { dot: string; label: string; text: string }> = {
  idle:    { dot: "bg-green-400",              label: "Idle",    text: "text-green-400"  },
  running: { dot: "bg-blue-400 animate-pulse", label: "Running", text: "text-blue-400"  },
  paused:  { dot: "bg-yellow-400",             label: "Paused",  text: "text-yellow-400" },
  connecting: { dot: "bg-slate-500 animate-pulse", label: "Connecting", text: "text-slate-500" },
};
