import type { Tool } from "./types";
import { TOOLS } from "./ToolPalette";

interface Props {
  activeTool: Tool;
}

export default function CanvasArea({ activeTool }: Props) {
  const activeToolLabel = TOOLS.find((t) => t.id === activeTool)?.label;

  return (
    <main className="flex-1 overflow-hidden flex flex-col items-center justify-center bg-[#0a0c10] relative">
      {/* Grid backdrop */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Paper / canvas */}
      <div
        className="relative bg-[#c4c7cf] border border-slate-700/50 shadow-2xl shadow-black/60"
        style={{ width: 595, height: 842 /* A4 proportions */ }}
      >
        {/* Placeholder empty state */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none select-none">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1" className="w-16 h-16 text-slate-700">
            <rect x="4" y="4" width="40" height="40" rx="3" />
            <line x1="12" y1="16" x2="36" y2="16" />
            <line x1="12" y1="24" x2="28" y2="24" />
            <line x1="12" y1="32" x2="32" y2="32" />
          </svg>
          <span className="text-slate-700 text-sm">
            {activeTool === "select"
              ? "Select a tool to start drawing"
              : `Drawing with: ${activeToolLabel}`}
          </span>
        </div>
      </div>
    </main>
  );
}
