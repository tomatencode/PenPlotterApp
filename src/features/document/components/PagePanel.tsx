import type { PageSettings } from "../types";
import { PAGE_PRESETS, WORKSPACE_PRESETS } from "../constants";

interface Props {
  page: PageSettings;
  onUpdatePage: (page: PageSettings) => void;
}

export default function PagePanel({ page, onUpdatePage }: Props) {
  const pagePresetIndex = PAGE_PRESETS.findIndex(
    (p) => p.width === page.page_width && p.height === page.page_height,
  );

  const wsPresetIndex = WORKSPACE_PRESETS.findIndex((p) =>
    p.width === null
      ? page.workspace_width === page.page_width && page.workspace_height === page.page_height
      : p.width === page.workspace_width && p.height === page.workspace_height,
  );

  function applyPagePreset(index: number) {
    const preset = PAGE_PRESETS[index];
    if (!preset) return;
    onUpdatePage({
      ...page,
      page_width: preset.width,
      page_height: preset.height,
    });
  }

  function applyWorkspacePreset(index: number) {
    const preset = WORKSPACE_PRESETS[index];
    if (!preset) return;
    onUpdatePage({
      ...page,
      workspace_width:  preset.width,
      workspace_height: preset.height,
    });
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Page</p>

      {/* Page size */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-slate-400">Paper size</label>
        <select
          className="bg-slate-800 appearance-none border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={pagePresetIndex}
          onChange={(e) => applyPagePreset(Number(e.target.value))}
        >
          {PAGE_PRESETS.map((p, i) => (
            <option key={p.label} value={i}>
              {p.label} ({p.width} × {p.height} mm)
            </option>
          ))}
        </select>
      </div>

      {/* Workspace size */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-slate-400">Plotter workspace</label>
        <select
          className="bg-slate-800 appearance-none border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={wsPresetIndex}
          onChange={(e) => applyWorkspacePreset(Number(e.target.value))}
        >
          {WORKSPACE_PRESETS.map((p, i) => (
            <option key={p.label} value={i}>{p.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
