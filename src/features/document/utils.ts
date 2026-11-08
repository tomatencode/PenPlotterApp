import type { Element, PageSettings } from "./types";

export function newId(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function effectivePageDimensions(page: PageSettings): { pageWidth: number; pageHeight: number; workspaceWidth: number; workspaceHeight: number } {
  if (page.rotate_workspace) {
    return {
      pageWidth: page.page_height,
      pageHeight: page.page_width,
      workspaceWidth: page.workspace_height,
      workspaceHeight: page.workspace_width,
    };
  }
  return {
    pageWidth: page.page_width,
    pageHeight: page.page_height,
    workspaceWidth: page.workspace_width,
    workspaceHeight: page.workspace_height,
  };
}

export function workspaceBounds(page: PageSettings): { x: number; y: number; w: number; h: number } {
  const { pageWidth, pageHeight, workspaceWidth, workspaceHeight } = effectivePageDimensions(page);
  return {
    x: Math.max(pageWidth / 2 - workspaceWidth / 2, 0),
    y: Math.max(pageHeight / 2 - workspaceHeight / 2, 0),
    w: Math.min(workspaceWidth, pageWidth),
    h: Math.min(workspaceHeight, pageHeight),
  };
}

export type ElementBounds = { minX: number; minY: number; maxX: number; maxY: number };

export function elementBounds(el: Element): ElementBounds {
  switch (el.type) {
    case "Drawing": {
      const xs = el.points.map(p => p[0]);
      const ys = el.points.map(p => p[1]);
      return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
    }
    case "Line":   return { minX: Math.min(el.x1, el.x2), minY: Math.min(el.y1, el.y2), maxX: Math.max(el.x1, el.x2), maxY: Math.max(el.y1, el.y2) };
    case "Arc": return { minX: el.cx - el.r, minY: el.cy - el.r, maxX: el.cx + el.r, maxY: el.cy + el.r };
    case "Rect":   return { minX: el.x,       minY: el.y,       maxX: el.x + el.w,    maxY: el.y + el.h    };
    case "Circle": return { minX: el.cx - el.r, minY: el.cy - el.r, maxX: el.cx + el.r, maxY: el.cy + el.r };
    case "Text":        return { minX: el.x, minY: el.y, maxX: el.x + el.w, maxY: el.y + el.h };
    case "Handwriting":  return { minX: el.x, minY: el.y, maxX: el.x + el.w, maxY: el.y + el.h };
  }
}
