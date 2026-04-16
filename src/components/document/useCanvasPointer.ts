import { useRef, useState, useCallback, useEffect } from "react";
import type { Element, Tool, PageSettings } from "./types";
import { newId, workspaceBounds } from "./types";
import { elementToStrokes, strokeToSvgPath } from "../../utils/strokes";
import type { Viewport } from "./CanvasArea";
import { viewportToDoc } from "./CanvasArea";

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
  function clampToWorkspace(x: number, y: number): [number, number] {
    const ws = workspaceBounds(page);
    return [
      Math.max(ws.x, Math.min(ws.x + ws.w, x)),
      Math.max(ws.y, Math.min(ws.y + ws.h, y)),
    ];
  }
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const panStart          = useRef<{ vp: Viewport; px: number; py: number } | null>(null);
  const elementDragLast   = useRef<{ docX: number; docY: number } | null>(null);
  const createDragStart   = useRef<{ docX: number; docY: number } | null>(null);

  // Clear ghost / selection when tool changes
  useEffect(() => {
    if (activeTool === "select") setGhost(null);
    else onSelectElement(null);
  }, [activeTool, onSelectElement]);

  function getSvgPoint(e: React.PointerEvent): [number, number] {
    const rect = svgRef.current!.getBoundingClientRect();
    return viewportToDoc(e.clientX - rect.left, e.clientY - rect.top, viewport);
  }

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    // Alt+drag or right-click → pan
    if ((e.button === 0 && e.altKey) || e.button === 2) {
      const rect = svgRef.current!.getBoundingClientRect();
      panStart.current = { vp: viewport, px: e.clientX - rect.left, py: e.clientY - rect.top };
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    if (e.button !== 0) return;

    if (activeTool === "select") {
      onSelectElement(null);
      return;
    }

    const [mx, my] = clampToWorkspace(...getSvgPoint(e));
    createDragStart.current = { docX: mx, docY: my };
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
  }, [activeTool, viewport, onSelectElement]);

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    // Pan
    if (panStart.current) {
      const rect = svgRef.current!.getBoundingClientRect();
      const dx = (e.clientX - rect.left) - panStart.current.px;
      const dy = (e.clientY - rect.top)  - panStart.current.py;
      onViewportChange({ ...panStart.current.vp, panX: panStart.current.vp.panX + dx, panY: panStart.current.vp.panY + dy });
      return;
    }

    // Element drag (move)
    if (elementDragLast.current && selectedId && activeTool === "select") {
      const [curDocX, curDocY] = getSvgPoint(e);
      const dx = curDocX - elementDragLast.current.docX;
      const dy = curDocY - elementDragLast.current.docY;
      elementDragLast.current = { docX: curDocX, docY: curDocY };
      onMoveElement(selectedId, dx, dy);
      return;
    }

    // Shape creation ghost
    if (!createDragStart.current || activeTool === "select" || e.buttons !== 1) {
      if (e.buttons === 0) setGhost(null);
      return;
    }
    const { docX: sx, docY: sy } = createDragStart.current;
    const [mx, my] = clampToWorkspace(...getSvgPoint(e));
    switch (activeTool) {
      case "line": {
        setGhost({ tool: "line", x1: sx, y1: sy, x2: mx, y2: my }); break;
      }
      case "rect": {
        const x = Math.min(sx, mx), y = Math.min(sy, my);
        setGhost({ tool: "rect", x, y, w: Math.abs(mx - sx), h: Math.abs(my - sy) }); break;
      }
      case "circle": {
        const ws = workspaceBounds(page);
        const max_r_x_right = sx - ws.x;
        const max_r_x_left  = ws.x + ws.w - sx;
        const max_r_y_up    = sy - ws.y;
        const max_r_y_down = ws.y + ws.h - sy;
        const r = Math.min(Math.hypot(mx - sx, my - sy), max_r_x_right, max_r_x_left, max_r_y_up, max_r_y_down  );
        setGhost({ tool: "circle", cx: sx, cy: sy, r: r }); break;
      }
    }
  }, [activeTool, selectedId, viewport, onViewportChange, onMoveElement]);

  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (elementDragLast.current) { elementDragLast.current = null; return; }
    if (panStart.current)        { panStart.current = null; return; }
    if (!createDragStart.current || activeTool === "select") return;

    const { docX: sx, docY: sy } = createDragStart.current;
    const [mx, my] = clampToWorkspace(...getSvgPoint(e));
    createDragStart.current = null;
    setGhost(null);

    if (Math.hypot(mx - sx, my - sy) < 0.5) return; // ignore accidental clicks

    const id = newId();
    let el: Element;
    switch (activeTool) {
      case "line": {
        el = { id, type: "Line", x1: sx, y1: sy, x2: mx, y2: my };
        break;
      }
      case "rect": {
        const x = Math.min(sx, mx), y = Math.min(sy, my);
        el = { id, type: "Rect", x, y, w: Math.abs(mx - sx), h: Math.abs(my - sy) };
        break;
      }
      case "circle": {
        const ws = workspaceBounds(page);
        const max_r_x_right = sx - ws.x;
        const max_r_x_left  = ws.x + ws.w - sx;
        const max_r_y_up    = sy - ws.y;
        const max_r_y_down = ws.y + ws.h - sy;
        const r = Math.min(Math.hypot(mx - sx, my - sy), max_r_x_right, max_r_x_left, max_r_y_up, max_r_y_down  );
        el = { id, type: "Circle", cx: sx, cy: sy, r: r };
        break;
      }
      default: return;
    }
    onAddElement(activeLayerId, el);
  }, [activeTool, activeLayerId, viewport, onAddElement]);

  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
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
    if (panStart.current) {
      const dx = panStart.current.px - (e.clientX - rect.left);
      const dy = panStart.current.py - (e.clientY - rect.top);
      panStart.current = {
        vp: { ...newVp, panX: newVp.panX + dx, panY: newVp.panY + dy },
        px: panStart.current.px,
        py: panStart.current.py,
      };
    }
    onViewportChange(newVp);
  }, [viewport, onViewportChange]);

  // Exposed so the hit-target paths can start a drag
  function startElementDrag(e: React.PointerEvent, elementId: string) {
    onSelectElement(elementId);
    onMoveStart();
    const rect = svgRef.current!.getBoundingClientRect();
    const [docX, docY] = viewportToDoc(e.clientX - rect.left, e.clientY - rect.top, viewport);
    elementDragLast.current = { docX, docY };
  }

  return { ghost, onPointerDown, onPointerMove, onPointerUp, onWheel, startElementDrag };
}
