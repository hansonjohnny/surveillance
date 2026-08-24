// Persisted queue of High-risk alerts that couldn't fully send while the
// device was offline. Survives app restarts so a queued alert isn't lost if
// the user closes the app before connectivity returns.

import type { QueuedAlert } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Give up retrying a dead alert (e.g. a saved phone number that always
// fails) after this many attempts, rather than retrying forever.
export const MAX_ATTEMPTS = 8;

type OfflineQueueStore = {
  pending: QueuedAlert[];
  enqueue: (item: QueuedAlert) => void;
  update: (id: string, patch: Partial<QueuedAlert>) => void;
  remove: (id: string) => void;
};

export const useOfflineQueueStore = create<OfflineQueueStore>()(
  persist(
    (set) => ({
      pending: [],

      enqueue: (item) =>
        set((state) => ({
          // An item for this alert may already be queued (e.g. it failed
          // once, was retried, and failed again) — replace it rather than
          // stacking duplicates.
          pending: [
            ...state.pending.filter((p) => p.alertId !== item.alertId),
            item,
          ],
        })),

      update: (id, patch) =>
        set((state) => ({
          pending: state.pending.map((p) =>
            p.id === id ? { ...p, ...patch } : p,
          ),
        })),

      remove: (id) =>
        set((state) => ({
          pending: state.pending.filter((p) => p.id !== id),
        })),
    }),
    {
      name: "@surveillance_ai/offline_queue",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
