// ── PLACEHOLDER — replace with your styled static body ───────────────────────
// Rendered in SVG units where 1 unit = 1 mm.
// This is the lowest Z layer; it never moves.
// widthMm / heightMm are the workspace bounds.
// The chassis extends BODY_MARGIN_MM beyond the workspace on all sides.
// The Y-axis rails (which the X-axis beam slides along) are part of this component.

import { BODY_MARGIN_MM } from "./types";

interface Props {
  widthMm: number;
  heightMm: number;
}

export default function PlotterBody({ widthMm, heightMm }: Props) {
  const m = BODY_MARGIN_MM;

  return (
    <g data-layer="body">
      {/* Outer machine chassis */}
      <rect
        x={-m} y={-m}
        width={widthMm + m * 2} height={heightMm + m * 2}
        fill="#0d1017" stroke="#334155" strokeWidth={2} rx={6}
      />

      {/* Workspace boundary (dashed) */}
      <rect
        x={0} y={0}
        width={widthMm} height={heightMm}
        fill="#0a0c10" stroke="#1e293b" strokeWidth={1} strokeDasharray="4 3"
      />

      {/* Left Y-axis rail */}
      <rect x={-m} y={-m} width={m * 0.55} height={heightMm + m * 2} fill="#1e293b" rx={2} />

      {/* Right Y-axis rail */}
      <rect x={widthMm + m * 0.45} y={-m} width={m * 0.55} height={heightMm + m * 2} fill="#1e293b" rx={2} />
    </g>
  );
}
