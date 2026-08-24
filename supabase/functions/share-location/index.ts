// Supabase Edge Function -- share-location
//
// JSON data endpoint for the public "Live Share" page an emergency contact
// opens from a link the user sends them — no login, no app install. The
// token in the URL IS the access control (checked against share_links.
// expires_at / revoked_at below); Supabase JWT verification is disabled
// for this function in supabase/config.toml since a plain browser
// navigation can't attach an Authorization header.
//
// The actual page lives in the "share-pages" Storage bucket, not here —
// Edge Functions on the default *.supabase.co domain rewrite text/html
// responses to text/plain (HTML serving needs a custom domain / Pro plan),
// so this function only ever returns JSON, and the static page (see
// lib/liveShare.ts for the URL it's uploaded to) polls it for updates.
//
// GET /share-location?token=...  →  { lat, lng, updatedAt, active } | { error }
//
// Uses the service-role key to read past RLS, since the viewer has no
// Supabase session of their own.
//
// Deploy: supabase functions deploy share-location --no-verify-jwt

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

type ShareState = {
  lat: number | null;
  lng: number | null;
  updatedAt: string | null;
  active: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return json({ error: "Missing token" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  try {
    const { data: link, error: linkError } = await db
      .from("share_links")
      .select("id, session_id, expires_at, revoked_at")
      .eq("token", token)
      .maybeSingle();

    if (linkError || !link) {
      return json({ error: "Link not found" }, 404);
    }

    const expired = new Date(link.expires_at).getTime() < Date.now();
    const revoked = !!link.revoked_at;

    if (expired || revoked) {
      return json({ error: revoked ? "Link revoked" : "Link expired" }, 410);
    }

    const { data: session, error: sessionError } = await db
      .from("sessions")
      .select("last_lat, last_lng, last_location_at, ended_at")
      .eq("id", link.session_id)
      .maybeSingle();

    if (sessionError || !session) {
      return json({ error: "Session not found" }, 404);
    }

    const state: ShareState = {
      lat: session.last_lat,
      lng: session.last_lng,
      updatedAt: session.last_location_at,
      active: session.ended_at === null,
    };

    return json(state);
  } catch (err) {
    console.error("[share-location] unexpected error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
