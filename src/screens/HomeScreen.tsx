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
    <div className="min-h-screen bg-[#0a0c10] text-gray-100 flex flex-col items-center justify-center gap-8 p-8">
      {/* Title */}
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-purple-400 to-green-400 bg-clip-text text-transparent">
          Pen Plotter Interfacer
        </h1>
        <p className="mt-2 text-sm text-slate-500">Create and manage your plotter documents</p>
      </div>

      {/* Action card */}
      <div className="w-full max-w-xl bg-[#111520] border border-slate-700/60 rounded-xl p-6 shadow-lg shadow-black/40">
        {showNameInput ? (
          <form
            onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
            className="flex gap-2 items-center"
          >
            <input
              ref={nameInputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Document name…"
              className="flex-1 px-4 py-2 rounded-lg bg-[#0a0c10] border border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 outline-none text-sm text-gray-100 placeholder-slate-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 border border-blue-500 rounded-lg font-medium text-sm transition-colors shadow-sm shadow-blue-900/40"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => { setShowNameInput(false); setNewName(""); }}
              className="px-4 py-2 bg-[#0a0c10] hover:bg-slate-800 border border-slate-600 rounded-lg font-medium text-sm text-slate-300 transition-colors"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => setShowNameInput(true)}
              className="flex-1 px-5 py-3 bg-blue-600 hover:bg-blue-500 border border-blue-500 rounded-lg font-semibold text-sm transition-colors shadow-sm shadow-blue-900/40"
            >
              + New Document
            </button>
            <button
              onClick={handleOpen}
              className="flex-1 px-5 py-3 bg-[#0a0c10] hover:bg-slate-800 border border-slate-600 hover:border-purple-500/60 rounded-lg font-semibold text-sm text-slate-200 transition-colors"
            >
              Open File…
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 px-4 py-2 rounded-lg bg-red-950/60 border border-red-700/60 text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Recent files card */}
      {recentFiles.length > 0 && (
        <div className="w-full max-w-xl bg-[#111520] border border-slate-700/60 rounded-xl p-5 shadow-lg shadow-black/40">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
            Recent Files
          </h2>
          <ul className="flex flex-col gap-1">
            {recentFiles.map((filePath) => (
              <li key={filePath}>
                <button
                  onClick={() => handleOpenRecent(filePath)}
                  className="w-full text-left px-4 py-3 rounded-lg bg-[#0a0c10] hover:bg-slate-800/80 border border-slate-700/40 hover:border-green-500/40 transition-colors text-sm group"
                  title={filePath}
                >
                  <span className="font-medium text-gray-200 group-hover:text-green-300 transition-colors">
                    {filePath.split(/[\\/]/).pop()}
                  </span>
                  <span className="block text-xs text-slate-600 truncate mt-0.5">{filePath}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

