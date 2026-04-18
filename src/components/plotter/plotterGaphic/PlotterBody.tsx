import {
  BODY_BEAM_MARGIN_MM,
  BODY_BEAM_WIDTH_MM,
  BODY_BEAM_OVERSHOOT_TOP_MM,
  BODY_FRONT_MARGIN_MM,
  BODY_FRONT_HEIGHT_MM
} from "./dimensions";

interface Props {
  workspaceWidthMm: number;
  workspaceHeightMm: number;
}

export default function PlotterBody({ workspaceWidthMm, workspaceHeightMm }: Props) {
  const wsW = workspaceWidthMm;
  const wsH = workspaceHeightMm;
  return (
    <g data-layer="body">
      {/* Workspace boundary (dashed) */}
      <rect
        x={0} y={0}
        width={wsW} height={wsH}
        fill="#0a0c10" stroke="#1e293b" strokeWidth={1} strokeDasharray="4 3"
      />

      {/* Left Y-axis rail */}
      <rect x={-BODY_BEAM_MARGIN_MM} y={-BODY_BEAM_OVERSHOOT_TOP_MM} width={BODY_BEAM_WIDTH_MM} height={wsH + BODY_BEAM_OVERSHOOT_TOP_MM + BODY_FRONT_MARGIN_MM + BODY_FRONT_HEIGHT_MM / 2} fill="#1e293b" rx={2} />

      {/* Right Y-axis rail */}
      <rect x={wsW + BODY_BEAM_MARGIN_MM - BODY_BEAM_WIDTH_MM} y={-BODY_BEAM_OVERSHOOT_TOP_MM} width={BODY_BEAM_WIDTH_MM} height={wsH + BODY_BEAM_OVERSHOOT_TOP_MM + BODY_FRONT_MARGIN_MM + BODY_FRONT_HEIGHT_MM / 2} fill="#1e293b" rx={2} />

      {/* 
        Machine front — U-shape open at the top (towards workspace)
        Outer corners are rounded (radius r).
        arm  = wall thickness of each side leg
        base = thickness of the bottom crossbar
        Path goes clockwise from top-left outer corner
      */}
      {(() => {
        const x = -BODY_BEAM_MARGIN_MM;
        const y = wsH;
        const w = wsW + BODY_BEAM_MARGIN_MM * 2;
        const h = BODY_FRONT_HEIGHT_MM;
        const arm = BODY_BEAM_WIDTH_MM;  // side leg width
        const base = h - BODY_FRONT_MARGIN_MM;                   // bottom crossbar thickness (mm)
        const d = [
          `M ${x}             ${y}`,                       // top-left outer
          `L ${x}             ${y + h}`,               // down outer left
          `L ${x + w}         ${y + h}`,                   // across bottom
          `L ${x + w}         ${y}`,                       // up outer right
          `L ${x + w - arm}   ${y}`,                       // inward top-right
          `L ${x + w - arm}   ${y + h - base}`,            // down inner right
          `L ${x + arm}       ${y + h - base}`,            // across inner base
          `L ${x + arm}       ${y}`,                       // up inner left
          "Z",
        ].join(" ");
        return (
          <path d={d} fill="#0d1017" stroke="#334155" strokeWidth={2} strokeLinejoin="round" />
        );
      })()}
    </g>
  );
}
