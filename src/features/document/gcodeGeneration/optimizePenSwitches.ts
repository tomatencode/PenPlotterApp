import type { Element } from "../types";

export interface PenBatch {
  penIdx: number;
  elements: Element[];
}

interface BBox { x1: number; y1: number; x2: number; y2: number }

function elementBBox(el: Element): BBox {
  switch (el.type) {
    case "Line":
      return { x1: Math.min(el.x1, el.x2), y1: Math.min(el.y1, el.y2),
               x2: Math.max(el.x1, el.x2), y2: Math.max(el.y1, el.y2) };
    case "Rect":
      return { x1: el.x, y1: el.y, x2: el.x + el.w, y2: el.y + el.h };
    case "Circle":
      return { x1: el.cx - el.r, y1: el.cy - el.r, x2: el.cx + el.r, y2: el.cy + el.r };
    case "Text":
    case "Handwriting":
      return { x1: el.x, y1: el.y, x2: el.x + el.w, y2: el.y + el.h };
    case "Drawing": {
      if (el.points.length === 0) return { x1: 0, y1: 0, x2: 0, y2: 0 };
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (const [x, y] of el.points) {
        if (x < x1) x1 = x; if (y < y1) y1 = y;
        if (x > x2) x2 = x; if (y > y2) y2 = y;
      }
      return { x1, y1, x2, y2 };
    }
  }
}

function bboxOverlaps(a: BBox, b: BBox): boolean {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

/**
 * Groups elements into ordered pen batches such that:
 * - Overlapping elements of different pens are always drawn lowest-z first
 *   (ensures correct visual layering on the physical medium)
 * - Pen switches are minimised: a greedy topological sort stays on the current
 *   pen as long as precedence constraints allow, and switches only when forced
 *   to or when another pen has more pending work.
 *
 * If the cross-pen overlap constraints form a cycle (e.g. pen A must precede
 * pen B for one pair of elements, and pen B must precede pen A for another)
 * the function falls back to flushing remaining elements in ascending z order.
 *
 * In the simple case (one pen, or no overlapping cross-pen elements) the result
 * is exactly one batch per pen — identical to a plain per-pen loop.
 */
export function optimizePenSwitches(elements: Element[]): PenBatch[] {
  if (elements.length === 0) return [];

  // --- 1. Bounding boxes -------------------------------------------------------
  const bboxes = new Map<string, BBox>(elements.map((el) => [el.id, elementBBox(el)]));

  // --- 2. Build element-level precedence DAG -----------------------------------
  // Edge first → second means "first must be drawn before second".
  const inDeps = new Map<string, number>(elements.map((el) => [el.id, 0]));
  const succs  = new Map<string, string[]>(elements.map((el) => [el.id, []]));

  for (let i = 0; i < elements.length; i++) {
    const a = elements[i];
    for (let j = i + 1; j < elements.length; j++) {
      const b = elements[j];
      if (a.pen === b.pen || a.z === b.z) continue;
      if (!bboxOverlaps(bboxes.get(a.id)!, bboxes.get(b.id)!)) continue;
      const [first, second] = a.z < b.z ? [a, b] : [b, a];
      succs.get(first.id)!.push(second.id);
      inDeps.set(second.id, inDeps.get(second.id)! + 1);
    }
  }

  // --- 3. Greedy topological sort, staying on the current pen -----------------
  const byId  = new Map<string, Element>(elements.map((el) => [el.id, el]));
  const ready = new Set<string>(
    elements.filter((el) => inDeps.get(el.id) === 0).map((el) => el.id),
  );
  const done = new Set<string>();
  const batches: PenBatch[] = [];
  let currentPen = -1;

  const markDone = (id: string) => {
    done.add(id);
    for (const sid of succs.get(id)!) {
      const d = inDeps.get(sid)! - 1;
      inDeps.set(sid, d);
      if (d === 0) ready.add(sid);
    }
  };

  while (done.size < elements.length) {
    if (ready.size === 0) {
      // Cycle — flush remaining elements sorted by z then pen index
      const remaining = elements
        .filter((el) => !done.has(el.id))
        .sort((a, b) => a.z - b.z || a.pen - b.pen);
      for (const el of remaining) {
        const last = batches[batches.length - 1];
        if (last && last.penIdx === el.pen) last.elements.push(el);
        else batches.push({ penIdx: el.pen, elements: [el] });
        markDone(el.id);
      }
      break;
    }

    // Group ready element ids by pen
    const readyByPen = new Map<number, string[]>();
    for (const id of ready) {
      const pen = byId.get(id)!.pen;
      if (!readyByPen.has(pen)) readyByPen.set(pen, []);
      readyByPen.get(pen)!.push(id);
    }

    // Stay on the current pen if it has ready work; otherwise pick the pen with
    // the most ready elements (minimises future switches).
    let chosenPen: number;
    if (currentPen !== -1 && readyByPen.has(currentPen)) {
      chosenPen = currentPen;
    } else {
      chosenPen = [...readyByPen.entries()].reduce<[number, number]>(
        (best, [pen, ids]) => (ids.length > best[1] ? [pen, ids.length] : best),
        [-1, -1],
      )[0];
    }

    const chosenIds = readyByPen.get(chosenPen)!;

    // Merge into the last batch if it's already for this pen (can happen after
    // a cycle flush); otherwise open a new batch.
    const last = batches[batches.length - 1];
    if (last && last.penIdx === chosenPen) {
      last.elements.push(...chosenIds.map((id) => byId.get(id)!));
    } else {
      batches.push({ penIdx: chosenPen, elements: chosenIds.map((id) => byId.get(id)!) });
    }

    for (const id of chosenIds) {
      ready.delete(id);
      markDone(id);
    }
    currentPen = chosenPen;
  }

  return batches;
}
