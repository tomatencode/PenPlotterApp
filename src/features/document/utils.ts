import type { PageSettings } from "./types";

export function newId(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function workspaceBounds(page: PageSettings): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.max(page.page_width  / 2 - page.workspace_width  / 2, 0),
    y: Math.max(page.page_height / 2 - page.workspace_height / 2, 0),
    w: Math.min(page.workspace_width,  page.page_width),
    h: Math.min(page.workspace_height, page.page_height),
  };
}
