// Client-side AI analysis helpers.
// Both functions call Supabase Edge Functions so the OPENAI_API_KEY
// never reaches the client bundle. Returns null on any error -- the
// monitoring loop handles null gracefully by skipping the AI score.

import { supabase } from "./supabase";

export type RiskLevel = "low" | "medium" | "high";

export type AnalysisResult = {
  riskLevel: RiskLevel;
  summary: string;
  concerns: string[];
  confidence: number;
};

export async function analyseImage(
  imageBase64: string,
  lat: number,
  lng: number,
  situation: string,
): Promise<AnalysisResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke("analyse-image", {
      body: { imageBase64, lat, lng, situation },
    });

    if (error) {
      console.error("[anthropic] analyseImage error:", error.message);
      return null;
    }

    return data as AnalysisResult;
  } catch (err) {
    console.error("[anthropic] analyseImage failed:", err);
    return null;
  }
}

export async function analyseAudio(
  transcript: string,
): Promise<AnalysisResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke("analyse-audio", {
      body: { transcript },
    });

    if (error) {
      console.error("[anthropic] analyseAudio error:", error.message);
      return null;
    }

    return data as AnalysisResult;
  } catch (err) {
    console.error("[anthropic] analyseAudio failed:", err);
    return null;
  }
}
