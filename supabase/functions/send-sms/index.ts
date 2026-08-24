// Supabase Edge Function -- send-sms
//
// Sends an SMS via the Arkesel SMS V2 API.
// Secrets required (set via `supabase secrets set`):
//   ARKESEL_API_KEY
//   ARKESEL_SENDER_ID
//
// Deploy: supabase functions deploy send-sms

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

// Arkesel expects recipient numbers in international format without a leading '+'.
function normalizePhone(phone: string): string {
  return phone.replace(/^\+/, "").replace(/[^0-9]/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { to, message } = await req.json();

    if (!to || !message) {
      return json(
        { success: false, error: "to and message are required" },
        400,
      );
    }

    const apiKey = Deno.env.get("ARKESEL_API_KEY");
    const sender = Deno.env.get("ARKESEL_SENDER_ID");

    if (!apiKey || !sender) {
      console.error("[send-sms] Missing Arkesel secrets");
      return json({ success: false, error: "Arkesel not configured" }, 500);
    }

    const response = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender,
        message,
        recipients: [normalizePhone(to)],
      }),
    });

    const result = await response.json();

    if (!response.ok || result?.status !== "success") {
      console.error("[send-sms] Arkesel error:", result);
      return json(
        { success: false, error: "Arkesel request failed", detail: result },
        502,
      );
    }

    // result.data holds per-recipient submission info (id/status) — "success"
    // here only means Arkesel accepted the request, not that it was delivered.
    console.log("[send-sms] Arkesel accepted:", result?.data);
    return json({ success: true, detail: result?.data });
  } catch (err) {
    console.error("[send-sms] unexpected error:", err);
    return json({ success: false, error: "Internal error" }, 500);
  }
});
