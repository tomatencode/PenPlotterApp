import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// ── Pen definitions ─────────────────────────────────────────────────────────
interface Pen {
  id: string;
  label: string;
  color: string;
  widthMm: number;
}

const PENS: Pen[] = [
  { id: "pen-black-03",  label: "Black 0.3 mm",  color: "#e2e8f0", widthMm: 0.3  },
  { id: "pen-black-05",  label: "Black 0.5 mm",  color: "#e2e8f0", widthMm: 0.5  },
  { id: "pen-blue-03",   label: "Blue 0.3 mm",   color: "#60a5fa", widthMm: 0.3  },
  { id: "pen-green-05",  label: "Green 0.5 mm",  color: "#4ade80", widthMm: 0.5  },
  { id: "pen-red-05",    label: "Red 0.5 mm",    color: "#f87171", widthMm: 0.5  },
  { id: "pen-purple-08", label: "Purple 0.8 mm", color: "#c084fc", widthMm: 0.8  },
];

// ── Layer ────────────────────────────────────────────────────────────────────
interface Layer {
  id: string;
  penId: string;
  name: string;
}

function newLayerId() {
  return Math.random().toString(36).slice(2, 9);
}

// ── Per-tool shape properties (placeholder values) ────────────────────────
const SHAPE_PROPS: Record<string, { label: string; value: string }[]> = {
  select: [],
  line: [
    { label: "X1", value: "0 mm" },
    { label: "Y1", value: "0 mm" },
    { label: "X2", value: "50 mm" },
    { label: "Y2", value: "50 mm" },
    { label: "Length", value: "70.7 mm" },
  ],
  rect: [
    { label: "X", value: "0 mm" },
    { label: "Y", value: "0 mm" },
    { label: "Width", value: "100 mm" },
    { label: "Height", value: "60 mm" },
  ],
  circle: [
    { label: "Center X", value: "50 mm" },
    { label: "Center Y", value: "50 mm" },
    { label: "Radius",   value: "25 mm" },
  ],
  text: [
    { label: "X",        value: "0 mm"  },
    { label: "Y",        value: "0 mm"  },
    { label: "Size",     value: "12 pt" },
    { label: "Content",  value: "Text"  },
  ],
};

interface LocationState {
  json: string;
  path: string | null;
}

type Tool = "select" | "line" | "rect" | "circle" | "text";

const TOOLS: { id: Tool; label: string; icon: React.ReactNode }[] = [
  {
    id: "select",
    label: "Select",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M3 2l10 5.5-4.5 1L6 13z" />
      </svg>
    ),
  },
  {
    id: "line",
    label: "Line",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-4 h-4">
        <line x1="2" y1="14" x2="14" y2="2" />
      </svg>
    ),
  },
  {
    id: "rect",
    label: "Rectangle",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <rect x="2" y="4" width="12" height="8" rx="1" />
      </svg>
    ),
  },
  {
    id: "circle",
    label: "Circle",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <circle cx="8" cy="8" r="5.5" />
      </svg>
    ),
  },
  {
    id: "text",
    label: "Text",
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
        <path d="M2 3.5A.5.5 0 0 1 2.5 3h11a.5.5 0 0 1 .5.5V5a.5.5 0 0 1-1 0V4H9v8.5a.5.5 0 0 1-1 0V4H4v1a.5.5 0 0 1-1 0V3.5z" />
      </svg>
    ),
  },
];

export default function DocumentScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { path } = (location.state as LocationState) ?? { json: "{}", path: null };
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const shapeProps = SHAPE_PROPS[activeTool] ?? [];

  // ── Layers state ──
  const [layers, setLayers] = useState<Layer[]>([
    { id: newLayerId(), penId: PENS[0].id, name: "Layer 1" },
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>(layers[0].id);
  const activeLayer = layers.find((l) => l.id === activeLayerId) ?? layers[0];
  const activeLayerPen = PENS.find((p) => p.id === activeLayer?.penId) ?? PENS[0];

  function addLayer() {
    const id = newLayerId();
    const n = layers.length + 1;
    const newLayer: Layer = { id, penId: PENS[0].id, name: `Layer ${n}` };
    setLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(id);
  }

  function deleteLayer(id: string) {
    if (layers.length === 1) return; // keep at least one
    setLayers((prev) => {
      const next = prev.filter((l) => l.id !== id);
      if (activeLayerId === id) setActiveLayerId(next[Math.max(0, prev.indexOf(prev.find(l => l.id === id)!) - 1)].id);
      return next;
    });
  }

  function moveLayer(id: string, direction: -1 | 1) {
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      const next = [...prev];
      const target = idx + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function setLayerPen(id: string, penId: string) {
    setLayers((prev) => prev.map((l) => l.id === id ? { ...l, penId } : l));
  }

  const fileName = path ? path.split(/[\\/]/).pop() : "Untitled";

  return (
    <div className="h-full bg-[#0a0c10] text-gray-100 flex flex-col overflow-hidden">

      {/* ── Top toolbar ── */}
      <header className="flex items-center gap-2 px-4 py-2 bg-[#0d1017] border-b border-slate-700/60 shrink-0">
        {/* Back */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-blue-400 transition-colors px-2 py-1.5 rounded-md hover:bg-slate-800/70"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <path d="M10 3L5 8l5 5" />
          </svg>
          Home
        </button>

        <div className="w-px h-5 bg-slate-700/80 mx-1" />

        {/* File name */}
        <span className="text-sm font-semibold text-gray-200 mr-1">{fileName}</span>
        {path && <span className="text-xs text-slate-600 truncate max-w-xs hidden md:block">{path}</span>}

        <div className="flex-1" />

        {/* Export to GCode */}
        <button
          onClick={() => {/* TODO: navigate to GCode screen */}}
          className="flex items-center gap-2 px-4 py-1.5 bg-green-700/80 hover:bg-green-600/80 border border-green-600/60 hover:border-green-500 rounded-lg text-sm font-semibold text-green-100 transition-colors shadow-sm shadow-green-900/30"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
          Export to GCode
        </button>
      </header>

      {/* ── Body: sidebar + canvas + properties ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left tool palette ── */}
        <aside className="w-14 shrink-0 flex flex-col items-center gap-1 pt-3 pb-3 bg-[#0d1017] border-r border-slate-700/60">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              title={tool.label}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors
                ${activeTool === tool.id
                  ? "bg-blue-600/30 text-blue-400 border border-blue-500/50"
                  : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
                }`}
            >
              {tool.icon}
            </button>
          ))}

          <div className="flex-1" />

          {/* Zoom controls */}
          <div className="flex flex-col items-center gap-1">
            <button
              title="Zoom in"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent transition-colors text-lg leading-none"
            >
              +
            </button>
            <button
              title="Zoom out"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent transition-colors text-lg leading-none"
            >
              −
            </button>
          </div>
        </aside>

        {/* ── Canvas area ── */}
        <main className="flex-1 overflow-hidden flex flex-col items-center justify-center bg-[#0a0c10] relative">
          {/* Grid backdrop */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: "linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          {/* Paper / canvas */}
          <div className="relative bg-[#c4c7cf] border border-slate-700/50 shadow-2xl shadow-black/60"
            style={{ width: 595, height: 842 /* A4 proportions */ }}
          >
            {/* Placeholder empty state */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none select-none">
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1" className="w-16 h-16 text-slate-700">
                <rect x="4" y="4" width="40" height="40" rx="3" />
                <line x1="12" y1="16" x2="36" y2="16" />
                <line x1="12" y1="24" x2="28" y2="24" />
                <line x1="12" y1="32" x2="32" y2="32" />
              </svg>
              <span className="text-slate-700 text-sm">
                {activeTool === "select" ? "Select a tool to start drawing" : `Drawing with: ${TOOLS.find(t => t.id === activeTool)?.label}`}
              </span>
            </div>
          </div>
        </main>

        {/* ── Right properties panel ── */}
        <aside className="w-60 shrink-0 flex-col bg-[#0d1017] border-l border-slate-700/60 overflow-hidden">

          {/* ── Layers ── */}
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Layers</p>
              <button
                onClick={addLayer}
                title="Add layer"
                className="w-6 h-6 flex items-center justify-center rounded-md text-slate-600 hover:text-blue-400 hover:bg-slate-800 transition-colors"
              >
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3 h-3">
                  <path d="M6 1v10M1 6h10" />
                </svg>
              </button>
            </div>

            {/* Layer list — scrollable */}
            <ul className="flex flex-col gap-1 px-2 overflow-y-auto flex-1 pb-2">
              {[...layers].reverse().map((layer, reversedIdx) => {
                const idx = layers.length - 1 - reversedIdx;
                const pen = PENS.find((p) => p.id === layer.penId) ?? PENS[0];
                const isActive = layer.id === activeLayerId;
                return (
                  <li key={layer.id}>
                    <button
                      onClick={() => setActiveLayerId(layer.id)}
                      className={`w-full px-2.5 py-2 rounded-lg border transition-colors text-left group
                        ${isActive
                          ? "bg-[#0a0c10] border-blue-500/40 text-gray-200"
                          : "bg-transparent border-transparent hover:bg-[#0a0c10] hover:border-slate-700/50 text-slate-400"
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        {/* Pen color dot */}
                        <div
                          className="w-3 h-3 rounded-full shrink-0 border border-white/10"
                          style={{ backgroundColor: pen.color }}
                        />
                        <span className="flex-1 text-xs font-medium truncate">{layer.name}</span>

                        {/* Reorder + delete — only visible on active / hover */}
                        <div className={`flex items-center gap-0.5 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => moveLayer(layer.id, 1)}
                            disabled={idx === layers.length - 1}
                            title="Move up"
                            className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:text-slate-300 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                          >
                            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                              <path d="M2 6.5l3-3 3 3" />
                            </svg>
                          </button>
                          <button
                            onClick={() => moveLayer(layer.id, -1)}
                            disabled={idx === 0}
                            title="Move down"
                            className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:text-slate-300 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                          >
                            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                              <path d="M2 3.5l3 3 3-3" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteLayer(layer.id)}
                            disabled={layers.length === 1}
                            title="Delete layer"
                            className="w-5 h-5 flex items-center justify-center rounded text-slate-700 hover:text-red-400 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                          >
                            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-2.5 h-2.5">
                              <line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {/* Pen picker — only shown for active layer */}
                      {isActive && (
                        <div className="mx-2 mt-1 mb-1">
                          <div className="relative">
                            <select
                              value={layer.penId}
                              onChange={(e) => setLayerPen(layer.id, e.target.value)}
                              className="w-full appearance-none pl-7 pr-6 py-1.5 rounded-md bg-[#111520] border border-slate-700/60 text-xs text-slate-300 outline-none focus:border-blue-500/50 cursor-pointer"
                            >
                              {PENS.map((p) => (
                                <option key={p.id} value={p.id}>{p.label}</option>
                              ))}
                            </select>
                            {/* Color swatch inside select left */}
                            <div
                              className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-white/10 pointer-events-none"
                              style={{ backgroundColor: pen.color }}
                            />
                            <svg viewBox="0 0 12 12" fill="currentColor" className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600 pointer-events-none">
                              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          {/* Stroke width hint */}
                          <div className="flex items-center gap-2 mt-1.5 px-1">
                            <div className="rounded-full" style={{ width: 32, height: Math.max(1, pen.widthMm * 2), backgroundColor: pen.color, opacity: 0.6 }} />
                            <span className="text-xs text-slate-700">{pen.widthMm} mm</span>
                          </div>
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="h-px bg-slate-800 mx-3 shrink-0" />

          {/* ── Shape properties ── */}
          <div className="px-4 pt-3 pb-4 shrink-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
              {activeTool === "select" ? "Selection" : activeTool.charAt(0).toUpperCase() + activeTool.slice(1)}
            </p>
            {shapeProps.length === 0 ? (
              <p className="text-xs text-slate-700 italic">No element selected</p>
            ) : (
              <div className="flex flex-col gap-2">
                {shapeProps.map(({ label, value }) => (
                  <div key={label} className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-slate-600 w-16 shrink-0">{label}</span>
                    <input
                      readOnly
                      value={value}
                      className="w-full min-w-0 px-2 py-1 rounded-md bg-[#0a0c10] border border-slate-700/60 text-xs text-slate-300 outline-none text-right tabular-nums"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ── Status bar ── */}
      <footer className="flex items-center gap-4 px-4 h-6 bg-[#0d1017] border-t border-slate-700/60 shrink-0">
        <span className="text-xs text-slate-700">
          Tool: <span className="text-slate-500 capitalize">{activeTool}</span>
        </span>
        <span className="text-xs text-slate-700">Zoom: <span className="text-slate-500">100%</span></span>
        <span className="text-xs text-slate-700">0 objects</span>
        <div className="flex-1" />
        <span className="text-xs text-slate-700">
          Pen: <span className="text-slate-500">{activeLayerPen.label}</span>
        </span>
        <span className="text-xs text-slate-700">A4  595 × 842</span>
      </footer>
    </div>
  );
}

