import type { PlttrFont } from "../types";
import { SIMPLEX_FONT } from "./fonts/simplex";

// All fonts available by default — no file needed.
export const DEFAULT_FONTS: Map<string, PlttrFont> = new Map([
  [SIMPLEX_FONT.name, SIMPLEX_FONT],
]);
