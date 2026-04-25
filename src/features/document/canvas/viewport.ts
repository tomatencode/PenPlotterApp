export interface Viewport {
  zoom: number;   // scale factor, 1 = 1px per mm
  panX: number;   // offset in px (pixels)
  panY: number;
}

// Convert an SVG-space pixel point to document mm coordinates.
export function viewportToDoc(px: number, py: number, viewport: Viewport): [number, number] {
  return [
    (px - viewport.panX) / viewport.zoom,
    (py - viewport.panY) / viewport.zoom,
  ];
}