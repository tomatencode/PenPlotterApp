// ── PLACEHOLDER — replace with your styled X-axis beam ───────────────────────
// Rendered in SVG units where 1 unit = 1 mm.
// Z layer: above PlotterBody, below PlotterHead.
// The beam spans rail-to-rail across the full body width.
// Its Y position is driven by the current head position — it slides along the Y rails.

import {
  WORKSPACE_WIDTH_MM,
  BODY_BEAM_MARGIN_MM,
  BODY_BEAM_WIDTH_MM,
  X_AXIS_BEAM_HEIGHT_MM,
  X_AXIS_TO_PEN_MM,
  X_AXIS_CONNECTOR_EXTRA_WIDTH_MM,
  X_AXIS_CONNECTOR_EXTRA_HEIGHT_MM
} from "./dimensions";

interface Props {
  yMm: number; // current Y position in workspace coordinates (mm)
}

export default function XAxisBeam({ yMm }: Props) {
  const m = BODY_BEAM_MARGIN_MM;

  return (
    <g data-layer="x-axis" transform={`translate(0, ${yMm})`}>
      {/* Beam spanning rail to rail */}
      <rect
        x={-m} y={-X_AXIS_BEAM_HEIGHT_MM / 2 + X_AXIS_TO_PEN_MM}
        width={WORKSPACE_WIDTH_MM + m * 2} height={X_AXIS_BEAM_HEIGHT_MM}
        fill="#1e293b" rx={2}
      />

      {/* Beam connector left */}
      <rect
        x={-m} y={-(X_AXIS_BEAM_HEIGHT_MM + X_AXIS_CONNECTOR_EXTRA_HEIGHT_MM) / 2 + X_AXIS_TO_PEN_MM}
        width={BODY_BEAM_WIDTH_MM + X_AXIS_CONNECTOR_EXTRA_WIDTH_MM} height={X_AXIS_BEAM_HEIGHT_MM + X_AXIS_CONNECTOR_EXTRA_HEIGHT_MM}
        fill="#0d1017" stroke="#334155" strokeWidth={2} rx={2}
      />

      {/* Beam connector right */}
      <rect
        x={WORKSPACE_WIDTH_MM + m - (BODY_BEAM_WIDTH_MM + X_AXIS_CONNECTOR_EXTRA_WIDTH_MM)} y={-(X_AXIS_BEAM_HEIGHT_MM + X_AXIS_CONNECTOR_EXTRA_HEIGHT_MM) / 2 + X_AXIS_TO_PEN_MM}
        width={BODY_BEAM_WIDTH_MM + X_AXIS_CONNECTOR_EXTRA_WIDTH_MM} height={X_AXIS_BEAM_HEIGHT_MM + X_AXIS_CONNECTOR_EXTRA_HEIGHT_MM}
        fill="#0d1017" stroke="#334155" strokeWidth={2} rx={2}
      />
    </g>
  );
}
