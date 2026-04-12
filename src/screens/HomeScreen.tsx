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
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Pen Plotter Interfacer</h1>

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
            className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-600 focus:border-indigo-500 outline-none text-sm w-56"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium text-sm transition-colors"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => { setShowNameInput(false); setNewName(""); }}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium text-sm transition-colors"
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex gap-4">
          <button
            onClick={() => setShowNameInput(true)}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors"
          >
            New Document
          </button>
          <button
            onClick={handleOpen}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
          >
            Open File…
          </button>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      {recentFiles.length > 0 && (
        <div className="w-full max-w-xl">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Recent Files
          </h2>
          <ul className="flex flex-col gap-1">
            {recentFiles.map((filePath) => (
              <li key={filePath}>
                <button
                  onClick={() => handleOpenRecent(filePath)}
                  className="w-full text-left px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-sm"
                  title={filePath}
                >
                  <span className="font-medium">
                    {filePath.split(/[\\/]/).pop()}
                  </span>
                  <span className="block text-xs text-gray-500 truncate">{filePath}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

