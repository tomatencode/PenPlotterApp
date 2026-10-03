import { memo, useMemo } from "react";

interface Props {
  workspaceWidthMm: number;
  workspaceHeightMm: number;
  /** Raw GCode string to preview. */
  gcode?: string;
  /**
   * Current GCode line being executed (0-based index matching the firmware's jobLine).
   * - `undefined` — pure preview, no active job; all strokes shown as pending (dashed).
   * - `N`         — strokes whose M5 is before line N are drawn solid; the rest are dashed.
   * - `Infinity`  — job completed; all strokes shown as drawn (solid).
   */
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

interface TravelPath {
  /** 0-based index of the G0 line that performs this pen-up move. */
  endLine: number;
  d: string;
}

// ── Bucketed stroke rendering ───────────────────────────────────────────────
// A layer's strokes are contiguous in tour order, so the drawn/pending split
// for a moving jobLine is a single cut point. Joining strokes into ~64KB
// buckets turns the per-push rebuild from thousands of string appends into
// ~11 boundary comparisons, and keeps every <path> small enough to re-parse
// fast. The original full-layer strings are memoised separately so they are
// never rebuilt during a live job.

interface Bucket {
  /** endLine of the bucket's last stroke — every bucket boundary flips at most once. */
  boundary: number;
  /** Strokes of this bucket, joined into a single path string. */
  d: string;
  strokes: Stroke[];
}

const BUCKET_BYTES = 65_536;

function bucketize(strokes: Stroke[]): Bucket[] {
  const buckets: Bucket[] = [];
  let current: Stroke[] = [];
  let currentBytes = 0;
  let boundary = -1;

  const flush = () => {
    if (current.length === 0) return;
    buckets.push({ boundary, d: current.map((stroke) => stroke.d).join(" "), strokes: current });
    current = [];
    currentBytes = 0;
    boundary = -1;
  };

  for (const stroke of strokes) {
    if (current.length > 0 && currentBytes + stroke.d.length > BUCKET_BYTES) flush();
    current.push(stroke);
    currentBytes += stroke.d.length;
    boundary = stroke.endLine;
  }
  flush();
  return buckets;
}

/** Parse GCode into SVG path data, one layer per pen.
 *
 *  Coordinate mapping: GCode uses Y-up (origin at front-left of workspace),
 *  SVG uses Y-down. Conversion: svgY = wsH - gcodeY, svgX = gcodeX.
 *
 *  Each stroke records the GCode line number of its closing M5 so the render
 *  can split drawn vs. pending paths using the live jobLine counter.
 */
function parseGcode(gcode: string, wsH: number): { layers: PenLayer[]; travelPaths: TravelPath[] } {
  const byColor = new Map<string, { width: number; strokes: Stroke[] }>();

  console.log("Parsing GCode...");

  let curX = 0;
  let curY = 0;
  let penDown = false;
  let curColor = "#888888";
  let curWidth = 0.3;
  let pathD = "";
  const travelPaths: TravelPath[] = [];

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
    const penMatch = rawLine.match(/;\s*Pen:\s+.+\s+\(([^,]+),\s*([\d.]+)mm\)/);
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
      const nx = param(parts, "X") ?? curX;
      const ny = param(parts, "Y") ?? curY;
      if (!penDown) {
        travelPaths.push({
          endLine: lineIdx,
          d: `M${sx(curX)} ${sy(curY)} L${sx(nx)} ${sy(ny)}`,
        });
      }
      curX = nx;
      curY = ny;
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

  return {
    layers: Array.from(byColor.entries()).map(([color, { width, strokes }]) => ({
      color,
      width,
      strokes,
    })),
    travelPaths,
  };
}

export default function PagePreview({ workspaceWidthMm, workspaceHeightMm, gcode, currentLine }: Props) {
  const wsW = workspaceWidthMm;
  const wsH = workspaceHeightMm;

  const { layers, travelPaths } = useMemo(
    () => (gcode ? parseGcode(gcode, wsH) : { layers: [], travelPaths: [] }),
    [gcode, wsH],
  );

  // Buckets are derived from the (already memoised) parse, so this runs once
  // per GCode string even for thousands of strokes.
  const bucketedLayers = useMemo(
    () => layers.map((layer) => ({
      color: layer.color,
      width: layer.width,
      buckets: bucketize(layer.strokes),
    })),
    [layers],
  );

  const travelPathsD = useMemo(
    () => travelPaths
      .filter((path) => currentLine === undefined || path.endLine >= currentLine)
      .map((path) => path.d)
      .join(" "),
    [travelPaths, currentLine],
  );

  return (
    <g data-layer="body">
      {/* Workspace boundary (dashed) */}
      <rect
        x={0} y={0}
        width={wsW} height={wsH}
        fill="#b6bbc6" stroke="#eea03b" strokeWidth={1} strokeDasharray="4 3"
      />
      {/* Pen-up travel moves (debug) */}
      {travelPathsD && (
        <path
          d={travelPathsD}
          stroke="#e07000"
          strokeWidth={0.4}
          fill="none"
          opacity={0.45}
          strokeDasharray="1.5 2.5"
          strokeLinecap="round"
        />
      )}
      {bucketedLayers.map((layer, i) => (
        <LayerBuckets
          key={i}
          layer={layer}
          currentLine={currentLine}
        />
      ))}
    </g>
  );
}
interface LayerBucketsProps {
  layer: { color: string; width: number; buckets: Bucket[] };
  currentLine?: number;
}

// One layer's drawn/pending split. Whole buckets keep stable paths while the
// single in-progress bucket is split at the exact current GCode line.
const LayerBuckets = memo(function LayerBuckets({ layer, currentLine }: LayerBucketsProps) {
  const sharedProps = {
    stroke: layer.color,
    strokeWidth: layer.width,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style: { stroke: layer.color },
  };
  if (currentLine === undefined) {
    return (
      <g>
        {layer.buckets.map((bucket, index) => (
          <path key={index} {...sharedProps} d={bucket.d} opacity={0.7} strokeDasharray="2 3" />
        ))}
      </g>
    );
  }

  return (
    <g>
      {layer.buckets.map((bucket, index) => {
        if (bucket.boundary < currentLine) {
          return <path key={index} {...sharedProps} d={bucket.d} opacity={1} />;
        }

        const pendingStart = bucket.strokes.findIndex((stroke) => stroke.endLine >= currentLine);
        if (pendingStart === 0) {
          return <path key={index} {...sharedProps} d={bucket.d} opacity={0.7} strokeDasharray="2 3" />;
        }

        const drawn = bucket.strokes.slice(0, pendingStart).map((stroke) => stroke.d).join(" ");
        const pending = bucket.strokes.slice(pendingStart).map((stroke) => stroke.d).join(" ");
        return (
          <g key={index}>
            <path {...sharedProps} d={drawn} opacity={1} />
            <path {...sharedProps} d={pending} opacity={0.7} strokeDasharray="2 3" />
          </g>
        );
      })}
    </g>
  );
});
