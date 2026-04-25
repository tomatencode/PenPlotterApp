import { RefObject } from "react";

interface Props {
  showNameInput: boolean;
  newName: string;
  error: string | null;
  nameInputRef: RefObject<HTMLInputElement | null>;
  onToggleNameInput: (show: boolean) => void;
  onNameChange: (name: string) => void;
  onCreate: () => void;
  onOpen: () => void;
}

export default function DocumentActions({
  showNameInput,
  newName,
  error,
  nameInputRef,
  onToggleNameInput,
  onNameChange,
  onCreate,
  onOpen,
}: Props) {
  return (
    <div className="px-4 py-4 flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest px-2 mb-1">Documents</p>

      {showNameInput ? (
        <form onSubmit={(e) => { e.preventDefault(); onCreate(); }} className="flex flex-col gap-2 px-1">
          <input
            ref={nameInputRef}
            value={newName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Document name…"
            className="w-full px-3 py-2 rounded-lg bg-[#0a0c10] border border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 outline-none text-sm text-gray-100 placeholder-slate-500"
          />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 border border-blue-500 rounded-lg font-semibold text-sm transition-colors">
              Create
            </button>
            <button type="button" onClick={() => { onToggleNameInput(false); onNameChange(""); }}
              className="flex-1 px-3 py-2 bg-transparent hover:bg-slate-800 border border-slate-700 rounded-lg font-medium text-sm text-slate-400 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <button onClick={() => onToggleNameInput(true)}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 bg-blue-600 hover:bg-blue-500 border border-blue-500 rounded-lg font-semibold text-sm transition-colors text-left">
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5 shrink-0">
              <path d="M6 1v10M1 6h10" />
            </svg>
            New Document
          </button>
          <button onClick={onOpen}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 bg-transparent hover:bg-slate-800/70 border border-slate-700/60 hover:border-slate-600 rounded-lg font-medium text-sm text-slate-300 transition-colors text-left">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
              <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3H7l2 2h3.5A1.5 1.5 0 0 1 14 6.5V12a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12V4.5z" />
            </svg>
            Open File…
          </button>
        </>
      )}

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-950/60 border border-red-700/60 text-red-400 text-xs">{error}</div>
      )}
    </div>
  );
}
