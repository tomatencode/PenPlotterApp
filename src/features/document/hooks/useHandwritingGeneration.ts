import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { PlotterStroke } from "../plotterMove";

interface UseHandwritingGenerationResult {
  generating: boolean;
  generate: (
    text: string,
    style: number,
    onSuccess: (strokes: PlotterStroke[]) => void,
  ) => void;
}

export function useHandwritingGeneration(): UseHandwritingGenerationResult {
  const [generating, setGenerating] = useState(false);

  function generate(
    text: string,
    style: number,
    onSuccess: (strokes: PlotterStroke[]) => void,
  ) {
    setGenerating(true);
    invoke<PlotterStroke[]>("generate_handwriting", { text, style })
      .then((strokes) => {
        onSuccess(strokes);
      })
      .catch((e) => {
        console.error("Handwriting generation failed:", e);
        alert("Handwriting generation failed: " + String(e));
      })
      .finally(() => {
        setGenerating(false);
      });
  }

  return { generating, generate };
}
