// Shared, headless-safe read of the current session for the home-screen
// widget (idea #4 from the retention-hook brainstorm). Both
// widgetTaskHandler.tsx (native widget lifecycle callbacks) and
// syncWidget.ts (pushed from the running app) need the exact same view
// of "what should the widget show right now" -- kept in one place so
// they can't drift.
//
// Reads the same persisted AsyncStorage blob as lib/location.ts's
// beginMonitoringSession/endMonitoringSession -- safe to call from a
// true headless context where useSessionStore hasn't hydrated, same
// reasoning as those two functions.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { SESSION_STORAGE_KEY } from "../lib/location";
import type { RiskLevel } from "../types";

export type WidgetSessionState = {
  isActive: boolean;
  riskLevel: RiskLevel | null;
  elapsedLabel: string | null;
};

export function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => n.toString().padStart(2, "0"))
    .join(":");
}

export async function readWidgetSessionState(): Promise<WidgetSessionState> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    const state = raw ? JSON.parse(raw)?.state : null;
    if (!state?.isActive) {
      return { isActive: false, riskLevel: null, elapsedLabel: null };
    }
    return {
      isActive: true,
      riskLevel: state.lastRiskLevel ?? "low",
      elapsedLabel: state.sessionStartTime
        ? fmtElapsed(Date.now() - state.sessionStartTime)
        : null,
    };
  } catch (err) {
    console.error("[widget] readWidgetSessionState failed:", err);
    return { isActive: false, riskLevel: null, elapsedLabel: null };
  }
}
