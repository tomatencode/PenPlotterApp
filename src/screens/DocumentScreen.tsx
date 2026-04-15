import { useReducer, useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import {
  type Layer, type Element, type PnplttrDocument, type Tool, type PageSettings,
  newId, DEFAULT_PEN, PRESET_PENS, translateElement,
} from "../components/document/types";
import DocumentToolbar from "../components/document/DocumentToolbar";
import ToolPalette from "../components/document/ToolPalette";
import CanvasArea, { type Viewport } from "../components/document/CanvasArea";
import LayersPanel from "../components/document/LayersPanel";
import PagePanel from "../components/document/PagePanel";
import PropertiesPanel from "../components/document/PropertiesPanel";
import DocumentStatusBar from "../components/document/DocumentStatusBar";

// ── Location state ────────────────────────────────────────────────────────────

interface LocationState {
  json: string;
  path: string | null;
}

// ── Layer reducer ─────────────────────────────────────────────────────────────

type DocAction =
  | { type: "ADD_ELEMENT";    layerId: string; element: Element }
  | { type: "DELETE_ELEMENT"; layerId: string; elementId: string }
  | { type: "UPDATE_ELEMENT"; layerId: string; element: Element }
  | { type: "ADD_LAYER";      layer: Layer }
  | { type: "DELETE_LAYER";   layerId: string }
  | { type: "MOVE_LAYER";     layerId: string; direction: -1 | 1 }
  | { type: "SET_LAYER_PEN";  layerId: string; penIndex: number }
  | { type: "RENAME_LAYER";   layerId: string; name: string }
  | { type: "SET_LAYERS";     layers: Layer[] }
  | { type: "UPDATE_PAGE";    page: PageSettings };

function docReducer(doc: PnplttrDocument, action: DocAction): PnplttrDocument {
  switch (action.type) {
    case "ADD_ELEMENT":
      return { ...doc, layers: doc.layers.map((l) =>
        l.id === action.layerId
          ? { ...l, elements: [...l.elements, action.element] }
          : l
      ) };
    case "DELETE_ELEMENT":
      return { ...doc, layers: doc.layers.map((l) =>
        l.id === action.layerId
          ? { ...l, elements: l.elements.filter((e) => e.id !== action.elementId) }
          : l
      ) };
    case "UPDATE_ELEMENT":
      return { ...doc, layers: doc.layers.map((l) =>
        l.id === action.layerId
          ? { ...l, elements: l.elements.map((e) => e.id === action.element.id ? action.element : e) }
          : l
      ) };
    case "ADD_LAYER":
      return { ...doc, layers: [...doc.layers, action.layer] };
    case "DELETE_LAYER": {
      if (doc.layers.length === 1) return doc;
      return { ...doc, layers: doc.layers.filter((l) => l.id !== action.layerId) };
    }
    case "MOVE_LAYER": {
      const idx = doc.layers.findIndex((l) => l.id === action.layerId);
      const target = idx + action.direction;
      if (target < 0 || target >= doc.layers.length) return doc;
      const next = [...doc.layers];
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...doc, layers: next };
    }
    case "RENAME_LAYER":
      return { ...doc, layers: doc.layers.map((l) =>
        l.id === action.layerId ? { ...l, name: action.name || l.name } : l
      ) };
    case "SET_LAYER_PEN":
      return { ...doc, layers: doc.layers.map((l) =>
        l.id === action.layerId ? { ...l, pen: PRESET_PENS[action.penIndex] ?? l.pen } : l
      ) };
    case "SET_LAYERS":
      return { ...doc, layers: action.layers };
    case "UPDATE_PAGE":
      return { ...doc, page: action.page };
    default:
      return doc;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initialDoc(json: string): PnplttrDocument {
  try {
    const doc = JSON.parse(json) as PnplttrDocument;
    if (doc.layers && doc.layers.length > 0) {
      // Assign UI ids to layers (not stored in file)
      return { ...doc, layers: doc.layers.map((l) => ({ ...l, id: newId() })) };
    }
  } catch { /* fall through */ }

  return { 
    meta: { created: new Date().toISOString(), doctype_version: 1 },
    page: { page_width: 210, page_height: 297, workspace_width: 210, workspace_height: 297 },
    layers: [{id: newId(), name: "Layer 1", pen: { ...DEFAULT_PEN }, elements: []}] 
  } as PnplttrDocument;
}

function docToJson(doc: PnplttrDocument): string {
  // Strip the UI-only `id` from layers before saving
  return JSON.stringify(doc, null, 2);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DocumentScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { json, path } = (location.state as LocationState) ?? { json: "{}", path: null };

  const [doc, dispatch] = useReducer(docReducer, json, initialDoc);
  const [activeLayerId, setActiveLayerId] = useState<string>(doc.layers[0].id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initial viewport: centre the A4 page with a reasonable zoom
  const [viewport, setViewport] = useState<Viewport>({ zoom: 2, panX: 60, panY: 40 });

  const activeLayer = doc.layers.find((l) => l.id === activeLayerId) ?? doc.layers[0];

  // Wrap dispatch to also mark dirty
  function act(action: DocAction) {
    dispatch(action);
    setIsDirty(true);
  }

  const handleAddElement = useCallback((layerId: string, el: Element) => {
    act({ type: "ADD_ELEMENT", layerId, element: el });
  }, []);

  function addLayer() {
    const layer: Layer = { id: newId(), name: `Layer ${doc.layers.length + 1}`, pen: { ...DEFAULT_PEN }, elements: [] };
    act({ type: "ADD_LAYER", layer });
    setActiveLayerId(layer.id);
  }

  function deleteLayer(id: string) {
    if (activeLayerId === id) {
      const idx = doc.layers.findIndex((l) => l.id === id);
      const next = doc.layers.filter((l) => l.id !== id);
      setActiveLayerId(next[Math.max(0, idx - 1)].id);
    }
    act({ type: "DELETE_LAYER", layerId: id });
  }

  function moveLayer(id: string, direction: -1 | 1) {
    act({ type: "MOVE_LAYER", layerId: id, direction });
  }

  function setLayerPen(id: string, penIndex: number) {
    act({ type: "SET_LAYER_PEN", layerId: id, penIndex });
  }

  function renameLayer(id: string, name: string) {
    act({ type: "RENAME_LAYER", layerId: id, name });
  }

  const handleSave = useCallback(async () => {
    if (!path || isSaving) return;
      setIsSaving(true);
      try {
        const content = docToJson(doc);
        await invoke("save_document", { path, content });
        setIsDirty(false);
      } catch (e) {
        console.error("Save failed:", e);
      } finally {
        setIsSaving(false);
      }
  }, [path, isSaving, doc, doc.layers]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ctrl+S / Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!isDirty) return;
        handleSave();
      }
      // Backspace to delete selected element
      if ((e.key === "Backspace") && selectedId) {
        // Don't fire if the user is typing in an input/textarea
        if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
        for (const layer of doc.layers) {
          if (layer.elements.some((el) => el.id === selectedId)) {
            act({ type: "DELETE_ELEMENT", layerId: layer.id, elementId: selectedId });
            setSelectedId(null);
            break;
          }
        }
      }
      // Escape to switch to select tool
      if (e.key === "Escape") {
        setActiveTool("select");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave, isDirty, selectedId, doc.layers]);

  const fileName = path ? path.split(/[\\/]/).pop() ?? "Untitled" : "Untitled";
  const totalElements = doc.layers.reduce((n, l) => n + l.elements.length, 0);

  return (
    <div className="h-full bg-[#0a0c10] text-gray-100 flex flex-col overflow-hidden">
      <DocumentToolbar
        fileName={fileName}
        path={path}
        isDirty={isDirty}
        isSaving={isSaving}
        onBack={() => navigate("/")}
        onSave={handleSave}
        onExport={() => { /* TODO */ }}
      />

      <div className="flex-1 flex overflow-hidden">
        <ToolPalette activeTool={activeTool} onToolChange={setActiveTool} />

        <CanvasArea
          doc={doc}
          activeLayerId={activeLayerId}
          activeTool={activeTool}
          selectedId={selectedId}
          viewport={viewport}
          onAddElement={handleAddElement}
          onSelectElement={setSelectedId}
          onMoveElement={(id, dx, dy) => {
            const layer = doc.layers.find(l => l.elements.some(el => el.id === id));
            if (!layer) { console.log("element to move not found:", id); return; }
            const el = layer.elements.find(e => e.id === id)!;
            act({ type: "UPDATE_ELEMENT", layerId: layer.id, element: translateElement(el, dx, dy) });
            console.log("Move element", id, "by", dx, dy);
          }}
          onViewportChange={setViewport}
        />

        <aside className="w-60 shrink-0 flex-col bg-[#0d1017] border-l border-slate-700/60 overflow-hidden">
          <PagePanel
            page={doc.page}
            onUpdatePage={(page) => act({ type: "UPDATE_PAGE", page })}
          />

          <div className="h-px bg-slate-800 mx-3 shrink-0" />

          <LayersPanel
            layers={doc.layers}
            activeLayerId={activeLayerId}
            onSetActiveLayerId={setActiveLayerId}
            onAddLayer={addLayer}
            onDeleteLayer={deleteLayer}
            onMoveLayer={moveLayer}
            onSetLayerPen={setLayerPen}
            onRenameLayer={renameLayer}
          />

          <div className="h-px bg-slate-800 mx-3 shrink-0" />

          <PropertiesPanel
            layers={doc.layers}
            selectedId={selectedId}
            onUpdateElement={(layerId, el) => act({ type: "UPDATE_ELEMENT", layerId, element: el })}
            onDeleteElement={(layerId, elementId) => {
              act({ type: "DELETE_ELEMENT", layerId, elementId });
              setSelectedId(null);
            }}
          />
        </aside>
      </div>

      <DocumentStatusBar
        activeTool={activeTool}
        activeLayerPen={activeLayer.pen}
        zoom={viewport.zoom}
        totalElements={totalElements}
      />
    </div>
  );
}

