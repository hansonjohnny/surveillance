// Notification helpers — permission request, push token registration,
// immediate local alerts, and wellness check-in scheduling.
//
// setupNotificationHandler() must be called once at app startup (_layout.tsx)
// before any notification can appear. All other functions are safe to call
// independently after that.

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// ─── Startup handler ──────────────────────────────────────────────────────────

export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// ─── Permission ───────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch (err) {
    console.error("[notifications] requestNotificationPermission failed:", err);
    return false;
  }
}

// ─── Push token ───────────────────────────────────────────────────────────────

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.warn("[notifications] Push tokens require a physical device.");
      return null;
    }

    const granted = await requestNotificationPermission();
    if (!granted) return null;

    // Android notification channel — required for local alerts to appear.
    // This works without Firebase and must run before any alert is scheduled.
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("safety-alert", {
        name: "Safety Alerts",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#00E5FF",
      });
    }

    // Expo push token — requires Firebase on Android (google-services.json).
    // Fails gracefully in development if Firebase is not yet configured.
    // Local scheduled notifications continue to work without this token.
    try {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
      await AsyncStorage.setItem("pushToken", token);

      // Persisted server-side so a guardian can remotely start monitoring
      // on this device later (supabase/functions/remote-start-session) —
      // previously fetched and immediately discarded.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from("users")
          .update({ push_token: token })
          .eq("id", user.id);
        if (error) {
          console.error("[notifications] Failed to save push token:", error.message);
        }
      }

      return token;
    } catch {
      console.warn(
        "[notifications] Push token skipped — Firebase not configured. " +
          "Local notifications still work. Add google-services.json to the " +
          "project root to enable remote push on Android.",
      );
      return null;
    }
  } catch (err) {
    console.error("[notifications] registerForPushNotifications failed:", err);
    return null;
  }
}

// ─── Immediate local alert ────────────────────────────────────────────────────

export async function sendLocalNotification(
  title: string,
  body: string,
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        categoryIdentifier: "safety-alert",
      },
      trigger: null, // fires immediately
    });
  } catch (err) {
    console.error("[notifications] sendLocalNotification failed:", err);
  }
}

// ─── Wellness check-in scheduling ─────────────────────────────────────────────

export async function scheduleWellnessCheckIn(time: string): Promise<string> {
  try {
    const [hourStr, minuteStr] = time.split(":");
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Safety check-in",
        body: "Tap to confirm you are safe",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });

    return id;
  } catch (err) {
    console.error("[notifications] scheduleWellnessCheckIn failed:", err);
    return "";
  }
}

export async function cancelWellnessCheckIn(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (err) {
    console.error("[notifications] cancelWellnessCheckIn failed:", err);
  }
}
