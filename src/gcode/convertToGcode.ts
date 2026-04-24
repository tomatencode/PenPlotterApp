import type { PnplttrDocument } from "../components/document/types";
import { makeConverter, gcodeToDoc } from "./converter";
import { elementsToGStrokes } from "./elementsToStrokes";
import { optimizeStrokes } from "./optimizeStrokes";
import { strokeToGcode } from "./strokeToGcode";
import { compressGcode } from "./compressGcode";

export function documentToGcode(doc: PnplttrDocument): string {
  const conv = makeConverter(doc.page);
  const home = gcodeToDoc(0, 0, conv);

  let gcode = "G28 ; Home all axes\n\n";

  for (const layer of doc.layers) {
    gcode += `; Layer: ${layer.name}\n`;
    // TODO: add pen switching GCode commands here, using layer.pen.color / layer.pen.width

    const strokes = elementsToGStrokes(layer.elements);
    const optimized = optimizeStrokes(strokes, home);

    gcode += "M5\n"; // ensure pen up before moving to first stroke
    for (const stroke of optimized) {
      gcode += strokeToGcode(stroke, conv);
    }
    gcode += "\n";
  }

  gcode += "G0 X0 Y0"; // return to origin

  return compressGcode(gcode);
}
