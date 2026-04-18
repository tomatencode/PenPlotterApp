import {
  BODY_BEAM_MARGIN_MM,
  BODY_BEAM_WIDTH_MM,
  X_AXIS_BEAM_HEIGHT_MM,
  X_AXIS_TO_PEN_MM,
  X_AXIS_CONNECTOR_EXTRA_WIDTH_MM,
  X_AXIS_CONNECTOR_EXTRA_HEIGHT_MM
} from "./dimensions";

interface Props {
  yMm: number; // current Y position in workspace coordinates (mm)
  workspaceWidthMm: number;
}

export default function XAxisBeam({ yMm, workspaceWidthMm }: Props) {
  const m = BODY_BEAM_MARGIN_MM;

  return (
    <g data-layer="x-axis" transform={`translate(0, ${yMm})`}>
      {/* Beam spanning rail to rail */}
      <rect
        x={-m} y={-X_AXIS_BEAM_HEIGHT_MM / 2 + X_AXIS_TO_PEN_MM}
        width={workspaceWidthMm + m * 2} height={X_AXIS_BEAM_HEIGHT_MM}
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
        x={workspaceWidthMm + m - (BODY_BEAM_WIDTH_MM + X_AXIS_CONNECTOR_EXTRA_WIDTH_MM)} y={-(X_AXIS_BEAM_HEIGHT_MM + X_AXIS_CONNECTOR_EXTRA_HEIGHT_MM) / 2 + X_AXIS_TO_PEN_MM}
        width={BODY_BEAM_WIDTH_MM + X_AXIS_CONNECTOR_EXTRA_WIDTH_MM} height={X_AXIS_BEAM_HEIGHT_MM + X_AXIS_CONNECTOR_EXTRA_HEIGHT_MM}
        fill="#0d1017" stroke="#334155" strokeWidth={2} rx={2}
      />
    </g>
  );
}
