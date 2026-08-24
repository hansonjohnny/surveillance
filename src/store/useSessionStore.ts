import { generateUUID } from "@/lib/id";
import { startLocationTracking as _startLocationTracking } from "@/lib/location";
import type { ShakeSensitivity } from "@/lib/sensors";
import {
  startShakeDetection as _startShakeDetection,
  stopShakeDetection as _stopShakeDetection,
} from "@/lib/sensors";
import { supabase } from "@/lib/supabase";
import type { Location, LocationPoint, RiskLevel } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Cap the recorded path so a very long session can't grow AsyncStorage without bound.
const MAX_LOCATION_HISTORY = 2000;

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
  // Breadcrumb trail for the current (or most recently ended) session.
  locationHistory: LocationPoint[];
  cycleCount: number;
  // Holds the cleanup function returned by startShakeDetection.
  // Not persisted — a stale cleanup from a previous run would be useless.
  shakeDetectionCleanup: (() => void) | null;
  // Holds the cleanup function returned by startLocationTracking.
  locationTrackingCleanup: (() => void) | null;
  startSession: () => void;
  stopSession: () => void;
  updateRiskLevel: (level: RiskLevel, summary?: string) => void;
  updateLocation: (location: Location) => void;
  incrementCycle: () => void;
  startShakeDetection: (
    sensitivity: ShakeSensitivity,
    onShake: () => void,
  ) => void;
  stopShakeDetection: () => void;
  startLocationHistoryTracking: () => Promise<void>;
  stopLocationHistoryTracking: () => void;
};

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      userId: null,
      setUserId: (id) => set({ userId: id }),

      isActive: false,
      sessionId: null,
      sessionStartTime: null,
      lastRiskLevel: null,
      lastAISummary: null,
      lastLocation: null,
      locationHistory: [],
      cycleCount: 0,
      shakeDetectionCleanup: null,
      locationTrackingCleanup: null,

      startSession: () => {
        const sessionId = generateUUID();
        set({
          isActive: true,
          sessionId,
          sessionStartTime: Date.now(),
          lastRiskLevel: "low",
          cycleCount: 0,
          locationHistory: [],
        });

        // Create the Supabase row up front (not lazily on first alert) so a
        // share link has a session to attach to from the moment monitoring
        // starts. Fire-and-forget — local state is already the source of
        // truth for the running session.
        const userId = get().userId;
        if (userId) {
          supabase
            .from("sessions")
            .upsert({ id: sessionId, user_id: userId })
            .then(({ error }) => {
              if (error) {
                console.error(
                  "[useSessionStore] Failed to create session row:",
                  error.message,
                );
              }
            });
        }
      },

      stopSession: () => {
        const { sessionId, userId } = get();
        set({
          isActive: false,
          sessionId: null,
          sessionStartTime: null,
          lastRiskLevel: null,
          lastAISummary: null,
          cycleCount: 0,
        });

        if (sessionId && userId) {
          supabase
            .from("sessions")
            .update({ ended_at: new Date().toISOString() })
            .eq("id", sessionId)
            .then(({ error }) => {
              if (error) {
                console.error(
                  "[useSessionStore] Failed to close session row:",
                  error.message,
                );
              }
            });
        }
      },

      updateRiskLevel: (level, summary) =>
        set((state) => ({
          lastRiskLevel: level,
          ...(summary !== undefined ? { lastAISummary: summary } : {}),
        })),

      updateLocation: (location) =>
        set((state) => ({
          lastLocation: location,
          locationHistory: [
            ...state.locationHistory,
            { lat: location.lat, lng: location.lng, timestamp: Date.now() },
          ].slice(-MAX_LOCATION_HISTORY),
        })),

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

      startLocationHistoryTracking: async () => {
        // Avoid stacking multiple watchers if called more than once.
        get().stopLocationHistoryTracking();
        const cleanup = await _startLocationTracking((coords) => {
          get().updateLocation(coords);
        });
        set({ locationTrackingCleanup: cleanup });
      },

      stopLocationHistoryTracking: () =>
        set((state) => {
          state.locationTrackingCleanup?.();
          return { locationTrackingCleanup: null };
        }),
    }),
    {
      name: "@surveillance_ai/session",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => {
        const { locationTrackingCleanup, shakeDetectionCleanup, ...rest } =
          state;
        return rest;
      },
    },
  ),
);
