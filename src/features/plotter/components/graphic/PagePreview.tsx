import { useMemo } from "react";

interface Props {
  workspaceWidthMm: number;
  workspaceHeightMm: number;
  gcode?: string;
  currentLine?: number;
}

interface Stroke {
  /** 0-based index of the M5 line that closes this stroke. */
  endLine: number;
  d: string;
}

interface PenLayer {
  color: string;
  width: number;
  strokes: Stroke[];
}

/** Parse GCode into SVG path data, one layer per pen.
 *
 *  Coordinate mapping: GCode uses Y-up (origin at front-left of workspace),
 *  SVG uses Y-down. Conversion: svgY = wsH - gcodeY, svgX = gcodeX.
 *
 *  Each stroke records the GCode line number of its closing M5 so the render
 *  can split drawn vs. pending paths using the live jobLine counter.
 */
function parseGcode(gcode: string, wsH: number): PenLayer[] {
  const byColor = new Map<string, { width: number; strokes: Stroke[] }>();

  let curX = 0;
  let curY = 0;
  let penDown = false;
  let curColor = "#888888";
  let curWidth = 0.3;
  let pathD = "";

  const sy = (y: number) => (wsH - y).toFixed(3);
  const sx = (x: number) => x.toFixed(3);

  const param = (parts: string[], prefix: string): number | null => {
    const up = prefix.toUpperCase();
    const tok = parts.find(t => t.toUpperCase().startsWith(up));
    return tok != null ? parseFloat(tok.slice(prefix.length)) : null;
  };

  const flushPath = (lineIdx: number) => {
    if (!penDown || !pathD) return;
    let entry = byColor.get(curColor);
    if (!entry) {
      entry = { width: curWidth, strokes: [] };
      byColor.set(curColor, entry);
    }
    entry.strokes.push({ endLine: lineIdx, d: pathD });
    pathD = "";
  };

  const lines = gcode.split("\n");
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];

    // "; Pen: name (color, widthmm)" — parse before stripping comments
    const penMatch = rawLine.match(/;\s*Pen:\s+\S+\s+\(([^,]+),\s*([\d.]+)mm\)/);
    if (penMatch) {
      curColor = penMatch[1].trim();
      curWidth = parseFloat(penMatch[2]);
      continue;
    }

    const line = rawLine.split(";")[0].trim();
    if (!line) continue;

    const parts = line.split(/\s+/);
    const cmd = parts[0].toUpperCase();

    if (cmd === "G0") {
      curX = param(parts, "X") ?? curX;
      curY = param(parts, "Y") ?? curY;
    } else if (cmd === "M3") {
      penDown = true;
      pathD = `M${sx(curX)} ${sy(curY)}`;
    } else if (cmd === "M5") {
      flushPath(lineIdx);
      penDown = false;
    } else if (cmd === "G1") {
      const nx = param(parts, "X") ?? curX;
      const ny = param(parts, "Y") ?? curY;
      if (penDown) pathD += ` L${sx(nx)} ${sy(ny)}`;
      curX = nx;
      curY = ny;
    } else if (cmd === "G2" || cmd === "G3") {
      const ex   = param(parts, "X") ?? curX;
      const ey   = param(parts, "Y") ?? curY;
      const iRel = param(parts, "I") ?? 0;
      const jRel = param(parts, "J") ?? 0;
      if (penDown) {
        const svgFx = curX,        svgFy = wsH - curY;
        const svgEx = ex,          svgEy = wsH - ey;
        const svgCx = curX + iRel, svgCy = wsH - (curY + jRel);
        const r = Math.hypot(svgFx - svgCx, svgFy - svgCy);
        // G2 = CW in gcode (Y-up) → CCW in SVG (Y-down) → sweep=0
        // G3 = CCW in gcode (Y-up) → CW  in SVG (Y-down) → sweep=1
        const sweep = cmd === "G2" ? 0 : 1;
        const startA = Math.atan2(svgFy - svgCy, svgFx - svgCx);
        const endA   = Math.atan2(svgEy - svgCy, svgEx - svgCx);
        const span   = sweep === 0
          ? ((startA - endA)   + 2 * Math.PI) % (2 * Math.PI)
          : ((endA   - startA) + 2 * Math.PI) % (2 * Math.PI);
        const large = span > Math.PI ? 1 : 0;
        pathD += ` A${r.toFixed(3)} ${r.toFixed(3)} 0 ${large} ${sweep} ${sx(ex)} ${sy(ey)}`;
      }
      curX = ex;
      curY = ey;
    } else if (cmd === "G5.1") {
      const ex = param(parts, "X")  ?? curX;
      const ey = param(parts, "Y")  ?? curY;
      const cx = param(parts, "CX") ?? 0;
      const cy = param(parts, "CY") ?? 0;
      if (penDown) pathD += ` Q${sx(cx)} ${sy(cy)} ${sx(ex)} ${sy(ey)}`;
      curX = ex;
      curY = ey;
    } else if (cmd === "G5") {
      const ex  = param(parts, "X")   ?? curX;
      const ey  = param(parts, "Y")   ?? curY;
      const c1x = param(parts, "CX1") ?? 0;
      const c1y = param(parts, "CY1") ?? 0;
      const c2x = param(parts, "CX2") ?? 0;
      const c2y = param(parts, "CY2") ?? 0;
      if (penDown) {
        pathD += ` C${sx(c1x)} ${sy(c1y)} ${sx(c2x)} ${sy(c2y)} ${sx(ex)} ${sy(ey)}`;
      }
      curX = ex;
      curY = ey;
    }
  }

  flushPath(lines.length); // safety flush in case file ends without M5

  return Array.from(byColor.entries()).map(([color, { width, strokes }]) => ({
    color,
    width,
    strokes,
  }));
}

export default function PagePreview({ workspaceWidthMm, workspaceHeightMm, gcode, currentLine }: Props) {
  const wsW = workspaceWidthMm;
  const wsH = workspaceHeightMm;

  const layers = useMemo(
    () => (gcode ? parseGcode(gcode, wsH) : []),
    [gcode, wsH],
  );

  return (
    <g data-layer="body">
      {/* Workspace boundary (dashed) */}
      <rect
        x={0} y={0}
        width={wsW} height={wsH}
        fill="#b6bbc6" stroke="#eea03b" strokeWidth={1} strokeDasharray="4 3"
      />
      {layers.map((layer, i) => {
        // Split strokes into drawn (M5 already past) vs. pending.
        const drawn   = currentLine !== undefined
          ? layer.strokes.filter(s => s.endLine < currentLine).map(s => s.d).join(" ")
          : "";
        const pending = currentLine !== undefined
          ? layer.strokes.filter(s => s.endLine >= currentLine).map(s => s.d).join(" ")
          : layer.strokes.map(s => s.d).join(" ");

        const sharedProps = {
          stroke: layer.color,
          strokeWidth: layer.width,
          fill: "none",
          strokeLinecap: "round" as const,
          strokeLinejoin: "round" as const,
        };

        return (
          <g key={i}>
            {drawn && (
              <path {...sharedProps} d={drawn} opacity={1} />
            )}
            {pending && (
              <path {...sharedProps} d={pending} opacity={0.7} strokeDasharray="2 3" />
            )}
          </g>
        );
      })}
    </g>
  );
}
