import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

interface OpenedDocument {
  path: string;
  json: string;
}

// ── Plotter stub types (will be driven by API later) ─────────────────────
type PlotterState = "idle" | "running" | "paused" | "error" | "offline";

interface Plotter {
  id: string;
  name: string;
  url: string;
  state: PlotterState;
}

const STATE_STYLES: Record<PlotterState, { dot: string; label: string; text: string }> = {
  idle:    { dot: "bg-green-400",  label: "Idle",    text: "text-green-400"  },
  running: { dot: "bg-blue-400 animate-pulse", label: "Running", text: "text-blue-400" },
  paused:  { dot: "bg-yellow-400", label: "Paused",  text: "text-yellow-400" },
  error:   { dot: "bg-red-500",    label: "Error",   text: "text-red-400"    },
  offline: { dot: "bg-slate-600",  label: "Offline", text: "text-slate-500"  },
};

// Placeholder plotters — replace with real fetch later
const STUB_PLOTTERS: Plotter[] = [
  { id: "plotter-1", name: "Plotter 1", url: "http://plotter.local", state: "idle" },
];

export default function HomeScreen() {
  const navigate = useNavigate();
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNameInput, setShowNameInput] = useState(false);
  const [newName, setNewName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [plotters] = useState<Plotter[]>(STUB_PLOTTERS);

  function refreshRecents() {
    invoke<string[]>("get_recent_files").then(setRecentFiles).catch(console.error);
  }

  useEffect(() => { refreshRecents(); }, []);
  useEffect(() => { if (showNameInput) nameInputRef.current?.focus(); }, [showNameInput]);

  async function handleCreate() {
    const name = newName.trim() || "Untitled";
    setShowNameInput(false);
    setNewName("");
    setError(null);
    try {
      const doc = await invoke<OpenedDocument>("create_document", { name });
      navigate("/document", { state: { json: doc.json, path: doc.path } });
    } catch (e) { setError(String(e)); }
  }

  async function handleOpen() {
    setError(null);
    try {
      const selected = await open({
        title: "Open .pnplttr file",
        filters: [{ name: "Pen Plotter Document", extensions: ["pnplttr"] }],
        multiple: false,
      });
      if (!selected) return;
      const path = typeof selected === "string" ? selected : (selected as string[])[0];
      const doc = await invoke<OpenedDocument>("open_document", { path });
      navigate("/document", { state: { json: doc.json, path: doc.path } });
    } catch (e) { setError(String(e)); }
  }

  async function handleOpenRecent(path: string) {
    setError(null);
    try {
      const doc = await invoke<OpenedDocument>("open_document", { path });
      navigate("/document", { state: { json: doc.json, path: doc.path } });
    } catch (e) {
      setError(String(e));
      refreshRecents();
    }
  }

  return (
    <div className="h-full bg-[#0a0c10] text-gray-100 flex overflow-hidden">

      {/* ── Left sidebar ── */}
      <aside className="w-72 shrink-0 flex flex-col border-r border-slate-700/60 bg-[#0d1017] overflow-y-auto">

        {/* Branding */}
        <div className="px-6 pt-7 pb-5">
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-br from-blue-400 via-purple-400 to-green-400 bg-clip-text text-transparent leading-tight">
            Pen Plotter<br />Interfacer
          </h1>
          <p className="mt-1.5 text-xs text-slate-600">Create and manage your plotter documents</p>
        </div>

        <div className="h-px bg-slate-800 mx-4" />

        {/* ── Documents ── */}
        <div className="px-4 py-4 flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest px-2 mb-1">Documents</p>

          {showNameInput ? (
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="flex flex-col gap-2 px-1">
              <input
                ref={nameInputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Document name…"
                className="w-full px-3 py-2 rounded-lg bg-[#0a0c10] border border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 outline-none text-sm text-gray-100 placeholder-slate-500"
              />
              <div className="flex gap-2">
                <button type="submit" className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 border border-blue-500 rounded-lg font-semibold text-sm transition-colors">
                  Create
                </button>
                <button type="button" onClick={() => { setShowNameInput(false); setNewName(""); }}
                  className="flex-1 px-3 py-2 bg-transparent hover:bg-slate-800 border border-slate-700 rounded-lg font-medium text-sm text-slate-400 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <button onClick={() => setShowNameInput(true)}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 bg-blue-600 hover:bg-blue-500 border border-blue-500 rounded-lg font-semibold text-sm transition-colors text-left">
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5 shrink-0">
                  <path d="M6 1v10M1 6h10" />
                </svg>
                New Document
              </button>
              <button onClick={handleOpen}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 bg-transparent hover:bg-slate-800/70 border border-slate-700/60 hover:border-slate-600 rounded-lg font-medium text-sm text-slate-300 transition-colors text-left">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                  <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3H7l2 2h3.5A1.5 1.5 0 0 1 14 6.5V12a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12V4.5z" />
                </svg>
                Open File…
              </button>
            </>
          )}

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-950/60 border border-red-700/60 text-red-400 text-xs">{error}</div>
          )}
        </div>

        <div className="h-px bg-slate-800 mx-4" />

        {/* ── Pen Presets ── */}
        <div className="px-4 py-4">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest px-2 mb-1.5">Tools</p>
          <button
            onClick={() => navigate("/pens")}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-purple-300 hover:bg-slate-800/60 border border-transparent hover:border-purple-500/20 transition-colors text-left group"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 group-hover:stroke-purple-400 transition-colors">
              <path d="M11 2l3 3-8 8H3v-3L11 2z" />
              <path d="M9 4l3 3" />
            </svg>
            Pen Presets
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 ml-auto text-slate-700 group-hover:text-slate-500 transition-colors shrink-0">
              <path d="M4 2l4 4-4 4" />
            </svg>
          </button>
        </div>

        <div className="h-px bg-slate-800 mx-4" />

        {/* ── Plotters ── */}
        <div className="px-4 py-4 flex flex-col gap-2">
          <div className="flex items-center justify-between px-2 mb-0.5">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest">Plotters</p>
            <button
              title="Add plotter"
              className="w-5 h-5 flex items-center justify-center rounded text-slate-700 hover:text-blue-400 hover:bg-slate-800 transition-colors"
            >
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3 h-3">
                <path d="M6 1v10M1 6h10" />
              </svg>
            </button>
          </div>

          {plotters.length === 0 ? (
            <p className="text-xs text-slate-700 px-2 italic">No plotters configured</p>
          ) : (
            plotters.map((plotter) => {
              const style = STATE_STYLES[plotter.state];
              return (
                <button
                  key={plotter.id}
                  onClick={() => navigate("/plotter", { state: { id: plotter.id } })}
                  className="flex items-center gap-3 w-full px-3 py-3 rounded-lg bg-[#0a0c10] hover:bg-slate-800/60 border border-slate-700/50 hover:border-blue-500/30 transition-colors group text-left"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 group-hover:text-blue-300 transition-colors leading-tight">{plotter.name}</p>
                    <p className="text-xs text-slate-600 truncate">{plotter.url}</p>
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

        <div className="flex-1" />
        <p className="px-6 py-4 text-xs text-slate-800">PenPlotter App</p>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 pt-6 pb-3 shrink-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Recent Files</p>
        </div>

        <div className="flex-1 overflow-auto px-6 pb-6">
          {recentFiles.length > 0 ? (
            <ul className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 content-start">
              {recentFiles.map((filePath) => (
                <li key={filePath}>
                  <button
                    onClick={() => handleOpenRecent(filePath)}
                    className="w-full h-full text-left px-5 py-4 rounded-xl bg-[#111520] hover:bg-[#141926] border border-slate-700/50 hover:border-green-500/40 transition-colors group shadow-sm shadow-black/30"
                    title={filePath}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-slate-600 group-hover:text-green-400 transition-colors text-base leading-none shrink-0">⬡</span>
                      <div className="min-w-0">
                        <span className="block font-semibold text-sm text-gray-200 group-hover:text-green-300 transition-colors truncate">
                          {filePath.split(/[\\/]/).pop()}
                        </span>
                        <span className="block text-xs text-slate-600 truncate mt-1">{filePath}</span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 text-center h-full">
              <span className="text-5xl opacity-10 select-none">⬡</span>
              <p className="text-slate-600 text-sm">No recent files</p>
              <p className="text-slate-700 text-xs">Create a new document or open an existing one to get started</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}