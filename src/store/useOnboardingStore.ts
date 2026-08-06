import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { useSettingsStore } from "./useSettingsStore";

export const STORAGE_KEY = "@surveillance_ai/onboarding";

export type OnboardingData = {
  when: string[];
  who: string;
  concern: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  interval: 20 | 30 | 60;
  sensitivity: 0 | 1 | 2;
  stealthMode: boolean;
};

const SENSITIVITY_MAP = { 0: "low", 1: "medium", 2: "high" } as const;
const REVERSE_SENSITIVITY_MAP = { low: 0, medium: 1, high: 2 } as const;

type OnboardingStore = {
  data: Partial<OnboardingData>;
  isComplete: boolean;
  set: (partial: Partial<OnboardingData>) => void;
  complete: () => Promise<void>;
  syncToSupabase: (userId: string) => Promise<void>;
  hydrateFromSupabase: (userId: string) => Promise<void>;
  hydrate: () => Promise<void>;
};

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
  data: {},
  isComplete: false,

  set: (partial) => set((state) => ({ data: { ...state.data, ...partial } })),

  complete: async () => {
    const { data } = get();
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("[OnboardingStore] Failed to persist onboarding data:", e);
    }
    set({ isComplete: true });
  },

  syncToSupabase: async (userId: string) => {
    const { data } = get();

    const { error: contactError } = await supabase.from("contacts").insert({
      user_id: userId,
      name: data.contactName ?? "",
      phone: data.contactPhone ?? "",
      email: data.contactEmail ?? "",
    });

    if (contactError) {
      console.warn(
        "[OnboardingStore] Failed to sync contact:",
        contactError.message,
      );
    }

    const sensitivity = SENSITIVITY_MAP[data.sensitivity ?? 1];

    const { error: settingsError } = await supabase
      .from("settings")
      .upsert(
        {
          user_id: userId,
          monitoring_interval: data.interval ?? 30,
          shake_sensitivity: sensitivity,
          stealth_mode: data.stealthMode ?? false,
        },
        { onConflict: "user_id" },
      );

    if (settingsError) {
      console.warn(
        "[OnboardingStore] Failed to sync settings:",
        settingsError.message,
      );
    }
  },

  hydrateFromSupabase: async (userId: string) => {
    try {
      const [contactResult, settingsResult] = await Promise.all([
        supabase
          .from("contacts")
          .select("name, phone, email")
          .eq("user_id", userId)
          .single(),
        supabase
          .from("settings")
          .select("monitoring_interval, shake_sensitivity, stealth_mode, wellness_checkin_time")
          .eq("user_id", userId)
          .single(),
      ]);

      const restored: Partial<OnboardingData> = {};

      if (contactResult.data) {
        restored.contactName = contactResult.data.name;
        restored.contactPhone = contactResult.data.phone;
        restored.contactEmail = contactResult.data.email;
      }

      if (settingsResult.data) {
        const s = settingsResult.data;
        restored.interval = s.monitoring_interval as 20 | 30 | 60;
        restored.sensitivity =
          REVERSE_SENSITIVITY_MAP[
            s.shake_sensitivity as keyof typeof REVERSE_SENSITIVITY_MAP
          ] ?? 1;
        restored.stealthMode = s.stealth_mode;
      }

      if (Object.keys(restored).length === 0 && !settingsResult.data) return;

      // Update both stores so every screen has fresh data.
      set((state) => ({ data: { ...state.data, ...restored }, isComplete: true }));

      useSettingsStore.getState().updateSettings({
        contactName: restored.contactName ?? "",
        contactPhone: restored.contactPhone ?? "",
        contactEmail: restored.contactEmail ?? "",
        monitoringInterval: restored.interval ?? 30,
        shakeSensitivity: SENSITIVITY_MAP[restored.sensitivity ?? 1],
        stealthMode: restored.stealthMode ?? false,
        wellnessCheckInTime: settingsResult.data?.wellness_checkin_time ?? null,
      });

      // Persist locally so subsequent cold starts use AsyncStorage, not Supabase.
      const merged = { ...get().data, ...restored };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (e) {
      console.warn("[OnboardingStore] Failed to hydrate from Supabase:", e);
    }
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<OnboardingData>;
        set({ data: saved, isComplete: true });
      }
    } catch (e) {
      console.warn("[OnboardingStore] Failed to hydrate onboarding data:", e);
    }
  },
}));
