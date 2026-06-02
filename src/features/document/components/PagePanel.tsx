import type { PageSettings } from "../types";
import { PAGE_PRESETS, WORKSPACE_PRESETS } from "../constants";
import { InlineDropdown } from "../../../shared/components/InlineDropdown";

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

  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Page</p>

      {/* Page size */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-slate-400">Paper size</label>
        <InlineDropdown
          value={PAGE_PRESETS[pagePresetIndex] ?? null}
          options={PAGE_PRESETS}
          onChange={(p) => onUpdatePage({ ...page, page_width: p.width, page_height: p.height })}
          keyOf={(p) => p.label}
          renderSelected={(p) => (
            <span className="text-xs text-slate-300 flex-1 truncate">
              {p.label} ({p.width} × {p.height} mm)
            </span>
          )}
          renderOption={(p) => (
            <span className="text-xs text-slate-300 truncate">
              {p.label} ({p.width} × {p.height} mm)
            </span>
          )}
          placeholder={<span className="text-xs text-slate-600 italic flex-1">Custom</span>}
        />
      </div>

      {/* Workspace size */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-slate-400">Plotter workspace</label>
        <InlineDropdown
          value={WORKSPACE_PRESETS[wsPresetIndex] ?? null}
          options={WORKSPACE_PRESETS}
          onChange={(p) => onUpdatePage({ ...page, workspace_width: p.width, workspace_height: p.height })}
          keyOf={(p) => p.label}
          renderSelected={(p) => (
            <span className="text-xs text-slate-300 flex-1 truncate">{p.label}</span>
          )}
          renderOption={(p) => (
            <span className="text-xs text-slate-300 truncate">{p.label}</span>
          )}
          placeholder={<span className="text-xs text-slate-600 italic flex-1">Custom</span>}
        />
      </div>
    </div>
  );
}
