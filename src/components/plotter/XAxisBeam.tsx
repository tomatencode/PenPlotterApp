// ── PLACEHOLDER — replace with your styled X-axis beam ───────────────────────
// Rendered in SVG units where 1 unit = 1 mm.
// Z layer: above PlotterBody, below PlotterHead.
// The beam spans rail-to-rail across the full body width.
// Its Y position is driven by the current head position — it slides along the Y rails.

import { BODY_BEAM_MARGIN_MM, X_AXIS_BEAM_HEIGHT_MM, X_AXIS_TO_PEN_MM } from "./dimensions";

interface Props {
  widthMm: number;
  yMm: number; // current Y position in workspace coordinates (mm)
}

export default function XAxisBeam({ widthMm, yMm }: Props) {
  const m = BODY_BEAM_MARGIN_MM;

  return (
    <g data-layer="x-axis" transform={`translate(0, ${yMm})`}>
      {/* Beam spanning rail to rail */}
      <rect
        x={-m} y={-X_AXIS_BEAM_HEIGHT_MM / 2 + X_AXIS_TO_PEN_MM}
        width={widthMm + m * 2} height={X_AXIS_BEAM_HEIGHT_MM}
        fill="#1e3a5f" stroke="#3b82f6" strokeWidth={1} rx={2}
      />
    </g>
  );
}
