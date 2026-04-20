import { useState } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

interface ContextMenu {
  x: number;
  y: number;
  filePath: string;
}

interface Props {
  files: string[];
  onOpen: (path: string) => void;
  onRemoveRecent: (path: string) => void;
}

function PnplttrIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 2h6l4 4v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
      <path d="M10 2v4h4" />
      <line x1="5" y1="9" x2="11" y2="9" />
      <line x1="5" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function GcodeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="7" cy="8" r="2.2" />
      <path d="M8 2.1l.6 1.2 1.35.28.95-.98 1.4 1.4-.98.95.28 1.35 1.2.6v2l-1.2.6-.28 1.35.98.95-1.4 1.4-.95-.98-1.35.28-.6 1.2h-2l-.6-1.2-1.35-.28-.95.98-1.4-1.4.98-.95-.28-1.35-1.2-.6v-2l1.2-.6.28-1.35-.98-.95 1.4-1.4.95.98 1.35-.28.6-1.2h2z" />
    </svg>
  );
}

function fileType(filePath: string): "pnplttr" | "gcode" | "other" {
  if (filePath.endsWith(".pnplttr")) return "pnplttr";
  if (filePath.endsWith(".gcode")) return "gcode";
  return "other";
}

const TYPE_STYLES = {
  pnplttr: {
    card: "hover:bg-[#141926] hover:border-green-500/40",
    icon: "text-slate-600 group-hover:text-green-400",
    name: "group-hover:text-green-300",
  },
  gcode: {
    card: "hover:bg-[#111b25] hover:border-blue-500/40",
    icon: "text-slate-600 group-hover:text-blue-400",
    name: "group-hover:text-blue-300",
  },
  other: {
    card: "hover:bg-[#141926] hover:border-slate-500/40",
    icon: "text-slate-600 group-hover:text-slate-400",
    name: "group-hover:text-slate-300",
  },
};

export default function RecentFilesList({ files, onOpen, onRemoveRecent }: Props) {
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  function handleContextMenu(e: React.MouseEvent, filePath: string) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, filePath });
  }

  function handleReveal() {
    if (!contextMenu) return;
    revealItemInDir(contextMenu.filePath);
    setContextMenu(null);
  }

  return (
    <main className="flex-1 flex flex-col overflow-hidden" onClick={() => setContextMenu(null)}>
      <div className="px-6 pt-6 pb-3 shrink-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Recent Files</p>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        {files.length > 0 ? (
          <ul className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 content-start">
            {files.map((filePath) => {
              const type = fileType(filePath);
              const styles = TYPE_STYLES[type];
              return (
                <li key={filePath}>
                  <button
                    onClick={() => onOpen(filePath)}
                    onContextMenu={(e) => handleContextMenu(e, filePath)}
                    className={`w-full h-full text-left px-5 py-4 rounded-xl bg-[#111520] border border-slate-700/50 transition-colors group shadow-sm shadow-black/30 ${styles.card}`}
                    title={filePath}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 shrink-0 transition-colors ${styles.icon}`}>
                        {type === "gcode" ? (
                          <GcodeIcon className="w-5 h-5" />
                        ) : (
                          <PnplttrIcon className="w-5 h-5" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <span className={`block font-semibold text-sm text-gray-200 transition-colors truncate ${styles.name}`}>
                          {filePath.split(/[\\/]/).pop()}
                        </span>
                        <span className="block text-xs text-slate-600 truncate mt-1">{filePath}</span>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 text-center h-full">
            <PnplttrIcon className="w-10 h-10 text-slate-800" />
            <p className="text-slate-600 text-sm">No recent files</p>
            <p className="text-slate-700 text-xs">Create a new document or open an existing one to get started</p>
          </div>
        )}
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 min-w-44 rounded-lg bg-[#1a1f2e] border border-slate-700/80 shadow-xl shadow-black/50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleReveal}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors text-left"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
              <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3H7l2 2h3.5A1.5 1.5 0 0 1 14 6.5V12a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12V4.5z" />
            </svg>
            Reveal in File Explorer
          </button>
          <button
            onClick={() => {
              if (contextMenu) {
                onRemoveRecent(contextMenu.filePath);
                setContextMenu(null);
              }
            }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors text-left"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
              <line x1="3" y1="3" x2="13" y2="13" />
              <line x1="3" y1="13" x2="13" y2="3" />
            </svg>
            Remove from Recent
          </button>
        </div>
      )}
    </main>
  );
}
