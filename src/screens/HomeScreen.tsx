import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getVersion } from "@tauri-apps/api/app";
import DocumentActions from "../features/home/components/DocumentActions";
import PlotterList from "../features/home/components/PlotterList";
import RecentFilesList from "../features/home/components/RecentFilesList";
import { usePlotterDiscovery } from "../features/plotter/discoveryContext";
import { DEFAULT_DOCUMENT } from "../features/document/constants";

export default function HomeScreen() {
  const navigate = useNavigate();
  const { plotters } = usePlotterDiscovery();
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNameInput, setShowNameInput] = useState(false);
  const [newName, setNewName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [version, setVersion] = useState<string>("");

  function refreshRecents() {
    invoke<string[]>("get_recent_files").then(setRecentFiles).catch(console.error);
  }

  useEffect(() => { refreshRecents(); }, []);
  useEffect(() => { getVersion().then(setVersion); }, []);
  useEffect(() => { if (showNameInput) nameInputRef.current?.focus(); }, [showNameInput]);

  async function handleCreateDocument() {
    const name = newName.trim() || "Untitled";
    setShowNameInput(false);
    setNewName("");
    setError(null);
    try {
      const document_dir = await invoke<string>("get_documents_dir");
      const fullPath = `${document_dir}/${name}.pnplttr`;
      await invoke("save_file", { path: fullPath, content: JSON.stringify(DEFAULT_DOCUMENT) });
      await invoke("push_recent_file", { filePath: fullPath });

      navigate("/document", { state: { path: fullPath } });
    } catch (e) { setError(String(e)); }
  }

  async function handleOpen() {
    setError(null);
    try {
      const defaultPath = await invoke<string>("get_documents_dir").catch(() => undefined);
      const selected = await open({
        title: "Open .pnplttr or .gcode file",
        defaultPath,
        filters: [{ name: "Pen Plotter File", extensions: ["pnplttr", "gcode"] }],
        multiple: false,
      });

      if (!selected) return;
      const path = typeof selected === "string" ? selected : (selected as string[])[0];

      if (path.endsWith(".pnplttr")) {
        await invoke("push_recent_file", { filePath: path });
        navigate("/document", { state: { path } });
      } else if (path.endsWith(".gcode")) {
        await invoke("push_recent_file", { filePath: path });
        navigate("/gcode", { state: { path } });
      } else {
        setError("Unsupported file type");
      }
    } catch (e) { setError(String(e)); }
  }

  async function handleOpenRecent(path: string) {
    setError(null);
    await invoke("push_recent_file", { filePath: path }); // Refresh recent files order
    if (path.endsWith(".pnplttr")) {
      try {
        navigate("/document", { state: { path } });
      } catch (e) {
        setError(String(e));
        refreshRecents();
      }
    } else if (path.endsWith(".gcode")) {
      try {
        navigate("/gcode", { state: { path } });
      } catch (e) {
        setError(String(e));
        refreshRecents();
      }
    }
  }

  async function handleDelete(path: string) {
    setError(null);
    try {
      await invoke("delete_file", { filePath: path });
      handleRemoveRecent(path);
    } catch (e) {
      setError(String(e));
    } finally {
      refreshRecents();
    }
  }

  function handleRemoveRecent(path: string) {
    invoke("remove_recent_file", { filePath: path })
      .then(() => setRecentFiles((files) => files.filter((f) => f !== path)))
      .catch(console.error);
    refreshRecents();
  }

  return (
    <div className="h-full bg-[#0a0c10] text-gray-100 flex overflow-hidden">

      {/* ── Left sidebar ── */}
      <aside className="w-75 shrink-0 flex flex-col border-r border-slate-700/60 bg-[#0d1017] overflow-y-auto">

        {/* Branding */}
        <div className="px-6 pt-7 pb-5">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-br from-blue-400 via-purple-400 to-green-400 bg-clip-text text-transparent leading-tight">
            Pen Plotter<br />Interfacer
          </h1>
          <p className="mt-1.5 text-xs text-slate-600">Manage your plotter, create and edit documents</p>
        </div>

        <div className="h-px bg-slate-800 mx-4" />

        <DocumentActions
          showNameInput={showNameInput}
          newName={newName}
          error={error}
          nameInputRef={nameInputRef}
          onToggleNameInput={setShowNameInput}
          onNameChange={setNewName}
          onCreate={handleCreateDocument}
          onOpen={handleOpen}
        />

        <div className="h-px bg-slate-800 mx-4" />

        <PlotterList
          plotters={plotters}
          onPlotterClick={(p) => navigate("/plotter", { state: { plotter: p } })}
        />

        <div className="flex-1" />
        <p className="px-6 py-4 text-xs text-slate-800">V {version}</p>
      </aside>

      <RecentFilesList files={recentFiles} onOpen={handleOpenRecent} onDelete={handleDelete} onRemoveRecent={handleRemoveRecent} />
    </div>
  );
}
