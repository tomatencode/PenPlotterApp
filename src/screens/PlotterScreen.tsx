import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ScreenHeader from "../components/ScreenHeader";
import PlotterView from "../components/plotter/PlotterView";
import type { PlotterPosition } from "../components/plotter/dimensions";
import { DEFAULT_PEN } from "../components/document/types";

// ── Types ──────────────────────────────────────────────────────────────────
type PlotterState = "idle" | "running" | "paused" | "error" | "offline";

// Slot count is fixed per iteration — will come from backend later
type PlotterIteration = "V1" | "V2" | "V3";
const ITERATION_SLOTS: Record<PlotterIteration, number> = { V1: 1, V2: 3, V3: 6 };

interface PlotterDetails {
  id: string;
  name: string;
  mdnsName: string;
  url: string;
  state: PlotterState;
  iteration: PlotterIteration;
  workspaceWidthMm: number;
  workspaceHeightMm: number;
  penSlots: (number | null)[]; // PRESET_PENS index or null per slot
}

const STATE_STYLES: Record<PlotterState, { dot: string; label: string; text: string; bg: string }> = {
  idle:    { dot: "bg-green-400",              label: "Idle",    text: "text-green-400",  bg: "bg-green-400/10 border-green-500/20"   },
  running: { dot: "bg-blue-400 animate-pulse", label: "Running", text: "text-blue-400",   bg: "bg-blue-400/10 border-blue-500/20"     },
  paused:  { dot: "bg-yellow-400",             label: "Paused",  text: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-500/20" },
  error:   { dot: "bg-red-500",                label: "Error",   text: "text-red-400",    bg: "bg-red-500/10 border-red-600/20"       },
  offline: { dot: "bg-slate-600",              label: "Offline", text: "text-slate-500",  bg: "bg-slate-700/20 border-slate-700/40"   },
};

// Stub — will be fetched from backend via plotter id from location state
const STUB_PLOTTER: PlotterDetails = {
  id: "plotter-1",
  name: "Plotter 1",
  mdnsName: "plotter.local",
  url: "http://plotter.local",
  state: "idle",
  iteration: "V1",
  workspaceWidthMm: 185,
  workspaceHeightMm: 265,
  penSlots: [0],
};

export default function PlotterScreen() {
  const navigate = useNavigate();
  const [plotter] = useState<PlotterDetails>(STUB_PLOTTER);
  const [headPosition, setHeadPosition] = useState<PlotterPosition>({ x: 0, y: 0 }); // wire _setHeadPosition to onPositionChange to enable drag control

  const style = STATE_STYLES[plotter.state];
  const isOnline = plotter.state !== "offline";
  const slotCount = ITERATION_SLOTS[plotter.iteration];

  // The active pen is whichever is in slot 0 (will be driven by active layer later)
  const activePen = plotter.penSlots[0] != null ? DEFAULT_PEN : null;

  return (
    <div className="h-full bg-[#0a0c10] text-gray-100 flex flex-col overflow-hidden">
      <ScreenHeader
        onBack={() => navigate("/")}
        title={plotter.name}
        subtitle={plotter.mdnsName}
      />

      <div className="flex-1 flex overflow-hidden">

        {/* ── Left info panel ── */}
        <aside className="w-56 shrink-0 flex flex-col border-r border-slate-700/60 bg-[#0d1017] overflow-y-auto">

          {/* Status card */}
          <div className="px-4 pt-4 pb-3">
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${style.bg}`}>
              <div className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
              <div>
                <p className={`text-sm font-semibold leading-tight ${style.text}`}>{style.label}</p>
                <p className="text-xs text-slate-600">{isOnline ? "Online" : "Offline"}</p>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-800 mx-4" />

          {/* Info rows */}
          <div className="px-4 py-4 flex flex-col gap-3.5">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest">Details</p>
            {([
              { label: "Iteration", value: plotter.iteration },
              { label: "mDNS Name", value: plotter.mdnsName  },
              { label: "URL",       value: plotter.url        },
              { label: "Workspace", value: `${plotter.workspaceWidthMm} × ${plotter.workspaceHeightMm} mm` },
              { label: "Pen slots", value: `${slotCount}` },
            ] as const).map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-slate-600 mb-0.5">{label}</p>
                <p className="text-sm text-slate-300 font-mono truncate" title={value}>{value}</p>
              </div>
            ))}
          </div>

          <div className="h-px bg-slate-800 mx-4" />

          {/* Head position readout */}
          <div className="px-4 py-4 flex flex-col gap-3">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest">Position</p>
            <div className="grid grid-cols-2 gap-2">
              {([["X", headPosition.x], ["Y", headPosition.y]] as [string, number][]).map(([axis, val]) => (
                <div key={axis} className="px-2.5 py-2 rounded-lg bg-[#0a0c10] border border-slate-700/50">
                  <p className="text-xs text-slate-600">{axis}</p>
                  <p className="text-sm font-mono text-slate-300 tabular-nums">{val.toFixed(1)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1" />
        </aside>

        {/* ── Center: plotter graphic ── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#0a0c10]">
          {/* TODO: controls toolbar (home, Pen Up/Down) */}
          <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
            <PlotterView
              position={headPosition}
              activePenColor={activePen?.color}
              onPositionChange={setHeadPosition}
            />
          </div>
        </main>

        {/* ── Right: pen slots with inline picker ── */}
        <aside className="w-52 shrink-0 flex flex-col border-l border-slate-700/60 bg-[#0d1017] overflow-hidden">
          <div className="px-4 pt-4 pb-2 shrink-0">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest">
              Pen Slots
              <span className="ml-2 text-slate-700 normal-case font-normal tracking-normal">{slotCount} total</span>
            </p>
          </div>

          <ul className="flex flex-col gap-1 px-2 pb-2 overflow-y-auto flex-1">
            {Array.from({ length: slotCount }, (_, idx) => {
              const penIndex = plotter.penSlots[idx] ?? null;
              const pen = penIndex != null ? DEFAULT_PEN : null;
              return (
                <li key={idx} className="flex flex-col">
                  {/* Slot row */}
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-slate-700 tabular-nums shrink-0">#{idx + 1}</span>
                    {pen ? (
                      <>
                        <div className="w-4 h-4 rounded-full border border-white/10 shrink-0" style={{ backgroundColor: pen.color }} />
                      </>
                    ) : (
                      <span className="text-xs text-slate-700 italic flex-1">Empty</span>
                    )}
                    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                      className="w-2.5 h-2.5 shrink-0 text-slate-700 transition-transform">
                      <path d="M2 3.5l3 3 3-3" />
                    </svg>
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}
