import type { PnplttrDocument } from "../types";
import { elementsToPlotterStrokes } from "../renderElements";
import { makeConverter, gcodeToDoc } from "./coordConverter";
import { DEFAULT_FONTS } from "../text/defaultFonts";
import { optimizeStrokes } from "./optimizeStrokes";
import { optimizePenSwitches } from "./optimizePenSwitches";
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

  onProgress?.(0, `Optimizing pen switches…`);
  const batches = optimizePenSwitches(doc.elements);
  const batchCount = batches.length;

  // Batch work takes 0–90 %, compression takes the last 10 %
  const batchShare = batchCount > 0 ? 90 / batchCount : 0;

  for (let batchIdx = 0; batchIdx < batchCount; batchIdx++) {
    const { penIdx, elements: penElements } = batches[batchIdx];
    const pen = doc.pens[penIdx];
    const batchBase = batchIdx * batchShare;

    gcode += `; Pen: ${pen.name} (${pen.color}, ${pen.width}mm)\n`;
    // TODO: add pen switching GCode commands here, using pen.color / pen.width

    onProgress?.(Math.round(batchBase + batchShare * 0.05), `Pen: ${pen.name}, batch ${batchIdx + 1}/${batchCount}: rendering elements…`);
    const strokes = elementsToPlotterStrokes(penElements, fonts);

    onProgress?.(Math.round(batchBase + batchShare * 0.8), `Pen: ${pen.name}, batch ${batchIdx + 1}/${batchCount}: optimizing stroke order…`);
    const optimized = optimizeStrokes(strokes, home);

    penPos = accumulateStats(stats, optimized, penPos);

    onProgress?.(Math.round(batchBase + batchShare * 0.9), `Pen: ${pen.name}, batch ${batchIdx + 1}/${batchCount}: writing GCode…`);
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
