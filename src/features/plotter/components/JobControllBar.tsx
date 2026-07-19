import type { WsStateMessage } from "../api/plotterTypes";
import { btnBlue, btnRed, btnSlate, btnYellow } from "../../../shared/styles";

interface Props {
  wsState: WsStateMessage | null;
  onPause: () => void;
  onResume: () => void;
  onAbort: () => void;
  onSendGcode?: (gcode: string) => void;
}

export default function JobControlBar({ wsState, onPause, onResume, onAbort, onSendGcode }: Props) {
  const active = wsState?.jobActive ?? false;
  const motionState = wsState?.motionState ?? "idle";
  const connected = wsState !== null;
  const penDown = wsState?.penDown ?? false;

  if (!active) {
    return (
      <div className="shrink-0 border-t border-slate-700/60 bg-[#0d1017] flex items-center justify-center gap-3 py-2.5 px-5">
        <button
          onClick={() => onSendGcode?.("G28")}
          disabled={!connected || !onSendGcode}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs ${btnSlate}`}
        >
          <HomeIcon />
          Home
        </button>
        {penDown ? (
          <button
            onClick={() => onSendGcode?.("M5")}
            disabled={!connected || !onSendGcode}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs ${btnBlue}`}
          >
            <PenUpIcon />
            Pen Up
          </button>
        ) : (
          <button
            onClick={() => onSendGcode?.("M3")}
            disabled={!connected || !onSendGcode}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs ${btnBlue}`}
          >
            <PenDownIcon />
            Pen Down
          </button>
        )}
      </div>
    );
  }

  const filename = wsState!.jobFile;
  const pct = Math.round(wsState!.jobProgress * 100);
  const currentLine = wsState!.jobLine;
  const totalLines = wsState!.jobTotalLines;
  const jobRemainingTime = wsState!.jobRemainingSeconds;
  const isPaused = motionState === "paused";

  return (
    <div className="shrink-0 border-t border-slate-700/60 bg-[#0d1017] flex items-center gap-4 px-5 py-2.5">

      {/* Filename */}
      <span
        className="text-xs font-mono text-slate-300 truncate max-w-[16rem] shrink-0"
        title={filename}
      >
        {filename}
      </span>

      <div className="h-3.5 w-px bg-slate-700/80 shrink-0" />

      {/* Progress bar */}
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${
              isPaused ? "bg-yellow-500" : "bg-blue-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span
          className={`text-xs font-semibold tabular-nums w-9 text-right shrink-0 ${
            isPaused ? "text-yellow-400" : "text-slate-300"
          }`}
        >
          {pct}%
        </span>
      </div>

      {/* Line counter */}
      <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
        <span className="text-slate-400">{currentLine.toLocaleString()}</span>
        {" / "}
        <span>{totalLines.toLocaleString()}</span>
        <span className="ml-1 text-slate-700">lines</span>
      </span>

      {/* remaining time */}
      <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
        <span className="text-slate-700 mr-1">~</span>
        {jobRemainingTime >= 3600 && (
          <>
            <span className="text-slate-400">{Math.floor(jobRemainingTime / 3600).toLocaleString()}</span>
            <span className="ml-0.5 mr-1 text-slate-700">h</span>
          </>
        )}
        {jobRemainingTime >= 60 && (
          <>
            <span className="text-slate-400">{Math.floor((jobRemainingTime % 3600) / 60).toLocaleString()}</span>
            <span className="ml-0.5 mr-1 text-slate-700">m</span>
          </>
        )}
        <span className="text-slate-400">
          {jobRemainingTime >= 60
            ? String(jobRemainingTime % 60).padStart(2, "0")
            : jobRemainingTime % 60}
        </span>
        <span className="ml-0.5 text-slate-700">s</span>
      </span>

      <div className="h-3.5 w-px bg-slate-700/80 shrink-0" />

      {/* Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isPaused ? (
          <button
            onClick={onResume}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs ${btnYellow}`}
          >
            <ResumeIcon />
            Resume
          </button>
        ) : (
          <button
            onClick={onPause}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs ${btnSlate}`}
          >
            <PauseIcon />
            Pause
          </button>
        )}
        <button
          onClick={onAbort}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs ${btnRed}`}
        >
          <StopIcon />
          Abort
        </button>
      </div>
    </div>
  );
}

function HomeIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 5.5L5.5 1L10 5.5" />
      <path d="M2.5 4.5V10H8.5V4.5" />
      <path d="M4.25 10V7.5H6.75V10" />
    </svg>
  );
}

function PenUpIcon() {
  return (
    <svg width="10" height="11" viewBox="0 0 10 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5.5" width="4" height="4" rx="0.5" />
      <line x1="5" y1="5" x2="5" y2="2" />
      <path d="M3.5 3.5L5 1.5L6.5 3.5" />
    </svg>
  );
}

function PenDownIcon() {
  return (
    <svg width="10" height="11" viewBox="0 0 10 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="1.5" width="4" height="4" rx="0.5" />
      <line x1="5" y1="6" x2="5" y2="9" />
      <path d="M3.5 7.5L5 9.5L6.5 7.5" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="10" height="11" viewBox="0 0 10 11" fill="currentColor" aria-hidden="true">
      <rect x="1" y="1" width="3" height="9" rx="1" />
      <rect x="6" y="1" width="3" height="9" rx="1" />
    </svg>
  );
}

function ResumeIcon() {
  return (
    <svg width="10" height="11" viewBox="0 0 10 11" fill="currentColor" aria-hidden="true">
      <path d="M2 1.5L9 5.5L2 9.5Z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" />
    </svg>
  );
}
