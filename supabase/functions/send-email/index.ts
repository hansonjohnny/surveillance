// Supabase Edge Function -- send-email
//
// Sends a safety alert email via the Resend API.
// Secrets required (set via `supabase secrets set`):
//   RESEND_API_KEY
//   ALERT_FROM_EMAIL  (verified sender address, e.g. alerts@yourdomain.com)
//
// Deploy: supabase functions deploy send-email

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { to, subject, body, contactName } = await req.json();

    if (!to || !subject || !body) {
      return json(
        { success: false, error: "to, subject, and body are required" },
        400,
      );
    }

    const apiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail =
      Deno.env.get("ALERT_FROM_EMAIL") ?? "alerts@surveillanceai.app";

    if (!apiKey) {
      console.error("[send-email] Missing RESEND_API_KEY");
      return json({ success: false, error: "Resend not configured" }, 500);
    }

    const payload = {
      from: `Surveillance AI <${fromEmail}>`,
      to: [to],
      subject,
      text: body,
    };

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("[send-email] Resend error:", result);
      return json(
        { success: false, error: "Resend request failed", detail: result },
        502,
      );
    }

    return json({ success: true });
  } catch (err) {
    console.error("[send-email] unexpected error:", err);
    return json({ success: false, error: "Internal error" }, 500);
  }
});
