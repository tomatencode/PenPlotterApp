import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { PlotterClient } from "../../../plotter/api/plotterClient";
import { usePlotterDiscovery } from "../../../plotter/discoveryContext";
import { PnplttrDocument } from "../../types";
import { GcodeHeader } from "./GcodeHeader";
import { GcodeProgressBar } from "./GcodeProgressBar";
import { GcodePreviewPanel } from "./GcodePreviewPanel";
import { GcodeControlsPanel } from "./GcodeControlsPanel";

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
			new URL("../../gcodeGeneration/gcodeWorker.ts", import.meta.url),
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

				await new Promise((r) => setTimeout(r, 1000));

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
					await new Promise((r) => setTimeout(r, 1000));

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
				<GcodeHeader onClose={onClose} />
				<GcodeProgressBar phase={progressPhase} percent={progressPercent} status={status} />
				<div className="flex-1 overflow-hidden flex gap-0">
					<GcodePreviewPanel gcode={gcode} isBusy={isBusy} />
					<GcodeControlsPanel
						fileName={fileName}
						onFileNameChange={setFileName}
						isBusy={isBusy}
						gcode={gcode}
						selectedPlotter={selectedPlotter}
						plotters={plotters}
						onPlotterChange={setSelectedPlotterUrl}
						onSaveAs={handleSaveAs}
						onUpload={handleUpload}
					/>
				</div>
			</section>
		</div>
	);
}
