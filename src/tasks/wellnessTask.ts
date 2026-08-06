// Background task that checks whether a wellness alert needs to fire.
//
// TaskManager.defineTask must be called at module load time — the background
// runtime boots a minimal JS context and looks up tasks by name. That is why
// this file has a top-level side effect.
//
// To activate the task, call registerWellnessTask() once at app startup
// (done in app/_layout.tsx). The task then runs automatically at the
// minimumInterval set below for as long as the app is installed.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { STORAGE_KEY } from '../store/useOnboardingStore';
import type { OnboardingData } from '../store/useOnboardingStore';
import type { Contact } from '../types';
import { checkWellnessWindow, triggerWellnessAlert } from '../lib/wellness';

export const WELLNESS_CHECK_TASK = 'WELLNESS_CHECK_TASK';

// Defined at module load time — required by TaskManager.
TaskManager.defineTask(WELLNESS_CHECK_TASK, async () => {
  try {
    const shouldAlert = await checkWellnessWindow();
    if (!shouldAlert) return BackgroundFetch.BackgroundFetchResult.NoData;

    // Read contact directly from AsyncStorage — Zustand stores are not
    // reliably hydrated in a background-only JS context.
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      console.warn('[wellness task] No onboarding data found');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const data = JSON.parse(raw) as Partial<OnboardingData>;
    if (!data.contactPhone) {
      console.warn('[wellness task] No contact phone configured');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const contact: Contact = {
      name:  data.contactName  ?? 'Unknown',
      phone: data.contactPhone,
      email: data.contactEmail ?? '',
    };

    await triggerWellnessAlert(contact);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (err) {
    console.error('[wellness task] Unexpected error:', err);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Registers the task with BackgroundFetch. Safe to call multiple times —
// returns early if already registered.
export async function registerWellnessTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(WELLNESS_CHECK_TASK);
    if (isRegistered) return;

    await BackgroundFetch.registerTaskAsync(WELLNESS_CHECK_TASK, {
      minimumInterval: 10 * 60, // 10 minutes (iOS schedules at its own discretion)
      stopOnTerminate: false,
      startOnBoot: true,
    });

    console.log('[wellness task] Registered');
  } catch (err) {
    // BackgroundFetch can fail on simulators and restricted environments.
    console.warn('[wellness task] Registration failed (simulator?):', err);
  }
}
