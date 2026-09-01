// Guardian-Ward monitoring (Phase 2) — inviting a ward, listing linked
// wards, and reading a ward's live status/event log/alert history.
//
// A guardian's phone has no local copy of a ward's sensor data — unlike
// every other screen in this app (which reads useSessionStore/useAlertStore,
// backed by the device's own AsyncStorage), everything here comes straight
// from Supabase, scoped by the RLS policies added in
// supabase/migrations/009_guardian_links.sql.

import type { Alert, Event, Location } from "../types";
import { sendEmail } from "./alerts";
import { CONFIRM_BRIDGE_URL, logFunctionError, supabase } from "./supabase";

export type WardLink = {
  id: string;
  wardId: string;
  wardEmail: string | null;
  status: "pending" | "active";
  createdAt: number;
};

export type WardSnapshot = {
  session: {
    id: string;
    startedAt: number | null;
    lastLocation: Location | null;
    lastLocationAt: number | null;
    active: boolean;
  } | null;
  events: Event[];
  alerts: Alert[];
};

const RECENT_LIMIT = 30;

// ─── Adding a ward ──────────────────────────────────────────────────────────

// Provisions a brand-new account for someone who doesn't have one yet —
// the guardian never sees or sets the password. Activates immediately:
// setting the password via the invite email is itself the confirmation
// step, so no separate accept flow is needed here (contrast with
// inviteWard below).
export async function createWardAccount(
  email: string,
  backup: { name: string; phone: string; email: string },
): Promise<{ success: boolean; error?: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) {
    return { success: false, error: "Enter an email address." };
  }

  const { data, error } = await supabase.functions.invoke(
    "create-ward-account",
    {
      body: {
        email: trimmed,
        backupName: backup.name.trim(),
        backupPhone: backup.phone.trim(),
        backupEmail: backup.email.trim(),
      },
    },
  );

  if (error) {
    // A non-2xx response makes the SDK throw a generic error and discard
    // the actual { success:false, error } body the function returned —
    // every specific message create-ward-account crafts (already has an
    // account, can't add yourself, etc.) lives in that discarded body, so
    // pull it back out instead of always showing a generic message.
    const context = (error as { context?: Response })?.context;
    if (context && typeof context.json === "function") {
      try {
        const body = await context.json();
        if (body?.error) return { success: false, error: body.error };
      } catch {
        // fall through to generic logging below
      }
    }
    await logFunctionError("[guardian] createWardAccount failed", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }

  if (!data?.success) {
    return { success: false, error: data?.error ?? "Something went wrong." };
  }

  return { success: true };
}

// Starts monitoring on a linked ward's phone without them touching it —
// sends a data-only push their device's background task reacts to (see
// tasks/remoteSessionTask.ts, lib/location.ts's beginMonitoringSession).
// Android-reliable; iOS won't wake a force-quit app (a platform policy,
// not something fixable here). Fails clearly if the ward never enabled
// notifications, since there's then nothing to push to.
export async function remoteStartWardSession(
  wardId: string,
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke(
    "remote-start-session",
    { body: { wardId } },
  );

  if (error) {
    const context = (error as { context?: Response })?.context;
    if (context && typeof context.json === "function") {
      try {
        const body = await context.json();
        if (body?.error) return { success: false, error: body.error };
      } catch {
        // fall through to generic logging below
      }
    }
    await logFunctionError("[guardian] remoteStartWardSession failed", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }

  if (!data?.success) {
    return { success: false, error: data?.error ?? "Something went wrong." };
  }

  return { success: true };
}

// Mirrors remoteStartWardSession above — stops monitoring on a linked
// ward's phone the same best-effort push-driven way (see
// tasks/remoteSessionTask.ts, lib/location.ts's endMonitoringSession).
export async function remoteStopWardSession(
  wardId: string,
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke(
    "remote-stop-session",
    { body: { wardId } },
  );

  if (error) {
    const context = (error as { context?: Response })?.context;
    if (context && typeof context.json === "function") {
      try {
        const body = await context.json();
        if (body?.error) return { success: false, error: body.error };
      } catch {
        // fall through to generic logging below
      }
    }
    await logFunctionError("[guardian] remoteStopWardSession failed", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }

  if (!data?.success) {
    return { success: false, error: data?.error ?? "Something went wrong." };
  }

  return { success: true };
}

// Links an *existing*, independent account. That person already has their
// own history, so — unlike createWardAccount — this stays "pending" and
// grants no read access (see migration 011's RLS) until they tap Accept
// on the email this sends.
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

  // A ward account cannot itself act as a guardian -- the RLS policy in
  // migration 012 enforces this too, but check here first for a clean
  // error message instead of a raw Postgres policy-violation.
  const { data: existingWardLink } = await supabase
    .from("guardian_links")
    .select("id")
    .eq("ward_id", user.id)
    .in("status", ["pending", "active"])
    .limit(1)
    .maybeSingle();

  if (existingWardLink) {
    return {
      success: false,
      error: "An account currently being monitored can't monitor others.",
    };
  }

  const { data: link, error } = await supabase
    .from("guardian_links")
    .insert({
      guardian_id: user.id,
      ward_id: wardId,
      ward_email: trimmed,
      guardian_email: user.email,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !link) {
    // Postgres unique_violation — a link between these two already exists.
    if (error?.code === "23505") {
      return { success: false, error: "You're already monitoring this person." };
    }
    console.error("[guardian] inviteWard insert failed:", error?.message);
    return { success: false, error: "Something went wrong. Please try again." };
  }

  // A real https link, not the raw surveillanceai:// scheme — plain-text
  // custom-scheme links often aren't even tappable in mail clients that
  // don't auto-linkify unknown schemes. confirm.html forwards into the
  // app from here the same way it does for Supabase's own auth emails.
  const deepLink = `${CONFIRM_BRIDGE_URL}?linkId=${link.id}`;
  const guardianLabel =
    (typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name
      : null) ?? user.email ?? "Someone";

  const emailSent = await sendEmail(
    trimmed,
    "Someone wants to monitor your status on Surveillance AI",
    `${guardianLabel} (${user.email}) wants to be able to see your live status, event log, and alerts on Surveillance AI.\n\n` +
      `If you recognise this request, open the link below to confirm:\n${deepLink}\n\n` +
      `If you don't recognise it, you can safely ignore this email — nothing is shared until you confirm.`,
    guardianLabel,
  );

  if (!emailSent) {
    console.warn(
      "[guardian] inviteWard: link created but confirmation email failed to send",
    );
  }

  return { success: true };
}

// Used by guardian-confirm.tsx to show who's requesting before the ward
// decides. Covered by the same "select as guardian or ward" RLS policy
// as everything else on this table — a pending link is still visible to
// both parties, it just grants no read access yet.
export async function getPendingLink(
  linkId: string,
): Promise<{ id: string; guardianEmail: string | null; status: "pending" | "active" } | null> {
  const { data, error } = await supabase
    .from("guardian_links")
    .select("id, guardian_email, status")
    .eq("id", linkId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[guardian] getPendingLink failed:", error.message);
    return null;
  }

  return { id: data.id, guardianEmail: data.guardian_email, status: data.status };
}

// Called from the ward's side (guardian-confirm.tsx) after they tap
// Accept on the confirmation email.
export async function acceptGuardianLink(linkId: string): Promise<boolean> {
  const { error } = await supabase.rpc("accept_guardian_link", {
    link_id: linkId,
  });

  if (error) {
    console.error("[guardian] acceptGuardianLink failed:", error.message);
    return false;
  }
  return true;
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
    .select("id, ward_id, ward_email, status, created_at")
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
    status: row.status,
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

// events.photo_url is a legacy column holding the ward's own device's
// local file:// URI — never uploaded anywhere, so never resolvable from a
// guardian's device. Map it to null rather than point <Image> at a path
// that only exists on someone else's phone. For a Medium/High event,
// photo_storage_path/audio_storage_path point at the real thing in the
// event-media Storage bucket instead — see getSignedMediaUrl.
function mapEvent(row: {
  id: string;
  session_id: string;
  timestamp: string;
  risk_level: "low" | "medium" | "high";
  ai_summary: string | null;
  concerns: string[] | null;
  confidence: number | null;
  audio_summary: string | null;
  audio_concerns: string[] | null;
  audio_confidence: number | null;
  photo_storage_path: string | null;
  audio_storage_path: string | null;
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
    concerns: row.concerns,
    confidence: row.confidence,
    audioSummary: row.audio_summary,
    audioConcerns: row.audio_concerns,
    audioConfidence: row.audio_confidence,
    // audioUri/photoUri are the ward's own local file:// paths — never
    // resolvable from a guardian's device (see the file comment above).
    // photoStoragePath/audioStoragePath are the actual guardian-readable
    // reference — resolved to a signed URL on demand, see getSignedMediaUrl.
    audioUri: null,
    photoUri: null,
    photoStoragePath: row.photo_storage_path,
    audioStoragePath: row.audio_storage_path,
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
      .select("id, started_at, last_lat, last_lng, last_location_at, ended_at")
      .eq("user_id", wardId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("events")
      .select(
        "id, session_id, timestamp, risk_level, ai_summary, concerns, confidence, audio_summary, audio_concerns, audio_confidence, photo_storage_path, audio_storage_path, transcript, latitude, longitude",
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
          startedAt: sessionRow.started_at
            ? new Date(sessionRow.started_at).getTime()
            : null,
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

// ─── Location history (calendar-scoped) ─────────────────────────────────────
// Marks which days in a visible calendar month have data, without pulling
// every row just to compute that — see migration 016. RLS on
// location_points already restricts this to the caller's own rows or, for
// a guardian, rows belonging to an actively-linked ward.
export async function fetchWardLocationHistoryDays(
  wardId: string,
  monthStart: Date,
  monthEnd: Date,
): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("location_history_days", {
    p_user_id: wardId,
    p_month_start: monthStart.toISOString(),
    p_month_end: monthEnd.toISOString(),
  });

  if (error) {
    console.error("[guardian] fetchWardLocationHistoryDays failed:", error.message);
    return new Set();
  }

  return new Set((data ?? []).map((row: { day: string }) => row.day));
}

export async function fetchWardLocationHistoryForDate(
  wardId: string,
  date: Date,
): Promise<{ lat: number; lng: number; timestamp: number }[]> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const { data, error } = await supabase
    .from("location_points")
    .select("lat, lng, recorded_at")
    .eq("user_id", wardId)
    .gte("recorded_at", dayStart.toISOString())
    .lt("recorded_at", dayEnd.toISOString())
    .order("recorded_at", { ascending: true })
    .limit(2000); // ~7200 possible at 12s/day; 2000 is plenty for a visible trail

  if (error) {
    console.error("[guardian] fetchWardLocationHistoryForDate failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    lat: row.lat,
    lng: row.lng,
    timestamp: new Date(row.recorded_at).getTime(),
  }));
}

// ─── Event log (calendar-scoped) ────────────────────────────────────────────
// Same pattern as location history above — see migration 020.
export async function fetchWardEventHistoryDays(
  wardId: string,
  monthStart: Date,
  monthEnd: Date,
): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("event_history_days", {
    p_user_id: wardId,
    p_month_start: monthStart.toISOString(),
    p_month_end: monthEnd.toISOString(),
  });

  if (error) {
    console.error("[guardian] fetchWardEventHistoryDays failed:", error.message);
    return new Set();
  }

  return new Set((data ?? []).map((row: { day: string }) => row.day));
}

export async function fetchWardEventsForDate(
  wardId: string,
  date: Date,
): Promise<Event[]> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const { data, error } = await supabase
    .from("events")
    .select(
      "id, session_id, timestamp, risk_level, ai_summary, concerns, confidence, audio_summary, audio_concerns, audio_confidence, photo_storage_path, audio_storage_path, transcript, latitude, longitude",
    )
    .eq("user_id", wardId)
    .gte("timestamp", dayStart.toISOString())
    .lt("timestamp", dayEnd.toISOString())
    .order("timestamp", { ascending: false });

  if (error) {
    console.error("[guardian] fetchWardEventsForDate failed:", error.message);
    return [];
  }

  return (data ?? []).map(mapEvent);
}

// ─── Alerts (calendar-scoped) ───────────────────────────────────────────────
// Same pattern again — see migration 020.
export async function fetchWardAlertHistoryDays(
  wardId: string,
  monthStart: Date,
  monthEnd: Date,
): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("alert_history_days", {
    p_user_id: wardId,
    p_month_start: monthStart.toISOString(),
    p_month_end: monthEnd.toISOString(),
  });

  if (error) {
    console.error("[guardian] fetchWardAlertHistoryDays failed:", error.message);
    return new Set();
  }

  return new Set((data ?? []).map((row: { day: string }) => row.day));
}

export async function fetchWardAlertsForDate(
  wardId: string,
  date: Date,
): Promise<Alert[]> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const { data, error } = await supabase
    .from("alerts")
    .select(
      "id, event_id, timestamp, contact_name, sms_sent, email_sent, call_made, ai_summary, latitude, longitude, acknowledged_at, escalated_at, backup_contact_name",
    )
    .eq("user_id", wardId)
    .gte("timestamp", dayStart.toISOString())
    .lt("timestamp", dayEnd.toISOString())
    .order("timestamp", { ascending: false });

  if (error) {
    console.error("[guardian] fetchWardAlertsForDate failed:", error.message);
    return [];
  }

  return (data ?? []).map(mapAlert);
}
