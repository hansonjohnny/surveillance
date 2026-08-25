// Guardian-Ward monitoring (Phase 2) — inviting a ward, listing linked
// wards, and reading a ward's live status/event log/alert history.
//
// A guardian's phone has no local copy of a ward's sensor data — unlike
// every other screen in this app (which reads useSessionStore/useAlertStore,
// backed by the device's own AsyncStorage), everything here comes straight
// from Supabase, scoped by the RLS policies added in
// supabase/migrations/009_guardian_links.sql.

import type { Alert, Event, Location } from "../types";
import { supabase } from "./supabase";

export type WardLink = {
  id: string;
  wardId: string;
  wardEmail: string | null;
  createdAt: number;
};

export type WardSnapshot = {
  session: {
    id: string;
    lastLocation: Location | null;
    lastLocationAt: number | null;
    active: boolean;
  } | null;
  events: Event[];
  alerts: Alert[];
};

const RECENT_LIMIT = 30;

// ─── Inviting / managing links ─────────────────────────────────────────────

export async function inviteWard(
  email: string,
): Promise<{ success: boolean; error?: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) {
    return { success: false, error: "Enter an email address." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not signed in." };
  }

  const { data: wardId, error: rpcError } = await supabase.rpc(
    "find_user_id_by_email",
    { lookup_email: trimmed },
  );

  if (rpcError) {
    console.error("[guardian] find_user_id_by_email failed:", rpcError.message);
    return { success: false, error: "Something went wrong. Please try again." };
  }

  if (!wardId) {
    return {
      success: false,
      error: "No Surveillance AI account found for that email.",
    };
  }

  if (wardId === user.id) {
    return { success: false, error: "You can't add yourself as a ward." };
  }

  const { error } = await supabase.from("guardian_links").insert({
    guardian_id: user.id,
    ward_id: wardId,
    ward_email: trimmed,
  });

  if (error) {
    // Postgres unique_violation — a link between these two already exists.
    if (error.code === "23505") {
      return { success: false, error: "You're already monitoring this person." };
    }
    console.error("[guardian] inviteWard insert failed:", error.message);
    return { success: false, error: "Something went wrong. Please try again." };
  }

  return { success: true };
}

export async function listWards(): Promise<WardLink[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // guardian_links' SELECT policy allows rows where you're either party —
  // filter to guardian_id = you specifically, since this is "wards I
  // monitor," not every link that mentions you.
  const { data, error } = await supabase
    .from("guardian_links")
    .select("id, ward_id, ward_email, created_at")
    .eq("guardian_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[guardian] listWards failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    wardId: row.ward_id,
    wardEmail: row.ward_email,
    createdAt: new Date(row.created_at).getTime(),
  }));
}

export async function revokeWardLink(linkId: string): Promise<void> {
  const { error } = await supabase
    .from("guardian_links")
    .delete()
    .eq("id", linkId);

  if (error) {
    console.error("[guardian] revokeWardLink failed:", error.message);
  }
}

// ─── Reading a ward's data ──────────────────────────────────────────────────

// events.photo_url and (were it added) an audio file path are the ward's own
// device's local file:// URIs — never uploaded anywhere, so never
// resolvable from a guardian's device. Map them to null rather than point
// <Image>/the audio player at a path that only exists on someone else's
// phone. audio_summary and transcript are real synced text, kept as-is.
function mapEvent(row: {
  id: string;
  session_id: string;
  timestamp: string;
  risk_level: "low" | "medium" | "high";
  ai_summary: string | null;
  audio_summary: string | null;
  transcript: string | null;
  latitude: number | null;
  longitude: number | null;
}): Event {
  return {
    id: row.id,
    sessionId: row.session_id,
    timestamp: new Date(row.timestamp).getTime(),
    riskLevel: row.risk_level,
    aiSummary: row.ai_summary ?? "",
    audioSummary: row.audio_summary,
    audioUri: null,
    photoUri: null,
    transcript: row.transcript,
    location:
      row.latitude != null && row.longitude != null
        ? { lat: row.latitude, lng: row.longitude }
        : null,
  };
}

function mapAlert(row: {
  id: string;
  event_id: string;
  timestamp: string;
  contact_name: string | null;
  sms_sent: boolean;
  email_sent: boolean;
  call_made: boolean;
  ai_summary: string | null;
  latitude: number | null;
  longitude: number | null;
  acknowledged_at: string | null;
  escalated_at: string | null;
  backup_contact_name: string | null;
}): Alert {
  return {
    id: row.id,
    eventId: row.event_id,
    timestamp: new Date(row.timestamp).getTime(),
    contactName: row.contact_name ?? "",
    smsSent: row.sms_sent,
    emailSent: row.email_sent,
    callMade: row.call_made,
    aiSummary: row.ai_summary ?? "",
    location:
      row.latitude != null && row.longitude != null
        ? { lat: row.latitude, lng: row.longitude }
        : null,
    acknowledgedAt: row.acknowledged_at
      ? new Date(row.acknowledged_at).getTime()
      : null,
    escalatedAt: row.escalated_at ? new Date(row.escalated_at).getTime() : null,
    backupContactName: row.backup_contact_name,
  };
}

export async function fetchWardSnapshot(wardId: string): Promise<WardSnapshot> {
  const [sessionResult, eventsResult, alertsResult] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, last_lat, last_lng, last_location_at, ended_at")
      .eq("user_id", wardId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("events")
      .select(
        "id, session_id, timestamp, risk_level, ai_summary, audio_summary, transcript, latitude, longitude",
      )
      .eq("user_id", wardId)
      .order("timestamp", { ascending: false })
      .limit(RECENT_LIMIT),
    supabase
      .from("alerts")
      .select(
        "id, event_id, timestamp, contact_name, sms_sent, email_sent, call_made, ai_summary, latitude, longitude, acknowledged_at, escalated_at, backup_contact_name",
      )
      .eq("user_id", wardId)
      .order("timestamp", { ascending: false })
      .limit(RECENT_LIMIT),
  ]);

  if (sessionResult.error) {
    console.error(
      "[guardian] fetchWardSnapshot session failed:",
      sessionResult.error.message,
    );
  }
  if (eventsResult.error) {
    console.error(
      "[guardian] fetchWardSnapshot events failed:",
      eventsResult.error.message,
    );
  }
  if (alertsResult.error) {
    console.error(
      "[guardian] fetchWardSnapshot alerts failed:",
      alertsResult.error.message,
    );
  }

  const sessionRow = sessionResult.data;

  return {
    session: sessionRow
      ? {
          id: sessionRow.id,
          lastLocation:
            sessionRow.last_lat != null && sessionRow.last_lng != null
              ? { lat: sessionRow.last_lat, lng: sessionRow.last_lng }
              : null,
          lastLocationAt: sessionRow.last_location_at
            ? new Date(sessionRow.last_location_at).getTime()
            : null,
          active: sessionRow.ended_at === null,
        }
      : null,
    events: (eventsResult.data ?? []).map(mapEvent),
    alerts: (alertsResult.data ?? []).map(mapAlert),
  };
}
