import { useRef, useState, useCallback, useEffect } from "react";
import type { Element, Tool, PageSettings } from "../../components/document/types";
import { newId, workspaceBounds } from "../../components/document/types";
import { elementToStrokes, strokeToSvgPath } from "../../utils/strokes";
import type { Viewport } from "../../components/document/CanvasArea";
import { viewportToDoc } from "../../components/document/CanvasArea";

// ── Ghost (in-progress draw preview) ─────────────────────────────────────────

export type Ghost =
  | { tool: "line";   x1: number; y1: number; x2: number; y2: number }
  | { tool: "rect";   x: number;  y: number;  w: number;  h: number  }
  | { tool: "circle"; cx: number; cy: number; r: number              };

export function ghostToElement(g: Ghost): Element {
  const id = "__ghost__";
  switch (g.tool) {
    case "line":   return { id, type: "Line",   x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2 };
    case "rect":   return { id, type: "Rect",   x: g.x, y: g.y, w: g.w, h: g.h };
    case "circle": return { id, type: "Circle", cx: g.cx, cy: g.cy, r: g.r };
  }
}

export function ghostToSvgPaths(ghost: Ghost | null): string[] {
  if (!ghost) return [];
  return elementToStrokes(ghostToElement(ghost)).map((s) => strokeToSvgPath(s));
}

// ── Pure helpers ────────────────────────────────────────────────────────────────

function getSvgPoint(
  e: React.PointerEvent,
  svgRef: React.RefObject<SVGSVGElement | null>,
  viewport: Viewport,
): [number, number] {
  const rect = svgRef.current!.getBoundingClientRect();
  return viewportToDoc(e.clientX - rect.left, e.clientY - rect.top, viewport);
}

function clampToWorkspace(x: number, y: number, page: PageSettings): [number, number] {
  const ws = workspaceBounds(page);
  return [
    Math.max(ws.x, Math.min(ws.x + ws.w, x)),
    Math.max(ws.y, Math.min(ws.y + ws.h, y)),
  ];
}

/** Maximum radius that keeps the full circle inside the workspace. */
function clampedCircleRadius(sx: number, sy: number, mx: number, my: number, page: PageSettings): number {
  const ws = workspaceBounds(page);
  return Math.min(
    Math.hypot(mx - sx, my - sy),
    sx - ws.x,           // distance to left edge
    ws.x + ws.w - sx,    // distance to right edge
    sy - ws.y,           // distance to top edge
    ws.y + ws.h - sy,    // distance to bottom edge
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface Options {
  svgRef: React.RefObject<SVGSVGElement | null>;
  viewport: Viewport;
  activeTool: Tool;
  selectedId: string | null;
  activeLayerId: string;
  page: PageSettings;
  onAddElement: (layerId: string, el: Element) => void;
  onSelectElement: (id: string | null) => void;
  onMoveElement: (id: string, dx: number, dy: number) => void;
  onMoveStart: () => void;
  onViewportChange: (v: Viewport) => void;
}

export function useCanvasPointer({
  svgRef,
  viewport,
  activeTool,
  selectedId,
  activeLayerId,
  page,
  onAddElement,
  onSelectElement,
  onMoveElement,
  onMoveStart,
  onViewportChange,
}: Options) {
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const panRef     = useRef<{ vp: Viewport; px: number; py: number } | null>(null);
  const dragRef    = useRef<{ docX: number; docY: number } | null>(null);
  const shapeStart = useRef<{ docX: number; docY: number } | null>(null);

  // Clear ghost / selection when tool changes
  useEffect(() => {
    if (activeTool === "select") setGhost(null);
    else onSelectElement(null);
  }, [activeTool, onSelectElement]);

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const isPan = (e.button === 0 && e.altKey) || e.button === 2;
    if (isPan) {
      const rect = svgRef.current!.getBoundingClientRect();
      panRef.current = { vp: viewport, px: e.clientX - rect.left, py: e.clientY - rect.top };
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    if (e.button !== 0) return; // ignore middle-click etc.

    if (activeTool === "select") {
      onSelectElement(null);
      return;
    }

    const [mx, my] = clampToWorkspace(...getSvgPoint(e, svgRef, viewport), page);
    shapeStart.current = { docX: mx, docY: my };
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
  }, [activeTool, viewport, page, onSelectElement]);

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    // Pan
    if (panRef.current) {
      const rect = svgRef.current!.getBoundingClientRect();
      const dx = (e.clientX - rect.left) - panRef.current.px;
      const dy = (e.clientY - rect.top)  - panRef.current.py;
      onViewportChange({ ...panRef.current.vp, panX: panRef.current.vp.panX + dx, panY: panRef.current.vp.panY + dy });
      return;
    }

    // Select tool: element drag, or nothing to do
    if (activeTool === "select") {
      if (dragRef.current && selectedId) {
        const [curDocX, curDocY] = getSvgPoint(e, svgRef, viewport);
        const dx = curDocX - dragRef.current.docX;
        const dy = curDocY - dragRef.current.docY;
        dragRef.current = { docX: curDocX, docY: curDocY };
        onMoveElement(selectedId, dx, dy);
      }
      return;
    }

    // Shape creation ghost (drawing tools only)
    if (e.buttons === 0) { setGhost(null); return; }
    if (!shapeStart.current || e.buttons !== 1) return;

    const { docX: sx, docY: sy } = shapeStart.current;
    const [mx, my] = clampToWorkspace(...getSvgPoint(e, svgRef, viewport), page);
    switch (activeTool) {
      case "line":
        setGhost({ tool: "line", x1: sx, y1: sy, x2: mx, y2: my });
        break;
      case "rect": {
        const x = Math.min(sx, mx), y = Math.min(sy, my);
        setGhost({ tool: "rect", x, y, w: Math.abs(mx - sx), h: Math.abs(my - sy) });
        break;
      }
      case "circle":
        setGhost({ tool: "circle", cx: sx, cy: sy, r: clampedCircleRadius(sx, sy, mx, my, page) });
        break;
    }
  }, [activeTool, selectedId, viewport, page, onViewportChange, onMoveElement]);

  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (dragRef.current)  { dragRef.current = null; return; }
    if (panRef.current)    { panRef.current = null; return; }
    if (activeTool === "select" || !shapeStart.current) return;

    const { docX: sx, docY: sy } = shapeStart.current;
    const [mx, my] = clampToWorkspace(...getSvgPoint(e, svgRef, viewport), page);
    shapeStart.current = null;
    setGhost(null);

    if (Math.hypot(mx - sx, my - sy) < 0.5) return; // ignore accidental clicks

    const id = newId();
    let el: Element;
    switch (activeTool) {
      case "line":
        el = { id, type: "Line", x1: sx, y1: sy, x2: mx, y2: my };
        break;
      case "rect": {
        const x = Math.min(sx, mx), y = Math.min(sy, my);
        el = { id, type: "Rect", x, y, w: Math.abs(mx - sx), h: Math.abs(my - sy) };
        break;
      }
      case "circle":
        el = { id, type: "Circle", cx: sx, cy: sy, r: clampedCircleRadius(sx, sy, mx, my, page) };
        break;
      default: return;
    }
    onAddElement(activeLayerId, el);
  }, [activeTool, activeLayerId, viewport, page, onAddElement]);

  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newZoom = Math.max(0.5, Math.min(20, viewport.zoom * factor));
    const newVp: Viewport = {
      zoom: newZoom,
      panX: px - (px - viewport.panX) * (newZoom / viewport.zoom),
      panY: py - (py - viewport.panY) * (newZoom / viewport.zoom),
    };
    if (panRef.current) {
      const dx = panRef.current.px - (e.clientX - rect.left);
      const dy = panRef.current.py - (e.clientY - rect.top);
      panRef.current = {
        vp: { ...newVp, panX: newVp.panX + dx, panY: newVp.panY + dy },
        px: panRef.current.px,
        py: panRef.current.py,
      };
    }
    onViewportChange(newVp);
  }, [viewport, onViewportChange]);

  function startElementDrag(e: React.PointerEvent, elementId: string) {
    onSelectElement(elementId);
    onMoveStart();
    const [docX, docY] = getSvgPoint(e, svgRef, viewport);
    dragRef.current = { docX, docY };
  }

  return { ghost, onPointerDown, onPointerMove, onPointerUp, onWheel, startElementDrag };
}
