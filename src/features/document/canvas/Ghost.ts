import { elementToStrokes, strokeToSvgPath } from "./Strokes";
import type { Element } from "../types";

// Distributes Omit over each union member so the discriminated union is preserved.
export type Ghost = Element extends infer E ? E extends { id: string } ? Omit<E, "id"> : never : never;

export function ghostToSvgPaths(ghost: Ghost | null): string[] {
  if (!ghost) return [];
  const el = { id: "__ghost__", ...ghost } as Element;
  return elementToStrokes(el).map(strokeToSvgPath);
}