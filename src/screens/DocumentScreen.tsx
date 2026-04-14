import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { type Layer, type Tool, PENS, newLayerId } from "../components/document/types";
import DocumentToolbar from "../components/document/DocumentToolbar";
import ToolPalette from "../components/document/ToolPalette";
import CanvasArea from "../components/document/CanvasArea";
import LayersPanel from "../components/document/LayersPanel";
import PropertiesPanel from "../components/document/PropertiesPanel";
import DocumentStatusBar from "../components/document/DocumentStatusBar";

interface LocationState {
  json: string;
  path: string | null;
}

export default function DocumentScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { path } = (location.state as LocationState) ?? { json: "{}", path: null };

  const [activeTool, setActiveTool] = useState<Tool>("select");

  const [layers, setLayers] = useState<Layer[]>([
    { id: newLayerId(), penId: PENS[0].id, name: "Layer 1" },
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>(layers[0].id);
  const activeLayer = layers.find((l) => l.id === activeLayerId) ?? layers[0];
  const activeLayerPen = PENS.find((p) => p.id === activeLayer?.penId) ?? PENS[0];

  function addLayer() {
    const id = newLayerId();
    const n = layers.length + 1;
    setLayers((prev) => [...prev, { id, penId: PENS[0].id, name: `Layer ${n}` }]);
    setActiveLayerId(id);
  }

  function deleteLayer(id: string) {
    if (layers.length === 1) return;
    setLayers((prev) => {
      const next = prev.filter((l) => l.id !== id);
      if (activeLayerId === id) setActiveLayerId(next[Math.max(0, prev.indexOf(prev.find((l) => l.id === id)!) - 1)].id);
      return next;
    });
  }

  function moveLayer(id: string, direction: -1 | 1) {
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      const next = [...prev];
      const target = idx + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function setLayerPen(id: string, penId: string) {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, penId } : l)));
  }

  function renameLayer(id: string, name: string) {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, name: name.trim() || l.name } : l)));
  }

  const fileName = path ? path.split(/[\\/]/).pop() : "Untitled";

  return (
    <div className="h-full bg-[#0a0c10] text-gray-100 flex flex-col overflow-hidden">
      <DocumentToolbar
        fileName={fileName ?? "Untitled"}
        path={path}
        onBack={() => navigate("/")}
        onExport={() => { /* TODO: navigate to GCode screen */ }}
      />

      <div className="flex-1 flex overflow-hidden">
        <ToolPalette activeTool={activeTool} onToolChange={setActiveTool} />

        <CanvasArea activeTool={activeTool} />

        <aside className="w-60 shrink-0 flex-col bg-[#0d1017] border-l border-slate-700/60 overflow-hidden">
          <LayersPanel
            layers={layers}
            activeLayerId={activeLayerId}
            pens={PENS}
            onSetActiveLayerId={setActiveLayerId}
            onAddLayer={addLayer}
            onDeleteLayer={deleteLayer}
            onMoveLayer={moveLayer}
            onSetLayerPen={setLayerPen}
            onRenameLayer={renameLayer}
          />

          <div className="h-px bg-slate-800 mx-3 shrink-0" />

          <PropertiesPanel activeTool={activeTool} />
        </aside>
      </div>

      <DocumentStatusBar activeTool={activeTool} activeLayerPen={activeLayerPen} />
    </div>
  );
}

