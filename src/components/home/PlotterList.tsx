import { STATE_STYLES } from "./types";
import type { Plotter } from "../../context/PlotterDiscoveryContext";

interface Props {
  plotters: Plotter[];
  onPlotterClick: (plotter: Plotter) => void;
}

export default function PlotterList({ plotters, onPlotterClick }: Props) {
  return (
    <div className="px-4 py-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 px-2 mb-0.5">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest">Plotters</p>
      </div>

      {plotters.length === 0 ? (
        <p className="text-xs text-slate-700 px-2 italic">No plotters found</p>
      ) : (
        plotters.map((plotter) => {
          const style = STATE_STYLES[plotter.displayInfo.state];
          return (
            <button
              key={plotter.url}
              onClick={() => onPlotterClick(plotter)}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-lg bg-[#0a0c10] hover:bg-slate-800/60 border border-slate-700/50 hover:border-blue-500/30 transition-colors group text-left"
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-200 group-hover:text-blue-300 transition-colors leading-tight">{plotter.displayInfo.name}</p>
                <p className="text-xs text-slate-600 truncate">{"http://" + plotter.displayInfo.mdnsName + ".local"}</p>
              </div>
              <span className={`text-xs font-medium shrink-0 ${style.text}`}>{style.label}</span>
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                className="w-3 h-3 text-slate-700 group-hover:text-slate-500 transition-colors shrink-0">
                <path d="M4 2l4 4-4 4" />
              </svg>
            </button>
          );
        })
      )}
    </div>
  );
}
