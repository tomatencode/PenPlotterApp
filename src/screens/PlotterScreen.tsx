import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ScreenHeader from "../shared/components/ScreenHeader";
import PlotterView from "../features/plotter/components/graphic/PlotterView";
import PlotterStatusCard from "../features/plotter/components/PlotterStatusCard";
import PlotterDetailsPanel from "../features/plotter/components/PlotterDetailsPanel";
import PlotterSettingsPanel from "../features/plotter/components/PlotterSettingsPanel";
import PlotterFileList from "../features/plotter/components/PlotterFileList";
import JobControlBar from "../features/plotter/components/JobControllBar";
import { PlotterClient } from "../features/plotter/api/plotterClient";
import type { SettingKey, PlotterSettings, WsStateMessage } from "../features/plotter/api/plotterClient";
import type { UiState } from "../features/plotter/components/PlotterStatusCard";
import type { PlotterInfo } from "../features/plotter/components/PlotterDetailsPanel";

export default function PlotterScreen() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const plotter = state?.plotter ?? null;

  if (!plotter) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0c10] ">
        <p className="text-sm text-slate-600">No plotter data provided.</p>
        <button
          onClick={() => navigate("/")}
          className="ml-4 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  const client = useMemo(() => new PlotterClient(plotter.url), [plotter.url]);

  const [openedSideTab, setOpenedSideTab] = useState<"files" | "settings">("files");

  const [info, setInfo] = useState<PlotterInfo | null>(null);
  const [wsState, setWsState] = useState<WsStateMessage | null>(null);
  const [settings, setSettings] = useState<PlotterSettings>({});
  const [files, setFiles] = useState<string[]>([]);
  const [startingFile, setStartingFile] = useState<string | null>(null);

  const uiState: UiState = wsState ? wsState.motionState : "connecting";
  const headPosition = wsState ? { x: wsState.x, y: wsState.y } : { x: 0, y: 0 };

  useEffect(() => {
    return client.subscribe(setWsState);
  }, [client]);

  useEffect(() => {
    Promise.all([

      client.getFirmwareVersion(),
      client.getWorkspace(),
    ]).then(([firmwareVersion, workspace]) => {
      setInfo({
        url: plotter.url,
        name: plotter.displayInfo.name,
        mdnsName: plotter.displayInfo.mdnsName,
        iteration: plotter.displayInfo.iteration,
        firmwareVersion, workspaceX: workspace.x,
        workspaceY: workspace.y
      });
    }).catch(console.error);

    client.getAllSettings().then(setSettings).catch(console.error);
    client.listFiles().then(setFiles).catch(console.error);
  }, [client]);

  async function handleDeleteFile(filename: string) {
    try {
      await client.deleteFile(filename);
      const updated = await client.listFiles();
      setFiles(updated);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleStartFile(filename: string) {
    if (startingFile !== null) return;
    setStartingFile(filename);
    try {
      await client.startJob(filename);
    } catch (e) {
      console.error(e);
    } finally {
      setStartingFile(null);
    }
  }

  async function handlePause() {
    try { await client.pauseJob(); } catch (e) { console.error(e); }
  }

  async function handleResume() {
    try { await client.resumeJob(); } catch (e) { console.error(e); }
  }

  async function handleAbort() {
    try { await client.abortJob(); } catch (e) { console.error(e); }
  }

  async function handleChangeSetting(key: SettingKey, rawValue: string) {
    try {
      await client.setSetting(key, rawValue);
      setSettings(prev => ({ ...prev, [key]: rawValue }));
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="h-full bg-[#0a0c10] text-gray-100 flex flex-col overflow-hidden">
      <ScreenHeader
        onBack={() => navigate("/")}
        title={plotter.displayInfo.name}
        subtitle={ `http://${plotter.displayInfo.mdnsName}.local`}
      >
        <PlotterStatusCard state={uiState} />
      </ScreenHeader>

      <div className="flex-1 flex overflow-hidden">

        {/* ── Left info panel ── */}
        <aside className="w-56 shrink-0 flex flex-col border-r border-slate-700/60 bg-[#0d1017] overflow-y-auto">
          <PlotterDetailsPanel info={info} />
        </aside>

        {/* ── Center: plotter graphic ── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#0a0c10]">
          {/* TODO: controls toolbar (home, Pen Up/Down) */}
          <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
            {info ? (
              <PlotterView
                position={headPosition}
                workspaceWidthMm={info.workspaceX}
                workspaceHeightMm={info.workspaceY}
                activePenColor="#383737"
              />
            ) : 
              <p className="text-sm text-slate-600 italic">Fetching Plotter Dimensions…</p>
            }
          </div>
        </main>

        {/* ── Right: file list / Settings ── */}

        <aside className="w-56 shrink-0 flex flex-col border-l border-slate-700/60 bg-[#0d1017] overflow-hidden">
          <div className="shrink-0 flex border-b border-slate-700/60">
            {(["files", "settings"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setOpenedSideTab(tab)}
                className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors ${
                  openedSideTab === tab
                    ? "text-slate-200 border-b-2 border-blue-600 -mb-px"
                    : "text-slate-600 hover:text-slate-400"
                }`}
              >
                {tab === "files" ? "Files" : "Settings"}
              </button>
            ))}
          </div>

          {openedSideTab === "settings" ? (
            <PlotterSettingsPanel settings={settings} onChangeSetting={handleChangeSetting} />
          ) : (
            <PlotterFileList
              files={files}
              uiState={uiState}
              startingFile={startingFile}
              onStartFile={handleStartFile}
              onDeleteFile={handleDeleteFile}
              onFetchFileInfo={filename => client.getFileInfo(filename)}
            />
          )}
        </aside>
      </div>

      <JobControlBar
        wsState={wsState}
        onPause={handlePause}
        onResume={handleResume}
        onAbort={handleAbort}
      />
    </div>
  );
}
