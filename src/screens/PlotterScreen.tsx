import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ScreenHeader from "../shared/components/ScreenHeader";
import PlotterView from "../features/plotter/components/graphic/PlotterView";
import type { PlotterPosition } from "../features/plotter/components/graphic/dimensions";
import PlotterStatusCard from "../features/plotter/components/PlotterStatusCard";
import PlotterDetailsPanel from "../features/plotter/components/PlotterDetailsPanel";
import PlotterSettingsPanel from "../features/plotter/components/PlotterSettingsPanel";
import PlotterFileList from "../features/plotter/components/PlotterFileList";
import JobControlBar from "../features/plotter/components/JobControllBar";
import { PlotterClient, downloadPreview, isRequestCancelled } from "../features/plotter/api/plotterClient";
import { usePlotterDiscovery, type Plotter } from "../features/plotter/discoveryContext";
import type { SettingKey, PlotterSettings, WsStateMessage } from "../features/plotter/api/plotterClient";
import type { UiState } from "../features/plotter/components/PlotterStatusCard";
import type { PlotterInfo } from "../features/plotter/components/PlotterDetailsPanel";


export default function PlotterScreen() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const plotter: Plotter | null = state?.plotter ?? null;

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

  return <PlotterContent plotter={plotter} onBack={() => navigate("/")} />;
}

function PlotterContent({
  plotter,
  onBack,
}: {
  plotter: Plotter;
  onBack: () => void;
}) {
  const { holdPoller } = usePlotterDiscovery();

  // Queues preview downloads behind each other: the plotter's single-threaded
  // HTTP server degrades badly under concurrent transfers, and one active
  // download at a time keeps a 1MB+ body from being truncated mid-stream.
  const downloadQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  // Latest requested preview; older queued downloads exit before touching state.
  const previewRequestRef = useRef<string | null>(null);
  const previewRequestIdRef = useRef(0);
  // Aborts the in-flight preview download when a newer one is requested.
  const previewAbortRef = useRef<AbortController | null>(null);

  const [previewLoadingFilename, setPreviewLoadingFilename] = useState<string | null>(null);

  // Requests the given preview through the queue. Older queued requests are
  // skipped; an already-running download for another file keeps the network
  // to itself and the new one restarts it as soon as it frees up.
  function requestPreview(filename: string): void {
    const requestId = ++previewRequestIdRef.current;
    previewRequestRef.current = filename;
    setPreviewLoadingFilename(filename);
    downloadQueueRef.current = downloadQueueRef.current
      .catch(() => {})
      .then(async () => {
        if (previewRequestIdRef.current !== requestId) return;
        previewAbortRef.current?.abort();
        const controller = new AbortController();
        previewAbortRef.current = controller;
        const releasePoller = holdPoller(plotter.url);
        try {
          console.log(`Requesting preview for file: ${filename}`);
          const gcode = await downloadPreview(client, filename, controller.signal);
          console.log(`Downloaded preview for file: ${filename}`);
          if (previewRequestIdRef.current !== requestId || controller.signal.aborted) return;
          setPreview({ gcode, filename });
        } catch (e) {
          if (controller.signal.aborted || isRequestCancelled(e)) return;
          console.error(e);
          if (previewRequestIdRef.current === requestId) setPreview(undefined);
        } finally {
          if (previewAbortRef.current === controller) {
            previewAbortRef.current = null;
          }
          if (previewRequestIdRef.current === requestId) {
            setPreviewLoadingFilename(null);
          }
          releasePoller();
        }
      });
  }

  const client = useMemo(() => new PlotterClient(plotter.url), [plotter.url]);

  const [openedSideTab, setOpenedSideTab] = useState<"details" | "settings">("details");

  const [info, setInfo] = useState<PlotterInfo | null>(null);
  const [wsState, setWsState] = useState<WsStateMessage | null>(null);
  const [settings, setSettings] = useState<PlotterSettings>({});
  const [files, setFiles] = useState<string[]>([]);
  const [startingFile, setStartingFile] = useState<string | null>(null);

  const uiState: UiState = wsState ? wsState.motionState : "connecting";
  const headPosition = wsState ? { x: wsState.x, y: wsState.y } : { x: 0, y: 0 };
  /** Downloaded GCode content together with the filename it belongs to. */
  const [preview, setPreview] = useState<{ gcode: string; filename: string } | undefined>();

  /**
   * Derive the current progress line from live wsState rather than baking it
   * into stored state (which would go stale between WebSocket pushes).
   *  undefined  → pure file preview, show everything as pending (dashed)
   *  N          → job in progress, split drawn/pending at line N
   *  Infinity   → job completed for this file, show everything as drawn
   */
  const previewCurrentLine: number | undefined = (() => {
    if (!preview || !wsState) return undefined;
    if (wsState.jobFile !== preview.filename) return undefined;
    if (wsState.jobActive) return wsState.jobLine;
    if (wsState.jobLine > 0) return Infinity; // same file, job just finished
    return undefined;
  })();

  useEffect(() => {
    return client.subscribe(setWsState);
  }, [client]);

  // Auto-load preview when the plotter starts (or switches) a job.
  useEffect(() => {
    if (wsState?.jobFile && wsState?.jobFile !== preview?.filename) {
      requestPreview(wsState.jobFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsState?.jobFile, client, preview]);


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

  async function handleSendGcode(gcode: string) {
    try { await client.executeGCode(gcode); } catch (e) { console.error(e); }
  }

  async function handleChangeSetting(key: SettingKey, rawValue: string) {
    try {
      await client.setSetting(key, rawValue);
      setSettings(prev => ({ ...prev, [key]: rawValue }));
    } catch (e) {
      console.error(e);
    }
  }

  async function handleHeadDrop(pos: PlotterPosition) {
    if (wsState?.jobActive) return;
    try {
      await client.executeGCode(`G0 X${pos.x.toFixed(2)} Y${pos.y.toFixed(2)}`);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="h-full bg-[#0a0c10] text-gray-100 flex flex-col overflow-hidden">
      <ScreenHeader
        onBack={onBack}
        title={plotter.displayInfo.name}
        subtitle={ `http://${plotter.displayInfo.mdnsName}.local`}
      >
        <PlotterStatusCard state={uiState} />
      </ScreenHeader>

      <div className="flex-1 flex overflow-hidden">

        {/* ── Left info panel ── */}
        <aside className="w-56 shrink-0 flex flex-col border-r border-slate-700/60 bg-[#0d1017] overflow-y-auto">
          <PlotterFileList
              files={files}
              uiState={uiState}
              startingFile={startingFile}
              onStartFile={handleStartFile}
              onDeleteFile={handleDeleteFile}
              onFetchFileInfo={filename => client.getFileInfo(filename)}
              onFocusFile={filename => {
                if (filename === null) {
                  previewRequestRef.current = null;
                  previewRequestIdRef.current += 1;
                  previewAbortRef.current?.abort();
                  setPreviewLoadingFilename(null);
                  setPreview(undefined);
                } else if (!wsState?.jobActive) {
                  requestPreview(filename);
                }
              }}
            />
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
                gcode={preview?.gcode}
                currentLine={previewCurrentLine}
                previewLoading={previewLoadingFilename !== null}
                activePenColor="#2f69a2"
                onHeadDrop={wsState?.jobActive ? undefined : handleHeadDrop}
              />
            ) : 
              <p className="text-sm text-slate-600 italic">Fetching Plotter Dimensions…</p>
            }
          </div>
        </main>

        {/* ── Right: file list / Settings ── */}

        <aside className="w-56 shrink-0 flex flex-col border-l border-slate-700/60 bg-[#0d1017] overflow-hidden">
          <div className="shrink-0 flex border-b border-slate-700/60">
            {(["details", "settings"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setOpenedSideTab(tab)}
                className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors ${
                  openedSideTab === tab
                    ? "text-slate-200 border-b-2 border-blue-600 -mb-px"
                    : "text-slate-600 hover:text-slate-400"
                }`}
              >
                {tab === "details" ? "Details" : "Settings"}
              </button>
            ))}
          </div>

          {openedSideTab === "details" ? (
            <PlotterDetailsPanel info={info} />
          ) : (
            <PlotterSettingsPanel settings={settings} onChangeSetting={handleChangeSetting} />
          )}
        </aside>
      </div>

      <JobControlBar
        wsState={wsState}
        onPause={handlePause}
        onResume={handleResume}
        onAbort={handleAbort}
        onSendGcode={handleSendGcode}
      />
    </div>
  );
}
