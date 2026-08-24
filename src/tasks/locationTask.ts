// Background task that receives location updates delivered while the app is
// backgrounded/screen-locked. Unlike wellnessTask.ts and escalationTask.ts,
// this task is started/stopped with the surveillance session (see
// lib/location.ts's startBackgroundLocationTracking, called from
// useSessionStore), not registered once at app launch — there's nothing
// useful to do with location updates when no session is running.
//
// TaskManager.defineTask must be called at module load time — the
// background runtime boots a minimal JS context and looks up tasks by
// name — which is why this file has a top-level side effect. Imported once
// from app/_layout.tsx so the definition is always registered, even before
// a session starts it.

import type * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import {
  LOCATION_TASK_NAME,
  updateLocalSessionLocation,
} from "../lib/location";

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("[location task] error:", error);
    return;
  }

  const locations = (data as { locations?: Location.LocationObject[] } | undefined)
    ?.locations;
  const latest = locations?.[locations.length - 1];
  if (!latest) return;

  try {
    await updateLocalSessionLocation(
      latest.coords.latitude,
      latest.coords.longitude,
    );
  } catch (err) {
    console.error("[location task] updateLocalSessionLocation failed:", err);
  }
});
