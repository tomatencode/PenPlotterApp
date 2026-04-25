// Text-element rendering: converts a Text element + font into PlotterStrokes.
// Also exposes allElementsToPlotterStrokes, which wraps elementsToPlotterStrokes
// and adds Text support — use this anywhere you need full element rendering.

import type { Element, PlttrFont } from "../types";
import type { PlotterMove, PlotterStroke } from "../plotterMove";
import { elementsToPlotterStrokes } from "../plotterMove";

type TextEl = Extract<Element, { type: "Text" }>;

// ── Glyph transform ───────────────────────────────────────────────────────────
// Font space: y up, baseline at 0.  Document space: y down.
// tx/ty map a font coordinate to an absolute document coordinate.

function transformMove(
  m: PlotterMove,
  tx: (x: number) => number,
  ty: (y: number) => number,
): PlotterMove {
  switch (m.type) {
    case "Line":
      return { type: "Line", x1: tx(m.x1), y1: ty(m.y1), x2: tx(m.x2), y2: ty(m.y2) };
    case "Arc":
      return { ...m, x1: tx(m.x1), y1: ty(m.y1), x2: tx(m.x2), y2: ty(m.y2),
               cx: tx(m.cx), cy: ty(m.cy), clockwise: !m.clockwise }; // y-flip inverts winding
    case "QuadBezier":
      return { ...m, x1: tx(m.x1), y1: ty(m.y1), x2: tx(m.x2), y2: ty(m.y2),
               cx: tx(m.cx), cy: ty(m.cy) };
    case "CubicBezier":
      return { ...m, x1: tx(m.x1), y1: ty(m.y1), x2: tx(m.x2), y2: ty(m.y2),
               cx1: tx(m.cx1), cy1: ty(m.cy1), cx2: tx(m.cx2), cy2: ty(m.cy2) };
  }
}

function transformStroke(
  stroke: PlotterStroke,
  penX: number,
  baselineY: number,
  scale: number,
): PlotterStroke {
  const tx = (fx: number) => penX   + fx * scale;
  const ty = (fy: number) => baselineY - fy * scale; // y-flip: font-up → doc-up
  return {
    start: [tx(stroke.start[0]), ty(stroke.start[1])],
    moves: stroke.moves.map((m) => transformMove(m, tx, ty)),
    closed: stroke.closed,
  };
}

// ── Text layout ───────────────────────────────────────────────────────────────

function measureLine(text: string, font: PlttrFont, scale: number): number {
  let w = 0;
  for (const ch of text) {
    w += (font.glyphs[ch]?.width ?? font.height * 0.5) * scale;
  }
  return w;
}

export function textElementToStrokes(el: TextEl, font: PlttrFont): PlotterStroke[] {
  const scale      = el.size / font.height;
  const lineHeight = el.size * 1.4;
  const strokes: PlotterStroke[] = [];

  // Word-wrap
  const lines: string[] = [];
  let current = "";
  for (const word of el.text.split(" ")) {
    const test = current ? `${current} ${word}` : word;
    if (current && measureLine(test, font, scale) > el.w) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  const descenderFraction = 0.33; // |max descender| / capHeight for descent clipping

  for (let li = 0; li < lines.length; li++) {
    const baselineY = el.y + el.size + li * lineHeight;
    // Stop if the lowest descender would exceed the box bottom
    if (baselineY + font.height * descenderFraction * scale > el.y + el.h && li > 0) break;

    let penX = el.x;
    for (const ch of lines[li]) {
      const glyph = font.glyphs[ch];
      if (glyph) {
        for (const stroke of glyph.paths) {
          strokes.push(transformStroke(stroke, penX, baselineY, scale));
        }
      }
      penX += (glyph?.width ?? font.height * 0.5) * scale;
    }
  }

  return strokes;
}

// ── All-element entry point ───────────────────────────────────────────────────

export function allElementsToPlotterStrokes(
  elements: Element[],
  fonts: Map<string, PlttrFont>,
): PlotterStroke[] {
  const result: PlotterStroke[] = [];
  for (const el of elements) {
    if (el.type === "Text") {
      const font = fonts.get(el.fontName);
      if (font) result.push(...textElementToStrokes(el, font));
    } else {
      result.push(...elementsToPlotterStrokes([el]));
    }
  }
  return result;
}
