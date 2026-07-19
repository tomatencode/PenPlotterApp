import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { PlotterStroke } from "../plotterMove";

interface HandwritingResult {
  strokes: PlotterStroke[];
  /** Natural width / height of the generated text. */
  aspectRatio: number;
}

interface UseHandwritingGenerationResult {
  generating: boolean;
  generate: (
    text: string,
    style: number,
    onSuccess: (result: HandwritingResult) => void,
  ) => void;
}

export function useHandwritingGeneration(): UseHandwritingGenerationResult {
  const [generating, setGenerating] = useState(false);

  function generate(
    text: string,
    style: number,
    onSuccess: (result: HandwritingResult) => void,
  ) {
    setGenerating(true);
    invoke<HandwritingResult>("generate_handwriting", { text, style })
      .then((result) => {
        onSuccess(result);
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
