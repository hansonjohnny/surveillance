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
  // Escalation contact — notified if the primary contact never acknowledges
  // a High-risk alert within the escalation window (see lib/escalation.ts).
  backupContactName: string;
  backupContactPhone: string;
  backupContactEmail: string;
  monitoringInterval: 20 | 30 | 60;
  shakeSensitivity: ShakeSensitivity;
  stealthMode: boolean;
  cameraSoundEnabled: boolean; // false = muted (default); true = shutter sound on
  wellnessCheckInTime: string | null;
  // "Arrived home" geofence center (see tasks/geofenceTask.ts) -- ward-set
  // only, synced via lib/settingsSync.ts same as the fields above it.
  homeLat: number | null;
  homeLng: number | null;
  logClearScheduledAt: string | null; // ISO datetime — clear event log at this time
  lastAutoCleared: number | null;     // epoch ms — last time the 5-day fallback cleared the log
  onboardingComplete: boolean;
  onboardingResumePath: string | null;
  // Billing — replaced by RevenueCat entitlements when payments are added.
  plan: Plan;
  todayUsage: number;
  usageDate: string | null; // ISO date (YYYY-MM-DD) of the last todayUsage update
  // Chosen at signup (see (onboarding)/who.tsx + (auth)/sign-up.tsx) and
  // independent of `plan` — no plan-tier gating or inheritance yet, see
  // supabase/migrations/011_guardian_role.sql.
  role: 'self' | 'guardian';
  // Whether this account is currently a ward of any guardian (any
  // guardian_links row with status pending/active where ward_id = this
  // user). Distinct from `role`, which is chosen once at signup — see
  // supabase/migrations/012_ward_cannot_be_guardian.sql.
  isWard: boolean;
  // Set when a guardian-confirm deep link arrives while signed out —
  // holds the linkId so sign-in can route straight back to it afterward,
  // instead of the normal post-sign-in destination. Same job
  // onboardingResumePath does for regular onboarding. See
  // guardian-confirm.tsx and (auth)/sign-in.tsx.
  pendingGuardianConfirmLinkId: string | null;
};

type SettingsStore = Settings & {
  updateSettings: (partial: Partial<Settings>) => void;
  markOnboardingComplete: () => void;
  resetOnboarding: () => void;
  setPlan: (plan: Plan) => void;
  setTodayUsage: (count: number) => void;
  resetUsageIfNewDay: () => void;
  setRole: (role: 'self' | 'guardian') => void;
  setIsWard: (isWard: boolean) => void;
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      contactName: '',
      contactPhone: '',
      contactEmail: '',
      backupContactName: '',
      backupContactPhone: '',
      backupContactEmail: '',
      monitoringInterval: 30,
      shakeSensitivity: 'medium',
      stealthMode: false,
      cameraSoundEnabled: false,
      wellnessCheckInTime: null,
      homeLat: null,
      homeLng: null,
      logClearScheduledAt: null,
      lastAutoCleared: null,
      onboardingComplete: false,
      onboardingResumePath: null,
      plan: 'free',
      todayUsage: 0,
      usageDate: null,
      role: 'self',
      isWard: false,
      pendingGuardianConfirmLinkId: null,

      updateSettings: (partial) => set(partial),
      setPlan: (plan) => set({ plan }),
      setRole: (role) => set({ role }),
      setIsWard: (isWard) => set({ isWard }),
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
