// Supabase Edge Function -- remote-start-session
//
// Lets a guardian start monitoring on a linked ward's phone without the
// ward touching anything. Sends a data-only Expo push to the ward's
// device; the client-side background task (tasks/remoteSessionTask.ts,
// registered via expo-notifications' background-notification-task API)
// reacts to it by calling lib/location.ts's beginMonitoringSession. See
// remote-stop-session for the matching stop path.
//
// Platform-honest limit, not fixable from here: iOS will never deliver a
// silent push to an app the user has force-quit (a deliberate Apple
// policy). This works reliably on Android; a killed Android app can
// still be missed if the manufacturer's battery optimizer suppresses
// the FCM data message -- not something app code can fully guarantee.
//
// POST { wardId: string }
//
// Deploy: supabase functions deploy remote-start-session

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user: guardian },
  } = await db.auth.getUser(token);

  if (!guardian) {
    return json({ success: false, error: "Not signed in." }, 401);
  }

  try {
    const { wardId } = await req.json();
    if (typeof wardId !== "string" || !wardId) {
      return json({ success: false, error: "wardId is required." }, 400);
    }

    // Confirm this is actually an active, linked ward of this guardian --
    // same check RLS would apply to a read, repeated explicitly here
    // since the service-role client bypasses RLS.
    const { data: link } = await db
      .from("guardian_links")
      .select("id")
      .eq("guardian_id", guardian.id)
      .eq("ward_id", wardId)
      .eq("status", "active")
      .maybeSingle();

    if (!link) {
      return json(
        { success: false, error: "This account isn't an active ward of yours." },
        403,
      );
    }

    const { data: wardRow } = await db
      .from("users")
      .select("push_token")
      .eq("id", wardId)
      .single();

    if (!wardRow?.push_token) {
      return json(
        {
          success: false,
          error:
            "This ward hasn't enabled notifications — ask them to start monitoring themselves this once.",
        },
        409,
      );
    }

    const pushResponse = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        to: wardRow.push_token,
        data: { type: "remote-start" },
        priority: "high",
        _contentAvailable: true,
      }),
    });

    if (!pushResponse.ok) {
      const detail = await pushResponse.text();
      console.error("[remote-start-session] Expo push send failed:", detail);
      return json(
        { success: false, error: "Failed to send the start request. Please try again." },
        502,
      );
    }

    // Expo's /send endpoint returns HTTP 200 even when the individual push
    // failed -- the real per-recipient result is nested in data.status.
    // Checking only pushResponse.ok reports false success (this is exactly
    // what happened testing this: Expo accepted the request with a 200
    // while data.status was "error" the whole time because this Expo
    // project has no FCM credentials configured yet).
    const pushBody = await pushResponse.json().catch(() => null);
    const ticket = pushBody?.data;
    if (ticket?.status === "error") {
      console.error("[remote-start-session] Expo push ticket error:", ticket);
      // A stale/uninstalled-app token specifically -- clear it so the next
      // attempt fails fast with the "enable notifications" message instead
      // of silently retrying a token that will never work again.
      if (ticket.details?.error === "DeviceNotRegistered") {
        await db.from("users").update({ push_token: null }).eq("id", wardId);
      }
      return json(
        {
          success: false,
          error:
            "Couldn't deliver the start request to their phone. Push notifications aren't fully set up for this app yet.",
        },
        502,
      );
    }

    return json({ success: true });
  } catch (err) {
    console.error("[remote-start-session] unexpected error:", err);
    return json({ success: false, error: "Something went wrong. Please try again." }, 500);
  }
});
