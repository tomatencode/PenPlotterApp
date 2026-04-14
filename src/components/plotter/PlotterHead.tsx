// ── PLACEHOLDER — replace with your styled plotter head ──────────────────────
// Rendered in SVG units where 1 unit = 1 mm.
// Z layer: topmost — sits on the X-axis beam.
// xMm is its position along the beam; yMm matches the beam's Y position.
// penColor comes from the active pen in the current slot.

import { X_AXIS_BEAM_HEIGHT_MM, HEAD_WIDTH_MM, X_AXIS_TO_PEN_MM, HEAD_PEN_COLOR_HINT_SIZE_MM } from "./dimensions";

interface Props {
  xMm: number;
  yMm: number;
  penColor?: string;
}

export default function PlotterHead({ xMm, yMm, penColor = "#94a3b8" }: Props) {
  return (
    <g data-layer="head" transform={`translate(${xMm}, ${yMm})`}>
      {/* Carriage body */}
      <rect
        x={-HEAD_WIDTH_MM / 2} y={-X_AXIS_BEAM_HEIGHT_MM / 2 + X_AXIS_TO_PEN_MM}
        width={HEAD_WIDTH_MM} height={X_AXIS_BEAM_HEIGHT_MM - X_AXIS_TO_PEN_MM}
        fill="#0f172a" stroke="#60a5fa" strokeWidth={1.5} rx={2}
      />

      {/* Pen position dot */}
      <circle cx={0} cy={0} r={HEAD_PEN_COLOR_HINT_SIZE_MM/2} fill={penColor} />
    </g>
  );
}

