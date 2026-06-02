import { useRef, useState, useCallback, useEffect } from "react";
import type { Element, Tool, PageSettings } from "../types";
import { newId, workspaceBounds } from "../utils";
import { Ghost } from "../canvas/Ghost";
import { type Viewport, viewportToDoc } from "../canvas/viewport";
import { elementsInMarquee } from "../canvas/marqueeHitTest";
import { SHAPE_TOOLS, isShapeTool } from "../canvas/shapeTools";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * The live marquee selection rectangle while the user is dragging.
 * mode "enclosed"  = right-drag  → only elements fully inside are selected
 * mode "crossing"  = left-drag   → elements that intersect the rect are selected
 */
export type MarqueeState = {
  x: number;
  y: number;
  w: number;
  h: number;
  mode: "enclosed" | "crossing";
};

// ── Pure helpers ───────────────────────────────────────────────────────────────

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

// ── Hook ──────────────────────────────────────────────────────────────────────

interface Options {
  svgRef: React.RefObject<SVGSVGElement | null>;
  viewport: Viewport;
  activeTool: Tool;
  activePenIndex: number;
  /** All elements, needed for marquee hit-testing. */
  elements: Element[];
  /** The next z value to assign to new elements. */
  nextZ: number;
  /** Currently selected element IDs, needed so element-click can extend vs. replace. */
  selectedIds: string[];
  ghost: Ghost | null;
  page: PageSettings;
  onAddElement: (el: Element) => void;
  setGhost: (g: Ghost | null) => void;
  /** Replace the entire selection with a new set of IDs (pass [] to clear). */
  onSelectElements: (ids: string[]) => void;
  onMoveStart: (elementIds: string[]) => void;
  onMoveElement: (totalDx: number, totalDy: number) => void;
  onDeformStart: (elementId: string, handleId: string) => void;
  onDeformElement: (elementId: string, handleId: string, x: number, y: number) => void;
  onViewportChange: (v: Viewport) => void;
}

export function useCanvasPointer({
  svgRef,
  viewport,
  activeTool,
  activePenIndex,
  elements,
  nextZ,
  selectedIds,
  ghost,
  page,
  onAddElement,
  setGhost,
  onSelectElements,
  onMoveStart,
  onMoveElement,
  onDeformStart,
  onDeformElement,
  onViewportChange,
}: Options) {
  const panRef        = useRef<{ vp: Viewport; px: number; py: number } | null>(null);
  const dragRef       = useRef<{ elementIds: string[]; grabDocX: number; grabDocY: number } | null>(null);
  const handleDragRef = useRef<{ elementId: string; handleId: string } | null>(null);
  const shapeStart    = useRef<{ docX: number; docY: number } | null>(null);
  const marqueeStart  = useRef<{ docX: number; docY: number; additive: boolean } | null>(null);
  const ghostRef      = useRef<Ghost | null>(ghost);
  ghostRef.current    = ghost;

  // selectedIds changes every render; keep a ref so startElementDrag always reads latest
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  // Live marquee rect shown while dragging (rendered as SVG overlay in CanvasArea)
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);

  // Reset interaction state when tool changes
  useEffect(() => {
    if (activeTool === "select") setGhost(null);
    else onSelectElements([]);
    dragRef.current       = null;
    handleDragRef.current = null;
    marqueeStart.current  = null;
    setMarquee(null);
  }, [activeTool, onSelectElements]);

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const isPan = (e.button === 0 && e.altKey) || e.button === 2;
    if (isPan) {
      const rect = svgRef.current!.getBoundingClientRect();
      panRef.current = { vp: viewport, px: e.clientX - rect.left, py: e.clientY - rect.top };
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    if (e.button !== 0) return;

    if (activeTool === "select") {
      const additive = e.ctrlKey || e.metaKey;
      // Without Ctrl: clear existing selection. With Ctrl: keep it and add to it.
      if (!additive) onSelectElements([]);
      const [docX, docY] = getSvgPoint(e, svgRef, viewport);
      marqueeStart.current = { docX, docY, additive };
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      return;
    }

    if (activeTool === "pen") {
      const [docX, docY] = clampToWorkspace(...getSvgPoint(e, svgRef, viewport), page);
      setGhost({ type: "Drawing", points: [[docX, docY]] });
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      return;
    }

    const [mx, my] = clampToWorkspace(...getSvgPoint(e, svgRef, viewport), page);
    shapeStart.current = { docX: mx, docY: my };
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
  }, [activeTool, viewport, page, onSelectElements]);

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    // Pan
    if (panRef.current) {
      const rect = svgRef.current!.getBoundingClientRect();
      const dx = (e.clientX - rect.left) - panRef.current.px;
      const dy = (e.clientY - rect.top)  - panRef.current.py;
      onViewportChange({ ...panRef.current.vp, panX: panRef.current.vp.panX + dx, panY: panRef.current.vp.panY + dy });
      return;
    }

    if (activeTool === "select") {
      // Deform handle drag
      if (handleDragRef.current) {
        const [x, y] = clampToWorkspace(...getSvgPoint(e, svgRef, viewport), page);
        onDeformElement(handleDragRef.current.elementId, handleDragRef.current.handleId, x, y);
        return;
      }
      // Element drag (single or multi)
      if (dragRef.current) {
        const [curDocX, curDocY] = getSvgPoint(e, svgRef, viewport);
        onMoveElement(curDocX - dragRef.current.grabDocX, curDocY - dragRef.current.grabDocY);
        return;
      }
      // Marquee drag
      if (marqueeStart.current) {
        const [curDocX, curDocY] = getSvgPoint(e, svgRef, viewport);
        const { docX: startDocX, docY: startDocY } = marqueeStart.current;
        const x = Math.min(startDocX, curDocX);
        const y = Math.min(startDocY, curDocY);
        const w = Math.abs(curDocX - startDocX);
        const h = Math.abs(curDocY - startDocY);
        const mode = curDocX >= startDocX ? "enclosed" : "crossing";
        if (w > 1 || h > 1) setMarquee({ x, y, w, h, mode });
        return;
      }
      return;
    }

    if (activeTool === "pen") {
      if (!ghostRef.current || ghostRef.current.type !== "Drawing") return;
      
      const [docX, docY] = clampToWorkspace(...getSvgPoint(e, svgRef, viewport), page);
      const lastPoint = ghostRef.current.points[ghostRef.current.points.length - 1];
      const dist = Math.hypot(docX - lastPoint[0], docY - lastPoint[1]);
      if (dist < 0.5) return;

      setGhost({ type: "Drawing", points: [...ghostRef.current.points, [docX, docY]] });
      return;
    }

    // Shape creation ghost (drawing tools only)
    if (e.buttons === 0) { setGhost(null); return; }
    if (!shapeStart.current || e.buttons !== 1) return;

    const { docX: sx, docY: sy } = shapeStart.current;
    const [mx, my] = clampToWorkspace(...getSvgPoint(e, svgRef, viewport), page);
    if (isShapeTool(activeTool)) {
      setGhost(SHAPE_TOOLS[activeTool].makeGhost(sx, sy, mx, my, page));
    }
  }, [activeTool, viewport, page, onViewportChange, onMoveElement, onDeformElement]);

  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (handleDragRef.current) { handleDragRef.current = null; return; }
    if (dragRef.current)       { dragRef.current = null; return; }
    if (panRef.current)        { panRef.current = null; return; }

    if (activeTool === "select") {
      if (marqueeStart.current) {
        const [curDocX, curDocY] = getSvgPoint(e, svgRef, viewport);
        const { docX: startDocX, docY: startDocY, additive } = marqueeStart.current;
        marqueeStart.current = null;
        setMarquee(null);
        const x = Math.min(startDocX, curDocX);
        const y = Math.min(startDocY, curDocY);
        const w = Math.abs(curDocX - startDocX);
        const h = Math.abs(curDocY - startDocY);
        if (w > 2 && h > 2) {
          const mode = curDocX >= startDocX ? "enclosed" : "crossing";
          const hit = elementsInMarquee(elements, x, y, w, h, mode);
          if (additive) {
            // Union: add newly hit elements to the existing selection
            const merged = [...new Set([...selectedIdsRef.current, ...hit])];
            onSelectElements(merged);
          } else {
            onSelectElements(hit);
          }
        }
        // else: treated as empty-space click → selection already handled in onPointerDown
      }
      return;
    }

    if (activeTool === "pen") {
      if (!ghostRef.current || ghostRef.current.type !== "Drawing" || ghostRef.current.points.length < 2) { setGhost(null); return; }
      const id = newId();
      onAddElement({ id, type: "Drawing", pen: activePenIndex, z: nextZ, points: ghostRef.current.points });
      setGhost(null);
      return;
    }

    if (!shapeStart.current) return;

    const { docX: sx, docY: sy } = shapeStart.current;
    const [mx, my] = clampToWorkspace(...getSvgPoint(e, svgRef, viewport), page);
    shapeStart.current = null;
    setGhost(null);

    if (Math.hypot(mx - sx, my - sy) < 0.5) return;

    if (!isShapeTool(activeTool)) return;
    const el = SHAPE_TOOLS[activeTool].makeElement(newId(), sx, sy, mx, my, page, activePenIndex, nextZ);
    onAddElement(el);
  }, [activeTool, activePenIndex, nextZ, viewport, page, elements, onAddElement, onSelectElements]);

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
    marqueeStart.current = null;
    setMarquee(null);
    const current = selectedIdsRef.current;

    if (e.ctrlKey || e.metaKey) {
      // Ctrl+click: toggle element in/out of selection, no drag started
      if (current.includes(elementId)) {
        onSelectElements(current.filter(id => id !== elementId));
      } else {
        onSelectElements([...current, elementId]);
      }
      return;
    }

    // If the clicked element is already part of the selection, drag the whole selection.
    // Otherwise replace the selection with just this element.
    const idsToMove = current.includes(elementId) ? current : [elementId];
    if (!current.includes(elementId)) {
      onSelectElements([elementId]);
    }
    onMoveStart(idsToMove);
    const [grabDocX, grabDocY] = getSvgPoint(e, svgRef, viewport);
    dragRef.current = { elementIds: idsToMove, grabDocX, grabDocY };
    svgRef.current!.setPointerCapture(e.pointerId);
  }

  function startHandleDrag(e: React.PointerEvent, elementId: string, handleId: string) {
    onDeformStart(elementId, handleId);
    handleDragRef.current = { elementId, handleId };
    svgRef.current!.setPointerCapture(e.pointerId);
  }

  return { onPointerDown, onPointerMove, onPointerUp, onWheel, startElementDrag, startHandleDrag, marquee };
}
