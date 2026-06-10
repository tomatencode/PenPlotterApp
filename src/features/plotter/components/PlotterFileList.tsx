import { useState } from "react";
import type { UiState } from "./PlotterStatusCard";
import type { FileInfo } from "../api/plotterClient";

interface Props {
  files: string[];
  uiState: UiState;
  startingFile: string | null;
  onStartFile: (filename: string) => void;
  onDeleteFile: (filename: string) => void;
  onFetchFileInfo: (filename: string) => Promise<FileInfo>;
  onFocusFile: (filename: string | null) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

export default function PlotterFileList({
  files,
  uiState,
  startingFile,
  onStartFile,
  onDeleteFile,
  onFetchFileInfo,
  onFocusFile,
}: Props) {
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [fileInfoCache, setFileInfoCache] = useState<Record<string, FileInfo | "loading" | "error">>({});

  function handleToggle(filename: string) {
    if (expandedFile === filename) {
      setExpandedFile(null);
      onFocusFile(null);
      return;
    }
    setExpandedFile(filename);
    onFocusFile(filename);
    if (!fileInfoCache[filename]) {
      setFileInfoCache(prev => ({ ...prev, [filename]: "loading" }));
      onFetchFileInfo(filename)
        .then(info => {
          setFileInfoCache(prev => ({ ...prev, [filename]: info }));
        })
        .catch(() => {
          setFileInfoCache(prev => ({ ...prev, [filename]: "error" }));
        });
    }
  }

  return (
    <>
      {files.length === 0 ? (
        <p className="px-4 py-3 text-xs text-slate-700 italic">No files on device</p>
      ) : (
        <ul className="flex flex-col gap-0.5 px-2 py-2 overflow-y-auto flex-1">
          {files.map(filename => {
            const isExpanded = expandedFile === filename;
            const info = fileInfoCache[filename];

            return (
              <li key={filename}>
                <button
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-mono transition-colors ${
                    isExpanded
                      ? "text-white bg-slate-700/60 rounded-b-none"
                      : "text-slate-300 hover:bg-slate-700/40 hover:text-white"
                  }`}
                  onClick={() => handleToggle(filename)}
                >
                  {filename}
                </button>

                {isExpanded && (
                  <div className="mb-1 px-2.5 pt-2 pb-2.5 rounded-b-lg bg-[#0d1017] border border-t-0 border-slate-700/60 flex flex-col gap-3">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <p className="text-[10px] text-slate-600 mb-0.5">Lines</p>
                        <p className="text-xs font-mono text-slate-300">
                          {info === "loading" && <span className="text-slate-600">—</span>}
                          {info === "error" && <span className="text-red-500">error</span>}
                          {info && info !== "loading" && info !== "error" && info.lines.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-slate-600 mb-0.5">Size</p>
                        <p className="text-xs font-mono text-slate-300">
                          {info === "loading" && <span className="text-slate-600">—</span>}
                          {info === "error" && <span className="text-red-500">error</span>}
                          {info && info !== "loading" && info !== "error" && formatSize(info.sizeBytes)}
                        </p>
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-slate-600 mb-0.5">Time</p>
                        <p className="text-xs font-mono text-slate-300">
                          {info === "loading" && <span className="text-slate-600">—</span>}
                          {info === "error" && <span className="text-red-500">error</span>}
                          {info && info !== "loading" && info !== "error" && formatTime(info.timeSeconds)}
                        </p>
                      </div>
                    </div>

                    <div className="h-px bg-slate-800" />

                    <div className="flex gap-1.5">
                      <button
                        className="flex-1 flex items-center gap-1.5 px-3 py-1.5 bg-blue-700/80 hover:bg-blue-600/80 border border-blue-600/60 hover:border-blue-500 rounded-lg text-xs font-semibold text-blue-100 transition-colors disabled:opacity-40 disabled:pointer-events-none shadow-sm shadow-blue-900/30"
                        disabled={startingFile !== null || uiState !== "idle"}
                        onClick={() => onStartFile(filename)}
                      >
                        <svg viewBox="0 0 16 16" fill="none" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0">
                          <polygon points="4,2 13,8 4,14" fill="currentColor" stroke="none" />
                        </svg>
                        {startingFile === filename ? "Starting…" : "Start Job"}
                      </button>
                      <button
                        className="px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                        onClick={() => onDeleteFile(filename)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
