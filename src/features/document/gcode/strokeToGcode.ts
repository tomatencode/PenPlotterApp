import type { PlotterMove, GStroke } from "./types";
import { type Converter, docToGcode } from "./converter";

function moveToGcode(m: PlotterMove, reversed: boolean, conv: Converter): string {
  switch (m.type) {
    case "Line": {
      const [tx, ty] = reversed ? docToGcode(m.x1, m.y1, conv) : docToGcode(m.x2, m.y2, conv);
      return `G1 X${tx.toFixed(3)} Y${ty.toFixed(3)}\n`;
    }

    case "Arc": {
      const [fromX, fromY, toX, toY] = reversed
        ? [m.x2, m.y2, m.x1, m.y1]
        : [m.x1, m.y1, m.x2, m.y2];
      const [gToX, gToY]     = docToGcode(toX, toY, conv);
      const [gCx,  gCy ]     = docToGcode(m.cx, m.cy, conv);
      const [gFrX, gFrY]     = docToGcode(fromX, fromY, conv);
      // Y-flip inverts winding; reversal inverts again — net: reversed = original winding.
      const effectiveCw = reversed ? m.clockwise : !m.clockwise;
      const cmd = effectiveCw ? "G2" : "G3";
      return `${cmd} X${gToX.toFixed(3)} Y${gToY.toFixed(3)} I${(gCx - gFrX).toFixed(3)} J${(gCy - gFrY).toFixed(3)}\n`;
    }

    case "QuadBezier": {
      const [toX, toY]   = reversed ? [m.x1, m.y1] : [m.x2, m.y2];
      const [gToX, gToY] = docToGcode(toX, toY, conv);
      const [gCx,  gCy ] = docToGcode(m.cx, m.cy, conv);
      return `G5.1 X${gToX.toFixed(3)} Y${gToY.toFixed(3)} CX${gCx.toFixed(3)} CY${gCy.toFixed(3)}\n`;
    }

    case "CubicBezier": {
      // When reversed, swap the two control points.
      const [toX, toY, cx1, cy1, cx2, cy2] = reversed
        ? [m.x1, m.y1, m.cx2, m.cy2, m.cx1, m.cy1]
        : [m.x2, m.y2, m.cx1, m.cy1, m.cx2, m.cy2];
      const [gToX, gToY] = docToGcode(toX, toY, conv);
      const [gc1X, gc1Y] = docToGcode(cx1, cy1, conv);
      const [gc2X, gc2Y] = docToGcode(cx2, cy2, conv);
      return `G5 X${gToX.toFixed(3)} Y${gToY.toFixed(3)} CX1${gc1X.toFixed(3)} CY1${gc1Y.toFixed(3)} CX2${gc2X.toFixed(3)} CY2${gc2Y.toFixed(3)}\n`;
    }
  }
}

export function strokeToGcode(stroke: GStroke, conv: Converter): string {
  let gcode = "";

  if (stroke.kind === "open") {
    const origin = stroke.reversed ? stroke.end : stroke.start;
    const [px, py] = docToGcode(origin[0], origin[1], conv);
    gcode += `G0 X${px.toFixed(3)} Y${py.toFixed(3)}\n`;
    gcode += "M3\n"; // pen down
    const moves = stroke.reversed ? [...stroke.moves].reverse() : stroke.moves;
    for (const m of moves) gcode += moveToGcode(m, stroke.reversed, conv);
    gcode += "M5\n"; // pen up

  } else {
    const joint = stroke.joints[stroke.startIndex];
    const [px, py] = docToGcode(joint[0], joint[1], conv);
    gcode += `G0 X${px.toFixed(3)} Y${py.toFixed(3)}\n`;
    gcode += "M3\n"; // pen down
    const n = stroke.moves.length;
    for (let i = 0; i < n; i++) {
      // Rotate moves to start at startIndex; loops are never reversed.
      gcode += moveToGcode(stroke.moves[(stroke.startIndex + i) % n], false, conv);
    }
    gcode += "M5\n"; // pen up
  }

  return gcode;
}
