import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

interface OpenedDocument {
  path: string;
  json: string;
}

export default function HomeScreen() {
  const navigate = useNavigate();
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNameInput, setShowNameInput] = useState(false);
  const [newName, setNewName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  function refreshRecents() {
    invoke<string[]>("get_recent_files").then(setRecentFiles).catch(console.error);
  }

  useEffect(() => {
    refreshRecents();
  }, []);

  useEffect(() => {
    if (showNameInput) {
      nameInputRef.current?.focus();
    }
  }, [showNameInput]);

  async function handleCreate() {
    const name = newName.trim() || "Untitled";
    setShowNameInput(false);
    setNewName("");
    setError(null);
    try {
      const doc = await invoke<OpenedDocument>("create_document", { name });
      navigate("/document", { state: { json: doc.json, path: doc.path } });
    } catch (e) {
      setError(String(e));
    }
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
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleOpenRecent(path: string) {
    setError(null);
    try {
      const doc = await invoke<OpenedDocument>("open_document", { path });
      navigate("/document", { state: { json: doc.json, path: doc.path } });
    } catch (e) {
      setError(String(e));
      // Remove stale entry and refresh
      refreshRecents();
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0c10] text-gray-100 flex">

      {/* ── Left sidebar ── */}
      <aside className="w-72 shrink-0 flex flex-col justify-between border-r border-slate-700/60 bg-[#0d1017] p-8">
        <div className="flex flex-col gap-8">
          {/* Branding */}
          <div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight bg-gradient-to-br from-blue-400 via-purple-400 to-green-400 bg-clip-text text-transparent leading-tight">
              Pen Plotter<br />Interfacer
            </h1>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Create and manage your plotter documents
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {showNameInput ? (
              <form
                onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
                className="flex flex-col gap-2"
              >
                <input
                  ref={nameInputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Document name…"
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0c10] border border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 outline-none text-sm text-gray-100 placeholder-slate-500"
                />
                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 border border-blue-500 rounded-lg font-semibold text-sm transition-colors shadow-sm shadow-blue-900/40"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNameInput(false); setNewName(""); }}
                  className="w-full px-4 py-2 bg-transparent hover:bg-slate-800 border border-slate-700 rounded-lg font-medium text-sm text-slate-400 transition-colors"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <button
                  onClick={() => setShowNameInput(true)}
                  className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 border border-blue-500 rounded-lg font-semibold text-sm transition-colors shadow-sm shadow-blue-900/40 text-left"
                >
                  + New Document
                </button>
                <button
                  onClick={handleOpen}
                  className="w-full px-4 py-2.5 bg-transparent hover:bg-slate-800 border border-slate-700 hover:border-purple-500/60 rounded-lg font-semibold text-sm text-slate-300 transition-colors text-left"
                >
                  Open File…
                </button>
              </>
            )}

            {error && (
              <div className="mt-1 px-3 py-2 rounded-lg bg-red-950/60 border border-red-700/60 text-red-400 text-xs">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-slate-700">PenPlotter App</p>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col p-8 overflow-auto">
        {recentFiles.length > 0 ? (
          <>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
              Recent Files
            </h2>
            <ul className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 content-start">
              {recentFiles.map((filePath) => (
                <li key={filePath}>
                  <button
                    onClick={() => handleOpenRecent(filePath)}
                    className="w-full h-full text-left px-5 py-4 rounded-xl bg-[#111520] hover:bg-[#141926] border border-slate-700/50 hover:border-green-500/40 transition-colors group shadow-sm shadow-black/30"
                    title={filePath}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-slate-600 group-hover:text-green-400 transition-colors text-base leading-none">⬡</span>
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
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <span className="text-5xl opacity-10 select-none">⬡</span>
            <p className="text-slate-600 text-sm">No recent files</p>
            <p className="text-slate-700 text-xs">Create a new document or open an existing one to get started</p>
          </div>
        )}
      </main>
    </div>
  );
}

