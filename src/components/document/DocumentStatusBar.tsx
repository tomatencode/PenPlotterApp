import type { Pen, Tool } from "./types";

interface Props {
  activeTool: Tool;
  activeLayerPen: Pen;
  zoom: number;
  totalElements: number;
}

export default function DocumentStatusBar({ activeTool, activeLayerPen, zoom, totalElements }: Props) {
  return (
    <footer className="flex items-center gap-4 px-4 h-6 bg-[#0d1017] border-t border-slate-700/60 shrink-0">
      <span className="text-xs text-slate-700">
        Tool: <span className="text-slate-500 capitalize">{activeTool}</span>
      </span>
      <span className="text-xs text-slate-700">
        Zoom: <span className="text-slate-500">{Math.round(zoom * 100)}%</span>
      </span>
      <span className="text-xs text-slate-700">
        <span className="text-slate-500">{totalElements}</span> {totalElements === 1 ? "object" : "objects"}
      </span>
      <div className="flex-1" />
      <span className="text-xs text-slate-700">
        Pen: <span className="text-slate-500">{activeLayerPen.name}</span>
      </span>
      <span className="text-xs text-slate-700">A4  210 × 297 mm</span>
    </footer>
  );
}
