interface Props {
  files: string[];
  onOpen: (path: string) => void;
}

export default function RecentFilesList({ files, onOpen }: Props) {
  return (
    <main className="flex-1 flex flex-col overflow-hidden">
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
    </main>
  );
}
