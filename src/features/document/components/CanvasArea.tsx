import { useRef, useState } from "react";
import type { Element, PlttrFont, PnplttrDocument, Tool } from "../types";
import { elementToStrokes, strokeToSvgPath } from "../canvas/Strokes";
import { Ghost, ghostToSvgPaths } from "../canvas/Ghost";
import { getHandles } from "../canvas/DeformHandles";
import { useCanvasPointer } from "../hooks/useCanvasPointer";
import { Viewport } from "../canvas/viewport";
import { getHints } from "../canvas/SelectionHints";
import { elementBounds } from "../utils";

interface Props {
  doc: PnplttrDocument;
  fonts: Map<string, PlttrFont>;
  activePenIndex: number;
  activeTool: Tool;
  selectedIds: string[];
  viewport: Viewport;
  onAddElement: (el: Element) => void;
  onSelectElements: (ids: string[]) => void;
  onMoveElement: (totalDx: number, totalDy: number) => void;
  onMoveStart: (elementIds: string[]) => void;
  onDeformStart: (elementId: string, handleId: string) => void;
  onDeformElement: (elementId: string, handleId: string, x: number, y: number) => void;
  onMultiDeformStart: (elementIds: string[]) => void;
  onMultiDeformElement: (handleId: string, x: number, y: number) => void;
  onViewportChange: (v: Viewport) => void;
}

export default function CanvasArea({
  doc,
  fonts,
  activePenIndex,
  activeTool,
  selectedIds,
  viewport,
  onAddElement,
  onSelectElements,
  onMoveElement,
  onMoveStart,
  onDeformStart,
  onDeformElement,
  onMultiDeformStart,
  onMultiDeformElement,
  onViewportChange,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const { onPointerDown, onPointerMove, onPointerUp, onWheel, startElementDrag, startHandleDrag, startMultiHandleDrag, marquee } =
    useCanvasPointer({
      svgRef, viewport, activeTool, activePenIndex,
      elements: doc.elements, nextZ: doc.elements.length,
      selectedIds, ghost, setGhost, page: doc.page,
      onAddElement, onSelectElements, onMoveElement, onMoveStart,
      onDeformStart, onDeformElement, onMultiDeformStart, onMultiDeformElement, onViewportChange,
    });

  // For single-element operations (deform handles) we need the actual element
  const singleSelectedElement = selectedIds.length === 1
    ? doc.elements.find(el => el.id === selectedIds[0]) ?? null
    : null;

  const selectedSet = new Set(selectedIds);
  const cursorClass = activeTool === "select" ? "cursor-default" : "cursor-crosshair";
  const transform   = `translate(${viewport.panX}, ${viewport.panY}) scale(${viewport.zoom})`;
  const ghostPaths  = ghostToSvgPaths(ghost, fonts);

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

          {/* Elements — rendered sorted by z */}
          {[...doc.elements].sort((a, b) => a.z - b.z).flatMap((el) => {
              const strokes = elementToStrokes(el, fonts);
              const isSelected = selectedSet.has(el.id);
              const pen = doc.pens[el.pen] ?? doc.pens[0];
              let i = 0;
              return strokes.map((stroke) => {
                const d = strokeToSvgPath(stroke);
                return (
                  <g key={`${el.id}-${i++}`}>
                    <path d={d} fill="none" stroke={isSelected ? "#4d90fe" : pen.color}
                      strokeWidth={pen.width}
                      strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"
                    />

                    {/* Invisible hit area for selection */}
                    {activeTool === "select" && (
                      <path d={d} fill="none" stroke="transparent"
                        strokeWidth={(pen.width + 8)}
                        strokeLinecap="round" strokeLinejoin="round"
                        style={{ cursor: "pointer" }}
                        onPointerDown={(e) => { e.stopPropagation(); startElementDrag(e, el.id); }}
                      />
                    )}
                  </g>
                );
              })
            })}

          {/* Selection hints for all selected elements; deform handles only for single selection */}
          {activeTool === "select" && selectedIds.length > 0 && (
            <>
              {doc.elements.filter(el => selectedSet.has(el.id)).map(el => (
                <g key={`hint-${el.id}`}>
                  {getHints(el).map((hint, i) => (
                    <path key={i} d={strokeToSvgPath(hint)} fill="none" stroke="#60a5fa" opacity={0.5}
                      strokeWidth={1 / viewport.zoom} strokeLinecap="round" strokeLinejoin="round"
                      strokeDasharray={`${4 / viewport.zoom} ${4 / viewport.zoom}`}
                    />
                  ))}
                </g>
              ))}

              {/* Deform handles: only when exactly one element is selected */}
              {singleSelectedElement && getHandles(singleSelectedElement).map((handle) => (
                <circle
                  key={handle.id}
                  cx={handle.x}
                  cy={handle.y}
                  r={5 / viewport.zoom}
                  fill="#2c3e49"
                  stroke="#60a5fa"
                  strokeWidth={1 / viewport.zoom}
                  style={{ cursor: "crosshair" }}
                  onPointerDown={(e) => { e.stopPropagation(); startHandleDrag(e, singleSelectedElement.id, handle.id); }}
                />
              ))}

              {/* Multi-selection bounding box + corner handles */}
              {selectedIds.length > 1 && (() => {
                const selectedEls = doc.elements.filter(el => selectedSet.has(el.id));
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (const el of selectedEls) {
                  const b = elementBounds(el);
                  if (b.minX < minX) minX = b.minX; if (b.minY < minY) minY = b.minY;
                  if (b.maxX > maxX) maxX = b.maxX; if (b.maxY > maxY) maxY = b.maxY;
                }
                if (!isFinite(minX)) return null;
                const bboxHandles = [
                  { id: "tl", x: minX, y: minY },
                  { id: "tr", x: maxX, y: minY },
                  { id: "bl", x: minX, y: maxY },
                  { id: "br", x: maxX, y: maxY },
                ];
                return (
                  <>
                    <rect
                      x={minX} y={minY} width={maxX - minX} height={maxY - minY}
                      fill="none" stroke="#60a5fa" strokeWidth={1 / viewport.zoom}
                      strokeDasharray={`${4 / viewport.zoom} ${4 / viewport.zoom}`}
                      pointerEvents="none"
                    />
                    {bboxHandles.map(h => (
                      <circle
                        key={h.id} cx={h.x} cy={h.y}
                        r={5 / viewport.zoom}
                        fill="#2c3e49" stroke="#60a5fa" strokeWidth={1 / viewport.zoom}
                        style={{ cursor: "crosshair" }}
                        onPointerDown={(e) => { e.stopPropagation(); startMultiHandleDrag(e, selectedIds, h.id); }}
                      />
                    ))}
                  </>
                );
              })()}
            </>
          )}

          {/* Ghost preview */}
          {ghostPaths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="#60a5fa" opacity={0.5}
              strokeWidth={1} strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray={`${4} ${4}`}
            />
          ))}

          {/* Marquee selection rectangle */}
          {marquee && (
            <rect
              x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h}
              fill={marquee.mode === "enclosed" ? "rgba(59,130,246,0.08)" : "rgba(34,197,94,0.08)"}
              stroke={marquee.mode === "enclosed" ? "#3b82f6" : "#22c55e"}
              strokeWidth={1 / viewport.zoom}
              strokeDasharray={marquee.mode === "crossing" ? `${4 / viewport.zoom} ${4 / viewport.zoom}` : undefined}
              pointerEvents="none"
            />
          )}

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
            strokeDasharray={`${4} ${4}`}
            strokeWidth={0.5}
          />
        </g>
      </svg>
    </main>
  );
}
