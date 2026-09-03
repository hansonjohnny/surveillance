// Background task for the "arrived home" geofence -- idea #2 from the
// retention-hook brainstorm: while a session is active, entering the
// ward's saved home location (see migration 022, lib/settingsSync.ts)
// pings their linked guardian(s) with a reassuring notification instead
// of just silence until something goes wrong.
//
// TaskManager.defineTask must be called at module load time, same as
// every other task in this folder -- see tasks/wellnessTask.ts's header
// comment for why. Only started/stopped alongside the session itself
// (see useSessionStore.ts), not registered once at app launch like
// wellness/escalation -- there's no point geofencing when nothing is
// being monitored.

import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { supabase } from "../lib/supabase";

export const HOME_GEOFENCE_TASK = "HOME_GEOFENCE_TASK";
const HOME_REGION_RADIUS_METERS = 150;

TaskManager.defineTask(HOME_GEOFENCE_TASK, async ({ data, error }) => {
  if (error) {
    console.error("[geofence task] error:", error);
    return;
  }
  const { eventType } = (data ?? {}) as {
    eventType?: Location.GeofencingEventType;
  };
  if (eventType !== Location.GeofencingEventType.Enter) return;

  try {
    const { error: invokeError } = await supabase.functions.invoke(
      "notify-guardian-arrived-home",
    );
    if (invokeError) {
      console.error("[geofence task] notify-guardian-arrived-home failed:", invokeError);
    }
  } catch (err) {
    console.error("[geofence task] unexpected error:", err);
  }
});

// Called from useSessionStore's startSession() when a home location is
// saved -- re-calling with a new region (e.g. the ward updated their
// home location) just replaces the previous one, per expo-location's own
// startGeofencingAsync semantics.
export async function startHomeGeofencing(lat: number, lng: number): Promise<void> {
  try {
    await Location.startGeofencingAsync(HOME_GEOFENCE_TASK, [
      {
        identifier: "home",
        latitude: lat,
        longitude: lng,
        radius: HOME_REGION_RADIUS_METERS,
        notifyOnEnter: true,
        notifyOnExit: false,
      },
    ]);
  } catch (err) {
    console.error("[geofence task] startHomeGeofencing failed:", err);
  }
}

export async function stopHomeGeofencing(): Promise<void> {
  try {
    const started = await Location.hasStartedGeofencingAsync(HOME_GEOFENCE_TASK).catch(
      () => false,
    );
    if (!started) return;
    await Location.stopGeofencingAsync(HOME_GEOFENCE_TASK);
  } catch (err) {
    console.error("[geofence task] stopHomeGeofencing failed:", err);
  }
}
