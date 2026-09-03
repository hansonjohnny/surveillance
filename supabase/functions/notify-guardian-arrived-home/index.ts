// Supabase Edge Function -- notify-guardian-arrived-home
//
// Called by the ward's own device (tasks/geofenceTask.ts) the moment
// their home geofence fires an Enter event during an active session.
// Pushes every linked, active guardian a reassuring "arrived home
// safely" notification -- the inverse direction of remote-start-session/
// remote-stop-session (guardian -> ward), same push mechanism.
//
// A ward can have more than one linked guardian (guardian_links has no
// uniqueness constraint on ward_id alone, only on the (guardian_id,
// ward_id) pair) -- notify all of them, not just one.
//
// POST (no body needed -- the caller's own auth identifies the ward)
//
// Deploy: supabase functions deploy notify-guardian-arrived-home

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
    data: { user: ward },
  } = await db.auth.getUser(token);

  if (!ward) {
    return json({ success: false, error: "Not signed in." }, 401);
  }

  try {
    const { data: links } = await db
      .from("guardian_links")
      .select("guardian_id")
      .eq("ward_id", ward.id)
      .eq("status", "active");

    if (!links || links.length === 0) {
      // Not an error -- a self-monitoring account with no linked
      // guardian has nobody to notify. Nothing to do.
      return json({ success: true, notified: 0 });
    }

    const { data: guardianRows } = await db
      .from("users")
      .select("push_token")
      .in(
        "id",
        links.map((l) => l.guardian_id),
      );

    const tokens = (guardianRows ?? [])
      .map((r) => r.push_token)
      .filter((t): t is string => !!t);

    if (tokens.length === 0) {
      return json({ success: true, notified: 0 });
    }

    const wardLabel =
      (ward.user_metadata?.display_name as string | undefined) ??
      ward.email ??
      "Your ward";

    await Promise.all(
      tokens.map((to) =>
        fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            to,
            title: "🏠 Arrived home",
            body: `${wardLabel} arrived home safely.`,
            priority: "high",
          }),
        }).catch((err) => console.error("[notify-guardian-arrived-home] push failed:", err)),
      ),
    );

    return json({ success: true, notified: tokens.length });
  } catch (err) {
    console.error("[notify-guardian-arrived-home] unexpected error:", err);
    return json({ success: false, error: "Something went wrong." }, 500);
  }
});
