import { STATE_STYLES } from "../../features/home/types";
import type { Plotter } from "../../features/plotter/discoveryContext";

interface Props {
  plotter: Plotter;
  /** Show a right-pointing chevron at the end. */
  showChevron?: boolean;
  /** Extra classes applied to the wrapping element (e.g. hover styles). */
  className?: string;
}

/** Read-only display of a single plotter's details — dot, name, version, URL, state label. */
export default function PlotterDetailsRow({ plotter, showChevron = false, className = "" }: Props) {
  const style = STATE_STYLES[plotter.displayInfo.state];
  const url =
    "http://" +
    (plotter.displayInfo.mdnsName === "" ? plotter.url : plotter.displayInfo.mdnsName) +
    ".local";

  return (
    <>
      <div className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
      <div className={`flex-1 min-w-0 ${className}`}>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-200 leading-tight truncate">
            {plotter.displayInfo.name === "" ? "?" : plotter.displayInfo.name}
          </p>
          <p className="text-xs text-slate-600 italic">
            {`V${plotter.displayInfo.iteration === 0 ? "?" : plotter.displayInfo.iteration}`}
          </p>
        </div>
        <p className="text-xs text-slate-600 truncate">{url}</p>
      </div>
      <span className={`text-xs font-medium shrink-0 ${style.text}`}>{style.label}</span>
      {showChevron && (
        <svg
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-3 h-3 text-slate-700 group-hover:text-slate-500 transition-colors shrink-0"
        >
          <path d="M4 2l4 4-4 4" />
        </svg>
      )}
    </>
  );
}
