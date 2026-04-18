import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ScreenHeader from "../components/ScreenHeader";
import PlotterView from "../components/plotter/plotterGaphic/PlotterView";
import PlotterStatusCard from "../components/plotter/PlotterStatusCard";
import PlotterDetailsPanel from "../components/plotter/PlotterDetailsPanel";
import PlotterSettingsPanel from "../components/plotter/PlotterSettingsPanel";
import PlotterFileList from "../components/plotter/PlotterFileList";
import { PlotterClient } from "../api/plotterClient";
import type { SettingKey, PlotterSettings, WsStateMessage } from "../api/plotterClient";
import type { UiState } from "../components/plotter/PlotterStatusCard";
import type { PlotterInfo } from "../components/plotter/PlotterDetailsPanel";

export default function PlotterScreen() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const url: string = state?.url ?? "";

  const client = useMemo(() => new PlotterClient(url), [url]);

  const [openedSideTab, setOpenedSideTab] = useState<"files" | "settings">("files");

  const [info, setInfo] = useState<PlotterInfo | null>(null);
  const [wsState, setWsState] = useState<WsStateMessage | null>(null);
  const [settings, setSettings] = useState<PlotterSettings>({});
  const [files, setFiles] = useState<string[]>([]);
  const [startingFile, setStartingFile] = useState<string | null>(null);

  const uiState: UiState = wsState ? wsState.motionState : "connecting";
  const headPosition = wsState ? { x: wsState.x, y: (info?.workspaceY ?? 0) - wsState.y } : { x: 0, y: 0 };

  useEffect(() => {
    Promise.all([
      client.getName(),
      client.getMdnsName(),
      client.getIteration(),
      client.getFirmwareVersion(),
      client.getWorkspace(),
    ]).then(([name, mdnsName, iteration, firmwareVersion, workspace]) => {
      setInfo({ name, mdnsName, iteration, firmwareVersion, workspaceX: workspace.x, workspaceY: workspace.y });
    }).catch(console.error);

    client.getAllSettings().then(setSettings).catch(console.error);
    client.listFiles().then(setFiles).catch(console.error);
  }, [client]);

  useEffect(() => {
    return client.subscribe(setWsState);
  }, [client]);

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
        title={info?.name ?? url}
        subtitle={info ? `${info.mdnsName}.local` : ""}
      />

      <div className="flex-1 flex overflow-hidden">

        {/* ── Left info panel ── */}
        <aside className="w-56 shrink-0 flex flex-col border-r border-slate-700/60 bg-[#0d1017] overflow-y-auto">
          <div className="px-4 pt-4 pb-3">
            <PlotterStatusCard state={uiState} />
          </div>

          <div className="h-px bg-slate-800 mx-4" />

          <PlotterDetailsPanel info={info} url={url} />
        </aside>

        {/* ── Center: plotter graphic ── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#0a0c10]">
          {/* TODO: controls toolbar (home, Pen Up/Down) */}
          <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
            <PlotterView position={headPosition} />
          </div>
        </main>

        {/* ── Right: file list / Settings ── */}
        <aside className="w-52 shrink-0 flex flex-col border-l border-slate-700/60 bg-[#0d1017] overflow-hidden">
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
            />
          )}
        </aside>
      </div>
    </div>
  );
}
