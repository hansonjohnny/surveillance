// Alert pipeline — fires SMS, email, and (conditionally) phone call when a
// high-risk event is detected. All three channels call Supabase Edge Functions
// so API keys never reach the client bundle.

import type { Alert, Contact, Event } from "../types";
import { useAlertStore } from "../store/useAlertStore";
import { supabase } from "./supabase";
import { formatAddress } from "./location";

// ─── Channel helpers ─────────────────────────────────────────────────────────

export async function sendSMS(to: string, message: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("send-sms", {
      body: { to, message },
    });
    if (error) throw error;
    return data?.success === true;
  } catch (err) {
    console.error("[alerts] sendSMS failed:", err);
    return false;
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  contactName: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: { to, subject, body, contactName },
    });
    if (error) throw error;
    return data?.success === true;
  } catch (err) {
    console.error("[alerts] sendEmail failed:", err);
    return false;
  }
}

export async function makeCall(to: string, message: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("make-call", {
      body: { to, message },
    });
    if (error) throw error;
    return data?.success === true;
  } catch (err) {
    console.error("[alerts] makeCall failed:", err);
    return false;
  }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export async function triggerAlert(event: Event, contact: Contact): Promise<void> {
  try {
  // Deduplicate — if an alert for this event was already fired, bail out.
  const existingAlerts = useAlertStore.getState().alerts;
  if (existingAlerts.some((a) => a.eventId === event.id)) {
    console.log("[alerts] duplicate event, skipping:", event.id);
    return;
  }

  const timestamp = new Date(event.timestamp).toLocaleString();
  const mapsLink = event.location
    ? `https://maps.google.com/?q=${event.location.lat},${event.location.lng}`
    : "Location unavailable";
  const humanAddress =
    event.location?.address ? formatAddress(event.location.address) : null;

  // ── SMS ──────────────────────────────────────────────────────────────────
  const smsMessage =
    `SAFETY ALERT: ${contact.name} may need help.\n` +
    (humanAddress ? `Address: ${humanAddress}\n` : "") +
    `Map: ${mapsLink}\n` +
    `AI detected: ${event.aiSummary}\n` +
    `Time: ${timestamp}`;

  // ── Email ─────────────────────────────────────────────────────────────────
  const emailSubject = `Safety Alert - ${contact.name} may need help`;
  const emailBody =
    `SURVEILLANCE AI - SAFETY ALERT\n` +
    `${"=".repeat(40)}\n\n` +
    `Someone you care about may be in danger.\n\n` +
    `DETAILS\n` +
    `-------\n` +
    `Person: ${contact.name}\n` +
    `Time: ${timestamp}\n` +
    `Risk Level: HIGH\n\n` +
    `LOCATION\n` +
    `--------\n` +
    (humanAddress ? `Address: ${humanAddress}\n` : "") +
    (event.location
      ? `Coordinates: ${event.location.lat}, ${event.location.lng}\n`
      : "") +
    `Map: ${mapsLink}\n` +
    (event.location?.address?.name ? `Name: ${event.location.address.name}\n` : "") +
    (event.location?.address?.street
      ? `Street: ${[event.location.address.streetNumber, event.location.address.street].filter(Boolean).join(" ")}\n`
      : "") +
    (event.location?.address?.district ? `District: ${event.location.address.district}\n` : "") +
    (event.location?.address?.city ? `City: ${event.location.address.city}\n` : "") +
    (event.location?.address?.subregion ? `Subregion: ${event.location.address.subregion}\n` : "") +
    (event.location?.address?.region ? `Region: ${event.location.address.region}\n` : "") +
    (event.location?.address?.postalCode ? `Postal Code: ${event.location.address.postalCode}\n` : "") +
    (event.location?.address?.country ? `Country: ${event.location.address.country} (${event.location.address.isoCountryCode})\n` : "") +
    `\nAI ANALYSIS\n` +
    `-----------\n` +
    `${event.aiSummary}\n` +
    (event.transcript ? `\nTranscript: ${event.transcript}\n` : "") +
    `\nTRIGGER\n` +
    `-------\n` +
    `Source: ${event.source ?? "AI analysis"}\n\n` +
    `${"=".repeat(40)}\n` +
    `This alert was generated automatically by Surveillance AI.\n` +
    `If this is a false alarm, please contact ${contact.name} directly.`;

  // ── Call message ──────────────────────────────────────────────────────────
  const callMessage =
    `Emergency alert. ${contact.name} may need help. ` +
    `The Surveillance AI app has detected a high risk situation. ` +
    `${event.aiSummary}. ` +
    `Please check on ${contact.name} immediately.`;

  // ── Fire channels in parallel ─────────────────────────────────────────────
  // A phone call is placed only when the event was triggered by a shake
  // (shake alone or shake combined with a high AI score). An AI-only high
  // score sends SMS and email but does not call — to avoid false-positive calls.
  const isShakeEvent = event.source?.includes("shake") ?? false;

  const channelPromises: Promise<boolean>[] = [
    sendSMS(contact.phone, smsMessage),
    sendEmail(contact.email, emailSubject, emailBody, contact.name),
  ];

  if (isShakeEvent) {
    channelPromises.push(makeCall(contact.phone, callMessage));
  }

  const [smsSent, emailSent, callMade = false] = await Promise.all(channelPromises);

  console.log(
    `[alerts] event=${event.id} sms=${smsSent} email=${emailSent} call=${callMade}`,
  );

  // ── Persist to store + Supabase ───────────────────────────────────────────
  const alert: Alert = {
    id: crypto.randomUUID(),
    eventId: event.id,
    timestamp: Date.now(),
    contactName: contact.name,
    smsSent,
    emailSent,
    callMade,
    aiSummary: event.aiSummary,
    location: event.location,
  };

  await useAlertStore.getState().addAlert(alert);
  } catch (err) {
    console.error("[alerts] triggerAlert failed:", err);
  }
}
