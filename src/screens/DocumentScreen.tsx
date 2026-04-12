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
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Toolbar */}
      <header className="flex items-center gap-4 px-4 py-3 bg-gray-900 border-b border-gray-800">
        <button
          onClick={() => navigate("/")}
          className="text-sm text-gray-400 hover:text-gray-100 transition-colors"
        >
          ← Home
        </button>
        <span className="text-sm font-medium">{fileName}</span>
        {path && <span className="text-xs text-gray-500 truncate">{path}</span>}
      </header>

      {/* JSON viewer */}
      <main className="flex-1 p-6 overflow-auto">
        <pre className="bg-gray-900 rounded-lg p-4 text-sm text-green-300 overflow-auto whitespace-pre-wrap break-all">
          {JSON.stringify(JSON.parse(json), null, 2)}
        </pre>
      </main>
    </div>
  );
}

