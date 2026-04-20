import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { PlotterApiError, PlotterClient } from "../../api/plotterClient";
import type { Plotter } from "../../context/PlotterDiscoveryContext";

interface Props {
	isOpen: boolean;
	onClose: () => void;
	documentJson: string;
	defaultFileName: string;
	plotters: Plotter[];
}

function toGcodeName(fileName: string): string {
	const base = fileName.replace(/\.[^/.]+$/, "").trim() || "untitled";
	return `${base}.gcode`;
}

export default function GcodePopup({
	isOpen,
	onClose,
	documentJson,
	defaultFileName,
	plotters,
}: Props) {
	const [gcode, setGcode] = useState<string>("");
	const [selectedPlotterUrl, setSelectedPlotterUrl] = useState<string>("");
	const [fileName, setFileName] = useState<string>(toGcodeName(defaultFileName));
	const [isBusy, setIsBusy] = useState(false);
	const [status, setStatus] = useState<string>("");

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
		void handleGenerateGcode();
		// Regenerate on open or whenever the document changed.
	}, [isOpen, documentJson]);

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

	async function handleGenerateGcode() {
		await withBusy(async () => {
			setStatus("Generating GCode...");
			try {
				const result = await invoke<string>("convert_document_to_gcode", { json: documentJson });
				setGcode(result);
				setStatus(`Generated ${result.split(/\r?\n/).filter(Boolean).length} GCode lines.`);
			} catch (e) {
				console.error("GCode conversion failed:", e);
				setStatus(`GCode conversion failed: ${String(e)}`);
			}
		});
	}

	async function handleSaveAs() {
		await withBusy(async () => {
			if (!gcode.trim()) {
				setStatus("No GCode to save yet.");
				return;
			}

			const selectedPath = await save({
				title: "Save GCode as",
				defaultPath: fileName,
				filters: [{ name: "GCode", extensions: ["gcode"] }],
			});

			if (!selectedPath) {
				setStatus("Save canceled.");
				return;
			}

			try {
				await invoke("save_gcode_file", { path: selectedPath, content: gcode });
				setStatus(`Saved GCode to ${selectedPath}`);
			} catch (e) {
				console.error("Save GCode failed:", e);
				setStatus(`Save failed: ${String(e)}`);
			}
		});
	}

	async function handleUpload(startAfterUpload: boolean) {
		await withBusy(async () => {
			if (!selectedPlotter) {
				setStatus("Select a plotter first.");
				return;
			}
			if (!gcode.trim()) {
				setStatus("No GCode to upload.");
				return;
			}

			try {
				setStatus(`Uploading to ${selectedPlotter.url}...`);
				const client = new PlotterClient(selectedPlotter.url);
				await client.uploadFile(fileName, gcode);
				if (startAfterUpload) {
					await client.startJob(fileName);
					setStatus("Upload complete. Job started.");
				} else {
					setStatus("Upload complete.");
				}
			} catch (e) {
				console.error("Upload failed:", e);
				setStatus(`Upload failed: ${String(e)}`);
			}
		});
	}

	async function handleStream() {
		await withBusy(async () => {
			if (!selectedPlotter) {
				setStatus("Select a plotter first.");
				return;
			}
			if (!gcode.trim()) {
				setStatus("No GCode to stream.");
				return;
			}

			const lines = gcode
				.split(/\r?\n/)
				.map((l) => l.trim())
				.filter((l) => l.length > 0 && !l.startsWith(";"));

			try {
				const client = new PlotterClient(selectedPlotter.url);
				for (let i = 0; i < lines.length; i += 1) {
                    try {
					await client.executeGCode(lines[i]);
                    } catch (e) {
                        if (e instanceof PlotterApiError) {
                            if (e.status === 500) {
                                // buffer full
                                setStatus("Buffer full, waiting to send more...");
                                await new Promise((res) => setTimeout(res, 500));
                                i -= 1; // retry the same line
                                continue;
                            } else {
                                throw e;
                            }
                        }
                    }
					setStatus(`Streaming ${i + 1}/${lines.length}...`);
				}
				setStatus(`Streaming complete (${lines.length} lines).`);
			} catch (e) {
				console.error("Stream failed:", e);
				setStatus(`Stream failed: ${String(e)}`);
			}
		});
	}

	if (!isOpen) return null;

	const progressPercent = gcode ? 100 : isBusy ? 45 : 0;

	return (
		<div className="fixed inset-0 z-50 flex justify-center items-center bg-black/50 p-4">
			<section
				className="w-full h-[90vh] max-w-5xl rounded-xl border border-slate-700/60 bg-[#0d1017] shadow-2xl overflow-hidden flex flex-col"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<header className="flex items-center justify-between border-b border-slate-700/60 px-4 py-2 shrink-0">
					<div className="flex items-center gap-3">
						<span className="text-sm font-semibold text-gray-200">Export to GCode</span>
						<span className="text-xs text-slate-600 hidden md:block">Preview, save, upload, or stream directly to a plotter.</span>
					</div>
					<button
						onClick={onClose}
						className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/60 hover:bg-slate-600/60 border border-slate-600/60 hover:border-slate-500 rounded-lg text-sm font-semibold text-slate-200 transition-colors"
					>
						Close
					</button>
				</header>

				{/* Progress bar */}
				<div className="px-4 pt-3 pb-2 border-b border-slate-700/60 shrink-0">
					<div className="flex items-center justify-between mb-1.5">
						<p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Conversion</p>
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
								{gcode ? `${gcode.split(/\r?\n/).filter(Boolean).length} lines` : "—"}
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
							<select
								value={selectedPlotterUrl}
								onChange={(e) => setSelectedPlotterUrl(e.target.value)}
								className="w-full appearance-none px-2 py-1.5 rounded-md bg-[#0a0c10] border border-slate-700/60 text-xs text-slate-300 outline-none focus:border-blue-500/50 transition-colors disabled:opacity-50"
								disabled={isBusy || plotters.length === 0}
							>
								{plotters.length === 0 ? (
									<option>No plotters found</option>
								) : (
									plotters.map((p) => (
										<option key={p.url} value={p.url}>
											{p.displayInfo.name || p.url}
										</option>
									))
								)}
							</select>
							{selectedPlotter && (
								<p className="text-xs text-slate-600 mt-1.5">
									Status: <span className="text-green-500">Connected</span>
								</p>
							)}
						</div>

						{/* Actions */}
						<div className="px-4 pt-3 pb-4 flex flex-col gap-2">
							<p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Actions</p>

							<button
								onClick={handleSaveAs}
								disabled={isBusy || !gcode.trim()}
								className="flex items-center gap-2 px-4 py-1.5 bg-slate-700/60 hover:bg-slate-600/60 border border-slate-600/60 hover:border-slate-500 rounded-lg text-sm font-semibold text-slate-200 transition-colors disabled:opacity-40 disabled:pointer-events-none"
							>
								<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
									<path d="M13 11v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2M8 10V3M5 6l3-3 3 3" />
								</svg>
								Save As
							</button>

							<button
								onClick={() => handleUpload(false)}
								disabled={isBusy || !gcode.trim() || !selectedPlotter}
								className="flex items-center gap-2 px-4 py-1.5 bg-slate-700/60 hover:bg-slate-600/60 border border-slate-600/60 hover:border-slate-500 rounded-lg text-sm font-semibold text-slate-200 transition-colors disabled:opacity-40 disabled:pointer-events-none"
							>
								<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
									<path d="M3 8v5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8M8 1v8M5 4l3-3 3 3" />
								</svg>
								Upload
							</button>

							<button
								onClick={() => handleUpload(true)}
								disabled={isBusy || !gcode.trim() || !selectedPlotter}
								className="flex items-center gap-2 px-4 py-1.5 bg-green-700/80 hover:bg-green-600/80 border border-green-600/60 hover:border-green-500 rounded-lg text-sm font-semibold text-green-100 transition-colors disabled:opacity-40 disabled:pointer-events-none shadow-sm shadow-green-900/30"
							>
								<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
									<polygon points="4,2 13,8 4,14" fill="currentColor" stroke="none" />
								</svg>
								Upload & Start
							</button>

							<button
								onClick={handleStream}
								disabled={isBusy || !gcode.trim() || !selectedPlotter}
								className="flex items-center gap-2 px-4 py-1.5 bg-green-700/80 hover:bg-green-600/80 border border-green-600/60 hover:border-green-500 rounded-lg text-sm font-semibold text-green-100 transition-colors disabled:opacity-40 disabled:pointer-events-none shadow-sm shadow-green-900/30"
							>
								<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
									<path d="M3 8h4M9 4l4 4-4 4M9 8h4" />
								</svg>
								Stream Live
							</button>
						</div>

						{/* Hint */}
						<div className="px-4 pb-4 mt-auto">
							<p className="text-xs text-slate-600 leading-relaxed">
								Upload & Start begins plotting immediately. Stream Live sends commands line by line.
							</p>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}
