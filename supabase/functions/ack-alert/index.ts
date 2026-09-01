// Supabase Edge Function -- ack-alert
//
// Backs the public alert.html page (repo root, GitHub Pages) embedded in a
// High-risk alert's SMS and email (see lib/alerts.ts buildAlertMessages).
// Opening that link does two things at once, per the same visit:
//   1. Returns the event's photo/audio (as short-lived signed URLs) plus
//      the AI summary/transcript, so the contact can actually see/hear
//      what was detected, not just read a sentence.
//   2. Marks the alert acknowledged, so lib/escalation.ts skips notifying
//      the backup contact.
//
// JSON, not HTML -- Edge Functions on the default *.supabase.co domain
// rewrite text/html responses to text/plain anyway (HTML serving needs a
// custom domain / Pro plan), so alert.html is a real static page that
// fetches this endpoint for its data, same pattern as share.html /
// share-location.
//
// The alert's own UUID is the access token -- unguessable, and this
// endpoint only ever reads/writes the one alert (and its one linked
// event) that id points at. Supabase JWT verification is disabled for
// this function in supabase/config.toml, since a plain browser
// navigation can't attach an Authorization header.
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

const SIGNED_URL_EXPIRES_IN = 60 * 60 * 24; // 24h -- plenty for a contact to open the link

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const alertId = url.searchParams.get("alertId");

  if (!alertId) {
    return json({ error: "This link is missing its alert id." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  try {
    const { data: alert, error: fetchError } = await db
      .from("alerts")
      .select("id, event_id, timestamp, contact_name, acknowledged_at")
      .eq("id", alertId)
      .maybeSingle();

    if (fetchError || !alert) {
      return json({ error: "This alert doesn't exist or has been removed." }, 404);
    }

    // First tap wins — don't clobber the original acknowledgment time.
    const alreadyAcknowledged = !!alert.acknowledged_at;
    if (!alreadyAcknowledged) {
      const { error: updateError } = await db
        .from("alerts")
        .update({ acknowledged_at: new Date().toISOString() })
        .eq("id", alertId);

      if (updateError) {
        console.error("[ack-alert] Failed to set acknowledged_at:", updateError);
        return json({ error: "Something went wrong. Please try the link again in a moment." }, 500);
      }
    }

    const { data: event } = await db
      .from("events")
      .select(
        "risk_level, ai_summary, audio_summary, transcript, latitude, longitude, photo_storage_path, audio_storage_path",
      )
      .eq("id", alert.event_id)
      .maybeSingle();

    let photoUrl: string | null = null;
    let audioUrl: string | null = null;

    if (event?.photo_storage_path) {
      const { data } = await db.storage
        .from("event-media")
        .createSignedUrl(event.photo_storage_path, SIGNED_URL_EXPIRES_IN);
      photoUrl = data?.signedUrl ?? null;
    }
    if (event?.audio_storage_path) {
      const { data } = await db.storage
        .from("event-media")
        .createSignedUrl(event.audio_storage_path, SIGNED_URL_EXPIRES_IN);
      audioUrl = data?.signedUrl ?? null;
    }

    return json({
      contactName: alert.contact_name,
      timestamp: alert.timestamp,
      riskLevel: event?.risk_level ?? null,
      aiSummary: event?.ai_summary ?? null,
      audioSummary: event?.audio_summary ?? null,
      transcript: event?.transcript ?? null,
      photoUrl,
      audioUrl,
      location:
        event?.latitude != null && event?.longitude != null
          ? { lat: event.latitude, lng: event.longitude }
          : null,
      alreadyAcknowledged,
    });
  } catch (err) {
    console.error("[ack-alert] unexpected error:", err);
    return json({ error: "Something went wrong. Please try the link again in a moment." }, 500);
  }
});
