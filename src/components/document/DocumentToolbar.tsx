import ScreenHeader from "../ScreenHeader";

interface Props {
  fileName: string;
  path: string | null;
  onBack: () => void;
  onExport: () => void;
}

export default function DocumentToolbar({ fileName, path, onBack, onExport }: Props) {
  return (
    <ScreenHeader onBack={onBack} title={fileName} subtitle={path ?? undefined}>
      <button
        onClick={onExport}
        className="flex items-center gap-2 px-4 py-1.5 bg-green-700/80 hover:bg-green-600/80 border border-green-600/60 hover:border-green-500 rounded-lg text-sm font-semibold text-green-100 transition-colors shadow-sm shadow-green-900/30"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
        Export to GCode
      </button>
    </ScreenHeader>
  );
}
