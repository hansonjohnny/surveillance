// Supabase Edge Function -- create-ward-account
//
// Lets a guardian provision a brand-new account for a ward, the way
// adding a family member works in iCloud Family Sharing -- the guardian
// never sees or sets the ward's password. Uses the Auth admin API
// (service-role only, never available client-side) to create the
// account and send Supabase's built-in invite email in one call; the
// invite link reuses the app's existing password-reset deep link
// (surveillanceai://reset-password, reached via the confirm.html bridge
// page -- see CONFIRM_BRIDGE_URL below) since setting a password is the
// same operation whether the tokens arrived via recovery or invite --
// no new screen needed for the ward's first login.
//
// Default verify_jwt = true is correct here (no config.toml entry
// needed) -- unlike share-location/ack-alert, this is only ever called
// by a signed-in app user, not an anonymous link tap.
//
// POST { email: string }
//
// Deploy: supabase functions deploy create-ward-account

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Must match src/lib/supabase.ts's CONFIRM_BRIDGE_URL and be present in
// Supabase's Auth > URL Configuration redirect allowlist -- an unlisted
// redirectTo silently falls back to Site URL instead of erroring, which
// is what previously sent this invite link to http://localhost:3000.
const CONFIRM_BRIDGE_URL = "https://hansonjohnny.github.io/surveillance/confirm.html";

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

  // Verify the caller is a real signed-in user (this function's own
  // verify_jwt already rejects a missing/invalid JWT before this code
  // runs, but we still need *who* the guardian is).
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user: guardian },
  } = await db.auth.getUser(token);

  if (!guardian) {
    return json({ success: false, error: "Not signed in." }, 401);
  }

  try {
    const { email } = await req.json();
    const trimmed = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!trimmed) {
      return json({ success: false, error: "Email is required." }, 400);
    }

    if (trimmed === guardian.email?.toLowerCase()) {
      return json(
        { success: false, error: "You can't add yourself as a ward." },
        400,
      );
    }

    const { data, error: inviteError } = await db.auth.admin.inviteUserByEmail(
      trimmed,
      { redirectTo: CONFIRM_BRIDGE_URL },
    );

    if (inviteError || !data?.user) {
      const code = (inviteError as { code?: string } | undefined)?.code;
      console.error("[create-ward-account] inviteUserByEmail failed:", inviteError);

      // Supabase's built-in email sender (no custom SMTP configured)
      // allows only a handful of emails per hour -- every auth email this
      // project sends (password resets, invites, wellness) shares that
      // cap, so this is a real, recurring case worth its own message
      // rather than a generic one. Confirmed via a direct test against
      // /auth/v1/invite, which returned exactly this status/code.
      if (inviteError?.status === 429 || code === "over_email_send_rate_limit") {
        return json(
          {
            success: false,
            error:
              "Email sending is rate-limited right now (Supabase's default sender allows only a few emails per hour without custom SMTP configured). Try again in a few minutes.",
          },
          429,
        );
      }

      const alreadyExists =
        inviteError?.status === 422 ||
        /already registered|already exists/i.test(inviteError?.message ?? "");

      return json(
        {
          success: false,
          error: alreadyExists
            ? "This email already has an account — link it instead of creating a new one."
            : "Something went wrong. Please try again.",
        },
        alreadyExists ? 409 : 500,
      );
    }

    const { error: linkError } = await db.from("guardian_links").insert({
      guardian_id: guardian.id,
      ward_id: data.user.id,
      ward_email: trimmed,
      status: "active",
    });

    if (linkError) {
      console.error("[create-ward-account] guardian_links insert failed:", linkError);
      return json(
        { success: false, error: "Account created, but linking it failed. Please try linking it manually." },
        500,
      );
    }

    return json({ success: true });
  } catch (err) {
    console.error("[create-ward-account] unexpected error:", err);
    return json({ success: false, error: "Something went wrong. Please try again." }, 500);
  }
});
