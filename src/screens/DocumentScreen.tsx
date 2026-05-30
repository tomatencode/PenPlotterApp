import { useReducer, useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import type { Layer, Element, PnplttrDocument, Tool, PageSettings, Pen } from "../features/document/types";
import { newId } from "../features/document/utils";
import { DEFAULT_PEN } from "../features/document/constants";
import { docReducer, initialDoc, docToJson } from "../features/document/docState";
import { useElementDrag } from "../features/document/hooks/useElementDrag";
import { useElementDeform } from "../features/document/hooks/useElementDeform";
import { DEFAULT_FONTS } from "../features/document/text/defaultFonts";
import DocumentToolbar from "../features/document/components/DocumentToolbar";
import ToolPalette from "../features/document/components/ToolPalette";
import CanvasArea from "../features/document/components/CanvasArea";
import type { Viewport } from "../features/document/canvas/viewport";
import LayersPanel from "../features/document/components/LayersPanel";
import PagePanel from "../features/document/components/PagePanel";
import PropertiesPanel from "../features/document/components/PropertiesPanel";
import DocumentStatusBar from "../features/document/components/DocumentStatusBar";
import GcodePopup from "../features/document/components/GcodePopup";

export default function DocumentScreen() {
  return <DocumentScreenContent />;
}

function DocumentScreenContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { path } = (location.state as { path: string | null }) ?? { path: null };
  useEffect(() => { docRef.current = doc; });

  const [doc, dispatch] = useReducer(docReducer, undefined, () => initialDoc("{}"));
  const docRef = useRef(doc);

  // Load file content on mount
  useEffect(() => {
    if (!path) return;
    invoke<string>("open_file", { path })
      .then((json) => {
        const loaded = initialDoc(json);
        dispatch({ type: "LOAD", doc: loaded });
        setActiveLayerId(loaded.layers[0].id);
        // Inject any custom fonts embedded in the document into the registry
      })
      .catch(console.error);
  }, [path]);

  const [activeLayerId, setActiveLayerId] = useState<string>(doc.layers[0].id);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<Tool>("select");

  const [undoStack, setUndoStack] = useState<PnplttrDocument[]>([]);
  const [redoStack, setRedoStack] = useState<PnplttrDocument[]>([]);
  
  const [isGcodePopupOpen, setIsGcodePopupOpen] = useState(false);

  // Initial doc viewport: centre the A4 page with a reasonable zoom
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
      await invoke("save_file", { path, content });
    } catch (e) {
      console.error("Save failed:", e);
    }
  }, [path, docRef]);

  // Auto-save 800ms after any doc change, timer resets if doc changes again before that
  useEffect(() => {
    if (!path) return;
    const timer = setTimeout(() => { handleSave(); }, 800);
    return () => clearTimeout(timer);
  }, [doc, path, handleSave]);

  const recordHistory = useCallback(() => {
    setUndoStack((h) => [...h, docRef.current]);
    setRedoStack([]);
  }, []);

  const { onMoveStart, onMoveElement } = useElementDrag(docRef, dispatch, recordHistory);
  const { onDeformStart, onDeformElement } = useElementDeform(docRef, dispatch, recordHistory);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, docRef.current]);
    setUndoStack((h) => h.slice(0, -1));
    dispatch({ type: "LOAD", doc: prev });
  }, [undoStack, docRef]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((h) => [...h, docRef.current]);
    setRedoStack((r) => r.slice(0, -1));
    dispatch({ type: "LOAD", doc: next });
  }, [redoStack, docRef]);

  const handleAddElement = useCallback((layerId: string, el: Element) => {
    recordHistory();
    dispatch({ type: "ADD_ELEMENT", layerId, element: el });
  }, [dispatch, recordHistory]);

  function addLayer() {
    recordHistory();
    const layer: Layer = { id: newId(), name: `Pen ${doc.layers.length + 1}`, pen: { ...DEFAULT_PEN }, elements: [] };
    dispatch({ type: "ADD_LAYER", layer });
    setActiveLayerId(layer.id);
  }

  function deleteLayer(id: string) {
    recordHistory();
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

      // Backspace to delete selected elements
      if ((e.key === "Backspace") && selectedIds.length > 0) {
        // Don't fire if the user is typing in an input/textarea
        if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
        recordHistory();
        const idsToDelete = new Set(selectedIds);
        for (const layer of docRef.current.layers) {
          for (const el of layer.elements) {
            if (idsToDelete.has(el.id)) {
              dispatch({ type: "DELETE_ELEMENT", layerId: layer.id, elementId: el.id });
            }
          }
        }
        setSelectedIds([]);
      }
      // Escape to switch to select tool
      if (e.key === "Escape") {
        setActiveTool("select");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
}, [handleSave, handleUndo, handleRedo, selectedIds, docRef]);

  const fonts = useMemo(
    () => new Map([...DEFAULT_FONTS, ...Object.entries(doc.fonts ?? {})]),
    [doc.fonts],
  );

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
          fonts={fonts}
          activeLayerId={activeLayerId}
          activeTool={activeTool}
          selectedIds={selectedIds}
          viewport={viewport}
          onAddElement={handleAddElement}
          onSelectElements={setSelectedIds}
          onMoveElement={onMoveElement}
          onMoveStart={onMoveStart}
          onDeformStart={onDeformStart}
          onDeformElement={onDeformElement}
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
            fonts={fonts}
            selectedIds={selectedIds}
            onUpdateElement={(layerId, el) => dispatch({ type: "UPDATE_ELEMENT", layerId, element: el })}
            onDeleteElement={(layerId, elementId) => {
              dispatch({ type: "DELETE_ELEMENT", layerId, elementId });
              setSelectedIds([]);
            }}
          />
        </aside>
      </div>

      <DocumentStatusBar
        activeTool={activeTool}
        zoom={viewport.zoom}
        totalElements={totalElements}
      />

      <GcodePopup
        isOpen={isGcodePopupOpen}
        onClose={() => setIsGcodePopupOpen(false)}
        doc={doc}
        defaultFileName={fileName}
      />
    </div>
  );
}
