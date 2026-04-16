import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { HexColorPicker } from "react-colorful";
import type { Layer, Pen } from "./types";

interface Props {
  layers: Layer[];
  activeLayerId: string;
  onSetActiveLayerId: (id: string) => void;
  onAddLayer: () => void;
  onDeleteLayer: (id: string) => void;
  onMoveLayer: (id: string, direction: -1 | 1) => void;
  onSetLayerPen: (id: string, pen: Pen) => void;
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
  const [pickerOpenId, setPickerOpenId] = useState<string | null>(null);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const pickerRef = useRef<HTMLDivElement>(null);
  const swatchRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)
          && swatchRef.current && !swatchRef.current.contains(e.target as Node)) {
        setPickerOpenId(null);
      }
    }
    if (pickerOpenId) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pickerOpenId]);

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

                {/* Pen editor — only shown for active layer */}
                {isActive && (
                  <div className="mx-1 mt-2 mb-1 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                    {/* Color row */}
                    <div className="flex items-center gap-2">
                      <button
                        ref={swatchRef}
                        title="Pick color"
                        className="w-5 h-5 rounded-full shrink-0 border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        style={{ backgroundColor: pen.color }}
                        onClick={(e) => {
                          if (pickerOpenId === layer.id) { setPickerOpenId(null); return; }
                          const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                          setPickerPos({ top: r.bottom + 6, left: r.left });
                          setPickerOpenId(layer.id);
                        }}
                      />
                      <span className="text-xs text-slate-500 font-mono">{pen.color}</span>
                    </div>
                    {pickerOpenId === layer.id && createPortal(
                      <div
                        ref={pickerRef}
                        style={{ position: "fixed", top: pickerPos.top, left: pickerPos.left, zIndex: 9999 }}
                        className="rounded-lg overflow-hidden shadow-xl shadow-black/60 border border-slate-700/60"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <HexColorPicker
                          color={pen.color}
                          onChange={(c) => onSetLayerPen(layer.id, { ...pen, color: c })}
                        />
                      </div>,
                      document.body
                    )}
                    {/* Width row */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Stroke</span>
                      <div className="flex items-center rounded border border-slate-700/60 bg-[#111520] overflow-hidden">
                        <button
                          onClick={() => { const v = Math.max(0.1, parseFloat((pen.width - 0.1).toFixed(1))); onSetLayerPen(layer.id, { ...pen, width: v }); }}
                          className="px-1.5 py-0.5 text-slate-500 hover:text-slate-200 hover:bg-slate-700/40 transition-colors text-xs leading-none"
                        >−</button>
                        <input
                          type="number"
                          min="0.1"
                          max="10"
                          step="0.1"
                          value={pen.width}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v > 0) onSetLayerPen(layer.id, { ...pen, width: v });
                          }}
                          className="w-10 py-0.5 bg-transparent text-xs text-slate-300 outline-none text-center"
                        />
                        <button
                          onClick={() => { const v = Math.min(10, parseFloat((pen.width + 0.1).toFixed(1))); onSetLayerPen(layer.id, { ...pen, width: v }); }}
                          className="px-1.5 py-0.5 text-slate-500 hover:text-slate-200 hover:bg-slate-700/40 transition-colors text-xs leading-none"
                        >+</button>
                      </div>
                      <span className="text-xs text-slate-500">mm</span>
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
