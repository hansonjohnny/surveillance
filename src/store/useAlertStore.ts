import type { Alert, Event } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
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

      syncAlertToSupabase: async (alertId) => {
        const userId = useSessionStore.getState().userId;
        if (!userId) return true; // no account to sync to — nothing to retry

        const alert = get().alerts.find((a) => a.id === alertId);
        if (!alert) return true; // alert was cleared locally — nothing to sync

        // alerts.event_id references events.id, which in turn references
        // sessions.id — neither is synced anywhere else, so upsert both here
        // first or the write below fails on the foreign key constraints.
        const event = get().events.find((e) => e.id === alert.eventId);
        if (event) {
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
            photo_url: event.photoUri,
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
        }

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
