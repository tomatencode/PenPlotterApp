import PlotterDetailsRow from "../../../shared/components/PlotterDetailsRow";
import type { Plotter } from "../../plotter/discoveryContext";

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
        <p className="text-xs text-slate-700 px-2 italic flex items-center gap-0.5">
          <span>Lokking for Plotters</span>
          <span className="inline-flex" aria-hidden="true">
            <span className="animate-pulse [animation-delay:0ms]">.</span>
            <span className="animate-pulse [animation-delay:150ms]">.</span>
            <span className="animate-pulse [animation-delay:300ms]">.</span>
          </span>
        </p>
      ) : (
        plotters.map((plotter) => (
          <button
            key={plotter.url}
            onClick={() => onPlotterClick(plotter)}
            className="flex items-center gap-3 w-full px-3 py-3 rounded-lg bg-[#0a0c10] hover:bg-slate-800/60 border border-slate-700/50 hover:border-blue-500/30 transition-colors group text-left"
          >
            <PlotterDetailsRow plotter={plotter} showChevron />
          </button>
        ))
      )}
    </div>
  );
}
