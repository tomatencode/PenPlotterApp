// ── Plotter top-down view ─────────────────────────────────────────────────────
// SVG coordinate system: 1 unit = 1 mm, origin at top-left of workspace.
// Z ordering (bottom → top): PlotterBody → XAxisBeam → PlotterHead.
//
// When onPositionChange is provided the view becomes interactive:
// clicking/dragging anywhere updates the head position (future manual control).

import { useRef } from "react";
import type { PlotterPosition } from "./types";
import { BODY_MARGIN_MM } from "./types";
import PlotterBody from "./PlotterBody";
import XAxisBeam from "./XAxisBeam";
import PlotterHead from "./PlotterHead";

interface Props {
  widthMm: number;
  heightMm: number;
  position: PlotterPosition;
  activePenColor?: string;
  // Provide to enable drag-to-move manual control; omit for view-only
  onPositionChange?: (pos: PlotterPosition) => void;
}

export default function PlotterView({ widthMm, heightMm, position, activePenColor, onPositionChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const m = BODY_MARGIN_MM;
  const viewBox = `${-m} ${-m} ${widthMm + m * 2} ${heightMm + m * 2}`;

  // Uses the SVG's own transform matrix so preserveAspectRatio letterboxing
  // is handled correctly — no manual rect math needed.
  function svgPoint(clientX: number, clientY: number): PlotterPosition | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return {
      x: Math.max(0, Math.min(widthMm, p.x)),
      y: Math.max(0, Math.min(heightMm, p.y)),
    };
  }

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full select-none"
      style={{ cursor: onPositionChange ? "crosshair" : "default" }}
      onMouseDown={(e) => {
        if (!onPositionChange) return;
        dragging.current = true;
        const pos = svgPoint(e.clientX, e.clientY);
        if (pos) onPositionChange(pos);
        e.preventDefault();
      }}
      onMouseMove={(e) => {
        if (!dragging.current || !onPositionChange) return;
        const pos = svgPoint(e.clientX, e.clientY);
        if (pos) onPositionChange(pos);
      }}
      onMouseUp={() => { dragging.current = false; }}
      onMouseLeave={() => { dragging.current = false; }}
    >
      {/* ── Z-layer 0: Static body (chassis + Y rails) ── */}
      <PlotterBody widthMm={widthMm} heightMm={heightMm} />

      {/* ── Z-layer 1: X-axis beam — travels along Y ── */}
      <XAxisBeam widthMm={widthMm} yMm={position.y} />

      {/* ── Z-layer 2: Head — travels along the beam ── */}
      <PlotterHead xMm={position.x} yMm={position.y} penColor={activePenColor} />

      {/* ── Position readout overlay ── */}
      <text
        x={widthMm} y={heightMm + m * 0.65}
        textAnchor="end"
        fontSize={8}
        fill="#334155"
        fontFamily="monospace"
      >
        {position.x.toFixed(1)}, {position.y.toFixed(1)} mm
      </text>
    </svg>
  );
}
