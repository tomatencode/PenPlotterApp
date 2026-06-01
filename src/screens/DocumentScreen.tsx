import { useReducer, useState, useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import type { Element, Tool } from "../features/document/types";
import { initialDoc, docToJson, historyReducer, initialHistoryState } from "../features/document/docState";
import { useElementDrag } from "../features/document/hooks/useElementDrag";
import { useElementDeform } from "../features/document/hooks/useElementDeform";
import { useLayerActions } from "../features/document/hooks/useLayerActions";
import { useDocumentKeyboard } from "../features/document/hooks/useDocumentKeyboard";
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

export default function DocumentScreenContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { path } = (location.state as { path: string | null }) ?? { path: null };

  const [history, dispatch] = useReducer(historyReducer, undefined, () => initialHistoryState("{}"));
  const doc = history.present;

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
      const content = docToJson(doc);
      await invoke("save_file", { path, content });
    } catch (e) {
      console.error("Save failed:", e);
    }
  }, [path, doc]);

  // Auto-save 800ms after any doc change, timer resets if doc changes again before that
  useEffect(() => {
    if (!path) return;
    const timer = setTimeout(() => { handleSave(); }, 800);
    return () => clearTimeout(timer);
  }, [doc, path, handleSave]);

  const { onMoveStart, onMoveElement } = useElementDrag(doc, dispatch, () => dispatch({ type: "SNAPSHOT" }));
  const { onDeformStart, onDeformElement } = useElementDeform(doc, dispatch, () => dispatch({ type: "SNAPSHOT" }));

  const handleAddElement = useCallback((layerId: string, el: Element) => {
    dispatch({ type: "SNAPSHOT" });
    dispatch({ type: "ADD_ELEMENT", layerId, element: el });
  }, [dispatch]);

  const { addLayer, deleteLayer, moveLayer, setLayerPen, renameLayer, updatePage } =
    useLayerActions(doc.layers, activeLayerId, setActiveLayerId, dispatch);

  useDocumentKeyboard({ dispatch, layers: doc.layers, activeLayerId, selectedIds, setSelectedIds, setActiveTool, onSave: handleSave });

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
        canUndo={history.past.length > 0}
        onUndo={() => dispatch({ type: "UNDO" })}
        canRedo={history.future.length > 0}
        onRedo={() => dispatch({ type: "REDO" })}
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
            onUpdateElement={(layerId, el) => {
              dispatch({ type: "SNAPSHOT" });
              dispatch({ type: "UPDATE_ELEMENT", layerId, element: el });
            }}
            onDeleteElement={(layerId, elementId) => {
              dispatch({ type: "SNAPSHOT" });
              dispatch({ type: "DELETE_ELEMENT", layerId, elementId });
              setSelectedIds((ids) => ids.filter((id) => id !== elementId));
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
