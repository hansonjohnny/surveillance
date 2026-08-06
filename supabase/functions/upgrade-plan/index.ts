// Supabase Edge Function -- upgrade-plan
//
// Validates the caller's JWT and updates their plan tier using the
// service-role key (bypasses RLS). This is the only authorised path
// for clients to change their own plan.
//
// Before going to production, add RevenueCat entitlement verification
// here so only users who have actually paid can receive a paid tier.
//
// Deploy: supabase functions deploy upgrade-plan

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VALID_PLANS = new Set(["free", "pro", "guardian"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  // Verify the caller's JWT.
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await db.auth.getUser(token);
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  try {
    const { plan } = await req.json();
    if (!VALID_PLANS.has(plan)) return json({ error: "Invalid plan" }, 400);

    const { error } = await db
      .from("users")
      .update({ plan })
      .eq("id", user.id);

    if (error) return json({ error: error.message }, 500);
    return json({ success: true, plan });
  } catch (err) {
    console.error("[upgrade-plan] error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
