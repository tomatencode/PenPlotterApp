import type { PnplttrDocument } from "../types";
import type { PlotterStroke } from "../plotterMove";
import { elementsToPlotterStrokes } from "../renderElements";
import { makeConverter, gcodeToDoc } from "./coordConverter";
import { DEFAULT_FONTS } from "../text/defaultFonts";
import { optimizeStrokes } from "./optimizeStrokes";
import { optimizePenSwitches } from "./optimizePenSwitches";
import { strokeToGcode } from "./strokeToGcode";
import { compressGcode } from "./compressGcode";
import { generateStats, statsHeader } from "./gcodeStats";

export type ProgressCallback = (pct: number, status: string) => void;

export function documentToGcode(doc: PnplttrDocument, onProgress?: ProgressCallback): string {
  const conv = makeConverter(doc.page);
  const home = gcodeToDoc(0, 0, conv);
  const fonts = new Map([...DEFAULT_FONTS, ...Object.entries(doc.fonts ?? {})]);

  // ── Phase 1 (0–80 %): render elements → optimise stroke order ────────────
  onProgress?.(0, "Optimizing pen switches…");
  const batches = optimizePenSwitches(doc.elements);
  const batchCount = batches.length;
  const batchShare = batchCount > 0 ? 80 / batchCount : 0;

  type ProcessedBatch = { penIdx: number; strokes: PlotterStroke[] };
  const processed: ProcessedBatch[] = [];

  for (let i = 0; i < batchCount; i++) {
    const { penIdx, elements: penElements } = batches[i];
    const base = Math.round(i * batchShare);

    onProgress?.(base, `Batch ${i + 1}/${batchCount}: rendering elements…`);
    const raw = elementsToPlotterStrokes(penElements, fonts);

    onProgress?.(Math.round(base + batchShare * 0.5), `Batch ${i + 1}/${batchCount}: optimizing stroke order…`);
    const strokes = optimizeStrokes(raw, home);

    if (strokes.length > 0) processed.push({ penIdx, strokes });
  }

  // ── Phase 2 (80–85 %): accumulate stats ──────────────────────────────────
  onProgress?.(80, "Computing stats…");
  const stats = generateStats(processed, home);

  // ── Phase 3 (85–95 %): emit GCode ────────────────────────────────────────
  onProgress?.(85, "Writing GCode…");

  let gcode = statsHeader(stats);
  gcode += "M5 ;ensure pen up\nG28 ; Home all axes\n\n";

  for (const { penIdx, strokes } of processed) {
    const pen = doc.pens[penIdx];
    gcode += `; Pen: ${pen.name} (${pen.color}, ${pen.width}mm)\n`;
    // TODO: add pen switching GCode commands here, using pen.color / pen.width
    gcode += "M5\n"; // ensure pen up before moving to first stroke
    for (const stroke of strokes) {
      gcode += strokeToGcode(stroke, conv);
    }
    gcode += "\n";
  }
  gcode += "G0 X0 Y0"; // return to origin

  // ── Phase 4 (95–100 %): compress ─────────────────────────────────────────
  onProgress?.(95, "Compressing GCode…");
  const result = compressGcode(gcode);
  onProgress?.(100, "Done.");
  return result;
}
