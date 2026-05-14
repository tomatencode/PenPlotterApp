import { useState } from "react";
import PlotterDetailsRow from "../../../shared/components/PlotterDetailsRow";
import type { Plotter } from "../../plotter/context";

interface Props {
	gcode: string;
	plotters: Plotter[];
	selectedPlotter: Plotter | null;
	isBusy: boolean;
	onSelectPlotter: (url: string) => void;
	onUpload: () => void;
	onUploadAndStart: () => void;
	onStream: () => void;
}

export default function GcodeControlsPanel({
	gcode,
	plotters,
	selectedPlotter,
	isBusy,
	onSelectPlotter,
	onUpload,
	onUploadAndStart,
	onStream,
}: Props) {
	const [showPlotterDropdown, setShowPlotterDropdown] = useState(false);

	const lines = gcode.split(/\r?\n/);
	const hasGcode = gcode.trim().length > 0;

	return (
		<aside className="w-72 shrink-0 border-l border-slate-700/60 bg-[#0d1017] flex flex-col overflow-y-auto">
			{/* Stats */}
			<div className="px-4 pt-4 pb-3 border-b border-slate-700/60">
				<p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">File</p>
				<div className="flex gap-4 text-xs text-slate-500">
					<span>{lines.filter(Boolean).length} lines</span>
					<span>{new Blob([gcode]).size} B</span>
				</div>
			</div>

			{/* Plotter selector */}
			<div className="px-4 pt-3 pb-4 border-b border-slate-700/60">
				<p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Plotter</p>

				<div
					className={`rounded-lg border bg-[#0a0c10] overflow-hidden transition-colors ${
						showPlotterDropdown ? "border-blue-500/40" : "border-slate-700/60"
					}`}
				>
					{selectedPlotter ? (
						<button
							onClick={() => setShowPlotterDropdown((v) => !v)}
							disabled={isBusy || plotters.length === 0}
							className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800/40 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<PlotterDetailsRow plotter={selectedPlotter} />
							<svg
								viewBox="0 0 12 12"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
								className={`w-3 h-3 text-slate-600 shrink-0 transition-transform ${
									showPlotterDropdown ? "rotate-90" : ""
								}`}
							>
								<path d="M4 2l4 4-4 4" />
							</svg>
						</button>
					) : (
						<div className="px-3 py-2 text-xs text-slate-600 italic">No plotter available</div>
					)}

					{showPlotterDropdown &&
						plotters.filter((p) => p.url !== selectedPlotter?.url).length > 0 && (
							<div className="border-t border-slate-700/60">
								{plotters
									.filter((p) => p.url !== selectedPlotter?.url)
									.map((plotter) => (
										<button
											key={plotter.url}
											onClick={() => {
												onSelectPlotter(plotter.url);
												setShowPlotterDropdown(false);
											}}
											className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800/40 border-b border-slate-700/30 last:border-b-0 text-left transition-colors"
										>
											<PlotterDetailsRow plotter={plotter} />
										</button>
									))}
							</div>
						)}
				</div>
			</div>

			{/* Actions */}
			<div className="px-4 pt-3 pb-4 flex flex-col gap-2">
				<p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Actions</p>

				<button
					onClick={onUpload}
					disabled={isBusy || !hasGcode || !selectedPlotter}
					className="flex items-center gap-2 px-4 py-1.5 bg-slate-700/60 hover:bg-slate-600/60 border border-slate-600/60 hover:border-slate-500 rounded-lg text-sm font-semibold text-slate-200 transition-colors disabled:opacity-40 disabled:pointer-events-none"
				>
					<svg
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="w-4 h-4 shrink-0"
					>
						<path d="M3 8v5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8M8 1v8M5 4l3-3 3 3" />
					</svg>
					Upload
				</button>

				<button
					onClick={onUploadAndStart}
					disabled={isBusy || !hasGcode || !selectedPlotter}
					className="flex items-center gap-2 px-4 py-1.5 bg-green-700/80 hover:bg-green-600/80 border border-green-600/60 hover:border-green-500 rounded-lg text-sm font-semibold text-green-100 transition-colors disabled:opacity-40 disabled:pointer-events-none shadow-sm shadow-green-900/30"
				>
					<svg
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="w-4 h-4 shrink-0"
					>
						<polygon points="4,2 13,8 4,14" fill="currentColor" stroke="none" />
					</svg>
					Upload & Start
				</button>

				<button
					onClick={onStream}
					disabled={isBusy || !hasGcode || !selectedPlotter}
					className="flex items-center gap-2 px-4 py-1.5 bg-green-700/80 hover:bg-green-600/80 border border-green-600/60 hover:border-green-500 rounded-lg text-sm font-semibold text-green-100 transition-colors disabled:opacity-40 disabled:pointer-events-none shadow-sm shadow-green-900/30"
				>
					<svg
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="w-4 h-4 shrink-0"
					>
						<path d="M3 8h4M9 4l4 4-4 4M9 8h4" />
					</svg>
					Stream Live
				</button>
			</div>
		</aside>
	);
}
