// ── PLACEHOLDER — replace with your styled plotter head ──────────────────────
// Rendered in SVG units where 1 unit = 1 mm.
// Z layer: topmost — sits on the X-axis beam.
// xMm is its position along the beam; yMm matches the beam's Y position.
// penColor comes from the active pen in the current slot.

interface Props {
  xMm: number;
  yMm: number;
  penColor?: string;
}

const SIZE_MM = 10;

export default function PlotterHead({ xMm, yMm, penColor = "#94a3b8" }: Props) {
  return (
    <g data-layer="head" transform={`translate(${xMm}, ${yMm})`}>
      {/* Carriage body */}
      <rect
        x={-SIZE_MM / 2} y={-SIZE_MM / 2}
        width={SIZE_MM} height={SIZE_MM}
        fill="#0f172a" stroke="#60a5fa" strokeWidth={1.5} rx={2}
      />

      {/* Pen position dot */}
      <circle cx={0} cy={0} r={SIZE_MM * 0.25} fill={penColor} />
    </g>
  );
}

