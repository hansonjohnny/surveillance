// Supabase Edge Function -- cleanup-old-media
//
// Retention sweep for the event-media Storage bucket. Since
// lib/monitoring.ts now uploads every non-covered photo/audio clip
// regardless of risk level (not just Medium/High), storage would grow
// unbounded without this -- deletes the actual Storage objects for
// events older than RETENTION_DAYS and clears their storage-path columns.
// The event row itself (timestamp, AI summary, transcript, risk level)
// is kept forever -- only the heavier media is purged, so the Event Log
// still reads as a full history, just without old photos/audio attached.
//
// Triggered opportunistically from the client (see app/_layout.tsx),
// at most once a day, by any signed-in user -- this is a global sweep,
// not scoped to the caller's own data, so who triggers it doesn't matter
// beyond "someone with a valid session opened the app."
//
// Deploy: supabase functions deploy cleanup-old-media

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

const RETENTION_DAYS = 30;
// Caps how many events one sweep handles -- opportunistic daily triggers
// catch up over a few days on a large backlog rather than one run trying
// to process everything and timing out.
const BATCH_LIMIT = 200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
  } = await db.auth.getUser(token);

  if (!user) {
    return json({ success: false, error: "Not signed in." }, 401);
  }

  try {
    const cutoff = new Date(
      Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: rows, error: selectError } = await db
      .from("events")
      .select("id, photo_storage_path, audio_storage_path")
      .lt("timestamp", cutoff)
      .or("photo_storage_path.not.is.null,audio_storage_path.not.is.null")
      .limit(BATCH_LIMIT);

    if (selectError) {
      console.error("[cleanup-old-media] select failed:", selectError.message);
      return json({ success: false, error: "Something went wrong." }, 500);
    }

    if (!rows || rows.length === 0) {
      return json({ success: true, cleaned: 0 });
    }

    const paths = rows.flatMap((row) =>
      [row.photo_storage_path, row.audio_storage_path].filter(
        (p): p is string => typeof p === "string",
      ),
    );

    if (paths.length > 0) {
      const { error: removeError } = await db.storage
        .from("event-media")
        .remove(paths);
      if (removeError) {
        console.error(
          "[cleanup-old-media] storage remove failed:",
          removeError.message,
        );
        return json({ success: false, error: "Something went wrong." }, 500);
      }
    }

    const ids = rows.map((row) => row.id);
    const { error: updateError } = await db
      .from("events")
      .update({ photo_storage_path: null, audio_storage_path: null })
      .in("id", ids);

    if (updateError) {
      console.error(
        "[cleanup-old-media] clearing storage paths failed:",
        updateError.message,
      );
      return json({ success: false, error: "Something went wrong." }, 500);
    }

    return json({ success: true, cleaned: rows.length });
  } catch (err) {
    console.error("[cleanup-old-media] unexpected error:", err);
    return json({ success: false, error: "Something went wrong." }, 500);
  }
});
