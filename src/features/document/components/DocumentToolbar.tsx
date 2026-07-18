import ScreenHeader from "../../../shared/components/ScreenHeader";
import { btnGreen, btnSlate } from "../../../shared/styles";

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
        className={`flex shrink-0 items-center gap-2 px-4 py-1.5 text-sm ${btnSlate}`}
      </button>

      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={`flex shrink-0 items-center gap-2 px-4 py-1.5 text-sm ${btnSlate}`}
      </button>

      <div className="w-px h-5 shrink-0 bg-slate-700/80 mx-1" />
      
      <button
        onClick={onExport}
        className={`flex shrink-0 items-center gap-2 px-4 py-1.5 text-sm ${btnGreen}`}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
        Export to GCode
      </button>
    </ScreenHeader>
  );
}
