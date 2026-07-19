import type { Element, Pen, PlttrFont } from "../types";
import { useHandwritingGeneration } from "../hooks/useHandwritingGeneration";
import { DropdownSelector } from "../../../shared/components/DropdownSelector";

interface Props {
  elements: Element[];
  fonts: Map<string, PlttrFont>;
  pens: Pen[];
  selectedIds: string[] | null;
  onUpdateElement: (el: Element) => void;
  onDeleteElement: (elementId: string) => void;
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

export default function PropertiesPanel({ elements, fonts, pens, selectedIds, onUpdateElement, onDeleteElement }: Props) {
  const { generating, generate: generateHandwriting } = useHandwritingGeneration();

  // Find the selected element
  let found: Element | null = null;
  if (selectedIds && selectedIds.length === 1) {
    found = elements.find((e) => e.id === selectedIds[0]) ?? null;
  }

  function update(patch: Partial<Element>) {
    if (!found) return;
    onUpdateElement({ ...found, ...patch } as Element);
  }

  return (
    <div className="px-4 pt-3 pb-4 shrink-0">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          {found ? found.type : "Selection"}
        </p>
        {found && (
          <button
            onClick={() => onDeleteElement(found!.id)}
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
        selectedIds && selectedIds.length > 1 ? (
          <p className="text-xs text-slate-700 italic">{selectedIds.length} elements selected</p>
        ) : (
          <p className="text-xs text-slate-700 italic">No element selected</p>
        )
      ) : (
        <div className="flex flex-col gap-2">

          {/* Pen */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-slate-600 w-16 shrink-0">Pen</span>
            <DropdownSelector
              value={found.pen}
              options={pens.map((_, i) => i)}
              onChange={(v) => update({ pen: v })}
              keyOf={(i) => i}
              renderSelected={(i) => (
                <>
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/10"
                    style={{ backgroundColor: pens[i]?.color ?? "#888" }}
                  />
                  <span className="text-xs text-slate-300 flex-1 truncate">
                    {pens[i]?.name ?? `Pen ${i + 1}`}
                  </span>
                </>
              )}
              renderOption={(i) => (
                <>
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/10"
                    style={{ backgroundColor: pens[i]?.color ?? "#888" }}
                  />
                  <span className="text-xs text-slate-300 truncate">{pens[i]?.name ?? `Pen ${i + 1}`}</span>
                </>
              )}
            />
          </div>

          <NumField label="Z" value={found.z} onChange={(v) => update({ z: Math.max(v, 0) })} />

          <div className="h-px bg-slate-800 mx-1 shrink-0" />

          {found.type === "Line" && (() => {
            const el = found;
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

          {found.type === "Rect" && (() => {
            const el = found;
            return <>
              <NumField label="X (mm)"      value={el.x} onChange={(v) => update({ x: v })} />
              <NumField label="Y (mm)"      value={el.y} onChange={(v) => update({ y: v })} />
              <NumField label="Width (mm)"  value={el.w} onChange={(v) => update({ w: Math.max(0.1, v) })} />
              <NumField label="Height (mm)" value={el.h} onChange={(v) => update({ h: Math.max(0.1, v) })} />
            </>;
          })()}

          {found.type === "Circle" && (() => {
            const el = found;
            return <>
              <NumField label="CX (mm)"     value={el.cx} onChange={(v) => update({ cx: v })} />
              <NumField label="CY (mm)"     value={el.cy} onChange={(v) => update({ cy: v })} />
              <NumField label="Radius (mm)" value={el.r}  onChange={(v) => update({ r: Math.max(0.1, v) })} />
            </>;
          })()}

          {found.type === "Text" && (() => {
            const el = found;
            return <>
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-xs text-slate-600">Content</span>
                <textarea
                  value={el.text}
                  rows={3}
                  onChange={(e) => update({ text: e.target.value })}
                  className="w-full px-2 py-1 rounded-md bg-[#0a0c10] border border-slate-700/60 text-xs text-slate-300 outline-none focus:border-blue-500/50 resize-none"
                />
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-slate-600 w-16 shrink-0">Font</span>
                <DropdownSelector
                  value={el.fontName}
                  options={[...fonts.keys()]}
                  onChange={(v) => update({ fontName: v })}
                  keyOf={(n) => n}
                  renderSelected={(n) => (
                    <span className="text-xs text-slate-300 flex-1 truncate">{n}</span>
                  )}
                  renderOption={(n) => (
                    <span className="text-xs text-slate-300 truncate">{n}</span>
                  )}
                />
              </div>
              <NumField label="Size (mm)"   value={el.size} onChange={(v) => update({ size: Math.max(0.5, v) })} />
              <NumField label="X (mm)"      value={el.x}    onChange={(v) => update({ x: v })} />
              <NumField label="Y (mm)"      value={el.y}    onChange={(v) => update({ y: v })} />
              <NumField label="Width (mm)"  value={el.w}    onChange={(v) => update({ w: Math.max(1, v) })} />
              <NumField label="Height (mm)" value={el.h}    onChange={(v) => update({ h: Math.max(1, v) })} />
            </>;
          })()}

          {found.type === "Handwriting" && (() => {
            const el = found;
            return <>
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-xs text-slate-600">Content</span>
                <textarea
                  value={el.text}
                  rows={3}
                  onChange={(e) => update({ text: e.target.value })}
                  className="w-full px-2 py-1 rounded-md bg-[#0a0c10] border border-slate-700/60 text-xs text-slate-300 outline-none focus:border-blue-500/50 resize-none"
                />
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-slate-600 w-16 shrink-0">Style</span>
                <DropdownSelector
                  value={el.style}
                  options={Array.from({ length: 10 }, (_, i) => i)}
                  onChange={(v) => update({ style: v })}
                  keyOf={(i) => i}
                  renderSelected={(i) => <span className="text-xs text-slate-300 flex-1">{i}</span>}
                  renderOption={(i) => <span className="text-xs text-slate-300">{i}</span>}
                />
              </div>

              <button
                onClick={() => generateHandwriting(el.text, el.style, ({ strokes, aspectRatio }) => onUpdateElement({ ...el, strokes, aspectRatio, h: el.w / aspectRatio }))}
                disabled={generating}
                className="mt-1 w-full py-2 rounded-md text-xs font-semibold transition-colors
                  bg-gradient-to-r from-violet-600/30 via-blue-600/25 to-violet-600/30
                  border border-violet-500/40 text-violet-300
                  hover:from-violet-600/50 hover:via-blue-600/40 hover:to-violet-600/50
                  hover:border-violet-400/60 hover:text-violet-200
                  disabled:opacity-40
                  flex items-center justify-center gap-1.5"
              >
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 shrink-0">
                  <path d="M6 1l1.2 3.6L11 6 7.2 7.4 6 11 4.8 7.4 1 6l3.8-1.4z" fill="currentColor" stroke="none" />
                </svg>
                {generating ? "Generating…" : "Generate"}
              </button>
              
              <div className="h-px bg-slate-800 mx-1 shrink-0" />

              <NumField label="X (mm)"      value={el.x} onChange={(v) => update({ x: v })} />
              <NumField label="Y (mm)"      value={el.y} onChange={(v) => update({ y: v })} />
              <NumField label="Width (mm)"  value={el.w} onChange={(v) => update({ w: Math.max(1, v) })} />
              <NumField label="Height (mm)" value={el.h} onChange={(v) => update({ h: Math.max(1, v) })} />
            </>;
          })()}
        </div>
      )}
    </div>
  );
}
