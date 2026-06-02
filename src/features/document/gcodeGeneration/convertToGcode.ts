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

  const penCount = doc.pens.length;
  // Pen group work takes 0–90 %, compression takes the last 10 %
  const penShare = penCount > 0 ? 90 / penCount : 0;

  for (let penIdx = 0; penIdx < penCount; penIdx++) {
    const pen = doc.pens[penIdx];
    const penElements = doc.elements.filter((e) => e.pen === penIdx);
    if (penElements.length === 0) continue;

    const penBase = penIdx * penShare;
    gcode += `; Pen ${penIdx + 1} (${pen.color})\n`;
    // TODO: add pen switching GCode commands here, using pen.color / pen.width

    onProgress?.(Math.round(penBase + penShare * 0.05), `Pen ${penIdx + 1}/${penCount}: rendering elements…`);
    const strokes = elementsToPlotterStrokes(penElements, fonts);

    onProgress?.(Math.round(penBase + penShare * 0.8), `Pen ${penIdx + 1}/${penCount}: optimizing stroke order…`);
    const optimized = optimizeStrokes(strokes, home);

    penPos = accumulateStats(stats, optimized, penPos);

    onProgress?.(Math.round(penBase + penShare * 0.9), `Pen ${penIdx + 1}/${penCount}: writing GCode…`);
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
