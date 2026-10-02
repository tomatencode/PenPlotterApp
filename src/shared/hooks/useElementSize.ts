import { useEffect, useState, type RefObject } from "react";

/**
 * Tracks the content-box height of an element with a ResizeObserver.
 *
 * Used by the virtualised GCode views to know how many rows fit in the
 * viewport without hard-coding panel dimensions.
 */
export function useElementSize(ref: RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    setHeight(el.clientHeight);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setHeight(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return height;
}