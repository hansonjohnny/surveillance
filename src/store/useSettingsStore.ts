import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Plan } from '../lib/plans';

export const ONBOARDING_SECURE_KEY = 'onboarding_complete';

type ShakeSensitivity = 'low' | 'medium' | 'high';

type Settings = {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  monitoringInterval: 20 | 30 | 60;
  shakeSensitivity: ShakeSensitivity;
  stealthMode: boolean;
  cameraSoundEnabled: boolean; // false = muted (default); true = shutter sound on
  wellnessCheckInTime: string | null;
  logClearScheduledAt: string | null; // ISO datetime — clear event log at this time
  lastAutoCleared: number | null;     // epoch ms — last time the 5-day fallback cleared the log
  onboardingComplete: boolean;
  onboardingResumePath: string | null;
  // Billing — replaced by RevenueCat entitlements when payments are added.
  plan: Plan;
  todayUsage: number;
  usageDate: string | null; // ISO date (YYYY-MM-DD) of the last todayUsage update
};

type SettingsStore = Settings & {
  updateSettings: (partial: Partial<Settings>) => void;
  markOnboardingComplete: () => void;
  resetOnboarding: () => void;
  setPlan: (plan: Plan) => void;
  setTodayUsage: (count: number) => void;
  resetUsageIfNewDay: () => void;
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      contactName: '',
      contactPhone: '',
      contactEmail: '',
      monitoringInterval: 30,
      shakeSensitivity: 'medium',
      stealthMode: false,
      cameraSoundEnabled: false,
      wellnessCheckInTime: null,
      logClearScheduledAt: null,
      lastAutoCleared: null,
      onboardingComplete: false,
      onboardingResumePath: null,
      plan: 'free',
      todayUsage: 0,
      usageDate: null,

      updateSettings: (partial) => set(partial),
      setPlan: (plan) => set({ plan }),
      setTodayUsage: (count) => {
        const today = new Date().toISOString().split('T')[0];
        set((s) => s.usageDate !== today ? { todayUsage: 0, usageDate: today } : { todayUsage: count, usageDate: today });
      },
      resetUsageIfNewDay: () => {
        const today = new Date().toISOString().split('T')[0];
        set((s) => s.usageDate !== today ? { todayUsage: 0, usageDate: today } : {});
      },

      markOnboardingComplete: () => {
        set({ onboardingComplete: true, onboardingResumePath: null });
        // Mirror into Secure Store so the flag survives AsyncStorage wipes.
        // On iOS this also survives app reinstall (Keychain is not cleared on delete).
        SecureStore.setItemAsync(ONBOARDING_SECURE_KEY, 'true').catch(console.warn);
      },

      resetOnboarding: () => {
        set({ onboardingComplete: false, onboardingResumePath: null });
        SecureStore.deleteItemAsync(ONBOARDING_SECURE_KEY).catch(console.warn);
      },
    }),
    {
      name: '@surveillance_ai/settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
