// Wellness check-in system.
//
// Flow:
//   1. User sets a daily check-in time in Settings.
//   2. A daily notification fires at that time with an "I'm Safe" action.
//   3. If the user taps "I'm Safe", confirmSafe() is called via the
//      notification response listener in _layout.tsx.
//   4. WELLNESS_CHECK_TASK runs in the background. If 10 minutes have
//      passed since the check-in time with no confirmation, it calls
//      triggerWellnessAlert() to SMS and email the emergency contact.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import type { Contact } from "../types";
import { sendSMS, sendEmail } from "./alerts";
import { getCurrentLocation, getGoogleMapsLink } from "./location";

// ─── AsyncStorage keys ────────────────────────────────────────────────────────

const KEY_NOTIFICATION_ID = "@wellness/notification_id";
const KEY_CHECK_IN_TIME = "@wellness/check_in_time"; // "HH:mm" 24h
const KEY_CONFIRMED_AT = "@wellness/confirmed_at"; // ISO string
const KEY_ALERTED_DATE = "@wellness/alerted_date"; // "YYYY-MM-DD"

// ─── Notification category constants ─────────────────────────────────────────

export const WELLNESS_CATEGORY = "wellness-checkin";
export const WELLNESS_ACTION_SAFE = "CONFIRM_SAFE";

// Registers the "I'm Safe" notification action. Safe to call multiple times.
export async function registerWellnessCategory(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(WELLNESS_CATEGORY, [
      {
        identifier: WELLNESS_ACTION_SAFE,
        buttonTitle: "I'm Safe",
        options: { opensAppToForeground: false },
      },
    ]);
  } catch (err) {
    console.error("[wellness] registerWellnessCategory failed:", err);
  }
}

// ─── Scheduling ───────────────────────────────────────────────────────────────

// Cancels any existing wellness notification and schedules a new daily one
// at the given time. `time` must be "HH:mm" in 24-hour format.
export async function scheduleWellnessCheckIn(time: string): Promise<void> {
  try {
    await cancelWellnessCheckIn();
    await registerWellnessCategory();

    const [hourStr, minuteStr] = time.split(":");
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr ?? "0", 10);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Wellness check-in",
        body: "Are you safe? Tap to confirm.",
        categoryIdentifier: WELLNESS_CATEGORY,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });

    await AsyncStorage.setItem(KEY_NOTIFICATION_ID, id);
    await AsyncStorage.setItem(KEY_CHECK_IN_TIME, time);
  } catch (err) {
    console.error("[wellness] scheduleWellnessCheckIn failed:", err);
  }
}

export async function cancelWellnessCheckIn(): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(KEY_NOTIFICATION_ID);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
    await AsyncStorage.multiRemove([KEY_NOTIFICATION_ID, KEY_CHECK_IN_TIME]);
  } catch (err) {
    console.error("[wellness] cancelWellnessCheckIn failed:", err);
  }
}

// ─── Confirmation ─────────────────────────────────────────────────────────────

// Called when the user taps "I'm Safe" on the notification. Persists a
// timestamp so the background task knows a confirmation exists.
export async function confirmSafe(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_CONFIRMED_AT, new Date().toISOString());
  } catch (err) {
    console.error("[wellness] confirmSafe failed:", err);
  }
}

// ─── Alert ────────────────────────────────────────────────────────────────────

// Sends SMS and email to the emergency contact. No phone call for wellness
// alerts — only High-risk surveillance events place calls.
export async function triggerWellnessAlert(contact: Contact): Promise<void> {
  try {
    const location = await getCurrentLocation();
    const mapsLink = location
      ? getGoogleMapsLink(location.lat, location.lng)
      : "Location unavailable";

    const smsMessage =
      `Wellness check: ${contact.name} has not confirmed they are safe. ` +
      `Last known location: ${mapsLink}`;

    const emailSubject = `Wellness Check - ${contact.name} has not confirmed they are safe`;
    const emailBody =
      `SURVEILLANCE AI - WELLNESS CHECK ALERT\n` +
      `${"=".repeat(40)}\n\n` +
      `${contact.name} has not confirmed they are safe after their scheduled check-in.\n\n` +
      `DETAILS\n` +
      `-------\n` +
      `Person: ${contact.name}\n` +
      `Time: ${new Date().toLocaleString()}\n\n` +
      `LOCATION\n` +
      `--------\n` +
      `${mapsLink}\n` +
      (location ? `Coordinates: ${location.lat}, ${location.lng}\n` : "") +
      `\n${"=".repeat(40)}\n` +
      `This alert was generated automatically by Surveillance AI.\n` +
      `If this is a false alarm, please contact ${contact.name} directly.`;

    await Promise.all([
      sendSMS(contact.phone, smsMessage),
      sendEmail(contact.email, emailSubject, emailBody, contact.name),
    ]);

    // Store today's date so the background task does not re-fire today.
    await AsyncStorage.setItem(
      KEY_ALERTED_DATE,
      new Date().toISOString().split("T")[0],
    );

    console.log("[wellness] alert sent to", contact.name);
  } catch (err) {
    console.error("[wellness] triggerWellnessAlert failed:", err);
  }
}

// ─── Window check (used by WELLNESS_CHECK_TASK) ───────────────────────────────

// Returns true if the 10-minute post-check-in window has passed with no
// confirmation and no alert has already fired today.
export async function checkWellnessWindow(): Promise<boolean> {
  try {
    const checkInTime = await AsyncStorage.getItem(KEY_CHECK_IN_TIME);
    if (!checkInTime) return false;

    const [hourStr, minuteStr] = checkInTime.split(":");
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr ?? "0", 10);

    const now = new Date();

    // Find the most recent occurrence of the check-in time.
    const checkInDatetime = new Date(now);
    checkInDatetime.setHours(hour, minute, 0, 0);

    if (checkInDatetime > now) {
      // Today's check-in hasn't fired yet — look at yesterday's.
      checkInDatetime.setDate(checkInDatetime.getDate() - 1);
    }

    const windowClose = new Date(checkInDatetime.getTime() + 10 * 60 * 1000);

    // The 10-minute window hasn't closed yet.
    if (now < windowClose) return false;

    // Already alerted today — don't re-fire.
    const today = now.toISOString().split("T")[0];
    const alertedDate = await AsyncStorage.getItem(KEY_ALERTED_DATE);
    if (alertedDate === today) return false;

    // User confirmed safe after the check-in fired.
    const confirmedAtRaw = await AsyncStorage.getItem(KEY_CONFIRMED_AT);
    if (confirmedAtRaw) {
      const confirmedAt = new Date(confirmedAtRaw);
      if (confirmedAt >= checkInDatetime) return false;
    }

    return true;
  } catch (err) {
    console.error("[wellness] checkWellnessWindow failed:", err);
    return false;
  }
}
