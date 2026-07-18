import type { Plotter } from "../../../plotter/discoveryContext";
import PlotterDetailsRow from "../../../../shared/components/PlotterDetailsRow";
import { DropdownSelector } from "../../../../shared/components/DropdownSelector";
import { btnGreen, btnSlate } from "../../../../shared/styles";

interface Props {
	fileName: string;
	onFileNameChange: (name: string) => void;
	isBusy: boolean;
	gcode: string;
	selectedPlotter: Plotter | null;
	plotters: Plotter[];
	onPlotterChange: (url: string) => void;
	onSaveAs: () => void;
	onUpload: (startAfterUpload: boolean) => void;
}

export function GcodeControlsPanel({
	fileName,
	onFileNameChange,
	isBusy,
	gcode,
	selectedPlotter,
	plotters,
	onPlotterChange,
	onSaveAs,
	onUpload,
}: Props) {
	return (
		<div className="w-72 flex flex-col shrink-0 overflow-y-auto">
			{/* File name */}
			<div className="px-4 pt-3 pb-4 border-b border-slate-700/60">
				<p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Output File</p>
				<input
					type="text"
					value={fileName}
					onChange={(e) => onFileNameChange(e.target.value)}
					className="w-full px-2 py-1.5 rounded-md bg-[#0a0c10] border border-slate-700/60 text-xs text-slate-300 outline-none focus:border-blue-500/50 transition-colors disabled:opacity-50"
					placeholder="Filename"
					disabled={isBusy}
				/>
			</div>

			{/* Plotter */}
			<div className="px-4 pt-3 pb-4 border-b border-slate-700/60">
				<p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Plotter</p>
				<DropdownSelector
					value={selectedPlotter}
					options={plotters}
					onChange={(p) => onPlotterChange(p.url)}
					keyOf={(p) => p.url}
					renderSelected={(p) => <PlotterDetailsRow plotter={p} />}
					renderOption={(p) => <PlotterDetailsRow plotter={p} />}
					disabled={isBusy || plotters.length === 0}
					placeholder={<div className="px-3 py-2 text-xs text-slate-600 italic">no plotters available</div>}
				/>
			</div>

			{/* Actions */}
			<div className="px-4 pt-3 pb-4 flex flex-col gap-2">
				<p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Actions</p>

				<button
					onClick={onSaveAs}
					disabled={isBusy || !gcode.trim()}
					className={`flex items-center gap-2 px-4 py-1.5 text-sm ${btnSlate}`}
				>
					<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
						<path d="M13 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h8l3 3v8a1 1 0 0 1-1 1z" />
						<path d="M5 2v4h5V2" />
						<path d="M4 9h8v4H4z" />
					</svg>
					Save As
				</button>

				<button
					onClick={() => onUpload(false)}
					disabled={isBusy || !gcode.trim() || !selectedPlotter}
					className={`flex items-center gap-2 px-4 py-1.5 text-sm ${btnSlate}`}
				>
					<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
						<path d="M3 8v5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8M8 1v8M5 4l3-3 3 3" />
					</svg>
					Upload
				</button>

				<button
					onClick={() => onUpload(true)}
					disabled={isBusy || !gcode.trim() || !selectedPlotter}
					className={`flex items-center gap-2 px-4 py-1.5 text-sm ${btnGreen}`}
				>
					<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
						<polygon points="4,2 13,8 4,14" fill="currentColor" stroke="none" />
					</svg>
					Upload & Start
				</button>
			</div>
		</div>
	);
}
