import { useLocation, useNavigate } from "react-router-dom";

interface LocationState {
  json: string;
  path: string | null;
}

export default function DocumentScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { json, path } = (location.state as LocationState) ?? { json: "{}", path: null };

  const fileName = path ? path.split(/[\\/]/).pop() : "Untitled";

  return (
    <div className="h-full bg-[#0a0c10] text-gray-100 flex flex-col">
      {/* Toolbar */}
      <header className="flex items-center gap-3 px-5 py-3 bg-[#111520] border-b border-slate-700/60 shadow-md shadow-black/30">
        <button
          onClick={() => navigate("/")}
          className="text-sm text-slate-400 hover:text-blue-400 transition-colors px-2 py-1 rounded hover:bg-slate-800"
        >
          ← Home
        </button>
        <div className="w-px h-5 bg-slate-700" />
        <span className="text-sm font-semibold text-gray-200">{fileName}</span>
        {path && (
          <span className="text-xs text-slate-600 truncate hidden sm:block">{path}</span>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Document JSON</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>
          <div className="bg-[#111520] border border-slate-700/60 rounded-xl shadow-lg shadow-black/40 overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[#0d1017] border-b border-slate-700/60">
              <span className="w-3 h-3 rounded-full bg-purple-500/70" />
              <span className="w-3 h-3 rounded-full bg-blue-500/70" />
              <span className="w-3 h-3 rounded-full bg-green-500/70" />
            </div>
            <pre className="p-5 text-sm text-green-300 overflow-auto whitespace-pre-wrap break-all leading-relaxed">
              {JSON.stringify(JSON.parse(json), null, 2)}
            </pre>
          </div>
        </div>
      </main>
    </div>
  );
}

