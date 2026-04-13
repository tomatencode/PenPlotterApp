import { useState } from "react";
import { useNavigate } from "react-router-dom";

// ── Types ─────────────────────────────────────────────────────────────────
interface PenPreset {
  id: string;
  name: string;
  color: string;   // hex
  widthMm: number;
}

// Stub data — replace with persisted store later
const INITIAL_PENS: PenPreset[] = [
  { id: "1", name: "Ballpoint Black",  color: "#e2e8f0", widthMm: 0.3 },
  { id: "2", name: "Ballpoint Black",  color: "#e2e8f0", widthMm: 0.5 },
  { id: "3", name: "Marker Blue",      color: "#60a5fa", widthMm: 0.8 },
  { id: "4", name: "Marker Green",     color: "#4ade80", widthMm: 0.8 },
  { id: "5", name: "Felt Tip Red",     color: "#f87171", widthMm: 1.0 },
  { id: "6", name: "Gel Pen Purple",   color: "#c084fc", widthMm: 0.5 },
];

const PRESET_COLORS = [
  "#e2e8f0", "#f87171", "#fb923c", "#facc15",
  "#4ade80", "#34d399", "#60a5fa", "#818cf8",
  "#c084fc", "#f472b6", "#94a3b8", "#1e293b",
];

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function PensScreen() {
  const navigate = useNavigate();
  const [pens, setPens] = useState<PenPreset[]>(INITIAL_PENS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formColor, setFormColor] = useState(PRESET_COLORS[0]);
  const [formWidth, setFormWidth] = useState("0.5");

  function openNewForm() {
    setEditingId(null);
    setFormName("");
    setFormColor(PRESET_COLORS[0]);
    setFormWidth("0.5");
    setShowForm(true);
  }

  function openEditForm(pen: PenPreset) {
    setEditingId(pen.id);
    setFormName(pen.name);
    setFormColor(pen.color);
    setFormWidth(String(pen.widthMm));
    setShowForm(true);
  }

  function handleSave() {
    const width = parseFloat(formWidth);
    if (!formName.trim() || isNaN(width) || width <= 0) return;

    if (editingId) {
      setPens((prev) =>
        prev.map((p) =>
          p.id === editingId ? { ...p, name: formName.trim(), color: formColor, widthMm: width } : p
        )
      );
    } else {
      setPens((prev) => [
        ...prev,
        { id: newId(), name: formName.trim(), color: formColor, widthMm: width },
      ]);
    }
    setShowForm(false);
  }

  function handleDelete(id: string) {
    setPens((prev) => prev.filter((p) => p.id !== id));
    if (editingId === id) setShowForm(false);
  }

  return (
    <div className="h-full bg-[#0a0c10] text-gray-100 flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-5 py-3 bg-[#0d1017] border-b border-slate-700/60 shrink-0">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-blue-400 transition-colors px-2 py-1.5 rounded-md hover:bg-slate-800/70"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <path d="M10 3L5 8l5 5" />
          </svg>
          Home
        </button>
        <div className="w-px h-5 bg-slate-700/80" />
        <span className="text-sm font-semibold text-gray-200">Pen Presets</span>
        <div className="flex-1" />
        <button
          onClick={openNewForm}
          className="flex items-center gap-2 px-4 py-1.5 bg-purple-700/80 hover:bg-purple-600/80 border border-purple-600/60 hover:border-purple-500 rounded-lg text-sm font-semibold text-purple-100 transition-colors"
        >
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="w-3.5 h-3.5">
            <path d="M6 1v10M1 6h10" />
          </svg>
          New Pen
        </button>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Pen list ── */}
        <main className="flex-1 overflow-auto p-6">
          {pens.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <p className="text-slate-600 text-sm">No pen presets yet</p>
              <button onClick={openNewForm} className="text-xs text-purple-400 hover:underline">
                Create your first pen
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 content-start">
              {pens.map((pen) => (
                <button
                  key={pen.id}
                  onClick={() => openEditForm(pen)}
                  className={`text-left px-5 py-4 rounded-xl border transition-colors group shadow-sm shadow-black/30
                    ${editingId === pen.id
                      ? "bg-[#141926] border-purple-500/50"
                      : "bg-[#111520] hover:bg-[#141926] border-slate-700/50 hover:border-purple-500/30"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Color + stroke preview */}
                    <div className="flex flex-col items-center gap-1.5 shrink-0">
                      <div
                        className="w-8 h-8 rounded-full border-2 border-white/10"
                        style={{ backgroundColor: pen.color }}
                      />
                      <div
                        className="rounded-full"
                        style={{
                          width: 24,
                          height: Math.max(1, pen.widthMm * 2.5),
                          backgroundColor: pen.color,
                          opacity: 0.7,
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-200 truncate group-hover:text-purple-300 transition-colors">
                        {pen.name}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">{pen.widthMm} mm tip</p>
                    </div>
                    {/* Edit indicator */}
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                      className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-500 transition-colors ml-auto shrink-0">
                      <path d="M11 2l3 3-8 8H3v-3L11 2z" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </main>

        {/* ── Edit / Create panel ── */}
        {showForm && (
          <aside className="w-72 shrink-0 flex flex-col bg-[#0d1017] border-l border-slate-700/60 overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-700/60 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">
                {editingId ? "Edit Pen" : "New Pen"}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-slate-600 hover:text-slate-300 transition-colors">
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="w-4 h-4">
                  <line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-5 p-5">

              {/* Preview */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0a0c10] border border-slate-700/40">
                <div className="w-10 h-10 rounded-full border-2 border-white/10 shrink-0" style={{ backgroundColor: formColor }} />
                <div>
                  <p className="text-sm font-medium text-slate-200 truncate">{formName || "Pen name"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="rounded-full" style={{ width: 36, height: Math.max(1, parseFloat(formWidth || "0") * 2.5), backgroundColor: formColor, opacity: 0.7 }} />
                    <span className="text-xs text-slate-600">{formWidth || "0"} mm</span>
                  </div>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-widest mb-1.5">Name</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Ballpoint Black"
                  className="w-full px-3 py-2 rounded-lg bg-[#0a0c10] border border-slate-700/60 focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/20 outline-none text-sm text-gray-100 placeholder-slate-600"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-widest mb-2">Color</label>
                <div className="grid grid-cols-6 gap-2 mb-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setFormColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110
                        ${formColor === c ? "border-white/70 scale-110" : "border-transparent border-white/10"}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
                {/* Custom hex input */}
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-6 h-6 rounded-md border border-white/10 shrink-0" style={{ backgroundColor: formColor }} />
                  <input
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="flex-1 px-2 py-1 rounded-md bg-[#0a0c10] border border-slate-700/60 text-xs text-slate-300 outline-none focus:border-purple-500/60 font-mono"
                    placeholder="#e2e8f0"
                    maxLength={7}
                  />
                </div>
              </div>

              {/* Stroke width */}
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-widest mb-1.5">Tip Width</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={formWidth}
                    onChange={(e) => setFormWidth(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0c10] border border-slate-700/60 focus:border-purple-500/60 outline-none text-sm text-gray-100"
                  />
                  <span className="text-xs text-slate-500 shrink-0">mm</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={handleSave}
                  className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-500 border border-purple-500 rounded-lg font-semibold text-sm transition-colors"
                >
                  {editingId ? "Save Changes" : "Create Pen"}
                </button>
                {editingId && (
                  <button
                    onClick={() => handleDelete(editingId)}
                    className="w-full px-4 py-2 bg-transparent hover:bg-red-950/40 border border-slate-700 hover:border-red-700/60 rounded-lg font-medium text-sm text-slate-500 hover:text-red-400 transition-colors"
                  >
                    Delete Pen
                  </button>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
