import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { PlotterClient } from "../api/plotterClient";
import { usePlotterDiscovery } from "../context/PlotterDiscoveryContext";
import GcodeToolbar from "../components/gcode/GcodeToolbar";
import GcodeEditor from "../components/gcode/GcodeEditor";
import GcodeControlsPanel from "../components/gcode/GcodeControlsPanel";

interface LocationState {
  gcodeContent: string;
  path: string | null;
}

export default function GcodeScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { plotters } = usePlotterDiscovery();
  const { gcodeContent: initialContent, path } = (location.state as LocationState) ?? {
    gcodeContent: "",
    path: null,
  };

  const [gcode, setGcode] = useState(initialContent);
  const [gcodeDir, setGcodeDir] = useState<string | null>(null);
  const [selectedPlotterUrl, setSelectedPlotterUrl] = useState<string>("");
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatusText] = useState<string>("");

  useEffect(() => {
    invoke<string>("get_gcode_dir").then(setGcodeDir).catch(() => setGcodeDir(null));
  }, []);

  useEffect(() => {
    if (!selectedPlotterUrl && plotters.length > 0) {
      setSelectedPlotterUrl(plotters[0].url);
    }
  }, [plotters, selectedPlotterUrl]);

  const selectedPlotter = useMemo(
    () => plotters.find((p) => p.url === selectedPlotterUrl) ?? null,
    [plotters, selectedPlotterUrl],
  );

  const fileName = path ? path.split(/[\\/]/).pop() ?? "untitled.gcode" : "untitled.gcode";


  async function withBusy(task: () => Promise<void>) {
    setIsBusy(true);
    try {
      await task();
    } finally {
      setIsBusy(false);
    }
  }

  const handleSave = useCallback(async () => {
    if (!path) return;
    try {
      await invoke("save_gcode_file", { path, content: gcode });
      setStatusText("Saved.");
    } catch (e) {
      setStatusText(`Save failed: ${String(e)}`);
    }
  }, [path, gcode]);

  async function handleSaveAs() {
    await withBusy(async () => {
      const baseName = fileName.replace(/\.[^/.]+$/, "").trim() || "untitled";
      const defaultFileName = `${baseName}.gcode`;
      const defaultPath = gcodeDir ? `${gcodeDir}/${defaultFileName}` : defaultFileName;
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
        await invoke("save_gcode_file", { path: selectedPath, content: gcode });
        setStatusText(`Saved to ${selectedPath}`);
      } catch (e) {
        setStatusText(`Save failed: ${String(e)}`);
      }
    });
  }

  async function handleUpload(startAfterUpload: boolean) {
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
        setStatusText(`Uploading to ${selectedPlotter.url}…`);
        const client = new PlotterClient(selectedPlotter.url);
        await client.uploadFile(fileName, gcode);
        if (startAfterUpload) {
          await client.startJob(fileName);
          setStatusText("Upload complete. Job started.");
          navigate("/plotter", { state: { plotter: selectedPlotter } });
        } else {
          setStatusText("Upload complete.");
        }
      } catch (e) {
        setStatusText(`Upload failed: ${String(e)}`);
      }
    });
  }

  async function handleStream() {
    setStatusText("Streaming is not yet implemented.");
  }

  // Ctrl/Cmd+S to save
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (path) {
          void handleSave();
        } else {
          void handleSaveAs();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave, path]);

  return (
    <div className="h-full bg-[#0a0c10] text-gray-100 flex flex-col overflow-hidden">
      <GcodeToolbar
        fileName={fileName}
        hasPath={!!path}
        isBusy={isBusy}
        onBack={() => navigate("/")}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
      />

      <div className="flex-1 flex overflow-hidden">
        <GcodeEditor gcode={gcode} onChange={setGcode} />

        <GcodeControlsPanel
          gcode={gcode}
          plotters={plotters}
          selectedPlotter={selectedPlotter}
          isBusy={isBusy}
          onSelectPlotter={setSelectedPlotterUrl}
          onUpload={() => handleUpload(false)}
          onUploadAndStart={() => handleUpload(true)}
          onStream={handleStream}
        />
      </div>

      <footer className="h-6 border-t border-slate-700/60 bg-[#0d1017] flex items-center px-4 shrink-0">
        <p className="text-xs text-slate-600 truncate">{status || "Ready"}</p>
      </footer>
    </div>
  );
}
