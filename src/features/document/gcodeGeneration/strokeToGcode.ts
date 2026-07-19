// Converts a single PlotterStroke to gcode.
// The optimizer has already baked reversal/rotation into the moves array,
// so this function just walks moves[] in order.

import type { PlotterStroke, PlotterMove } from "../plotterMove";
import { type ConverterProps, docToGcode } from "./coordConverter";

function moveToGcode(m: PlotterMove, conv: ConverterProps): string {
  switch (m.type) {
    case "Line": {
      const [tx, ty] = docToGcode(m.x2, m.y2, conv, true); // cap to workspace
      return `G1 X${tx.toFixed(3)} Y${ty.toFixed(3)}\n`;
    }

    // capping all points to the workspace
    // doesnt totaly pervent the pen from going outside the workspace for
    // arcs and beziers but tey are rare so this is a good compromise for now
    case "Arc": {
      const [gToX, gToY] = docToGcode(m.x2, m.y2, conv, true); // cap to workspace
      const [gCx,  gCy ] = docToGcode(m.cx, m.cy, conv, true); // cap to workspace
      const [gFrX, gFrY] = docToGcode(m.x1, m.y1, conv, true); // cap to workspace
      // Y-flip inverts winding, so clockwise in doc-space = counter-clockwise in gcode
      const cmd = m.clockwise ? "G3" : "G2";
      return `${cmd} X${gToX.toFixed(3)} Y${gToY.toFixed(3)} I${(gCx - gFrX).toFixed(3)} J${(gCy - gFrY).toFixed(3)}\n`;
    }

    case "QuadBezier": {
      const [gToX, gToY] = docToGcode(m.x2, m.y2, conv, true); // cap to workspace
      const [gCx,  gCy ] = docToGcode(m.cx, m.cy, conv, true); // cap to workspace
      return `G5.1 X${gToX.toFixed(3)} Y${gToY.toFixed(3)} CX${gCx.toFixed(3)} CY${gCy.toFixed(3)}\n`;
    }

    case "CubicBezier": {
      const [gToX, gToY] = docToGcode(m.x2, m.y2, conv, true); // cap to workspace
      const [gc1X, gc1Y] = docToGcode(m.cx1, m.cy1, conv, true); // cap to workspace
      const [gc2X, gc2Y] = docToGcode(m.cx2, m.cy2, conv, true); // cap to workspace
      return `G5 X${gToX.toFixed(3)} Y${gToY.toFixed(3)} CX1${gc1X.toFixed(3)} CY1${gc1Y.toFixed(3)} CX2${gc2X.toFixed(3)} CY2${gc2Y.toFixed(3)}\n`;
    }
  }
}

export function strokeToGcode(stroke: PlotterStroke, conv: ConverterProps): string {
  const [px, py] = docToGcode(stroke.start[0], stroke.start[1], conv, true); // cap to workspace
  let gcode = `G0 X${px.toFixed(3)} Y${py.toFixed(3)}\n`;
  gcode += "M3\n"; // pen down
  for (const m of stroke.moves) gcode += moveToGcode(m, conv);
  gcode += "M5\n"; // pen up
  return gcode;
}
