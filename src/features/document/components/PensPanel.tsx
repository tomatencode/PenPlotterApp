import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { HexColorPicker } from "react-colorful";
import type { Pen } from "../types";

interface Props {
  pens: Pen[];
  activePenIndex: number;
  onSetActivePenIndex: (idx: number) => void;
  onAddPen: () => void;
  onDeletePen: (idx: number) => void;
  onSetPen: (idx: number, pen: Pen) => void;
}

export default function PensPanel({
  pens,
  activePenIndex,
  onSetActivePenIndex,
  onAddPen,
  onDeletePen,
  onSetPen,
}: Props) {
  const [pickerOpenIdx, setPickerOpenIdx] = useState<number | null>(null);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const pickerRef = useRef<HTMLDivElement>(null);
  const swatchRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)
          && swatchRef.current && !swatchRef.current.contains(e.target as Node)) {
        setPickerOpenIdx(null);
      }
    }
    if (pickerOpenIdx !== null) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pickerOpenIdx]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Pens</p>
        <button
          onClick={onAddPen}
          title="Add pen"
          className="w-6 h-6 flex items-center justify-center rounded-md text-slate-600 hover:text-blue-400 hover:bg-slate-800 transition-colors"
        >
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3 h-3">
            <path d="M6 1v10M1 6h10" />
          </svg>
        </button>
      </div>

      {/* Pen list — scrollable */}
      <ul className="flex flex-col gap-1 px-2 overflow-y-auto pb-2">
        {[...pens].reverse().map((pen, reversedIdx) => {
          const idx = pens.length - 1 - reversedIdx;
          const isActive = idx === activePenIndex;
          return (
            <li key={idx}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSetActivePenIndex(idx)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSetActivePenIndex(idx); }}
                className={`w-full px-2.5 py-2 rounded-lg border transition-colors text-left group cursor-pointer
                  ${isActive
                    ? "bg-[#0a0c10] border-gray-500/40 text-gray-200"
                    : "bg-transparent border-transparent hover:bg-[#0a0c10] hover:border-slate-700/50 text-slate-400"
                  }`}
              >
                <>
                  <div className="flex items-center gap-2">
                    {/* Pen color dot */}
                    {!isActive && (
                      <div
                        className="w-3 h-3 rounded-full shrink-0 border border-white/10"
                        style={{ backgroundColor: pen.color }}
                      />
                    )}

                    {/* Name — auto-width via ghost span */}
                    <div className="relative min-w-0">
                      {/* Invisible span that sizes the container to fit the text */}
                      <span
                        aria-hidden
                        className="invisible text-xs px-1 py-1 whitespace-pre pointer-events-none"
                      >
                        {pen.name || "\u00a0"}
                      </span>
                      <input
                        type="text"
                        value={pen.name}
                        onChange={(e) => onSetPen(idx, { ...pen, name: e.target.value })}
                        onBlur={(e) => { if (!e.target.value.trim()) onSetPen(idx, { ...pen, name: `Pen ${idx + 1}` }); }}
                        className="absolute inset-0 bg-transparent text-xs text-slate-300 outline-none focus:underline focus:underline-blue-500/50 px-1 py-1"
                      />
                    </div>

                    <div className="flex-1" />

                    {/* delete — only visible on active / hover */}
                    <div
                      className={`flex items-center gap-0.5 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => onDeletePen(idx)}
                        disabled={pens.length === 1}
                        title="Delete pen"
                        className="w-5 h-5 flex items-center justify-center rounded text-slate-700 hover:text-red-400 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                      >
                        <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-2.5 h-2.5">
                          <line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Pen editor — only shown for active pen */}
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
                            if (pickerOpenIdx === idx) { setPickerOpenIdx(null); return; }
                            const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                            setPickerPos({ top: r.bottom + 6, left: r.left });
                            setPickerOpenIdx(idx);
                          }}
                        />
                        <span className="text-xs text-slate-500 font-mono">{pen.color}</span>
                      </div>
                      {pickerOpenIdx === idx && createPortal(
                        <div
                          ref={pickerRef}
                          style={{ position: "fixed", top: pickerPos.top, left: pickerPos.left, zIndex: 9999 }}
                          className="rounded-lg overflow-hidden shadow-xl shadow-black/60 border border-slate-700/60"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <HexColorPicker
                            color={pen.color}
                            onChange={(c) => onSetPen(idx, { ...pen, color: c })}
                          />
                        </div>,
                        document.body
                      )}
                      {/* Width row */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Stroke</span>
                        <div className="flex items-center rounded border border-slate-700/60 bg-[#111520] overflow-hidden">
                          <button
                            onClick={() => { const v = Math.max(0.1, parseFloat((pen.width - 0.1).toFixed(1))); onSetPen(idx, { ...pen, width: v }); }}
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
                              if (!isNaN(v) && v > 0) onSetPen(idx, { ...pen, width: v });
                            }}
                            className="w-10 py-0.5 bg-transparent text-xs text-slate-300 outline-none text-center"
                          />
                          <button
                            onClick={() => {
                              const v = Math.min(10, parseFloat((pen.width + 0.1).toFixed(1)));
                              onSetPen(idx, { ...pen, width: v });
                            }}
                            className="px-1.5 py-0.5 text-slate-500 hover:text-slate-200 hover:bg-slate-700/40 transition-colors text-xs leading-none"
                          >+</button>
                        </div>
                        <span className="text-xs text-slate-500">mm</span>
                      </div>
                    </div>
                  )}
                </>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
