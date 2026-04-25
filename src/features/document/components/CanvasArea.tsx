import { useRef, useState } from "react";
import type { Element, PnplttrDocument, Tool } from "../types";
import { elementToStrokes, strokeToSvgPath } from "../canvas/Strokes";
import { Ghost, ghostToSvgPaths } from "../canvas/Ghost";
import { getHandles } from "../canvas/DeformHandles";
import { useCanvasPointer } from "../hooks/useCanvasPointer";
import { Viewport } from "../canvas/viewport";
import { useTextElementToStrokes } from "../fonts/textToStrokes";
import { getHints } from "../canvas/SelectionHints";

interface Props {
  doc: PnplttrDocument;
  activeLayerId: string;
  activeTool: Tool;
  selectedId: string | null;
  viewport: Viewport;
  onAddElement: (layerId: string, el: Element) => void;
  onSelectElement: (id: string | null) => void;
  onMoveElement: (id: string, dx: number, dy: number) => void;
  onMoveStart: (elementId: string) => void;
  onDeformStart: (elementId: string, handleId: string) => void;
  onDeformElement: (elementId: string, handleId: string, x: number, y: number) => void;
  onViewportChange: (v: Viewport) => void;
}

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
  onDeformStart,
  onDeformElement,
  onViewportChange,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const renderText = useTextElementToStrokes();
  const { onPointerDown, onPointerMove, onPointerUp, onWheel, startElementDrag, startHandleDrag } =
    useCanvasPointer({
      svgRef, viewport, activeTool, activeLayerId, ghost, setGhost, page: doc.page,
      onAddElement, onSelectElement, onMoveElement, onMoveStart,
      onDeformStart, onDeformElement, onViewportChange,
    });

  const selectedElement = selectedId
    ? doc.layers.flatMap(l => l.elements).find(el => el.id === selectedId) ?? null
    : null;

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
            layer.elements.flatMap((el) => {
              const strokes = elementToStrokes(el, renderText);
              let i = 0;
              return strokes.map((stroke) => {
                const d = strokeToSvgPath(stroke);
                return (
                  <g key={`${layer.id}-${el.id}-${i++}`}>
                    <path d={d} fill="none" stroke={el.id === selectedId ? "#4d90fe" : layer.pen.color}
                      strokeWidth={layer.pen.width / viewport.zoom}
                      strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"
                    />
                    
                    {/* Invisible hit area for selection */}
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
            })
          )}

          {/* Selection handles and hints */}
          {selectedElement && activeTool === "select" && (
            <>
              {getHints(selectedElement).map((hint, i) => (
                <path key={i} d={strokeToSvgPath(hint)} fill="none" stroke="#60a5fa" opacity={0.5}
                  strokeWidth={1 / viewport.zoom} strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray={`${4 / viewport.zoom} ${4 / viewport.zoom}`}
                />
              ))}

              {getHandles(selectedElement).map((handle) => (
                <circle
                  key={handle.id}
                  cx={handle.x}
                  cy={handle.y}
                  r={5 / viewport.zoom}
                  fill="#2c3e49"
                  stroke="#60a5fa"
                  strokeWidth={1 / viewport.zoom}
                  style={{ cursor: "crosshair" }}
                  onPointerDown={(e) => { e.stopPropagation(); startHandleDrag(e, selectedElement.id, handle.id); }}
                />
              ))}
            </>
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
