import ScreenHeader from "../ScreenHeader";

interface Props {
  fileName: string;
  path: string | null;
  canUndo: boolean;
  onUndo: () => void;
  canRedo: boolean;
  onRedo: () => void;
  onBack: () => void;
  onExport: () => void;
}

export default function DocumentToolbar({ fileName, path, canUndo, onUndo, canRedo, onRedo, onBack, onExport }: Props) {
  return (
    <ScreenHeader onBack={onBack} title={fileName} subtitle={path ?? undefined}>
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="flex shrink-0 items-center gap-2 px-4 py-1.5 bg-slate-700/60 hover:bg-slate-600/60 border border-slate-600/60 hover:border-slate-500 rounded-lg text-sm font-semibold text-slate-200 transition-colors disabled:opacity-40 disabled:pointer-events-none"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M2 6h7a4 4 0 0 1 0 8H6" />
          <polyline points="5 3 2 6 5 9" />
        </svg>
        Undo
      </button>

      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="flex shrink-0 items-center gap-2 px-4 py-1.5 bg-slate-700/60 hover:bg-slate-600/60 border border-slate-600/60 hover:border-slate-500 rounded-lg text-sm font-semibold text-slate-200 transition-colors disabled:opacity-40 disabled:pointer-events-none"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M14 6H7a4 4 0 0 0 0 8h3" />
          <polyline points="11 3 14 6 11 9" />
        </svg>
        Redo
      </button>

      <div className="w-px h-5 shrink-0 bg-slate-700/80 mx-1" />
      
      <button
        onClick={onExport}
        className="flex shrink-0 items-center gap-2 px-4 py-1.5 bg-green-700/80 hover:bg-green-600/80 border border-green-600/60 hover:border-green-500 rounded-lg text-sm font-semibold text-green-100 transition-colors shadow-sm shadow-green-900/30"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
        Export to GCode
      </button>
    </ScreenHeader>
  );
}
