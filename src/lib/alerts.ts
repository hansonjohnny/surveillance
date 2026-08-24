// Alert pipeline — fires SMS, email, and (conditionally) phone call when a
// high-risk event is detected. All three channels call Supabase Edge Functions
// so API keys never reach the client bundle.

import { useAlertStore } from "../store/useAlertStore";
import { useOfflineQueueStore } from "../store/useOfflineQueueStore";
import type { Alert, Contact, Event, QueuedAlert } from "../types";
import { generateUUID } from "./id";
import { formatAddress } from "./location";
import { isOnline } from "./network";
import { supabase } from "./supabase";

// supabase.functions.invoke() throws a generic "non-2xx" error that hides the
// actual { success:false, error } body the edge function returned — pull the
// real reason out of the response so failures are diagnosable from logs.
async function logFunctionError(label: string, err: unknown): Promise<void> {
  const context = (err as { context?: Response })?.context;
  if (context && typeof context.json === "function") {
    try {
      console.error(`[alerts] ${label}:`, await context.json());
      return;
    } catch {
      // fall through to generic logging below
    }
  }
  console.error(`[alerts] ${label}:`, err);
}

// ─── Channel helpers ─────────────────────────────────────────────────────────

export async function sendSMS(to: string, message: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("send-sms", {
      body: { to, message },
    });
    if (error) throw error;
    // "success" only means Arkesel accepted the request — log the
    // per-recipient submission id/status so delivery can be cross-checked
    // against the Arkesel dashboard.
    console.log("[alerts] sendSMS accepted:", data?.detail);
    return data?.success === true;
  } catch (err) {
    await logFunctionError("sendSMS failed", err);
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
    await logFunctionError("sendEmail failed", err);
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
    await logFunctionError("makeCall failed", err);
    return false;
  }
}

// ─── Message builder ────────────────────────────────────────────────────────

function buildAlertMessages(event: Event, contact: Contact, alertId: string) {
  const timestamp = new Date(event.timestamp).toLocaleString();
  const mapsLink = event.location
    ? `https://maps.google.com/?q=${event.location.lat},${event.location.lng}`
    : "Location unavailable";
  const humanAddress = event.location?.address
    ? formatAddress(event.location.address)
    : null;
  const ackUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ack-alert?alertId=${alertId}`;

  // ── SMS ──────────────────────────────────────────────────────────────────
  const smsMessage =
    `SAFETY ALERT: ${contact.name} may need help.\n` +
    (humanAddress ? `Address: ${humanAddress}\n` : "") +
    `Map: ${mapsLink}\n` +
    `AI detected: ${event.aiSummary}\n` +
    `Time: ${timestamp}\n` +
    `Seen this? Tap to confirm: ${ackUrl}`;

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
    (event.location?.address?.name
      ? `Name: ${event.location.address.name}\n`
      : "") +
    (event.location?.address?.street
      ? `Street: ${[event.location.address.streetNumber, event.location.address.street].filter(Boolean).join(" ")}\n`
      : "") +
    (event.location?.address?.district
      ? `District: ${event.location.address.district}\n`
      : "") +
    (event.location?.address?.city
      ? `City: ${event.location.address.city}\n`
      : "") +
    (event.location?.address?.subregion
      ? `Subregion: ${event.location.address.subregion}\n`
      : "") +
    (event.location?.address?.region
      ? `Region: ${event.location.address.region}\n`
      : "") +
    (event.location?.address?.postalCode
      ? `Postal Code: ${event.location.address.postalCode}\n`
      : "") +
    (event.location?.address?.country
      ? `Country: ${event.location.address.country} (${event.location.address.isoCountryCode})\n`
      : "") +
    `\nAI ANALYSIS\n` +
    `-----------\n` +
    `${event.aiSummary}\n` +
    (event.transcript ? `\nTranscript: ${event.transcript}\n` : "") +
    `\nTRIGGER\n` +
    `-------\n` +
    `Source: ${event.source ?? "AI analysis"}\n\n` +
    `Acknowledge this alert: ${ackUrl}\n` +
    `(If we don't hear from you within 10 minutes, we'll also notify the backup contact.)\n\n` +
    `${"=".repeat(40)}\n` +
    `This alert was generated automatically by Surveillance AI.\n` +
    `If this is a false alarm, please contact ${contact.name} directly.`;

  // ── Call message ──────────────────────────────────────────────────────────
  const callMessage =
    `Emergency alert. ${contact.name} may need help. ` +
    `The Surveillance AI app has detected a high risk situation. ` +
    `${event.aiSummary}. ` +
    `Please check on ${contact.name} immediately.`;

  return { smsMessage, emailSubject, emailBody, callMessage };
}

// ─── Channel sender ─────────────────────────────────────────────────────────
// A phone call is placed only for the highest-confidence triggers — a shake
// event (alone or combined with a high AI score) or a manual SOS. An AI-only
// high score sends SMS and email but does not call — to avoid false-positive
// calls.

async function sendAlertChannels(
  event: Event,
  contact: Contact,
  isUrgent: boolean,
  alertId: string,
): Promise<{ smsSent: boolean; emailSent: boolean; callMade: boolean }> {
  const { smsMessage, emailSubject, emailBody, callMessage } =
    buildAlertMessages(event, contact, alertId);

  const channelPromises: Promise<boolean>[] = [
    sendSMS(contact.phone, smsMessage),
    sendEmail(contact.email, emailSubject, emailBody, contact.name),
  ];

  if (isUrgent) {
    channelPromises.push(makeCall(contact.phone, callMessage));
  }

  const [smsSent, emailSent, callMade = false] =
    await Promise.all(channelPromises);

  return { smsSent, emailSent, callMade };
}

// A channel result counts as fully delivered only if every channel that
// should have fired for this event actually succeeded.
function isFullyDelivered(
  result: { smsSent: boolean; emailSent: boolean; callMade: boolean },
  isUrgent: boolean,
): boolean {
  return result.smsSent && result.emailSent && (!isUrgent || result.callMade);
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export async function triggerAlert(
  event: Event,
  contact: Contact,
): Promise<void> {
  try {
    // Deduplicate — if an alert for this event was already fired, bail out.
    const existingAlerts = useAlertStore.getState().alerts;
    if (existingAlerts.some((a) => a.eventId === event.id)) {
      console.log("[alerts] duplicate event, skipping:", event.id);
      return;
    }

    const isUrgent =
      event.source === "manual" || (event.source?.includes("shake") ?? false);

    // Generated up front (not after sending) so the ack link embedded in
    // the SMS/email body points at this alert's real id.
    const alertId = generateUUID();

    const online = await isOnline();
    if (!online) {
      console.warn(
        "[alerts] device offline — queueing alert for retry:",
        event.id,
      );
    }

    const channelResult = online
      ? await sendAlertChannels(event, contact, isUrgent, alertId)
      : { smsSent: false, emailSent: false, callMade: false };

    console.log(
      `[alerts] event=${event.id} sms=${channelResult.smsSent} email=${channelResult.emailSent} call=${channelResult.callMade}`,
    );

    // ── Persist to store + Supabase ───────────────────────────────────────────
    const alert: Alert = {
      id: alertId,
      eventId: event.id,
      timestamp: Date.now(),
      contactName: contact.name,
      ...channelResult,
      aiSummary: event.aiSummary,
      location: event.location,
      acknowledgedAt: null,
      escalatedAt: null,
      backupContactName: null,
    };

    useAlertStore.getState().addAlertLocal(alert);
    const supabaseSynced = online
      ? await useAlertStore.getState().syncAlertToSupabase(alert.id)
      : false;

    const channelsSent = isFullyDelivered(channelResult, isUrgent);

    if (!channelsSent || !supabaseSynced) {
      useOfflineQueueStore.getState().enqueue({
        id: generateUUID(),
        alertId: alert.id,
        event,
        contact,
        isUrgent,
        channelsSent,
        supabaseSynced,
        attempts: 0,
        createdAt: Date.now(),
      });
    }
  } catch (err) {
    console.error("[alerts] triggerAlert failed:", err);
  }
}

// Retries whatever part of a queued alert didn't complete last time — the
// channel sends, the Supabase sync, or both. Called by the offline queue
// processor once connectivity returns.
export async function retryQueuedAlert(
  item: QueuedAlert,
): Promise<{ channelsSent: boolean; supabaseSynced: boolean }> {
  let channelsSent = item.channelsSent;
  let supabaseSynced = item.supabaseSynced;

  if (!channelsSent) {
    const result = await sendAlertChannels(
      item.event,
      item.contact,
      item.isUrgent,
      item.alertId,
    );
    channelsSent = isFullyDelivered(result, item.isUrgent);
    useAlertStore.getState().updateAlert(item.alertId, result);
    console.log(
      `[alerts] retry event=${item.event.id} sms=${result.smsSent} email=${result.emailSent} call=${result.callMade}`,
    );
  }

  if (!supabaseSynced) {
    supabaseSynced = await useAlertStore
      .getState()
      .syncAlertToSupabase(item.alertId);
  }

  return { channelsSent, supabaseSynced };
}
