// Syncs monitoringInterval/shakeSensitivity/wellnessCheckInTime between the
// local useSettingsStore and Supabase's settings table (migration 001
// defined the table; nothing ever actually used it for reading until now
// — these fields only ever lived in local AsyncStorage). This is what
// lets a linked guardian control how a ward's monitoring runs and when
// their daily wellness check-in fires (see migration 021's RLS) instead
// of it being entirely up to the ward.
//
// Not push-driven like remote-start/stop -- a guardian's change to
// monitoringInterval/shakeSensitivity takes effect the next time the
// ward's session (re)starts, not live mid-cycle (the interval's
// setInterval is only read once, at startSession()). Pairing a change
// with a remote-stop + remote-start makes it take effect immediately.
// wellnessCheckInTime is different -- it's rescheduled for real (see
// below) the moment this sync runs, since scheduling a local
// notification doesn't depend on any session being active.

import type { Plan } from "./plans";
import type { ShakeSensitivity } from "./sensors";
import { supabase } from "./supabase";
import {
  cancelWellnessCheckIn,
  getScheduledCheckInTime,
  scheduleWellnessCheckIn,
} from "./wellness";
import { useSettingsStore } from "../store/useSettingsStore";

export type RemoteSettings = {
  monitoringInterval: 20 | 30 | 60;
  shakeSensitivity: ShakeSensitivity;
  wellnessCheckInTime: string | null;
  // Ward-set only (see migration 022) -- upsertSettings will happily write
  // these for whoever calls it, same as every other field, but no
  // guardian-facing UI ever does; only the ward's own device can actually
  // be standing at the location to set it.
  homeLat: number | null;
  homeLng: number | null;
};

function isValidInterval(n: number): n is 20 | 30 | 60 {
  return n === 20 || n === 30 || n === 60;
}

function isValidSensitivity(s: string): s is ShakeSensitivity {
  return s === "low" || s === "medium" || s === "high";
}

export async function fetchSettings(
  userId: string,
): Promise<RemoteSettings | null> {
  const { data, error } = await supabase
    .from("settings")
    .select(
      "monitoring_interval, shake_sensitivity, wellness_checkin_time, home_lat, home_lng",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[settingsSync] fetchSettings failed:", error.message);
    return null;
  }
  if (!data) return null;

  return {
    monitoringInterval: isValidInterval(data.monitoring_interval)
      ? data.monitoring_interval
      : 30,
    shakeSensitivity: isValidSensitivity(data.shake_sensitivity)
      ? data.shake_sensitivity
      : "medium",
    wellnessCheckInTime: data.wellness_checkin_time ?? null,
    homeLat: data.home_lat ?? null,
    homeLng: data.home_lng ?? null,
  };
}

// Used both by a ward updating their own settings and by a guardian
// updating a linked ward's -- RLS (migration 001 + 021) decides which of
// those the caller is actually allowed to do; this function doesn't care.
export async function upsertSettings(
  userId: string,
  patch: Partial<RemoteSettings>,
): Promise<boolean> {
  const row: Record<string, unknown> = { user_id: userId };
  if (patch.monitoringInterval !== undefined) {
    row.monitoring_interval = patch.monitoringInterval;
  }
  if (patch.shakeSensitivity !== undefined) {
    row.shake_sensitivity = patch.shakeSensitivity;
  }
  if (patch.wellnessCheckInTime !== undefined) {
    row.wellness_checkin_time = patch.wellnessCheckInTime;
  }
  if (patch.homeLat !== undefined) {
    row.home_lat = patch.homeLat;
  }
  if (patch.homeLng !== undefined) {
    row.home_lng = patch.homeLng;
  }

  const { error } = await supabase
    .from("settings")
    .upsert(row, { onConflict: "user_id" });

  if (error) {
    console.error("[settingsSync] upsertSettings failed:", error.message);
    return false;
  }
  return true;
}

// Pulls the signed-in user's own settings row into the local store,
// creating the row (from current local values) if it doesn't exist yet.
// Called on app launch and whenever a session is about to start (see
// lib/location.ts's beginMonitoringSession) so a guardian's change is
// picked up even from a cold start triggered purely by a remote-start
// push.
export async function syncSettingsFromSupabase(userId: string): Promise<void> {
  try {
    const remote = await fetchSettings(userId);
    if (remote) {
      useSettingsStore.getState().updateSettings(remote);

      // Actually reschedule (or cancel) the local notification to match
      // -- unlike monitoringInterval/shakeSensitivity, this doesn't wait
      // for a session to start; the notification itself is what needs to
      // change. Compare first so an unchanged value doesn't cancel and
      // recreate the same notification on every single launch.
      const scheduled = await getScheduledCheckInTime();
      if (remote.wellnessCheckInTime !== scheduled) {
        if (remote.wellnessCheckInTime) {
          await scheduleWellnessCheckIn(remote.wellnessCheckInTime);
        } else if (scheduled) {
          await cancelWellnessCheckIn();
        }
      }
    } else {
      // No row yet -- create one from whatever the local store already
      // has, so a guardian has something to read/write from their side.
      const { monitoringInterval, shakeSensitivity, wellnessCheckInTime, homeLat, homeLng } =
        useSettingsStore.getState();
      await upsertSettings(userId, {
        monitoringInterval,
        shakeSensitivity,
        wellnessCheckInTime,
        homeLat,
        homeLng,
      });
    }
  } catch (err) {
    console.error("[settingsSync] syncSettingsFromSupabase failed:", err);
  }

  // users.plan is the actual source of truth (only ever changed via the
  // admin assign-plan tool, now that the self-serve upgrade screen is
  // gone) -- the local store's copy otherwise never gets corrected if it
  // was set some other way (a factory-reset default, manual testing, an
  // old build). Same "pull real account state on launch" reasoning as
  // the settings sync above, just a separate table.
  try {
    const { data, error } = await supabase
      .from("users")
      .select("plan")
      .eq("id", userId)
      .maybeSingle();

    if (!error && data?.plan) {
      useSettingsStore.getState().updateSettings({ plan: data.plan as Plan });
    }
  } catch (err) {
    console.error("[settingsSync] plan sync failed:", err);
  }
}
