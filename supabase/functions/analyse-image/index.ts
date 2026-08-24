// Supabase Edge Function -- analyse-image
//
// Receives a base64 JPEG and GPS coordinates, checks the user's daily cap,
// calls GPT-4o-mini vision, and returns a structured risk assessment.
//
// Returns { cappedOut: true } when the user has hit their daily limit so the
// client can show an upgrade prompt without making an OpenAI call.
//
// Deploy:  supabase functions deploy analyse-image
// Secrets: supabase secrets set OPENAI_API_KEY=sk-proj-...
//          supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ─── Plan caps ────────────────────────────────────────────────────────────────

const PLAN_CAPS: Record<string, number | null> = {
  free: 50,
  pro: 300,
  guardian: null,
};

// ─── Usage check ─────────────────────────────────────────────────────────────
// Returns cappedOut=true when the user has hit their daily limit.
// If auth is missing or the DB call fails, we allow the request through
// so a backend hiccup never silently breaks monitoring.

async function checkAndIncrementUsage(req: Request): Promise<{
  cappedOut: boolean;
  todayUsage: number;
}> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { cappedOut: false, todayUsage: 0 };

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return { cappedOut: false, todayUsage: 0 };

  try {
    const db = createClient(supabaseUrl, serviceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return { cappedOut: false, todayUsage: 0 };

    const { data: userData } = await db
      .from("users")
      .select("plan")
      .eq("id", user.id)
      .single();

    const plan = (userData?.plan as string) ?? "free";
    const dailyCap = PLAN_CAPS[plan] ?? 50;

    if (dailyCap === null) return { cappedOut: false, todayUsage: 0 };

    const today = new Date().toISOString().split("T")[0];

    // Atomic increment: increments only when count < dailyCap.
    // Returns (new_count, capped_out) from the increment_ai_usage RPC.
    const { data: rows, error: rpcError } = await db.rpc("increment_ai_usage", {
      p_user_id: user.id,
      p_date: today,
      p_cap: dailyCap,
    });

    if (rpcError) {
      console.error("[analyse-image] usage RPC failed:", rpcError);
      return { cappedOut: false, todayUsage: 0 };
    }

    const row = (rows as Array<{ new_count: number; capped_out: boolean }>)?.[0];
    if (row?.capped_out) return { cappedOut: true, todayUsage: row.new_count };
    return { cappedOut: false, todayUsage: row?.new_count ?? 0 };
  } catch (err) {
    console.error("[analyse-image] usage check failed:", err);
    return { cappedOut: false, todayUsage: 0 };
  }
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(lat: number, lng: number, situation: string): string {
  return `You are a personal safety AI monitoring a person's surroundings.
The person is at coordinates ${lat}, ${lng}.
Context: ${situation}

Analyse this image for potential safety risks. Look for:
- Signs of physical confrontation or aggression
- People appearing distressed or threatened
- Visible signs of an unsafe setting, such as a weapon, physical restraint, or a hostile person approaching
- Suspicious behaviour directed at the camera holder

If the image is blank, mostly black, blurry, out of focus, or otherwise does not clearly show the scene (for example the phone was in a pocket or bag, or it is simply a dark room), this is NOT evidence of danger by itself. Rate it low risk and say in the summary that the image was not clear enough to analyse. Never rate high risk based only on darkness or a lack of visibility -- only rate high when you can clearly see specific evidence of danger in the image.

Respond ONLY with a JSON object in this exact format:
{
  "riskLevel": "low" | "medium" | "high",
  "summary": "One sentence description of what you see",
  "concerns": ["specific concern 1", "specific concern 2"],
  "confidence": 0.0 to 1.0
}

Do not use em-dashes in any text. Be conservative -- only rate high if there is clear evidence of danger. Rate low for normal scenes or images too unclear to assess.`;
}

type AnalysisResult = {
  riskLevel: "low" | "medium" | "high";
  summary: string;
  concerns: string[];
  confidence: number;
  cappedOut?: boolean;
  todayUsage?: number;
};

function safeParseResult(text: string): AnalysisResult {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no JSON block found");
    const parsed = JSON.parse(match[0]);

    const riskLevel = ["low", "medium", "high"].includes(parsed.riskLevel)
      ? (parsed.riskLevel as "low" | "medium" | "high")
      : "low";

    return {
      riskLevel,
      summary:
        typeof parsed.summary === "string" ? parsed.summary : "Scene analysed.",
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
      confidence:
        typeof parsed.confidence === "number"
          ? Math.min(1, Math.max(0, parsed.confidence))
          : 0.5,
    };
  } catch {
    return {
      riskLevel: "low",
      summary: "Unable to analyse scene.",
      concerns: [],
      confidence: 0,
    };
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { cappedOut, todayUsage } = await checkAndIncrementUsage(req);

    if (cappedOut) {
      return json({
        riskLevel: "low",
        summary: "Daily analysis limit reached. Upgrade for more coverage.",
        concerns: [],
        confidence: 0,
        cappedOut: true,
        todayUsage,
      });
    }

    const { imageBase64, lat, lng, situation } = await req.json();

    if (!imageBase64) {
      return json({ error: "imageBase64 is required" }, 400);
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return json({ error: "OPENAI_API_KEY not configured" }, 500);
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: "low",
                },
              },
              {
                type: "text",
                text: buildPrompt(
                  lat ?? 0,
                  lng ?? 0,
                  situation ?? "General surveillance",
                ),
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[analyse-image] OpenAI error:", response.status, err);
      return json({ riskLevel: "low", summary: "Analysis failed.", concerns: [], confidence: 0, todayUsage });
    }

    const data = await response.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";
    return json({ ...safeParseResult(text), todayUsage });
  } catch (err) {
    console.error("[analyse-image] unexpected error:", err);
    return json({ riskLevel: "low", summary: "Analysis failed.", concerns: [], confidence: 0 });
  }
});
