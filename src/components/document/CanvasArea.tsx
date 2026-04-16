import { useRef } from "react";
import type { Element, PnplttrDocument, Tool } from "./types";
import { elementToStrokes, strokeToSvgPath } from "../../utils/strokes";
import { useCanvasPointer, ghostToSvgPaths } from "./useCanvasPointer";

// ── Viewport helpers ──────────────────────────────────────────────────────────

export interface Viewport {
  zoom: number;   // scale factor, 1 = 1px per mm
  panX: number;   // offset in px (pixels)
  panY: number;
}

/** Convert an SVG-space pixel point to document mm coordinates. */
export function viewportToDoc(px: number, py: number, viewport: Viewport): [number, number] {
  return [
    (px - viewport.panX) / viewport.zoom,
    (py - viewport.panY) / viewport.zoom,
  ];
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
  onMoveStart: () => void;
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
  onMoveStart,
  onViewportChange,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  const { ghost, onPointerDown, onPointerMove, onPointerUp, onWheel, startElementDrag } =
    useCanvasPointer({
      svgRef, viewport, activeTool, selectedId, activeLayerId,
      onAddElement, onSelectElement, onMoveElement, onMoveStart, onViewportChange,
    });

  const cursorClass = activeTool === "select" ? "cursor-default" : "cursor-crosshair";
  const transform   = `translate(${viewport.panX}, ${viewport.panY}) scale(${viewport.zoom})`;
  const ghostPaths  = ghostToSvgPaths(ghost);

  return (
    <main className={`flex-1 overflow-hidden bg-[#0a0c10] relative ${cursorClass} select-none`}>
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

          {/* Elements */}
          {doc.layers.flatMap((layer) =>
            layer.elements.flatMap((el) =>
              elementToStrokes(el).map((stroke) => {
                const d          = strokeToSvgPath(stroke);
                const isSelected = el.id === selectedId;
                return (
                  <g key={`${layer.id}-${el.id}-${stroke.start[0]}-${stroke.start[1]}`}>
                    <path d={d} fill="none" stroke={isSelected ? "#60a5fa" : layer.pen.color}
                      strokeWidth={layer.pen.width / viewport.zoom}
                      strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
                    {activeTool === "select" && (
                      <path d={d} fill="none" stroke="transparent"
                        strokeWidth={(layer.pen.width + 8) / viewport.zoom}
                        strokeLinecap="round" strokeLinejoin="round"
                        style={{ cursor: "pointer" }}
                        onPointerDown={(e) => { e.stopPropagation(); startElementDrag(e, el.id); }}
                      />
                    )}
                  </g>
                );
              })
            )
          )}

          {/* Ghost preview */}
          {ghostPaths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="#60a5fa" opacity={0.5}
              strokeWidth={1 / viewport.zoom} strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray={`${4 / viewport.zoom} ${4 / viewport.zoom}`}
            />
          ))}

          {/* Page border */}
          <rect x={0} y={0} width={doc.page.page_width} height={doc.page.page_height}
            fill="none" stroke="#475569" strokeWidth={1 / viewport.zoom} />

          {/* Workspace border */}
          <rect
            x={Math.max(doc.page.page_width  / 2 - doc.page.workspace_width  / 2, 0)}
            y={Math.max(doc.page.page_height / 2 - doc.page.workspace_height / 2, 0)}
            width={Math.min(doc.page.workspace_width,  doc.page.page_width)}
            height={Math.min(doc.page.workspace_height, doc.page.page_height)}
            fill="none" stroke="#eea03b" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray={`${4 / viewport.zoom} ${4 / viewport.zoom}`}
            strokeWidth={1 / viewport.zoom}
          />
        </g>
      </svg>
    </main>
  );
}
