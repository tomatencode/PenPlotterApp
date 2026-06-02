import { elementToStrokes, strokeToSvgPath } from "./Strokes";
import type { Element, PlttrFont } from "../types";

// Distributes Omit over each union member so the discriminated union is preserved.
export type Ghost = Element extends infer E ? E extends { id: string } ? Omit<E, "id" | "pen" | "z"> : never : never;

export function ghostToSvgPaths(ghost: Ghost | null, fonts: Map<string, PlttrFont>): string[] {
  if (!ghost) return [];
  const el = { id: "__ghost__", pen: 0, z: 0, ...ghost } as Element;
  return elementToStrokes(el, fonts).map(strokeToSvgPath);
}