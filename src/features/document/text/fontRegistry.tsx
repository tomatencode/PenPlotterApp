import { createContext, useContext, useState, type ReactNode } from "react";
import type { PlttrFont } from "../types";
import { DEFAULT_FONTS } from "./defaultFonts";

interface FontRegistryValue {
  /** All fonts: defaults + any custom fonts added this session. */
  fonts: Map<string, PlttrFont>;
  /** Merge additional fonts into the registry (e.g. from a loaded document). */
  addFonts: (fontsToAdd: Record<string, PlttrFont>) => void;
}

const FontRegistryContext = createContext<FontRegistryValue | null>(null);

export function FontRegistryProvider({ children }: { children: ReactNode }) {
  const [customFonts, setCustomFonts] = useState<Map<string, PlttrFont>>(new Map());

  // Merge defaults + any runtime-added custom fonts
  const fonts: Map<string, PlttrFont> = new Map([...DEFAULT_FONTS, ...customFonts]);

  function addFonts(fontsToAdd: Record<string, PlttrFont>) {
    setCustomFonts((prev) => {
      const next = new Map(prev);
      for (const [name, font] of Object.entries(fontsToAdd)) {
        next.set(name, font);
      }
      return next;
    });
  }

  return (
    <FontRegistryContext.Provider value={{ fonts, addFonts }}>
      {children}
    </FontRegistryContext.Provider>
  );
}

export function useFontRegistry(): FontRegistryValue {
  const ctx = useContext(FontRegistryContext);
  if (!ctx) throw new Error("useFontRegistry must be used inside <FontRegistryProvider>");
  return ctx;
}
