import { useRef, useState, useCallback, useEffect } from "react";
import type { Element, PnplttrDocument, Tool } from "./types";
import { newId } from "./types";
import { elementToStrokes, strokeToSvgPath } from "../../utils/strokes";

// ── Viewport helpers ──────────────────────────────────────────────────────────

export interface Viewport {
  zoom: number;   // scale factor, 1 = 1px per mm
  panX: number;   // offset in px
  panY: number;
}

/** Convert an SVG-element-relative pixel point to document mm coordinates. */
export function viewportToDoc(
  px: number, py: number,
  viewport: Viewport,
): [number, number] {
  return [
    (px - viewport.panX) / viewport.zoom,
    (py - viewport.panY) / viewport.zoom,
  ];
}

// ── Ghost (in-progress draw preview) ─────────────────────────────────────────

type Ghost =
  | { tool: "line";   x1: number; y1: number; x2: number; y2: number }
  | { tool: "rect";   x: number;  y: number;  w: number;  h: number  }
  | { tool: "circle"; cx: number; cy: number; r: number              };

function ghostToElement(g: Ghost): Element {
  const id = "__ghost__";
  switch (g.tool) {
    case "line":   return { id, type: "Line",   x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2 };
    case "rect":   return { id, type: "Rect",   x: g.x, y: g.y, w: g.w, h: g.h };
    case "circle": return { id, type: "Circle", cx: g.cx, cy: g.cy, r: g.r };
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  doc: PnplttrDocument;
  activeLayerId: string;
  activeTool: Tool;
  selectedId: string | null;
  viewport: Viewport;
  onAddElement: (layerId: string, el: Element) => void;
  onSelectElement: (id: string | null) => void;
  onMoveElement: (id: string, dx: number, dy: number) => void;
  onViewportChange: (v: Viewport) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CanvasArea({
  doc,
  activeLayerId,
  activeTool,
  selectedId,
  viewport,
  onAddElement,
  onSelectElement,
  onMoveElement,
  onViewportChange,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const panStart = useRef<{ vp: Viewport; px: number; py: number } | null>(null);
  const elementDragStart = useRef<{ docX: number; docY: number } | null>(null);
  const elementCreateDragStart = useRef<{ docX: number; docY: number } | null>(null);

  useEffect(() => {
    if (activeTool !== "select") {
      onSelectElement(null);
    }
  }, [activeTool, onSelectElement]);

  function getSvgPoint(e: React.PointerEvent): [number, number] {
    const rect = svgRef.current!.getBoundingClientRect();
    return viewportToDoc(e.clientX - rect.left, e.clientY - rect.top, viewport);
  }

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if ((e.button === 0 && e.altKey) || e.button === 2) {
      // alt+drag or right click → pan
      const rect = svgRef.current!.getBoundingClientRect();
      panStart.current = { vp: viewport, px: e.clientX - rect.left, py: e.clientY - rect.top };
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    }

    if (e.button === 0 && activeTool === "select") {
      onSelectElement(null);
    };

    if (activeTool !== "select" && e.button === 0) {
      const [mx, my] = getSvgPoint(e);
      elementCreateDragStart.current = { docX: mx, docY: my };
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    }
  }, [activeTool, viewport, onSelectElement]);

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    // Pan
    if (panStart.current) {
      const rect = svgRef.current!.getBoundingClientRect();
      const dx = (e.clientX - rect.left) - panStart.current.px;
      const dy = (e.clientY - rect.top)  - panStart.current.py;
      onViewportChange({
        ...panStart.current.vp,
        panX: panStart.current.vp.panX + dx,
        panY: panStart.current.vp.panY + dy,
      });
    }

    if (elementDragStart.current && selectedId && activeTool === "select") {
      const [curDocX, curDocY] = getSvgPoint(e);
      const dx = curDocX - elementDragStart.current.docX;
      const dy = curDocY - elementDragStart.current.docY;
      elementDragStart.current = { docX: curDocX, docY: curDocY };
      onMoveElement(selectedId, dx, dy);
    }

    if (elementCreateDragStart.current && activeTool !== "select") {
      const { docX: sx, docY: sy } = elementCreateDragStart.current;
      const [mx, my] = getSvgPoint(e);

      switch (activeTool) {
        case "line":
          setGhost({ tool: "line", x1: sx, y1: sy, x2: mx, y2: my });
          break;
        case "rect": {
          const x = Math.min(sx, mx), y = Math.min(sy, my);
          setGhost({ tool: "rect", x, y, w: Math.abs(mx - sx), h: Math.abs(my - sy) });
          break;
        }
        case "circle": {
          const r = Math.hypot(mx - sx, my - sy);
          setGhost({ tool: "circle", cx: sx, cy: sy, r });
          break;
        }
      }
    }
  }, [activeTool, selectedId, viewport, onViewportChange, onMoveElement]);

  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (panStart.current) { panStart.current = null; return; }
    elementDragStart.current = null;
    if (!elementCreateDragStart.current || activeTool === "select") return;

    const { docX: sx, docY: sy } = elementCreateDragStart.current;
    const [mx, my] = getSvgPoint(e);
    elementCreateDragStart.current = null;
    setGhost(null);

    // Ignore tiny drags (accidental clicks)
    if (Math.hypot(mx - sx, my - sy) < 0.5) return;

    let el: Element;
    const id = newId();
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
        el = { id, type: "Circle", cx: sx, cy: sy, r: Math.hypot(mx - sx, my - sy) };
        break;
      default:
        return;
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
    // Keep the pan reference in sync so a mid-pan zoom doesn't reset position
    if (panStart.current) {
      const dx = panStart.current.px - (e.clientX - rect.left); // recalc relative origin
      const dy = panStart.current.py - (e.clientY - rect.top);
      panStart.current = {
        vp: { ...newVp, panX: newVp.panX + dx, panY: newVp.panY + dy },
        px: panStart.current.px,
        py: panStart.current.py,
      };
    }
    onViewportChange(newVp);
  }, [viewport, onViewportChange]);

  // All element strokes across all layers, for rendering
  const allLayers = doc.layers.map((layer) => ({
    layer,
    strokes: layer.elements.flatMap((el) =>
      elementToStrokes(el).map((s) => ({ stroke: s, elementId: el.id }))
    ),
  }));

  const ghostStrokes = ghost
    ? elementToStrokes(ghostToElement(ghost)).map((s) => strokeToSvgPath(s))
    : [];

  const cursorClass =
    activeTool === "select" ? "cursor-default" :
    activeTool === "line"   ? "cursor-crosshair" :
    activeTool === "rect"   ? "cursor-crosshair" :
    activeTool === "circle" ? "cursor-crosshair" : "cursor-default";

  const transform = `translate(${viewport.panX}, ${viewport.panY}) scale(${viewport.zoom})`;

  return (
    <main className={`flex-1 overflow-hidden bg-[#0a0c10] relative ${cursorClass}`}>
      {/* Grid backdrop */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <svg
        ref={svgRef}
        className="relative z-[1] w-full h-full"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: "none" }}
      >
        <g transform={transform}>
          {/* Paper */}
          <rect x={0} y={0} width={doc.page.page_width} height={doc.page.page_height} fill="#e8eaf1" />

          {/* Committed elements, one <path> per stroke */}
          {allLayers.map(({ layer, strokes }) =>
            strokes.map(({ stroke, elementId }) => {
              const d = strokeToSvgPath(stroke);
              const isSelected = elementId === selectedId;
              return (
                <g key={`${layer.id}-${elementId}-${stroke.start[0]}-${stroke.start[1]}`}>
                  {/* Visible path */}
                  <path
                    d={d}
                    fill="none"
                    stroke={isSelected ? "#60a5fa" : layer.pen.color}
                    strokeWidth={layer.pen.width / viewport.zoom}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pointerEvents="none"
                  />
                  {/* Invisible hit target — always 8px wide in screen space */}
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={(layer.pen.width + 8) / viewport.zoom}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ cursor: activeTool === "select" ? "pointer" : undefined }}
                    onPointerDown={(e) => {
                      if (activeTool === "select") {
                        e.stopPropagation();
                        onSelectElement(elementId);
                        const rect = svgRef.current!.getBoundingClientRect();
                        const [docX, docY] = viewportToDoc(e.clientX - rect.left, e.clientY - rect.top, viewport);
                        elementDragStart.current = { docX, docY };
                      }
                    }}
                  />
                </g>
              );
            })
          )}

          {/* Ghost preview */}
          {ghostStrokes.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="#ffffff"
              strokeWidth={1 / viewport.zoom}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.5}
              strokeDasharray={`${4 / viewport.zoom} ${4 / viewport.zoom}`}
            />
          ))}

          {/* Page border */}
          <rect
            x={0}
            y={0}
            width={doc.page.page_width}
            height={doc.page.page_height}
            fill="none"
            stroke="#475569"
            strokeWidth={0.5 / viewport.zoom}
          />

          {/* Workspace border */}
          {(doc.page.page_width >= doc.page.workspace_width || doc.page.page_height >= doc.page.workspace_height) && (
            <rect
              x={doc.page.page_width / 2 - doc.page.workspace_width / 2}
              y={doc.page.page_height / 2 - doc.page.workspace_height / 2}
              width={doc.page.workspace_width}
              height={doc.page.workspace_height}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              stroke="#eea03b"
              strokeDasharray={`${4 / viewport.zoom} ${4 / viewport.zoom}`}
              strokeWidth={1 / viewport.zoom}
            />
          )}
        </g>
      </svg>
    </main>
  );
}
