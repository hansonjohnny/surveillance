import type { SessionRecord } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Cap stored sessions so AsyncStorage doesn't grow without bound.
const MAX_SESSIONS = 30;

type SessionHistoryStore = {
  sessions: SessionRecord[];
  addSession: (record: SessionRecord) => void;
  clearHistory: () => void;
};

export const useSessionHistoryStore = create<SessionHistoryStore>()(
  persist(
    (set) => ({
      sessions: [],

      addSession: (record) =>
        set((state) => ({
          sessions: [record, ...state.sessions].slice(0, MAX_SESSIONS),
        })),

      clearHistory: () => set({ sessions: [] }),
    }),
    {
      name: "@surveillance_ai/session_history",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
