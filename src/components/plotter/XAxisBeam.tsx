// ── PLACEHOLDER — replace with your styled X-axis beam ───────────────────────
// Rendered in SVG units where 1 unit = 1 mm.
// Z layer: above PlotterBody, below PlotterHead.
// The beam spans rail-to-rail across the full body width.
// Its Y position is driven by the current head position — it slides along the Y rails.

import { BODY_MARGIN_MM } from "./types";

interface Props {
  widthMm: number;
  yMm: number; // current Y position in workspace coordinates (mm)
}

const BEAM_HEIGHT_MM = 6;

export default function XAxisBeam({ widthMm, yMm }: Props) {
  const m = BODY_MARGIN_MM;

  return (
    <g data-layer="x-axis" transform={`translate(0, ${yMm})`}>
      {/* Beam spanning rail to rail */}
      <rect
        x={-m} y={-BEAM_HEIGHT_MM / 2}
        width={widthMm + m * 2} height={BEAM_HEIGHT_MM}
        fill="#1e3a5f" stroke="#3b82f6" strokeWidth={1} rx={2}
      />
    </g>
  );
}
