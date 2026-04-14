// ── Plotter top-down view ─────────────────────────────────────────────────────
// SVG coordinate system: 1 unit = 1 mm, origin at top-left of workspace.
// Z ordering (bottom → top): PlotterBody → XAxisBeam → PlotterHead.
//
// When onPositionChange is provided the view becomes interactive:
// clicking/dragging anywhere updates the head position (future manual control).

import { useRef } from "react";
import type { PlotterPosition } from "./dimensions";
import {
    BODY_BEAM_MARGIN_MM,
    BODY_BEAM_WIDTH_MM,
    BODY_BEAM_OVERSHOOT_TOP_MM,
    BODY_FRONT_HEIGHT_MM,
    BODY_FRONT_MARGIN_MM
} from "./dimensions";
import PlotterBody from "./PlotterBody";
import XAxisBeam from "./XAxisBeam";
import PlotterHead from "./PlotterHead";

interface Props {
  position: PlotterPosition;
  activePenColor?: string;
  // Provide to enable drag-to-move manual control; omit for view-only
  onPositionChange?: (pos: PlotterPosition) => void;
}

export default function PlotterView({ position, activePenColor, onPositionChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const workspaceWidthMm = 185;
  const workspaceHeightMm = 265;

  const view_box_x = -BODY_BEAM_MARGIN_MM - BODY_BEAM_WIDTH_MM;
  const view_box_y = -BODY_BEAM_OVERSHOOT_TOP_MM;
  const view_box_width = workspaceWidthMm + (BODY_BEAM_MARGIN_MM + BODY_BEAM_WIDTH_MM) * 2;
  const view_box_height = workspaceHeightMm + BODY_BEAM_OVERSHOOT_TOP_MM + BODY_FRONT_MARGIN_MM + BODY_FRONT_HEIGHT_MM;

  const viewBox = `${view_box_x} ${view_box_y} ${view_box_width} ${view_box_height}`;

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
      x: Math.max(0, Math.min(workspaceWidthMm, p.x)),
      y: Math.max(0, Math.min(workspaceHeightMm, p.y)),
    };
  }

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full select-none"
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
      <PlotterBody widthMm={workspaceWidthMm} heightMm={workspaceHeightMm} />

      {/* ── Z-layer 1: X-axis beam — travels along Y ── */}
      <XAxisBeam widthMm={workspaceWidthMm} yMm={position.y} />

      {/* ── Z-layer 2: Head — travels along the beam ── */}
      <PlotterHead xMm={position.x} yMm={position.y} penColor={activePenColor} />
    </svg>
  );
}
