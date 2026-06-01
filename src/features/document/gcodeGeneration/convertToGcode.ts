import type { PnplttrDocument } from "../types";
import { elementsToPlotterStrokes } from "../renderElements";
import { makeConverter, gcodeToDoc } from "./coordConverter";
import { DEFAULT_FONTS } from "../text/defaultFonts";
import { optimizeStrokes } from "./optimizeStrokes";
import { strokeToGcode } from "./strokeToGcode";
import { compressGcode } from "./compressGcode";
import { type JobStats, accumulateStats, statsHeader } from "./gcodeStats";

export type ProgressCallback = (pct: number, status: string) => void;

export function documentToGcode(doc: PnplttrDocument, onProgress?: ProgressCallback): string {
  const conv = makeConverter(doc.page);
  const home = gcodeToDoc(0, 0, conv);
  const fonts = new Map([...DEFAULT_FONTS, ...Object.entries(doc.fonts ?? {})]);

  const stats: JobStats = { travel_mm: 0, draw_mm: 0, pen_lifts: 0 };
  let penPos: [number, number] = home;
  let gcode = "M5 ;ensure pen up\nG28 ; Home all axes\n\n";

  const layerCount = doc.layers.length;
  // Layer work takes 0–90 %, compression takes the last 10 %
  const layerShare = layerCount > 0 ? 90 / layerCount : 0;

  for (let i = 0; i < layerCount; i++) {
    const layer = doc.layers[i];
    const layerBase = i * layerShare;

    gcode += `; Layer: ${layer.name}\n`;
    // TODO: add pen switching GCode commands here, using layer.pen.color / layer.pen.width

    onProgress?.(Math.round(layerBase + layerShare * 0.05), `Layer ${i + 1}/${layerCount}: rendering elements…`);
    const strokes = elementsToPlotterStrokes(layer.elements, fonts);

    onProgress?.(Math.round(layerBase + layerShare * 0.8), `Layer ${i + 1}/${layerCount}: optimizing stroke order…`);
    const optimized = optimizeStrokes(strokes, home);

    penPos = accumulateStats(stats, optimized, penPos);

    onProgress?.(Math.round(layerBase + layerShare * 0.9), `Layer ${i + 1}/${layerCount}: writing GCode…`);
    gcode += "M5\n"; // ensure pen up before moving to first stroke
    for (const stroke of optimized) {
      gcode += strokeToGcode(stroke, conv);
    }
    gcode += "\n";
  }

  gcode += "G0 X0 Y0"; // return to origin

  onProgress?.(90, "Compressing GCode…");
  const result = compressGcode(statsHeader(stats) + gcode);
  onProgress?.(100, "Done.");
  return result;
}
