import type { UiState } from "./PlotterStatusCard";

interface Props {
  files: string[];
  uiState: UiState;
  startingFile: string | null;
  onStartFile: (filename: string) => void;
}

export default function PlotterFileList({ files, uiState, startingFile, onStartFile }: Props) {
  return (
    <>
      {files.length === 0 ? (
        <p className="px-4 py-3 text-xs text-slate-700 italic">No files on device</p>
      ) : (
        <ul className="flex flex-col gap-0.5 px-2 pb-2 overflow-y-auto flex-1">
          {files.map(filename => (
            <li key={filename}>
              <button
                className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-mono text-slate-300 hover:bg-slate-700/40 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={startingFile !== null || uiState !== "idle"}
                onClick={() => onStartFile(filename)}
                title={`Start ${filename}`}
              >
                {startingFile === filename
                  ? <span className="text-blue-400">Starting…</span>
                  : filename}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
