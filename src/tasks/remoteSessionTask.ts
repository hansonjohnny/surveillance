// Background task that starts or stops a monitoring session when a
// guardian triggers supabase/functions/remote-start-session or
// remote-stop-session, which send a data-only push to this device.
// Unlike the other tasks in this folder (registered via
// expo-background-fetch's polling API), this one uses
// expo-notifications' own background-notification-task API — it runs in
// response to a push arriving, not on a timer, and (Android only) can
// wake even a fully force-quit app. See lib/location.ts's
// beginMonitoringSession/endMonitoringSession for what actually happens
// once this fires.
//
// TaskManager.defineTask must be called at module load time — the
// background runtime boots a minimal JS context and looks up tasks by
// name. To activate the task, call registerRemoteSessionTask() once at
// app startup (done in app/_layout.tsx).

import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { beginMonitoringSession, endMonitoringSession } from "../lib/location";

export const REMOTE_SESSION_TASK = "REMOTE_SESSION_MONITORING_TASK";

TaskManager.defineTask<Notifications.NotificationTaskPayload>(
  REMOTE_SESSION_TASK,
  async ({ data, error }) => {
    if (error) {
      console.error("[remote-session task] error:", error);
      return;
    }
    if (!data || "actionIdentifier" in data) return; // a tap/response, not a raw receipt

    // The custom { type: "remote-start" | "remote-stop" } payload sent by
    // the edge functions arrives as a JSON string in dataString for a
    // true headless delivery, but may also be spread directly onto
    // `data` depending on platform/delivery path — check both.
    let payloadType: unknown;
    const rawDataString = data.data?.dataString;
    if (typeof rawDataString === "string") {
      try {
        payloadType = JSON.parse(rawDataString)?.type;
      } catch (err) {
        console.warn("[remote-session task] Failed to parse dataString:", err);
      }
    }
    if (payloadType === undefined) {
      payloadType = data.data?.type;
    }

    if (payloadType === "remote-start") {
      await beginMonitoringSession();
    } else if (payloadType === "remote-stop") {
      await endMonitoringSession();
    }
  },
);

export async function registerRemoteSessionTask(): Promise<void> {
  try {
    await Notifications.registerTaskAsync(REMOTE_SESSION_TASK);
  } catch (err) {
    console.error("[remote-session task] registerRemoteSessionTask failed:", err);
  }
}
