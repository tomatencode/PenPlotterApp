import type { Layer } from "./types";
import { PRESET_PENS } from "./types";

interface Props {
  layers: Layer[];
  activeLayerId: string;
  onSetActiveLayerId: (id: string) => void;
  onAddLayer: () => void;
  onDeleteLayer: (id: string) => void;
  onMoveLayer: (id: string, direction: -1 | 1) => void;
  onSetLayerPen: (id: string, penIndex: number) => void;
  onRenameLayer: (id: string, name: string) => void;
}

export default function LayersPanel({
  layers,
  activeLayerId,
  onSetActiveLayerId,
  onAddLayer,
  onDeleteLayer,
  onMoveLayer,
  onSetLayerPen,
  onRenameLayer,
}: Props) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Layers</p>
        <button
          onClick={onAddLayer}
          title="Add layer"
          className="w-6 h-6 flex items-center justify-center rounded-md text-slate-600 hover:text-blue-400 hover:bg-slate-800 transition-colors"
        >
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3 h-3">
            <path d="M6 1v10M1 6h10" />
          </svg>
        </button>
      </div>

      {/* Layer list — scrollable */}
      <ul className="flex flex-col gap-1 px-2 overflow-y-auto pb-2">
        {[...layers].reverse().map((layer, reversedIdx) => {
          const idx = layers.length - 1 - reversedIdx;
          const isActive = layer.id === activeLayerId;
          const pen = layer.pen;
          return (
            <li key={layer.id}>
              <button
                onClick={() => onSetActiveLayerId(layer.id)}
                className={`w-full px-2.5 py-2 rounded-lg border transition-colors text-left group
                  ${isActive
                    ? "bg-[#0a0c10] border-gray-500/40 text-gray-200"
                    : "bg-transparent border-transparent hover:bg-[#0a0c10] hover:border-slate-700/50 text-slate-400"
                  }`}
              >
                <div className="flex items-center gap-2">
                  {/* Pen color dot */}
                  <div
                    className="w-3 h-3 rounded-full shrink-0 border border-white/10"
                    style={{ backgroundColor: pen.color }}
                  />
                  {isActive ? (
                    <input
                      value={layer.name}
                      onChange={(e) => onRenameLayer(layer.id, e.target.value)}
                      onBlur={(e) => { if (!e.target.value.trim()) onRenameLayer(layer.id, layer.name); }}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur(); }}
                      className="flex-1 min-w-0 text-xs font-medium bg-transparent border-b border-slate-600 text-gray-200 outline-none pb-px"
                    />
                  ) : (
                    <span className="flex-1 text-xs font-medium truncate">{layer.name}</span>
                  )}

                  {/* Reorder + delete — only visible on active / hover */}
                  <div
                    className={`flex items-center gap-0.5 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onMoveLayer(layer.id, 1)}
                      disabled={idx === layers.length - 1}
                      title="Move up"
                      className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:text-slate-300 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                    >
                      <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                        <path d="M2 6.5l3-3 3 3" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onMoveLayer(layer.id, -1)}
                      disabled={idx === 0}
                      title="Move down"
                      className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:text-slate-300 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                    >
                      <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
                        <path d="M2 3.5l3 3 3-3" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDeleteLayer(layer.id)}
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
                        value={PRESET_PENS.findIndex((p) => p.name === pen.name && p.color === pen.color)}
                        onChange={(e) => onSetLayerPen(layer.id, parseInt(e.target.value))}
                        className="w-full appearance-none pl-7 pr-6 py-1.5 rounded-md bg-[#111520] border border-slate-700/60 text-xs text-slate-300 outline-none focus:border-blue-500/50 cursor-pointer"
                      >
                        {PRESET_PENS.map((p, i) => (
                          <option key={i} value={i}>{p.name}</option>
                        ))}
                      </select>
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 absolute left-2 top-1/2 -translate-y-1/2" style={{ color: pen.color }}>
                        <path d="M11 2l3 3-8 8H3v-3L11 2z" />
                        <path d="M9 4l3 3" />
                      </svg>
                      <svg viewBox="0 0 12 12" fill="currentColor" className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600 pointer-events-none">
                        <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    {/* Stroke width hint */}
                    <div className="flex items-center gap-2 mt-1.5 px-1">
                      <div className="rounded-full" style={{ width: 32, height: Math.max(1, pen.width * 2), backgroundColor: pen.color, opacity: 0.6 }} />
                      <span className="text-xs text-slate-700">{pen.width} mm</span>
                    </div>
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
