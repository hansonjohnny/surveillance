// Supabase Edge Function -- send-email
//
// Sends a safety alert email via SendGrid API.
// Secrets required (set via `supabase secrets set`):
//   SENDGRID_API_KEY
//   SENDGRID_FROM_EMAIL  (verified sender address, e.g. alerts@yourdomain.com)
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

    const apiKey = Deno.env.get("SENDGRID_API_KEY");
    const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL") ?? "alerts@surveillanceai.app";

    if (!apiKey) {
      console.error("[send-email] Missing SENDGRID_API_KEY");
      return json({ success: false, error: "SendGrid not configured" }, 500);
    }

    const payload = {
      personalizations: [
        {
          to: [{ email: to, name: contactName ?? undefined }],
          subject,
        },
      ],
      from: { email: fromEmail, name: "Surveillance AI" },
      content: [{ type: "text/plain", value: body }],
    };

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // SendGrid returns 202 Accepted on success (no body)
    if (response.status !== 202) {
      const err = await response.text();
      console.error("[send-email] SendGrid error:", err);
      return json({ success: false, error: "SendGrid request failed" }, 502);
    }

    return json({ success: true });
  } catch (err) {
    console.error("[send-email] unexpected error:", err);
    return json({ success: false, error: "Internal error" }, 500);
  }
});
