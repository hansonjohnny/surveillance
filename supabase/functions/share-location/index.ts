// Supabase Edge Function -- share-location
//
// Serves the public "Live Share" page an emergency contact opens from a
// link the user sends them — no login, no app install. The token in the
// URL IS the access control (checked against share_links.expires_at /
// revoked_at below); Supabase JWT verification is disabled for this
// function in supabase/config.toml since a plain browser navigation can't
// attach an Authorization header.
//
// GET /share-location?token=...          → HTML page (polls itself)
// GET /share-location?token=...&json=1    → JSON: { lat, lng, updatedAt, active }
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

function html(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { ...CORS, "Content-Type": "text/html; charset=utf-8" },
  });
}

function invalidPage(reason: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Surveillance AI — Live Share</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:#0A0A0F; color:#F0F0F5; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  .card { text-align:center; padding:32px; max-width:340px; }
  h1 { font-size:20px; margin:0 0 8px; }
  p { color:#8888A0; font-size:14px; line-height:1.5; margin:0; }
</style></head>
<body><div class="card"><h1>Link unavailable</h1><p>${reason}</p></div></body></html>`;
}

type ShareState = {
  lat: number | null;
  lng: number | null;
  updatedAt: string | null;
  active: boolean;
};

function renderPage(token: string, initial: ShareState): string {
  // Both interpolations below land inside JS string/object literals via
  // JSON.stringify, so the raw token/state values can never break out of
  // that context even if they contained quotes or script-like text.
  const safeToken = JSON.stringify(token);
  const safeInitial = JSON.stringify(initial);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Surveillance AI — Live Share</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  * { box-sizing: border-box; }
  html, body { margin:0; height:100%; background:#0A0A0F; color:#F0F0F5;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  #map { position:absolute; inset:0; }
  .leaflet-control-attribution { display:none; }
  .banner { position:absolute; top:0; left:0; right:0; z-index:1000; padding:14px 16px;
    background:rgba(10,10,15,0.90); border-bottom:1px solid rgba(255,255,255,0.1);
    display:flex; align-items:center; justify-content:space-between; gap:12px; }
  .banner h1 { font-size:14px; margin:0; letter-spacing:0.3px; font-weight:600; }
  .banner .sub { font-size:12px; color:#8888A0; margin-top:2px; }
  .dot { width:8px; height:8px; border-radius:4px; background:#00E676; flex-shrink:0; }
  .dot.ended { background:#555568; }
</style>
</head>
<body>
  <div class="banner">
    <div>
      <h1>Live Location</h1>
      <div class="sub" id="status">Loading…</div>
    </div>
    <div class="dot" id="dot"></div>
  </div>
  <div id="map"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var TOKEN = ${safeToken};
    var state = ${safeInitial};

    var map = L.map('map', { zoomControl: true, attributionControl: false }).setView(
      [state.lat || 0, state.lng || 0], state.lat != null ? 16 : 2
    );
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 19,
    }).addTo(map);

    var marker = null;
    function setMarker(lat, lng) {
      if (marker) { marker.setLatLng([lat, lng]); return; }
      marker = L.circleMarker([lat, lng], {
        radius: 9, color: '#00E5FF', weight: 2, fillColor: '#00E5FF', fillOpacity: 0.5,
      }).addTo(map);
    }

    function relativeTime(iso) {
      if (!iso) return 'never';
      var secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
      if (secs < 60) return secs + 's ago';
      var mins = Math.floor(secs / 60);
      if (mins < 60) return mins + 'm ago';
      return Math.floor(mins / 60) + 'h ago';
    }

    function render() {
      var statusEl = document.getElementById('status');
      var dotEl = document.getElementById('dot');
      if (state.lat != null && state.lng != null) {
        var wasUnset = map.getZoom() < 3;
        setMarker(state.lat, state.lng);
        if (wasUnset) map.setView([state.lat, state.lng], 16);
      }
      if (!state.active) {
        statusEl.textContent = 'Session ended — last known location, updated ' + relativeTime(state.updatedAt);
        dotEl.className = 'dot ended';
      } else {
        statusEl.textContent = 'Updated ' + relativeTime(state.updatedAt);
        dotEl.className = 'dot';
      }
    }
    render();
    setInterval(render, 1000);

    function showExpired() {
      document.getElementById('status').textContent = 'This link is no longer active.';
      document.getElementById('dot').className = 'dot ended';
    }

    function poll() {
      fetch(location.pathname + '?token=' + encodeURIComponent(TOKEN) + '&json=1')
        .then(function (r) {
          if (!r.ok) throw new Error('expired');
          return r.json();
        })
        .then(function (data) {
          if (data.error) { showExpired(); return; }
          state = data;
          render();
        })
        .catch(function () { showExpired(); });
    }
    setInterval(poll, 5000);
  </script>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const wantsJson = url.searchParams.get("json") === "1";

  if (!token) {
    return wantsJson
      ? json({ error: "Missing token" }, 400)
      : html(invalidPage("This link is missing its access token."), 400);
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
      return wantsJson
        ? json({ error: "Link not found" }, 404)
        : html(
            invalidPage("This link doesn't exist or has been removed."),
            404,
          );
    }

    const expired = new Date(link.expires_at).getTime() < Date.now();
    const revoked = !!link.revoked_at;

    if (expired || revoked) {
      const reason = revoked
        ? "Sharing was turned off for this link."
        : "This link has expired.";
      return wantsJson
        ? json({ error: revoked ? "Link revoked" : "Link expired" }, 410)
        : html(invalidPage(reason), 410);
    }

    const { data: session, error: sessionError } = await db
      .from("sessions")
      .select("last_lat, last_lng, last_location_at, ended_at")
      .eq("id", link.session_id)
      .maybeSingle();

    if (sessionError || !session) {
      return wantsJson
        ? json({ error: "Session not found" }, 404)
        : html(invalidPage("This session is no longer available."), 404);
    }

    const state: ShareState = {
      lat: session.last_lat,
      lng: session.last_lng,
      updatedAt: session.last_location_at,
      active: session.ended_at === null,
    };

    return wantsJson ? json(state) : html(renderPage(token, state));
  } catch (err) {
    console.error("[share-location] unexpected error:", err);
    return wantsJson
      ? json({ error: "Internal error" }, 500)
      : html(invalidPage("Something went wrong loading this link."), 500);
  }
});
