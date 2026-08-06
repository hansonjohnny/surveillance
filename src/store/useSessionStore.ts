import type { Location, RiskLevel } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ShakeSensitivity } from "@/lib/sensors";
import {
  startShakeDetection as _startShakeDetection,
  stopShakeDetection as _stopShakeDetection,
} from "@/lib/sensors";

type SessionStore = {
  // Supabase auth user ID — set by _layout.tsx on sign-in, cleared on sign-out
  userId: string | null;
  setUserId: (id: string | null) => void;

  isActive: boolean;
  sessionId: string | null;
  sessionStartTime: number | null;
  lastRiskLevel: RiskLevel | null;
  lastAISummary: string | null;
  lastLocation: Location | null;
  cycleCount: number;
  // Holds the cleanup function returned by startShakeDetection.
  // Not persisted — a stale cleanup from a previous run would be useless.
  shakeDetectionCleanup: (() => void) | null;
  startSession: () => void;
  stopSession: () => void;
  updateRiskLevel: (level: RiskLevel, summary?: string) => void;
  updateLocation: (location: Location) => void;
  incrementCycle: () => void;
  startShakeDetection: (sensitivity: ShakeSensitivity, onShake: () => void) => void;
  stopShakeDetection: () => void;
};

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      userId: null,
      setUserId: (id) => set({ userId: id }),

      isActive: false,
      sessionId: null,
      sessionStartTime: null,
      lastRiskLevel: null,
      lastAISummary: null,
      lastLocation: null,
      cycleCount: 0,
      shakeDetectionCleanup: null,

      startSession: () =>
        set({
          isActive: true,
          sessionId: Date.now().toString(),
          sessionStartTime: Date.now(),
          lastRiskLevel: "low",
          cycleCount: 0,
        }),

      stopSession: () =>
        set({
          isActive: false,
          sessionId: null,
          sessionStartTime: null,
          lastRiskLevel: null,
          lastAISummary: null,
          cycleCount: 0,
        }),

      updateRiskLevel: (level, summary) =>
        set((state) => ({
          lastRiskLevel: level,
          ...(summary !== undefined ? { lastAISummary: summary } : {}),
        })),

      updateLocation: (location) => set({ lastLocation: location }),

      incrementCycle: () =>
        set((state) => ({ cycleCount: state.cycleCount + 1 })),

      startShakeDetection: (sensitivity, onShake) => {
        const cleanup = _startShakeDetection(sensitivity, onShake);
        set({ shakeDetectionCleanup: cleanup });
      },

      stopShakeDetection: () =>
        set((state) => {
          if (state.shakeDetectionCleanup) {
            _stopShakeDetection(state.shakeDetectionCleanup);
          }
          return { shakeDetectionCleanup: null };
        }),
    }),
    {
      name: "@surveillance_ai/session",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
