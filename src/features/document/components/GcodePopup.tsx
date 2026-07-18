import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { PlotterClient } from "../../plotter/api/plotterClient";
import PlotterDetailsRow from "../../../shared/components/PlotterDetailsRow";
import { usePlotterDiscovery } from "../../plotter/discoveryContext";
import { PnplttrDocument } from "../types";
import { InlineDropdown } from "../../../shared/components/InlineDropdown";
import { btnGreen, btnSlate } from "../../../shared/styles";

interface Props {
	isOpen: boolean;
	onClose: () => void;
	doc: PnplttrDocument;
	defaultFileName: string;
}

function toGcodeName(fileName: string): string {
	const base = fileName.replace(/\.[^/.]+$/, "").trim() || "untitled";
	return `${base}.gcode`;
}

export default function GcodePopup({
	isOpen,
	onClose,
	doc,
	defaultFileName,
}: Props) {
	const [gcode, setGcode] = useState<string>("");
	const [selectedPlotterUrl, setSelectedPlotterUrl] = useState<string>("");
	const [fileName, setFileName] = useState<string>(toGcodeName(defaultFileName));
	const [gcodeDir, setGcodeDir] = useState<string | null>(null);
	const [isBusy, setIsBusy] = useState(false);
	const [status, setStatusText] = useState<string>("");
	const [uploadProgress, setUploadProgress] = useState<number>(0);
	const [conversionProgress, setConversionProgress] = useState<number>(0);
	const [isUploading, setIsUploading] = useState(false);
	const { plotters } = usePlotterDiscovery();

	const navigate = useNavigate();

	useEffect(() => {
		if (!isOpen) return;
		setFileName(toGcodeName(defaultFileName));
	}, [defaultFileName, isOpen]);

	useEffect(() => {
		if (!isOpen) return;
		if (!selectedPlotterUrl && plotters.length > 0) {
			setSelectedPlotterUrl(plotters[0].url);
		}
	}, [isOpen, selectedPlotterUrl, plotters]);

	useEffect(() => {
		if (!isOpen) return;
		setUploadProgress(0);
		setConversionProgress(0);
		setIsUploading(false);
		setStatusText("");
		void handleGenerateGcode();
		// Regenerate on open or whenever the document changed.
	}, [isOpen, doc]);

	useEffect(() => {
		invoke<string>("get_gcode_dir").then(setGcodeDir).catch(() => setGcodeDir(null));
	}, []);

	const selectedPlotter = useMemo(
		() => plotters.find((p) => p.url === selectedPlotterUrl) ?? null,
		[plotters, selectedPlotterUrl],
	);

	async function withBusy(task: () => Promise<void>) {
		setIsBusy(true);
		try {
			await task();
		} finally {
			setIsBusy(false);
		}
	}

	function handleGenerateGcode() {
		setIsBusy(true);
		setConversionProgress(0);
		setIsUploading(false);
		setStatusText("Generating GCode…");
		setGcode("");

		const worker = new Worker(
			new URL("../gcodeGeneration/gcodeWorker.ts", import.meta.url),
			{ type: "module" },
		);

		worker.onmessage = (e: MessageEvent<{ type: string; gcode?: string; message?: string; pct?: number; status?: string }>) => {
			if (e.data.type === "progress") {
				if (e.data.pct != null) setConversionProgress(e.data.pct);
				if (e.data.status != null) setStatusText(e.data.status);
				return;
			}
			worker.terminate();
			if (e.data.type === "success" && e.data.gcode != null) {
				const result = e.data.gcode;
				setGcode(result);
				setConversionProgress(100);
				setStatusText(`Generated ${result.split(/\r?\n/).filter(Boolean).length} GCode lines.`);
			} else {
				console.error("GCode conversion failed:", e.data.message);
				setStatusText(`GCode conversion failed: ${e.data.message ?? "unknown error"}`);
			}
			setIsBusy(false);
		};

		worker.onerror = (err) => {
			worker.terminate();
			console.error("GCode worker error:", err);
			setStatusText(`GCode conversion failed: ${err.message}`);
			setIsBusy(false);
		};

		worker.postMessage(doc);
	}

	async function handleSaveAs() {
		await withBusy(async () => {
			if (!gcode.trim()) {
				setStatusText("No GCode to save yet.");
				return;
			}

			const defaultPath = gcodeDir ? `${gcodeDir}/${fileName}` : fileName;
			const selectedPath = await save({
				title: "Save GCode as",
				defaultPath,
				filters: [{ name: "GCode", extensions: ["gcode"] }],
			});

			if (!selectedPath) {
				setStatusText("Save canceled.");
				return;
			}

			try {
				await invoke("save_file", { path: selectedPath, content: gcode });
				await invoke("push_recent_file", { filePath: selectedPath });
				setStatusText(`Saved GCode to ${selectedPath}, opening file...`);

				await new Promise((r) => setTimeout(r, 1000)); // Wait a moment for the user to read the status

				navigate("/gcode", { state: { path: selectedPath } });
			} catch (e) {
				console.error("Save GCode failed:", e);
				setStatusText(`Save failed: ${String(e)}`);
			}
		});
	}

	async function handleUpload(startAfterUpload: boolean) {
		setIsUploading(true);
		setUploadProgress(0);
		let simPct = 0;
		const intervalId = window.setInterval(() => {
			simPct = simPct + (90 - simPct) * 0.08;
			setUploadProgress(Math.round(simPct));
		}, 100);

		await withBusy(async () => {
			if (!selectedPlotter) {
				setStatusText("Select a plotter first.");
				return;
			}
			if (!gcode.trim()) {
				setStatusText("No GCode to upload.");
				return;
			}

			try {
				setStatusText(`Uploading to ${selectedPlotter.url}...`);
				const client = new PlotterClient(selectedPlotter.url);
				await client.uploadFile(fileName, gcode);
				if (startAfterUpload) {
					clearInterval(intervalId);
					setUploadProgress(100);

					await client.startJob(fileName);

					setStatusText(`Upload complete. Jumping to plotter page...`);
					await new Promise((r) => setTimeout(r, 1000)); // Wait a moment for the user to read the status

					navigate("/plotter", { state: { plotter: selectedPlotter } });
				} else {
					clearInterval(intervalId);
					setUploadProgress(100);
					setStatusText("Upload complete.");
				}
			} catch (e) {
				console.error("Upload failed:", e);
				setStatusText(`Upload failed: ${String(e)}`);
			}
		});
	}

	if (!isOpen) return null;

	const progressPhase = isUploading ? "Upload" : "Conversion";
	const progressPercent = isUploading ? uploadProgress : conversionProgress;

	return (
		<div className="fixed inset-0 z-50 flex justify-center items-center bg-black/50 p-4" onClick={onClose}>
			<section
				className="w-full h-[90vh] max-w-5xl rounded-xl border border-slate-700/60 bg-[#0d1017] shadow-2xl overflow-hidden flex flex-col"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<header className="flex items-center justify-between border-b border-slate-700/60 px-4 py-2 shrink-0">
					<div className="flex items-center gap-3">
						<span className="text-sm font-semibold text-gray-200">Export to GCode</span>
						<span className="text-xs text-slate-600 hidden md:block">Preview and upload to a plotter, or save to a file.</span>
					</div>
					<button
						onClick={onClose}
						className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${btnSlate}`}
					>
						Close
					</button>
				</header>

				{/* Progress bar */}
				<div className="px-4 pt-3 pb-2 border-b border-slate-700/60 shrink-0">
					<div className="flex items-center justify-between mb-1.5">
						<p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{progressPhase}</p>
						<p className="text-xs text-slate-600 tabular-nums">{progressPercent}%</p>
					</div>
					<div className="w-full h-1.5 rounded-full bg-[#0a0c10] overflow-hidden border border-slate-700/60">
						<div
							className="h-full bg-blue-500/80 rounded-full transition-all duration-500 ease-out"
							style={{ width: `${progressPercent}%` }}
						/>
					</div>
					<p className="text-xs text-slate-600 mt-1.5 h-4">{status}</p>
				</div>

				{/* Main Content */}
				<div className="flex-1 overflow-hidden flex gap-0">
					{/* GCode Preview */}
					<div className="flex-1 flex flex-col min-w-0 border-r border-slate-700/60">
						<div className="px-4 pt-3 pb-2 shrink-0 border-b border-slate-700/60">
							<p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">GCode Preview</p>
						</div>
						<div className="flex-1 overflow-auto bg-[#0a0c10]">
							{gcode ? (
								<div className="p-3 font-mono text-xs text-slate-400 leading-relaxed">
									{gcode.split(/\r?\n/).map((line, idx) => (
										<div key={idx} className="hover:bg-slate-800/40 flex px-1 py-0.5 transition-colors">
											<span className="text-slate-700 w-8 shrink-0 text-right tabular-nums select-none">{idx + 1}</span>
											<span className="ml-3 text-slate-300">{line}</span>
										</div>
									))}
								</div>
							) : (
								<div className="flex items-center justify-center h-full text-xs text-slate-600 italic">
									{isBusy ? "Generating GCode…" : "Ready"}
								</div>
							)}
						</div>
						{/* Footer stat */}
						<div className="px-4 py-2 border-t border-slate-700/60 shrink-0">
							<p className="text-xs text-slate-600">
								{gcode
									? `${gcode.split(/\r?\n/).filter(Boolean).length} lines · ${gcode.length >= 1024 ? `${(gcode.length / 1024).toFixed(1)} KB` : `${gcode.length} B`}`
									: "—"}
							</p>
						</div>
					</div>

					{/* Controls Panel */}
					<div className="w-72 flex flex-col shrink-0 overflow-y-auto">
						{/* File name */}
						<div className="px-4 pt-3 pb-4 border-b border-slate-700/60">
							<p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Output File</p>
							<input
								type="text"
								value={fileName}
								onChange={(e) => setFileName(e.target.value)}
								className="w-full px-2 py-1.5 rounded-md bg-[#0a0c10] border border-slate-700/60 text-xs text-slate-300 outline-none focus:border-blue-500/50 transition-colors disabled:opacity-50"
								placeholder="Filename"
								disabled={isBusy}
							/>
						</div>
					

						{/* Plotter */}
						<div className="px-4 pt-3 pb-4 border-b border-slate-700/60">
							<p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Plotter</p>
							
							<InlineDropdown
								value={selectedPlotter}
								options={plotters}
								onChange={(p) => setSelectedPlotterUrl(p.url)}
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
								onClick={handleSaveAs}
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
								onClick={() => handleUpload(false)}
								disabled={isBusy || !gcode.trim() || !selectedPlotter}
							className={`flex items-center gap-2 px-4 py-1.5 text-sm ${btnSlate}`}
							>
								<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
									<path d="M3 8v5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8M8 1v8M5 4l3-3 3 3" />
								</svg>
								Upload
							</button>

							<button
								onClick={() => handleUpload(true)}
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
				</div>
			</section>
		</div>
	);
}
