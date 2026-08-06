// Client-side image analysis.
// Sends a base64 JPEG to the analyse-image Edge Function, which calls
// GPT-4o vision and returns a structured risk assessment. The OpenAI API
// key stays on the server — it never touches the client bundle.

import { supabase } from "./supabase";

export type RiskLevel = "low" | "medium" | "high";

export type VisionResult = {
  riskLevel: RiskLevel;
  summary: string;
  cappedOut?: boolean;
  todayUsage?: number;
};

export async function analyseImage(
  imageBase64: string,
  location: { lat: number; lng: number } | null,
): Promise<VisionResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke("analyse-image", {
      body: {
        imageBase64,
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
      },
    });

    if (error) {
      // FunctionsHttpError carries the raw Response in .context — read it so
      // we can see the actual error body (e.g. "OPENAI_API_KEY not configured"
      // or an OpenAI 4xx), not just the generic "non-2xx status code" message.
      const ctx = (error as unknown as { context?: Response }).context;
      if (ctx) {
        const status = ctx.status;
        const body = await ctx.text().catch(() => "(unreadable)");
        console.error(`[vision] analyseImage error: HTTP ${status} —`, body);
      } else {
        console.error("[vision] analyseImage error:", error.message);
      }
      return null;
    }

    return data as VisionResult;
  } catch (err) {
    console.error("[vision] analyseImage failed:", err);
    return null;
  }
}
