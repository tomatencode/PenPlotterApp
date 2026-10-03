import { memo } from "react";
import { partialLineD, remainingLineD, type Bucket, type SvgPoint, usePagePreview } from "../../hooks/usePagePreview";

interface Props {
  workspaceWidthMm: number;
  workspaceHeightMm: number;
  headPosition?: { x: number; y: number };
  gcode?: string;
  currentLine?: number;
}

export default function PagePreview({ workspaceWidthMm, workspaceHeightMm, headPosition, gcode, currentLine }: Props) {
  const { layersWithBuckets, travelPathsD, activeLine, activeTravel, headInSvg } = usePagePreview({
    workspaceHeightMm,
    headPosition,
    gcode,
    currentLine,
  });

  return (
    <g data-layer="body">
      <rect x={0} y={0} width={workspaceWidthMm} height={workspaceHeightMm} fill="#b6bbc6" stroke="#eea03b" strokeWidth={1} strokeDasharray="4 3" />
      {travelPathsD && <path d={travelPathsD} stroke="#e07000" strokeWidth={0.4} fill="none" opacity={0.45} strokeDasharray="1.5 2.5" strokeLinecap="round" />}
      {activeTravel && headInSvg && <path d={remainingLineD(activeTravel.start, activeTravel.end, headInSvg)} stroke="#e07000" strokeWidth={0.4} fill="none" opacity={0.45} strokeDasharray="1.5 2.5" strokeLinecap="round" />}
      {layersWithBuckets.map((layer, index) => <LayerBuckets key={index} layer={layer} currentLine={currentLine} activeLine={activeLine} headInSvg={headInSvg} />)}
    </g>
  );
}

interface LayerBucketsProps {
  layer: { color: string; width: number; buckets: Bucket[] };
  currentLine?: number;
  activeLine?: number;
  headInSvg?: SvgPoint;
}

const LayerBuckets = memo(function LayerBuckets({ layer, currentLine, activeLine, headInSvg }: LayerBucketsProps) {
  const sharedProps = { stroke: layer.color, strokeWidth: layer.width, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, style: { stroke: layer.color } };
  if (currentLine === undefined) {
    return <g>{layer.buckets.map((bucket, index) => <path key={index} {...sharedProps} d={bucket.d} opacity={0.7} strokeDasharray="2 3" />)}</g>;
  }

  const activeStroke = activeLine !== undefined
    ? layer.buckets.flatMap((bucket) => bucket.strokes).find((stroke) => stroke.endLine >= activeLine && stroke.segments.some((segment) => segment.endLine <= activeLine))
    : undefined;
  const activeSegmentsD = activeStroke && activeLine !== undefined
    ? activeStroke.segments.filter((segment) => segment.endLine < activeLine).map((segment) => segment.d).join(" ")
    : "";
  const activeSegment = activeStroke?.segments.find((segment) => segment.endLine === activeLine);

  return (
    <g>
      {layer.buckets.map((bucket, index) => {
        if (bucket.boundary < currentLine) return <path key={index} {...sharedProps} d={bucket.d} opacity={1} />;
        const pendingStart = bucket.strokes.findIndex((stroke) => stroke.endLine >= currentLine);
        if (pendingStart === 0) return <path key={index} {...sharedProps} d={bucket.d} opacity={0.7} strokeDasharray="2 3" />;
        const drawn = bucket.strokes.slice(0, pendingStart).map((stroke) => stroke.d).join(" ");
        const pending = bucket.strokes.slice(pendingStart).map((stroke) => stroke.d).join(" ");
        return <g key={index}><path {...sharedProps} d={drawn} opacity={1} /><path {...sharedProps} d={pending} opacity={0.7} strokeDasharray="2 3" /></g>;
      })}
      {activeSegmentsD && <path {...sharedProps} d={activeSegmentsD} opacity={1} />}
      {activeSegment?.linear && headInSvg && <path {...sharedProps} d={partialLineD(activeSegment.start, activeSegment.end, headInSvg)} opacity={1} />}
    </g>
  );
});