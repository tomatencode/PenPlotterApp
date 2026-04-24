// Coordinate conversion between document space and GCode space.
//
// Document space: origin top-left,    +Y down  (mm)
// GCode space:    origin bottom-left, +Y up    (mm)

import type { PageSettings } from "../components/document/types";

export interface Converter {
  xOffset: number;
  yOffset: number;
  wsHeight: number;
}

export function makeConverter(page: PageSettings): Converter {
  return {
    xOffset:  (page.workspace_width  - page.page_width)  / 2,
    yOffset:  (page.workspace_height - page.page_height) / 2,
    wsHeight: page.workspace_height,
  };
}

export function docToGcode(x: number, y: number, c: Converter): [number, number] {
  return [x + c.xOffset, c.wsHeight - (y + c.yOffset)];
}

/** The GCode origin (0, 0) expressed in document space — used as the optimizer home. */
export function gcodeToDoc(x: number, y: number, c: Converter): [number, number] {
  return [x - c.xOffset, c.wsHeight - y - c.yOffset];
}
