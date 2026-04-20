import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { PlotterClient } from "../api/plotterClient";
import PlotterDetailsRow from "../components/common/PlotterDetailsRow";
import { usePlotterDiscovery } from "../context/PlotterDiscoveryContext";

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
  const [showPlotterDropdown, setShowPlotterDropdown] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatusText] = useState<string>("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

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

  const lines = gcode.split(/\r?\n/);
  const fileName = path ? path.split(/[\\/]/).pop() ?? "untitled.gcode" : "untitled.gcode";

  function syncScroll() {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }

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
      {/* Toolbar */}
      <header className="h-11 flex items-center gap-2 border-b border-slate-700/60 bg-[#0d1017] px-3 shrink-0">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors text-sm"
        >
          <svg
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3.5 h-3.5"
          >
            <path d="M8 2L4 6l4 4" />
          </svg>
          Home
        </button>

        <div className="h-4 w-px bg-slate-700/60" />

        <span className="text-sm font-medium text-gray-300 truncate">{fileName}</span>

        <div className="flex-1" />

        {path && (
          <button
            onClick={handleSave}
            disabled={isBusy}
            className="px-3 py-1.5 bg-slate-700/60 hover:bg-slate-600/60 border border-slate-600/60 rounded-lg text-xs font-semibold text-slate-200 transition-colors disabled:opacity-40"
          >
            Save
          </button>
        )}
        <button
          onClick={handleSaveAs}
          disabled={isBusy}
          className="px-3 py-1.5 bg-slate-700/60 hover:bg-slate-600/60 border border-slate-600/60 rounded-lg text-xs font-semibold text-slate-200 transition-colors disabled:opacity-40"
        >
          Save As…
        </button>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* GCode Editor */}
        <div className="flex-1 flex overflow-hidden bg-[#0a0c10]">
          {/* Line numbers */}
          <div
            ref={lineNumbersRef}
            className="w-12 shrink-0 overflow-hidden text-right font-mono text-xs text-slate-700 select-none bg-[#0a0c10] border-r border-slate-800 pt-3 pb-3 pr-2"
            aria-hidden="true"
          >
            {lines.map((_, i) => (
              <div key={i} className="leading-6 px-1">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Editor */}
          <textarea
            ref={textareaRef}
            value={gcode}
            onChange={(e) => setGcode(e.target.value)}
            onScroll={syncScroll}
            spellCheck={false}
            className="flex-1 min-w-0 resize-none bg-transparent font-mono text-xs text-slate-300 leading-6 p-3 outline-none caret-blue-400 placeholder-slate-700"
            placeholder="Paste or type GCode here…"
          />
        </div>

        {/* Controls panel */}
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
                            setSelectedPlotterUrl(plotter.url);
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
              onClick={() => handleUpload(false)}
              disabled={isBusy || !gcode.trim() || !selectedPlotter}
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
              onClick={() => handleUpload(true)}
              disabled={isBusy || !gcode.trim() || !selectedPlotter}
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
              onClick={handleStream}
              disabled={isBusy || !gcode.trim() || !selectedPlotter}
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

          <div className="px-4 pb-4 mt-auto">
            <p className="text-xs text-slate-600 leading-relaxed">
              Upload & Start begins plotting immediately. Stream Live sends commands line by line.
            </p>
          </div>
        </aside>
      </div>

      {/* Status bar */}
      <footer className="h-6 border-t border-slate-700/60 bg-[#0d1017] flex items-center px-4 shrink-0">
        <p className="text-xs text-slate-600 truncate">{status || "Ready"}</p>
      </footer>
    </div>
  );
}
