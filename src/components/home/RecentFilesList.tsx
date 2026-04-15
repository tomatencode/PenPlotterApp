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
            {files.map((filePath) => (
              <li key={filePath}>
                <button
                  onClick={() => onOpen(filePath)}
                  onContextMenu={(e) => handleContextMenu(e, filePath)}
                  className="w-full h-full text-left px-5 py-4 rounded-xl bg-[#111520] hover:bg-[#141926] border border-slate-700/50 hover:border-green-500/40 transition-colors group shadow-sm shadow-black/30"
                  title={filePath}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-slate-600 group-hover:text-green-400 transition-colors text-base leading-none shrink-0">⬡</span>
                    <div className="min-w-0">
                      <span className="block font-semibold text-sm text-gray-200 group-hover:text-green-300 transition-colors truncate">
                        {filePath.split(/[\\/]/).pop()}
                      </span>
                      <span className="block text-xs text-slate-600 truncate mt-1">{filePath}</span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 text-center h-full">
            <span className="text-5xl opacity-10 select-none">⬡</span>
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
