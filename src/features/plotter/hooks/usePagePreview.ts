import { useMemo } from "react";

export interface SvgPoint {
  x: number;
  y: number;
}

interface PathSegment {
  endLine: number;
  d: string;
  start: SvgPoint;
  end: SvgPoint;
  linear: boolean;
}

interface Stroke {
  endLine: number;
  d: string;
  segments: PathSegment[];
}

interface PenLayer {
  color: string;
  width: number;
  strokes: Stroke[];
}

interface TravelPath {
  endLine: number;
  d: string;
  start: SvgPoint;
  end: SvgPoint;
}

export interface Bucket {
  boundary: number;
  d: string;
  strokes: Stroke[];
}

const BUCKET_BYTES = 65_536;

export function partialLineD(start: SvgPoint, end: SvgPoint, head: SvgPoint): string {
  const current = pointOnLine(start, end, head);
  return `M${start.x.toFixed(3)} ${start.y.toFixed(3)} L${current.x.toFixed(3)} ${current.y.toFixed(3)}`;
}

export function remainingLineD(start: SvgPoint, end: SvgPoint, head: SvgPoint): string {
  const current = pointOnLine(start, end, head);
  return `M${current.x.toFixed(3)} ${current.y.toFixed(3)} L${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}

function pointOnLine(start: SvgPoint, end: SvgPoint, head: SvgPoint): SvgPoint {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const progress = lengthSquared === 0
    ? 1
    : Math.max(0, Math.min(1, ((head.x - start.x) * dx + (head.y - start.y) * dy) / lengthSquared));
  return { x: start.x + dx * progress, y: start.y + dy * progress };
}

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

function parseGcode(gcode: string, workspaceHeightMm: number): { layers: PenLayer[]; travelPaths: TravelPath[] } {
  const byColor = new Map<string, { width: number; strokes: Stroke[] }>();
  let curX = 0;
  let curY = 0;
  let penDown = false;
  let curColor = "#888888";
  let curWidth = 0.3;
  let pathD = "";
  let pathSegments: PathSegment[] = [];
  const travelPaths: TravelPath[] = [];
  const sy = (y: number) => (workspaceHeightMm - y).toFixed(3);
  const sx = (x: number) => x.toFixed(3);
  const param = (parts: string[], prefix: string): number | null => {
    const token = parts.find((part) => part.toUpperCase().startsWith(prefix));
    return token ? parseFloat(token.slice(prefix.length)) : null;
  };
  const flushPath = (lineIdx: number) => {
    if (!penDown || !pathD) return;
    let entry = byColor.get(curColor);
    if (!entry) {
      entry = { width: curWidth, strokes: [] };
      byColor.set(curColor, entry);
    }
    entry.strokes.push({ endLine: lineIdx, d: pathD, segments: pathSegments });
    pathD = "";
    pathSegments = [];
  };

  for (const [lineIdx, rawLine] of gcode.split("\n").entries()) {
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
        const start = { x: curX, y: workspaceHeightMm - curY };
        const end = { x: nx, y: workspaceHeightMm - ny };
        travelPaths.push({ endLine: lineIdx, d: `M${sx(curX)} ${sy(curY)} L${sx(nx)} ${sy(ny)}`, start, end });
      }
      curX = nx;
      curY = ny;
    } else if (cmd === "M3") {
      penDown = true;
      pathD = `M${sx(curX)} ${sy(curY)}`;
      pathSegments = [];
    } else if (cmd === "M5") {
      flushPath(lineIdx);
      penDown = false;
    } else if (cmd === "G1") {
      const nx = param(parts, "X") ?? curX;
      const ny = param(parts, "Y") ?? curY;
      if (penDown) {
        const start = { x: curX, y: workspaceHeightMm - curY };
        const end = { x: nx, y: workspaceHeightMm - ny };
        pathD += ` L${sx(nx)} ${sy(ny)}`;
        pathSegments.push({ endLine: lineIdx, d: `M${sx(start.x)} ${start.y.toFixed(3)} L${sx(end.x)} ${end.y.toFixed(3)}`, start, end, linear: true });
      }
      curX = nx;
      curY = ny;
    } else if (cmd === "G2" || cmd === "G3") {
      const ex = param(parts, "X") ?? curX;
      const ey = param(parts, "Y") ?? curY;
      const iRel = param(parts, "I") ?? 0;
      const jRel = param(parts, "J") ?? 0;
      if (penDown) {
        const start = { x: curX, y: workspaceHeightMm - curY };
        const end = { x: ex, y: workspaceHeightMm - ey };
        const center = { x: curX + iRel, y: workspaceHeightMm - (curY + jRel) };
        const radius = Math.hypot(start.x - center.x, start.y - center.y);
        const sweep = cmd === "G2" ? 0 : 1;
        const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
        const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
        const span = sweep === 0 ? (startAngle - endAngle + 2 * Math.PI) % (2 * Math.PI) : (endAngle - startAngle + 2 * Math.PI) % (2 * Math.PI);
        const large = span > Math.PI ? 1 : 0;
        pathD += ` A${radius.toFixed(3)} ${radius.toFixed(3)} 0 ${large} ${sweep} ${sx(ex)} ${sy(ey)}`;
        pathSegments.push({ endLine: lineIdx, d: `M${start.x.toFixed(3)} ${start.y.toFixed(3)} A${radius.toFixed(3)} ${radius.toFixed(3)} 0 ${large} ${sweep} ${end.x.toFixed(3)} ${end.y.toFixed(3)}`, start, end, linear: false });
      }
      curX = ex;
      curY = ey;
    } else if (cmd === "G5.1" || cmd === "G5") {
      const ex = param(parts, "X") ?? curX;
      const ey = param(parts, "Y") ?? curY;
      if (penDown) {
        const start = { x: curX, y: workspaceHeightMm - curY };
        const end = { x: ex, y: workspaceHeightMm - ey };
        const curve = cmd === "G5.1"
          ? `Q${sx(param(parts, "CX") ?? 0)} ${sy(param(parts, "CY") ?? 0)} ${sx(ex)} ${sy(ey)}`
          : `C${sx(param(parts, "CX1") ?? 0)} ${sy(param(parts, "CY1") ?? 0)} ${sx(param(parts, "CX2") ?? 0)} ${sy(param(parts, "CY2") ?? 0)} ${sx(ex)} ${sy(ey)}`;
        pathD += ` ${curve}`;
        pathSegments.push({ endLine: lineIdx, d: `M${start.x.toFixed(3)} ${start.y.toFixed(3)} ${curve}`, start, end, linear: false });
      }
      curX = ex;
      curY = ey;
    }
  }

  flushPath(gcode.split("\n").length);
  return { layers: Array.from(byColor, ([color, { width, strokes }]) => ({ color, width, strokes })), travelPaths };
}

interface UsePagePreviewOptions {
  workspaceHeightMm: number;
  headPosition?: { x: number; y: number };
  gcode?: string;
  currentLine?: number;
}

export function usePagePreview({ workspaceHeightMm, headPosition, gcode, currentLine }: UsePagePreviewOptions) {
  const { layers, travelPaths } = useMemo(
    () => (gcode ? parseGcode(gcode, workspaceHeightMm) : { layers: [], travelPaths: [] }),
    [gcode, workspaceHeightMm],
  );
  const layersWithBuckets = useMemo(
    () => layers.map((layer) => ({ color: layer.color, width: layer.width, buckets: bucketize(layer.strokes) })),
    [layers],
  );
  const activeLine = currentLine !== undefined && currentLine !== Infinity ? currentLine - 1 : undefined;
  const activeTravel = useMemo(
    () => activeLine !== undefined ? travelPaths.find((path) => path.endLine === activeLine) : undefined,
    [travelPaths, activeLine],
  );
  const travelPathsD = useMemo(
    () => travelPaths
      .filter((path) => path !== activeTravel && (currentLine === undefined || path.endLine >= currentLine - 1))
      .map((path) => path.d)
      .join(" "),
    [travelPaths, currentLine, activeTravel],
  );
  const headInSvg: SvgPoint | undefined = headPosition && { x: headPosition.x, y: workspaceHeightMm - headPosition.y };

  return { layersWithBuckets, travelPathsD, activeLine, activeTravel, headInSvg };
}