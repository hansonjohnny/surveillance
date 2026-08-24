// Retries queued High-risk alerts (failed SMS/email/call sends, or failed
// Supabase sync) whenever the device regains connectivity. Items are
// processed sequentially, not in parallel — a burst of simultaneous
// SMS/calls to the same contact after an outage would itself look alarming.

import {
  MAX_ATTEMPTS,
  useOfflineQueueStore,
} from "../store/useOfflineQueueStore";
import { retryQueuedAlert } from "./alerts";
import { subscribeToConnectivity } from "./network";

let processing = false;

export async function processOfflineQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  try {
    const { pending, update, remove } = useOfflineQueueStore.getState();

    for (const item of pending) {
      const { channelsSent, supabaseSynced } = await retryQueuedAlert(item);

      if (channelsSent && supabaseSynced) {
        remove(item.id);
        continue;
      }

      const attempts = item.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        console.warn(
          `[offlineQueue] giving up on alert after ${attempts} attempts:`,
          item.alertId,
        );
        remove(item.id);
        continue;
      }

      update(item.id, { channelsSent, supabaseSynced, attempts });
    }
  } finally {
    processing = false;
  }
}

// Call once from the root layout to start watching connectivity. Also runs
// once immediately on mount, in case alerts were queued while the app was
// closed and connectivity is already back by the time it relaunches.
export function startOfflineQueueWatcher(): () => void {
  processOfflineQueue().catch((err) =>
    console.error("[offlineQueue] initial process failed:", err),
  );

  return subscribeToConnectivity(() => {
    processOfflineQueue().catch((err) =>
      console.error("[offlineQueue] process failed:", err),
    );
  });
}
