import { useState } from "react";
import type { SettingKey, PlotterSettings } from "../../api/plotterClient";

const SETTING_KEYS: SettingKey[] = [
  "drawFeedRate", "travelFeedRate",
  "penUpAngle", "penDownAngle",
  "driverCurrent", "microsteps",
  "homingSpeed", "homingBackOffSpeed",
  "stallguardThreshold",
  "backOffStepsX", "backOffStepsY",
  "homingTimeout", "sgCheckInterval",
  "sgStartTimeout", "sgHistorySize",
];

const SETTING_LABEL: Partial<Record<SettingKey, string>> = {
  drawFeedRate:        "Draw Feed Rate",
  travelFeedRate:      "Travel Feed Rate",
  penUpAngle:          "Pen Up Angle",
  penDownAngle:        "Pen Down Angle",
  driverCurrent:       "Driver Current",
  microsteps:          "Microsteps",
  homingSpeed:         "Homing Speed",
  homingBackOffSpeed:  "Homing Back-Off",
  stallguardThreshold: "Stallguard",
  backOffStepsX:       "Back-Off X",
  backOffStepsY:       "Back-Off Y",
  homingTimeout:       "Homing Timeout",
  sgCheckInterval:     "SG Check Interval",
  sgStartTimeout:      "SG Start Timeout",
  sgHistorySize:       "SG History Size",
};

const SETTING_UNITS: Partial<Record<SettingKey, { conversionFactor: number; unit: string }>> = {
  drawFeedRate:       { conversionFactor: 1,     unit: "mm/s"   },
  travelFeedRate:     { conversionFactor: 1,     unit: "mm/s"   },
  homingSpeed:        { conversionFactor: 1,     unit: "stps/s" },
  homingBackOffSpeed: { conversionFactor: 1,     unit: "stps/s" },
  homingTimeout:      { conversionFactor: 0.001, unit: "s"      },
  sgCheckInterval:    { conversionFactor: 1,     unit: "ms"     },
  sgStartTimeout:     { conversionFactor: 0.001, unit: "s"      },
};

function toDisplay(key: SettingKey, raw: string): string {
  const u = SETTING_UNITS[key];
  if (!u) return raw;
  const n = parseFloat(raw);
  if (isNaN(n)) return raw;
  const converted = n * u.conversionFactor;
  return Number.isInteger(converted) ? String(converted) : converted.toPrecision(6).replace(/\.?0+$/, "");
}

function toRaw(key: SettingKey, display: string): string {
  const u = SETTING_UNITS[key];
  if (!u) return display;
  const n = parseFloat(display);
  if (isNaN(n)) return display;
  return String(n / u.conversionFactor);
}

interface Props {
  settings: PlotterSettings;
  onChangeSetting: (key: SettingKey, rawValue: string) => Promise<void>;
}

export default function PlotterSettingsPanel({ settings, onChangeSetting }: Props) {
  const [editingKey, setEditingKey] = useState<SettingKey | null>(null);
  const [editValue, setEditValue] = useState("");

  function beginEdit(key: SettingKey) {
    setEditingKey(key);
    const raw = settings[key] ?? "";
    setEditValue(raw ? toDisplay(key, raw) : "");
  }

  async function commitEdit(key: SettingKey) {
    setEditingKey(null);
    const trimmed = editValue.trim();
    if (!trimmed) return;
    const raw = toRaw(key, trimmed);
    if (raw === (settings[key] ?? "")) return;
    await onChangeSetting(key, raw);
  }

  return (
    <div className="px-4 py-4 flex flex-col gap-0.5">
      {SETTING_KEYS.map(key => (
        <div key={key} className="flex flex-row gap-0.5 py-1">
          <p className="text-xs text-slate-600">{(SETTING_LABEL[key] ?? key) + ":"}</p>
          {editingKey === key ? (
            <input
              autoFocus
              className="w-full text-xs font-mono bg-[#0a0c10] border border-blue-500/50 rounded px-1.5 py-0.5 text-slate-200 outline-none"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={() => commitEdit(key)}
              onKeyDown={e => {
                if (e.key === "Enter") commitEdit(key);
                if (e.key === "Escape") setEditingKey(null);
              }}
            />
          ) : (
            <button
              className="text-left text-xs font-mono text-slate-300 hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-700/40 transition-colors"
              onClick={() => beginEdit(key)}
            >
              {settings[key]
                ? <>{toDisplay(key, settings[key]!)}{SETTING_UNITS[key] && <span className="text-slate-600 ml-1">{SETTING_UNITS[key]!.unit}</span>}</>
                : <span className="text-slate-700 italic">—</span>}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
