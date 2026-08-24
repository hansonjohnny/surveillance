// Escalating contact chain — if the primary contact never taps the
// acknowledge link in a High-risk alert (see lib/alerts.ts) within the
// escalation window, notify the backup contact configured in Settings.
//
// Runs from two places: tasks/escalationTask.ts (background, coarse
// ~5min-at-best cadence) and an AppState "active" listener in
// app/_layout.tsx (foreground, for a snappier check). Both call the same
// checkEscalations() below.
//
// Deliberately reads/writes AsyncStorage directly instead of going through
// useAlertStore/useSettingsStore — mirrors the same precaution already
// taken in tasks/wellnessTask.ts: a background-launched JS context may not
// have finished hydrating a Zustand store yet, and calling a store action
// on an unhydrated store would persist empty/default state over the real
// data. Reading the raw AsyncStorage keys is safe in both contexts.

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Alert } from "../types";
import { sendEmail, sendSMS } from "./alerts";
import { getGoogleMapsLink } from "./location";
import { supabase } from "./supabase";

const ALERTS_STORAGE_KEY = "@surveillance_ai/alerts";
const SETTINGS_STORAGE_KEY = "@surveillance_ai/settings";

export const ESCALATION_DELAY_MS = 10 * 60 * 1000;

type PersistedAlertsState = { alerts: Alert[] };
type PersistedSettingsState = {
  backupContactName: string;
  backupContactPhone: string;
  backupContactEmail: string;
};

async function readPersistedState<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw).state as T;
  } catch (err) {
    console.error(`[escalation] Failed to read ${key}:`, err);
    return null;
  }
}

// Patches one alert's escalation fields directly in the persisted
// AsyncStorage JSON (zustand's { state, version } shape) — a fresh
// read-modify-write, safe regardless of whether the live store has hydrated.
async function updateLocalAlert(
  alertId: string,
  patch: Partial<Pick<Alert, "acknowledgedAt" | "escalatedAt" | "backupContactName">>,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(ALERTS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const state: PersistedAlertsState = parsed.state;
    parsed.state = {
      ...state,
      alerts: state.alerts.map((a) =>
        a.id === alertId ? { ...a, ...patch } : a,
      ),
    };
    await AsyncStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(parsed));
  } catch (err) {
    console.error("[escalation] Failed to patch local alert:", err);
  }
}

function buildEscalationMessages(alert: Alert) {
  const mapsLink = alert.location
    ? getGoogleMapsLink(alert.location.lat, alert.location.lng)
    : "Location unavailable";
  const timestamp = new Date(alert.timestamp).toLocaleString();

  const smsMessage =
    `ESCALATION: ${alert.contactName} did not confirm a safety alert. ` +
    `AI detected: ${alert.aiSummary}. Map: ${mapsLink}. Time: ${timestamp}`;

  const emailSubject = `Escalated Safety Alert — ${alert.contactName} has not responded`;
  const emailBody =
    `SURVEILLANCE AI — ESCALATED ALERT\n${"=".repeat(40)}\n\n` +
    `${alert.contactName} was notified about a High-risk event and has not ` +
    `confirmed they've seen it, so you're being notified as the backup contact.\n\n` +
    `AI ANALYSIS\n-----------\n${alert.aiSummary}\n\n` +
    `LOCATION\n--------\n${mapsLink}\n\n` +
    `Original alert time: ${timestamp}\n\n` +
    `${"=".repeat(40)}\nThis alert was generated automatically by Surveillance AI.`;

  return { smsMessage, emailSubject, emailBody };
}

export async function checkEscalations(): Promise<void> {
  try {
    const alertsState = await readPersistedState<PersistedAlertsState>(
      ALERTS_STORAGE_KEY,
    );
    const settings = await readPersistedState<PersistedSettingsState>(
      SETTINGS_STORAGE_KEY,
    );

    const backupPhone = settings?.backupContactPhone;
    const backupEmail = settings?.backupContactEmail;
    if (!backupPhone || !backupEmail) return; // no backup contact configured
    const backupName = settings?.backupContactName || "Backup Contact";

    const now = Date.now();
    const candidates = (alertsState?.alerts ?? []).filter(
      (a) => !a.escalatedAt && now - a.timestamp >= ESCALATION_DELAY_MS,
    );

    for (const alert of candidates) {
      // Supabase is the source of truth for acknowledged_at — the tap
      // happens in the contact's own browser, which only Supabase knows about.
      const { data, error } = await supabase
        .from("alerts")
        .select("acknowledged_at, escalated_at, backup_contact_name")
        .eq("id", alert.id)
        .maybeSingle();

      if (error || !data) {
        console.error(
          "[escalation] Failed to check alert status:",
          error?.message,
        );
        continue;
      }

      if (data.acknowledged_at || data.escalated_at) {
        // Already resolved — by the contact, or by an earlier check that
        // succeeded in Supabase but didn't get to patch local state (e.g.
        // the app was killed mid-run). Just sync it down.
        await updateLocalAlert(alert.id, {
          acknowledgedAt: data.acknowledged_at
            ? new Date(data.acknowledged_at).getTime()
            : null,
          escalatedAt: data.escalated_at
            ? new Date(data.escalated_at).getTime()
            : null,
          backupContactName: data.backup_contact_name,
        });
        continue;
      }

      const { smsMessage, emailSubject, emailBody } =
        buildEscalationMessages(alert);
      const [smsSent, emailSent] = await Promise.all([
        sendSMS(backupPhone, smsMessage),
        sendEmail(backupEmail, emailSubject, emailBody, backupName),
      ]);

      if (!smsSent && !emailSent) {
        console.warn(
          "[escalation] Both channels failed for alert",
          alert.id,
          "— will retry next check",
        );
        continue;
      }

      const escalatedAtIso = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("alerts")
        .update({ escalated_at: escalatedAtIso, backup_contact_name: backupName })
        .eq("id", alert.id);

      if (updateError) {
        console.error(
          "[escalation] Failed to record escalation in Supabase:",
          updateError.message,
        );
      }

      await updateLocalAlert(alert.id, {
        escalatedAt: new Date(escalatedAtIso).getTime(),
        backupContactName: backupName,
      });

      console.log(
        "[escalation] Escalated alert",
        alert.id,
        "to backup contact",
        backupName,
      );
    }
  } catch (err) {
    console.error("[escalation] checkEscalations failed:", err);
  }
}
