import { useReducer, useState, useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import {
  type Layer, type Element, type PnplttrDocument, type Tool, type PageSettings, type Pen,
  newId, DEFAULT_PEN, translateElement, elementBounds, workspaceBounds,
} from "../components/document/types";
import { docReducer, initialDoc, docToJson } from "../hooks/document/documentState";
import DocumentToolbar from "../components/document/DocumentToolbar";
import ToolPalette from "../components/document/ToolPalette";
import CanvasArea, { type Viewport } from "../components/document/CanvasArea";
import LayersPanel from "../components/document/LayersPanel";
import PagePanel from "../components/document/PagePanel";
import PropertiesPanel from "../components/document/PropertiesPanel";
import DocumentStatusBar from "../components/document/DocumentStatusBar";
import GcodePupup from "../components/document/GcodePupup";
import { usePlotterDiscovery } from "../context/PlotterDiscoveryContext";

interface FileLocationState {
  json: string;
  path: string | null;
}

export default function DocumentScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { plotters } = usePlotterDiscovery();
  const { json, path } = (location.state as FileLocationState) ?? { json: "{}", path: null };

  const [doc, dispatch] = useReducer(docReducer, json, initialDoc);
  const docRef = useRef(doc);
  useEffect(() => { docRef.current = doc; });
  const [undoStack, setUndoStack] = useState<PnplttrDocument[]>([]);
  const [redoStack, setRedoStack] = useState<PnplttrDocument[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string>(doc.layers[0].id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [isGcodePopupOpen, setIsGcodePopupOpen] = useState(false);

  // Initial viewport: centre the A4 page with a reasonable zoom
  const [viewport, setViewport] = useState<Viewport>(() => {
    const width = window.innerWidth - 60 - 300; // minus side panels
    const height = window.innerHeight - 64 - 24; // minus toolbar and status bar
    const pageW = doc.page.page_width;
    const pageH = doc.page.page_height;
    const zoom = Math.min(width / pageW, height / pageH) * 0.85;
    return {
      zoom,
      panX: (width  - pageW * zoom) / 2,
      panY: (height - pageH * zoom) / 2,
    }
  });

  const handleSave = useCallback(async () => {
    if (!path) return;
    try {
      const content = docToJson(docRef.current);
      await invoke("save_document", { path, content });
    } catch (e) {
      console.error("Save failed:", e);
    }
  }, [path, docRef]);

  // Auto-save 800ms after any doc change
  useEffect(() => {
    if (!path) return;
    const timer = setTimeout(() => { handleSave(); }, 800);
    return () => clearTimeout(timer);
  }, [doc, path, handleSave]);

  const recordHistory = useCallback(() => {
    setUndoStack((h) => [...h, docRef.current]);
    setRedoStack([]);
  }, []);

  const applyDoc = useCallback((snapshot: PnplttrDocument) => {
    dispatch({ type: "SET_LAYERS", layers: snapshot.layers });
    dispatch({ type: "UPDATE_PAGE", page: snapshot.page });
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, docRef.current]);
    setUndoStack((h) => h.slice(0, -1));
    applyDoc(prev);
  }, [undoStack, docRef, applyDoc]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((h) => [...h, docRef.current]);
    setRedoStack((r) => r.slice(0, -1));
    applyDoc(next);
  }, [redoStack, docRef, applyDoc]);

  const handleAddElement = useCallback((layerId: string, el: Element) => {
    recordHistory();
    dispatch({ type: "ADD_ELEMENT", layerId, element: el });
  }, [dispatch, recordHistory]);

  const handleMoveElement = useCallback((id: string, dx: number, dy: number) => {
    const layer = docRef.current.layers.find(l => l.elements.some(el => el.id === id));
    if (!layer) { console.log("element to move not found:", id); return; }
    const el = layer.elements.find(e => e.id === id)!;
    const b  = elementBounds(el);
    const ws = workspaceBounds(docRef.current.page);
    const clampedDx = Math.max(ws.x - b.minX, Math.min(ws.x + ws.w - b.maxX, dx));
    const clampedDy = Math.max(ws.y - b.minY, Math.min(ws.y + ws.h - b.maxY, dy));
    dispatch({ type: "UPDATE_ELEMENT", layerId: layer.id, element: translateElement(el, clampedDx, clampedDy) });
    // Don't save on every move for performance, only at the end of the drag
  }, [dispatch]);

  function addLayer() {
    recordHistory();
    const layer: Layer = { id: newId(), name: `Pen ${doc.layers.length + 1}`, pen: { ...DEFAULT_PEN }, elements: [] };
    dispatch({ type: "ADD_LAYER", layer });
    setActiveLayerId(layer.id);
  }

  function deleteLayer(id: string) {
    if (activeLayerId === id) {
      const idx = doc.layers.findIndex((l) => l.id === id);
      const next = doc.layers.filter((l) => l.id !== id);
      setActiveLayerId(next[Math.max(0, idx - 1)].id);
    }
    dispatch({ type: "DELETE_LAYER", layerId: id });
  }

  function moveLayer(id: string, direction: -1 | 1) {
    recordHistory();
    dispatch({ type: "MOVE_LAYER", layerId: id, direction });
  }

  function setLayerPen(id: string, pen: Pen) {
    recordHistory();
    dispatch({ type: "SET_LAYER_PEN", layerId: id, pen });
  }

  function renameLayer(id: string, name: string) {
    recordHistory();
    dispatch({ type: "RENAME_LAYER", layerId: id, name });
  }

  function updatePage(page: PageSettings) {
    recordHistory();
    dispatch({ type: "UPDATE_PAGE", page });
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ctrl+S / Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }

      // Ctrl+Z / Cmd+Z to undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }

      // Ctrl+Shift+Z / Ctrl+Y to redo
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") ||
          ((e.ctrlKey || e.metaKey) && e.key === "y")) {
        e.preventDefault();
        handleRedo();
      }

      // Backspace to delete selected element
      if ((e.key === "Backspace") && selectedId) {
        // Don't fire if the user is typing in an input/textarea
        if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
        for (const layer of docRef.current.layers) {
          if (layer.elements.some((el) => el.id === selectedId)) {
            dispatch({ type: "DELETE_ELEMENT", layerId: layer.id, elementId: selectedId });
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
  }, [handleSave, handleUndo, handleRedo, selectedId, docRef]);

  const fileName = path ? path.split(/[\\/]/).pop() ?? "Untitled" : "Untitled";
  const totalElements = doc.layers.reduce((n, l) => n + l.elements.length, 0);

  return (
    <div className="h-full bg-[#0a0c10] text-gray-100 flex flex-col overflow-hidden">
      <DocumentToolbar
        fileName={fileName}
        path={path}
        canUndo={undoStack.length > 0}
        onUndo={handleUndo}
        canRedo={redoStack.length > 0}
        onRedo={handleRedo}
        onBack={() => {
          handleSave();
          navigate("/");
        }}
        onExport={() => setIsGcodePopupOpen(true)}
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
          onMoveElement={handleMoveElement}
          onMoveStart={recordHistory}
          onViewportChange={setViewport}
        />

        <aside className="w-60 shrink-0 flex-col bg-[#0d1017] border-l border-slate-700/60 overflow-y-auto">
          <PagePanel
            page={doc.page}
            onUpdatePage={updatePage}
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
            onUpdateElement={(layerId, el) => dispatch({ type: "UPDATE_ELEMENT", layerId, element: el })}
            onDeleteElement={(layerId, elementId) => {
              dispatch({ type: "DELETE_ELEMENT", layerId, elementId });
              setSelectedId(null);
            }}
          />
        </aside>
      </div>

      <DocumentStatusBar
        activeTool={activeTool}
        zoom={viewport.zoom}
        totalElements={totalElements}
      />

      <GcodePupup
        isOpen={isGcodePopupOpen}
        onClose={() => setIsGcodePopupOpen(false)}
        documentJson={docToJson(doc)}
        defaultFileName={fileName}
        plotters={plotters}
      />
    </div>
  );
}
