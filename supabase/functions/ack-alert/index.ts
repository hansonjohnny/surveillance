// Supabase Edge Function -- ack-alert
//
// The public "I've seen this" link embedded in a High-risk alert's SMS and
// email (see lib/alerts.ts buildAlertMessages). Tapping it marks the alert
// acknowledged so lib/escalation.ts skips notifying the backup contact.
//
// Plain text, not HTML — Edge Functions on the default *.supabase.co domain
// rewrite text/html responses to text/plain anyway (HTML serving needs a
// custom domain / Pro plan), and a one-line confirmation doesn't need
// styling, so there's nothing to work around here.
//
// The alert's own UUID is the access token — unguessable, and the only
// thing this endpoint can do is set one timestamp on one row. Supabase JWT
// verification is disabled for this function in supabase/config.toml,
// since a plain browser navigation can't attach an Authorization header.
//
// GET /ack-alert?alertId=...
//
// Deploy: supabase functions deploy ack-alert --no-verify-jwt

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function text(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const alertId = url.searchParams.get("alertId");

  if (!alertId) {
    return text("This link is missing its alert id.", 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  try {
    const { data: alert, error: fetchError } = await db
      .from("alerts")
      .select("id, acknowledged_at")
      .eq("id", alertId)
      .maybeSingle();

    if (fetchError || !alert) {
      return text("This alert doesn't exist or has been removed.", 404);
    }

    // First tap wins — don't clobber the original acknowledgment time.
    if (!alert.acknowledged_at) {
      const { error: updateError } = await db
        .from("alerts")
        .update({ acknowledged_at: new Date().toISOString() })
        .eq("id", alertId);

      if (updateError) {
        console.error("[ack-alert] Failed to set acknowledged_at:", updateError);
        return text("Something went wrong. Please try the link again in a moment.", 500);
      }
    }

    return text(
      "Thanks — got it. You've confirmed you've seen this alert. No further contact will be notified.",
    );
  } catch (err) {
    console.error("[ack-alert] unexpected error:", err);
    return text("Something went wrong. Please try the link again in a moment.", 500);
  }
});
