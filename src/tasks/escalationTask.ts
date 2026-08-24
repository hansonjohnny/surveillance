// Background task that checks whether any unacknowledged High-risk alert
// needs to escalate to the backup contact. Mirrors wellnessTask.ts —
// TaskManager.defineTask must be called at module load time, which is why
// this file has a top-level side effect.
//
// To activate the task, call registerEscalationTask() once at app startup
// (done in app/_layout.tsx).

import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import { checkEscalations } from "../lib/escalation";

export const ESCALATION_CHECK_TASK = "ESCALATION_CHECK_TASK";

// Defined at module load time — required by TaskManager.
TaskManager.defineTask(ESCALATION_CHECK_TASK, async () => {
  try {
    await checkEscalations();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (err) {
    console.error("[escalation task] Unexpected error:", err);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Registers the task with BackgroundFetch. Safe to call multiple times —
// returns early if already registered.
export async function registerEscalationTask(): Promise<void> {
  try {
    const isRegistered =
      await TaskManager.isTaskRegisteredAsync(ESCALATION_CHECK_TASK);
    if (isRegistered) return;

    await BackgroundFetch.registerTaskAsync(ESCALATION_CHECK_TASK, {
      // iOS/Android schedule background fetch at their own discretion —
      // this is a floor, not a guarantee. Combined with the 10-minute
      // ESCALATION_DELAY_MS, real-world escalation lands somewhere in the
      // 10-15 minute range while backgrounded; the AppState-triggered
      // foreground check in app/_layout.tsx catches most cases faster.
      minimumInterval: 5 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });

    console.log("[escalation task] Registered");
  } catch (err) {
    // BackgroundFetch can fail on simulators and restricted environments.
    console.warn("[escalation task] Registration failed (simulator?):", err);
  }
}
