type UiState = "idle" | "running" | "paused" | "connecting";

const STATE_STYLES: Record<UiState, { dot: string; label: string; text: string; bg: string }> = {
  idle:       { dot: "bg-green-400",               label: "Idle",       text: "text-green-400",  bg: "bg-green-400/10 border-green-500/20"   },
  running:    { dot: "bg-blue-400 animate-pulse",  label: "Running",    text: "text-blue-400",   bg: "bg-blue-400/10 border-blue-500/20"     },
  paused:     { dot: "bg-yellow-400",              label: "Paused",     text: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-500/20" },
  connecting: { dot: "bg-slate-500 animate-pulse", label: "Connecting WS", text: "text-slate-500",  bg: "bg-slate-500/10 border-slate-500/20" },
};

interface Props {
  state: UiState;
}

export default function PlotterStatusCard({ state }: Props) {
  const s = STATE_STYLES[state];
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border min-w-[120px] ${s.bg}`}>
      <div className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
      <div>
        <p className={`text-sm font-semibold leading-tight ${s.text}`}>{s.label}</p>
      </div>
    </div>
  );
}

export type { UiState };
