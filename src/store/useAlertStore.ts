import type { Alert, Event } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { NO_ANALYSIS_SUMMARY } from "../lib/eventContent";
import { supabase } from "../lib/supabase";
import { useSessionStore } from "./useSessionStore";

const MAX_EVENTS = 100;

type AlertStore = {
  events: Event[];
  alerts: Alert[];
  addEvent: (event: Event) => void;
  updateEvent: (id: string, patch: Partial<Event>) => void;
  // Local-only write, no network — lets the caller record an alert
  // immediately even while offline, then sync separately once connected.
  addAlertLocal: (alert: Alert) => void;
  updateAlert: (id: string, patch: Partial<Alert>) => void;
  // Pushes an already-local event to Supabase (and its parent session, so
  // the event's foreign key doesn't fail). Called once per cycle for every
  // event now, not just ones that trigger an alert — a linked guardian's
  // event log needs the full picture, not just High-risk history.
  syncEventToSupabase: (eventId: string) => Promise<boolean>;
  // Pushes an already-local alert (and its event) to Supabase. Returns
  // whether it succeeded, so a caller can requeue it on failure.
  syncAlertToSupabase: (alertId: string) => Promise<boolean>;
  addAlert: (alert: Alert) => Promise<boolean>;
  clearEvents: () => void;
};

export const useAlertStore = create<AlertStore>()(
  persist(
    (set, get) => ({
      events: [],
      alerts: [],

      addEvent: (event) =>
        set((state) => ({
          events: [event, ...state.events].slice(0, MAX_EVENTS),
        })),

      updateEvent: (id, patch) =>
        set((state) => ({
          events: state.events.map((e) =>
            e.id === id ? { ...e, ...patch } : e,
          ),
        })),

      addAlertLocal: (alert) => {
        // Deduplicate: skip if an alert for this event already exists
        if (get().alerts.some((a) => a.eventId === alert.eventId)) return;
        set((state) => ({
          alerts: [alert, ...state.alerts].slice(0, MAX_EVENTS),
        }));
      },

      updateAlert: (id, patch) =>
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === id ? { ...a, ...patch } : a,
          ),
        })),

      syncEventToSupabase: async (eventId) => {
        const userId = useSessionStore.getState().userId;
        if (!userId) return true; // no account to sync to — nothing to retry

        const event = get().events.find((e) => e.id === eventId);
        if (!event) return true; // event was cleared locally — nothing to sync

        // A genuine vision-analysis failure (network/API error, not a
        // covered lens or backgrounded camera — both of those are real,
        // informative states) carries zero information about the ward's
        // actual situation. Syncing it would show a guardian a "LOW risk"
        // card that looks exactly like a real all-clear reading but isn't
        // one. Skip it — unless audio picked up something real this cycle,
        // or shake/manual made this event informative on its own.
        const isUninformativeFailure =
          event.riskLevel === "low" &&
          event.aiSummary === NO_ANALYSIS_SUMMARY &&
          !event.audioSummary &&
          !event.transcript &&
          !(event.source === "shake" || (event.source?.includes("shake") ?? false)) &&
          event.source !== "manual";
        if (isUninformativeFailure) return true; // nothing worth syncing yet

        // events.session_id references sessions.id — normally already
        // created by useSessionStore.startSession, but upsert defensively
        // in case that failed silently; this is cheap and idempotent.
        const { error: sessionError } = await supabase
          .from("sessions")
          .upsert({ id: event.sessionId, user_id: userId });
        if (sessionError) {
          console.error(
            "[useAlertStore] Failed to sync session to Supabase:",
            sessionError.message,
          );
          return false;
        }

        const { error: eventError } = await supabase.from("events").upsert({
          id: event.id,
          session_id: event.sessionId,
          user_id: userId,
          timestamp: new Date(event.timestamp).toISOString(),
          risk_level: event.riskLevel,
          ai_summary: event.aiSummary,
          concerns: event.concerns ?? null,
          confidence: event.confidence ?? null,
          audio_summary: event.audioSummary ?? null,
          audio_concerns: event.audioConcerns ?? null,
          audio_confidence: event.audioConfidence ?? null,
          photo_url: event.photoUri,
          photo_storage_path: event.photoStoragePath ?? null,
          audio_storage_path: event.audioStoragePath ?? null,
          transcript: event.transcript ?? null,
          latitude: event.location?.lat ?? null,
          longitude: event.location?.lng ?? null,
        });
        if (eventError) {
          console.error(
            "[useAlertStore] Failed to sync event to Supabase:",
            eventError.message,
          );
          return false;
        }
        return true;
      },

      syncAlertToSupabase: async (alertId) => {
        const userId = useSessionStore.getState().userId;
        if (!userId) return true; // no account to sync to — nothing to retry

        const alert = get().alerts.find((a) => a.id === alertId);
        if (!alert) return true; // alert was cleared locally — nothing to sync

        // alerts.event_id references events.id — make sure the event (and
        // its session) exist in Supabase first or this fails on the FK.
        const eventSynced = await get().syncEventToSupabase(alert.eventId);
        if (!eventSynced) return false;

        // Upsert (not insert) so a retry after a partial failure doesn't
        // collide with a row that already made it to Supabase.
        const { error } = await supabase.from("alerts").upsert({
          id: alert.id,
          event_id: alert.eventId,
          user_id: userId,
          timestamp: new Date(alert.timestamp).toISOString(),
          contact_name: alert.contactName,
          sms_sent: alert.smsSent,
          email_sent: alert.emailSent,
          call_made: alert.callMade,
          ai_summary: alert.aiSummary,
          latitude: alert.location?.lat ?? null,
          longitude: alert.location?.lng ?? null,
        });

        if (error) {
          console.error(
            "[useAlertStore] Failed to sync alert to Supabase:",
            error.message,
          );
          return false;
        }
        return true;
      },

      addAlert: async (alert) => {
        get().addAlertLocal(alert);
        return get().syncAlertToSupabase(alert.id);
      },

      clearEvents: () => set({ events: [] }),
    }),
    {
      name: "@surveillance_ai/alerts",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
