import type { PlttrFont } from "../types";
import { ROWMANS_FONT } from "./fonts/rowmans";

// All fonts available by default — no file needed.
export const DEFAULT_FONTS: Map<string, PlttrFont> = new Map([
  [ROWMANS_FONT.name, ROWMANS_FONT],
]);
