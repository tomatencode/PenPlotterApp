interface Props {
  fileName: string;
  path: string | null;
  onBack: () => void;
  onExport: () => void;
}

export default function DocumentToolbar({ fileName, path, onBack, onExport }: Props) {
  return (
    <header className="flex items-center gap-2 px-4 py-2 bg-[#0d1017] border-b border-slate-700/60 shrink-0">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-blue-400 transition-colors px-2 py-1.5 rounded-md hover:bg-slate-800/70"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
          <path d="M10 3L5 8l5 5" />
        </svg>
        Home
      </button>

      <div className="w-px h-5 bg-slate-700/80 mx-1" />

      <span className="text-sm font-semibold text-gray-200 mr-1">{fileName}</span>
      {path && <span className="text-xs text-slate-600 truncate max-w-xs hidden md:block">{path}</span>}

      <div className="flex-1" />

      <button
        onClick={onExport}
        className="flex items-center gap-2 px-4 py-1.5 bg-green-700/80 hover:bg-green-600/80 border border-green-600/60 hover:border-green-500 rounded-lg text-sm font-semibold text-green-100 transition-colors shadow-sm shadow-green-900/30"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
        Export to GCode
      </button>
    </header>
  );
}
