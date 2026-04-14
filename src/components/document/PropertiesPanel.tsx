import type { Tool } from "./types";

// Placeholder values — will be derived from the selected shape later
const SHAPE_PROPS: Record<string, { label: string; value: string }[]> = {
  select: [],
  line: [
    { label: "X1",     value: "0 mm"    },
    { label: "Y1",     value: "0 mm"    },
    { label: "X2",     value: "50 mm"   },
    { label: "Y2",     value: "50 mm"   },
    { label: "Length", value: "70.7 mm" },
  ],
  rect: [
    { label: "X",      value: "0 mm"   },
    { label: "Y",      value: "0 mm"   },
    { label: "Width",  value: "100 mm" },
    { label: "Height", value: "60 mm"  },
  ],
  circle: [
    { label: "Center X", value: "50 mm" },
    { label: "Center Y", value: "50 mm" },
    { label: "Radius",   value: "25 mm" },
  ],
  text: [
    { label: "X",       value: "0 mm"  },
    { label: "Y",       value: "0 mm"  },
    { label: "Size",    value: "12 pt" },
    { label: "Content", value: "Text"  },
  ],
};

interface Props {
  activeTool: Tool;
}

export default function PropertiesPanel({ activeTool }: Props) {
  const shapeProps = SHAPE_PROPS[activeTool] ?? [];
  const title = activeTool === "select"
    ? "Selection"
    : activeTool.charAt(0).toUpperCase() + activeTool.slice(1);

  return (
    <div className="px-4 pt-3 pb-4 shrink-0">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
        {title}
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
  );
}
