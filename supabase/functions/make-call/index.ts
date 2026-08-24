// Supabase Edge Function -- make-call
//
// Places an automated voice call via Arkesel's OTP "voice" medium, which
// reads an arbitrary text message aloud using text-to-speech. Arkesel has no
// general-purpose voice API for arbitrary text, so this reuses the OTP
// generate endpoint -- the generated code is appended to (and ignored in) the
// message, since the endpoint requires a %otp_code% slot.
// Secrets required (set via `supabase secrets set`):
//   ARKESEL_API_KEY (must be the main SMS API key -- OTP does not work with
//   Multiple API Keys)
//   ARKESEL_SENDER_ID
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
    const senderId = Deno.env.get("ARKESEL_SENDER_ID");

    if (!apiKey || !senderId) {
      console.error("[make-call] Missing Arkesel secrets");
      return json({ success: false, error: "Arkesel not configured" }, 500);
    }

    // Arkesel's OTP/voice message must be 10-145 characters total, including
    // the required %otp_code% slot we append below.
    const SUFFIX = " Reference code %otp_code%.";
    const maxBodyLength = 145 - SUFFIX.length;
    const trimmedMessage =
      message.length > maxBodyLength
        ? message.slice(0, maxBodyLength)
        : message;

    const response = await fetch("https://sms.arkesel.com/api/otp/generate", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expiry: 5,
        length: 6,
        medium: "voice",
        message: `${trimmedMessage}${SUFFIX}`,
        number: normalizePhone(to),
        sender_id: senderId,
        type: "numeric",
      }),
    });

    const result = await response.json();

    if (!response.ok || result?.code !== "1000") {
      console.error("[make-call] Arkesel error:", result);
      return json(
        { success: false, error: "Arkesel request failed", detail: result },
        502,
      );
    }

    return json({ success: true });
  } catch (err) {
    console.error("[make-call] unexpected error:", err);
    return json({ success: false, error: "Internal error" }, 500);
  }
});
