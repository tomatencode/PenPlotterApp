import type { PageSettings } from "../types";

export interface ConverterProps {
  xOffset: number;
  yOffset: number;
  wsWidth: number;
  wsHeight: number;
  rotateWorkspace: boolean;
  pageHeight: number;
}

export function makeConverter(page: PageSettings): ConverterProps {
  return {
    xOffset:  (page.workspace_width  - page.page_width)  / 2,
    yOffset:  (page.workspace_height - page.page_height) / 2,
    wsWidth:  page.workspace_width,
    wsHeight: page.workspace_height,
    rotateWorkspace: page.rotate_workspace,
    pageHeight: page.page_height,
  };
}

export function docToGcode(x: number, y: number, c: ConverterProps, cap?: boolean): [number, number] {
  const physicalX = c.rotateWorkspace ? y : x;
  const physicalY = c.rotateWorkspace ? c.pageHeight - x : y;
  let gx = physicalX + c.xOffset;
  let gy = c.wsHeight - (physicalY + c.yOffset);
  if (cap) {
    gx = Math.max(0, Math.min(gx, c.wsWidth));
    gy = Math.max(0, Math.min(gy, c.wsHeight));
  }
  return [gx, gy];
}

/** The GCode origin (0, 0) expressed in document space — used as the optimizer home. */
export function gcodeToDoc(x: number, y: number, c: ConverterProps): [number, number] {
  const physicalX = x - c.xOffset;
  const physicalY = c.wsHeight - y - c.yOffset;
  return c.rotateWorkspace
    ? [c.pageHeight - physicalY, physicalX]
    : [physicalX, physicalY];
}
