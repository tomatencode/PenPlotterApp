import type { Element, Layer } from "../types";

interface Props {
  layers: Layer[];
  selectedId: string | null;
  onUpdateElement: (layerId: string, el: Element) => void;
  onDeleteElement: (layerId: string, elementId: string) => void;
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-xs text-slate-600 w-16 shrink-0">{label}</span>
      <input
        type="number"
        value={Math.round(value * 100) / 100}
        onChange={(e) => { const n = parseFloat(e.target.value); if (!isNaN(n)) onChange(n); }}
        className="w-full min-w-0 px-2 py-1 rounded-md bg-[#0a0c10] border border-slate-700/60 text-xs text-slate-300 outline-none focus:border-blue-500/50 text-right tabular-nums"
      />
    </div>
  );
}

export default function PropertiesPanel({ layers, selectedId, onUpdateElement, onDeleteElement }: Props) {
  // Find the selected element and which layer it belongs to
  let found: { layerId: string; el: Element } | null = null;
  if (selectedId) {
    for (const layer of layers) {
      const el = layer.elements.find((e) => e.id === selectedId);
      if (el) { found = { layerId: layer.id, el }; break; }
    }
  }

  function update(patch: Partial<Element>) {
    if (!found) return;
    onUpdateElement(found.layerId, { ...found.el, ...patch } as Element);
  }

  return (
    <div className="px-4 pt-3 pb-4 shrink-0">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          {found ? found.el.type : "Selection"}
        </p>
        {found && (
          <button
            onClick={() => onDeleteElement(found!.layerId, found!.el.id)}
            title="Delete element"
            className="w-5 h-5 flex items-center justify-center rounded text-slate-700 hover:text-red-400 transition-colors"
          >
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-2.5 h-2.5">
              <line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" />
            </svg>
          </button>
        )}
      </div>

      {!found ? (
        <p className="text-xs text-slate-700 italic">No element selected</p>
      ) : (
        <div className="flex flex-col gap-2">
          {found.el.type === "Line" && (() => {
            const el = found.el;
            return <>
              <NumField label="X1 (mm)" value={el.x1} onChange={(v) => update({ x1: v })} />
              <NumField label="Y1 (mm)" value={el.y1} onChange={(v) => update({ y1: v })} />
              <NumField label="X2 (mm)" value={el.x2} onChange={(v) => update({ x2: v })} />
              <NumField label="Y2 (mm)" value={el.y2} onChange={(v) => update({ y2: v })} />
              <div className="flex items-center gap-2 min-w-0 mt-1">
                <span className="text-xs text-slate-700 w-16 shrink-0">Length</span>
                <span className="text-xs text-slate-500 tabular-nums">
                  {Math.round(Math.hypot(el.x2 - el.x1, el.y2 - el.y1) * 100) / 100} mm
                </span>
              </div>
            </>;
          })()}

          {found.el.type === "Rect" && (() => {
            const el = found.el;
            return <>
              <NumField label="X (mm)"      value={el.x} onChange={(v) => update({ x: v })} />
              <NumField label="Y (mm)"      value={el.y} onChange={(v) => update({ y: v })} />
              <NumField label="Width (mm)"  value={el.w} onChange={(v) => update({ w: Math.max(0.1, v) })} />
              <NumField label="Height (mm)" value={el.h} onChange={(v) => update({ h: Math.max(0.1, v) })} />
            </>;
          })()}

          {found.el.type === "Circle" && (() => {
            const el = found.el;
            return <>
              <NumField label="CX (mm)"     value={el.cx} onChange={(v) => update({ cx: v })} />
              <NumField label="CY (mm)"     value={el.cy} onChange={(v) => update({ cy: v })} />
              <NumField label="Radius (mm)" value={el.r}  onChange={(v) => update({ r: Math.max(0.1, v) })} />
            </>;
          })()}
        </div>
      )}
    </div>
  );
}
