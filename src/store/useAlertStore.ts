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
  addAlert: (alert: Alert) => Promise<void>;
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

      addAlert: async (alert) => {
        // Deduplicate: skip if an alert for this event already exists
        if (get().alerts.some((a) => a.eventId === alert.eventId)) return;

        // Optimistic local update
        set((state) => ({
          alerts: [alert, ...state.alerts].slice(0, MAX_EVENTS),
        }));

        // Sync to Supabase
        const userId = useSessionStore.getState().userId;
        if (!userId) return;

        const { error } = await supabase.from("alerts").insert({
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
          // Alert stays in local AsyncStorage — do not roll back.
        }
      },

      clearEvents: () => set({ events: [] }),
    }),
    {
      name: "@surveillance_ai/alerts",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
