import type { ReactNode } from "react";
import type { Tool } from "./types";

export interface ToolDef {
  id: Tool;
  label: string;
  icon: ReactNode;
}

export const TOOLS: ToolDef[] = [
  {
    id: "select",
    label: "Select",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M3 2l10 5.5-4.5 1L6 13z" />
      </svg>
    ),
  },
  {
    id: "line",
    label: "Line",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-4 h-4">
        <line x1="2" y1="14" x2="14" y2="2" />
      </svg>
    ),
  },
  {
    id: "rect",
    label: "Rectangle",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <rect x="2" y="4" width="12" height="8" rx="1" />
      </svg>
    ),
  },
  {
    id: "circle",
    label: "Circle",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <circle cx="8" cy="8" r="5.5" />
      </svg>
    ),
  }
];

interface Props {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
}

export default function ToolPalette({ activeTool, onToolChange }: Props) {
  return (
    <aside className="w-14 shrink-0 flex flex-col items-center gap-1 pt-3 pb-3 bg-[#0d1017] border-r border-slate-700/60">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onToolChange(tool.id)}
          title={tool.label}
          className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors
            ${activeTool === tool.id
              ? "bg-blue-600/30 text-blue-400 border border-blue-500/50"
              : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
            }`}
        >
          {tool.icon}
        </button>
      ))}
    </aside>
  );
}
