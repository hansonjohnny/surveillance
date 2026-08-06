// Supabase Edge Function -- make-call
//
// Places an automated voice call via Twilio Programmable Voice.
// The call reads the alert message aloud using TwiML <Say>.
// Secrets required (set via `supabase secrets set`):
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_PHONE_NUMBER
//
// Deploy: supabase functions deploy make-call

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

// Builds a TwiML response that reads the message aloud twice, then hangs up.
function buildTwiml(message: string): string {
  // Escape any XML special characters in the message to keep TwiML valid.
  const safe = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">${safe}</Say>
  <Pause length="1"/>
  <Say voice="alice" language="en-US">${safe}</Say>
</Response>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { to, message } = await req.json();

    if (!to || !message) {
      return json({ success: false, error: "to and message are required" }, 400);
    }

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!accountSid || !authToken || !from) {
      console.error("[make-call] Missing Twilio secrets");
      return json({ success: false, error: "Twilio not configured" }, 500);
    }

    const credentials = btoa(`${accountSid}:${authToken}`);
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;

    const body = new URLSearchParams({
      To: to,
      From: from,
      Twiml: buildTwiml(message),
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[make-call] Twilio error:", err);
      return json({ success: false, error: "Twilio request failed" }, 502);
    }

    return json({ success: true });
  } catch (err) {
    console.error("[make-call] unexpected error:", err);
    return json({ success: false, error: "Internal error" }, 500);
  }
});
