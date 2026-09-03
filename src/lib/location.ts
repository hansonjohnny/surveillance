// GPS tracking utilities for the monitoring loop.
// requestLocationPermission requests foreground permission (and background on iOS).
// startLocationTracking uses watchPositionAsync (foreground watcher, for the
// Live screen's fine-grained trail while the app is open).
// True background tracking uses Location.startLocationUpdatesAsync — see
// startBackgroundLocationTracking below and tasks/locationTask.ts for the
// task definition it's paired with.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Alert, Platform } from "react-native";
// Circular import, safe by the same rule already used between
// useSessionStore.ts and lib/monitoring.ts: useSessionStore is only
// referenced inside function bodies below, never at module-evaluation
// time, so it doesn't matter which of the two modules Metro/TS loads
// first.
import { useSessionStore } from "../store/useSessionStore";
import type { Address } from "../types";
import { generateUUID } from "./id";
import { sendLocalNotification } from "./notifications";
import { syncSettingsFromSupabase } from "./settingsSync";
import { supabase } from "./supabase";
import { syncSurveillanceWidget } from "../widgets/syncWidget";

export type LocationPermissionStatus = "denied" | "foreground" | "background";

export async function requestLocationPermission(): Promise<LocationPermissionStatus> {
  try {
    await new Promise<void>((resolve) => {
      Alert.alert(
        "Location Access",
        'Surveillance AI needs your location to log your position during every monitoring cycle and to send precise GPS coordinates to your emergency contact if a high-risk event occurs. Selecting "Always Allow" enables background monitoring.',
        [{ text: "Continue", onPress: () => resolve() }],
      );
    });

    const { status: foreground } =
      await Location.requestForegroundPermissionsAsync();
    if (foreground !== "granted") return "denied";

    // On Android 10+, requestBackgroundPermissionsAsync opens the system
    // Settings app rather than showing an in-app dialog. This takes the user
    // out of the app mid-onboarding and can leave the permission flow stuck.
    // Skip it on Android — foreground location is sufficient for the
    // monitoring loop. The user can enable "Allow all the time" in Settings later.
    if (Platform.OS === "android") return "foreground";

    const { status: background } =
      await Location.requestBackgroundPermissionsAsync();
    return background === "granted" ? "background" : "foreground";
  } catch (err) {
    console.error("[location] requestLocationPermission failed:", err);
    return "denied";
  }
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<Address | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Android's native Geocoder can hang for the full 5-second OS timeout.
    // Race against a 3-second deadline so monitoring cycles are not held up.
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("reverseGeocode timeout")), 3000);
    });
    const results = await Promise.race([
      Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }),
      timeout,
    ]);
    if (!results.length) return null;
    const r = results[0];
    return {
      name: r.name ?? null,
      street: r.street ?? null,
      streetNumber: r.streetNumber ?? null,
      district: r.district ?? null,
      city: r.city ?? null,
      subregion: r.subregion ?? null,
      region: r.region ?? null,
      country: r.country ?? null,
      isoCountryCode: r.isoCountryCode ?? null,
      postalCode: r.postalCode ?? null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function formatAddress(address: Address): string {
  const parts: string[] = [];
  if (address.name) parts.push(address.name);
  const streetLine = [address.streetNumber, address.street].filter(Boolean).join(" ");
  if (streetLine) parts.push(streetLine);
  if (address.district) parts.push(address.district);
  const cityLine = [address.city, address.subregion].filter(Boolean).join(", ");
  if (cityLine) parts.push(cityLine);
  if (address.region) parts.push(address.region);
  const countryLine = [address.postalCode, address.country].filter(Boolean).join(" ");
  if (countryLine) parts.push(countryLine);
  return parts.join(", ");
}

export async function getCurrentLocation(): Promise<{
  lat: number;
  lng: number;
} | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") return null;

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const { latitude: lat, longitude: lng } = pos.coords;
    return { lat, lng };
  } catch (err) {
    console.error("[location] getCurrentLocation failed:", err);
    return null;
  }
}

// Starts a continuous position watcher. Returns a cleanup function that
// stops the watcher — call it when the session ends.
export async function startLocationTracking(
  onUpdate: (coords: { lat: number; lng: number }) => void,
): Promise<() => void> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") {
      console.warn("[location] startLocationTracking: permission not granted");
      return () => {};
    }

    const watcher = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 5,
      },
      (pos) => {
        onUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
    );

    return () => watcher.remove();
  } catch (err) {
    console.error("[location] startLocationTracking failed:", err);
    return () => {};
  }
}

export function getGoogleMapsLink(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

// Directions to a single point, e.g. a guardian navigating to a ward's
// last known location. Origin is deliberately omitted -- Google Maps
// defaults it to the opening device's current location, so this needs no
// location permission of its own.
export function getDirectionsUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${lat},${lng}`,
    travelmode: "driving",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

// ─── Background location ────────────────────────────────────────────────────

export const LOCATION_TASK_NAME = "BACKGROUND_LOCATION_TASK";

export const SESSION_STORAGE_KEY = "@surveillance_ai/session";
const MAX_LOCATION_HISTORY = 2000; // must match useSessionStore's own cap

// Called from tasks/locationTask.ts, which can run in a headless JS context
// if Android fully kills and briefly relaunches the process despite the
// foreground service (a known edge case) — so this reads and rewrites the
// persisted AsyncStorage state directly rather than going through
// useSessionStore.getState().updateLocation(), which would persist an
// unhydrated (empty) history array over the real one in that scenario. Same
// precaution as lib/escalation.ts's updateLocalAlert.
//
// Returns the active session's userId/sessionId so the caller can also
// call maybePushLocationPing without a second AsyncStorage read — null
// when there's no active session to attach this update to.
export async function updateLocalSessionLocation(
  lat: number,
  lng: number,
): Promise<{ userId: string | null; sessionId: string | null } | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const state = parsed.state;
    if (!state?.isActive) return null; // no active session to attach this update to

    parsed.state = {
      ...state,
      lastLocation: { lat, lng },
      locationHistory: [
        ...(state.locationHistory ?? []),
        { lat, lng, timestamp: Date.now() },
      ].slice(-MAX_LOCATION_HISTORY),
    };
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed));
    return { userId: state.userId ?? null, sessionId: state.sessionId ?? null };
  } catch (err) {
    console.error("[location] updateLocalSessionLocation failed:", err);
    return null;
  }
}

// Starts a monitoring session from a headless context — a remote-start
// push notification's background task (tasks/remoteSessionTask.ts).
//
// A background task triggered while the app process is still alive (just
// backgrounded, not killed) runs in the SAME JS engine as the rest of the
// app, so useSessionStore is the real, already-hydrated singleton — call
// its actual startSession() action so the monitoring-cycle interval and
// shake-detection listener genuinely start, not just a persisted flag.
// useSessionStore.persist.hasHydrated() is what tells the two cases
// apart: a fully-killed app woken solely to run this task gets a freshly
// re-evaluated store module whose rehydration hasn't finished, and
// calling its set()-based actions on that not-yet-hydrated state would
// overwrite the real persisted history with blank defaults — so that
// case falls back to writing directly into the same persisted
// AsyncStorage key instead. Same direct-AsyncStorage precaution as
// updateLocalSessionLocation above and lib/escalation.ts's
// updateLocalAlert; the tradeoff there is unchanged from before this
// fallback existed — the monitoring cycle/shake detection only actually
// start once the app is next opened.
// `notify` defaults to true (the remote-start push case — the ward wasn't
// the one who triggered this, so they need telling). The home-screen
// widget's Start button (widgets/widgetTaskHandler.tsx) is the one other
// caller, and passes `notify: false` since the ward just tapped it
// themselves — a "Monitoring Started" notification would be redundant.
export async function beginMonitoringSession(
  { notify = true }: { notify?: boolean } = {},
): Promise<void> {
  try {
    if (useSessionStore.persist.hasHydrated()) {
      if (!useSessionStore.getState().isActive) {
        // Pull the freshest monitoring interval/shake sensitivity before
        // starting — startSession() reads useSettingsStore once, right
        // here, to set up the cycle interval, so a guardian's very recent
        // change (see lib/settingsSync.ts) needs to have landed locally
        // before this point, not just eventually on next app launch.
        const { userId } = useSessionStore.getState();
        if (userId) {
          await syncSettingsFromSupabase(userId);
        }

        useSessionStore.getState().startSession();
        if (notify) {
          await sendLocalNotification(
            "Monitoring Started",
            "Your guardian started monitoring.",
          );
        }
      }
      return;
    }

    const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    const state = parsed.state ?? {};

    if (state.isActive) return; // already running, nothing to do

    const sessionId = generateUUID();
    const userId: string | null = state.userId ?? null;

    parsed.state = {
      ...state,
      isActive: true,
      sessionId,
      sessionStartTime: Date.now(),
      lastRiskLevel: "low",
      cycleCount: 0,
      locationHistory: [],
    };
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed));
    syncSurveillanceWidget();

    await startBackgroundLocationTracking();

    if (userId) {
      const { error } = await supabase
        .from("sessions")
        .upsert({ id: sessionId, user_id: userId });
      if (error) {
        console.error(
          "[location] beginMonitoringSession: failed to create session row:",
          error.message,
        );
      }
    }

    if (notify) {
      await sendLocalNotification(
        "Monitoring Started",
        "Your guardian started monitoring.",
      );
    }
  } catch (err) {
    console.error("[location] beginMonitoringSession failed:", err);
  }
}

// Mirrors beginMonitoringSession above, for a remote-stop push. Same
// hasHydrated()-gated choice between calling the real stopSession()
// action (kills the live monitoring-cycle interval and shake-detection
// listener, not just a flag) and the direct-AsyncStorage fallback for a
// genuinely cold-started headless context.
export async function endMonitoringSession(
  { notify = true }: { notify?: boolean } = {},
): Promise<void> {
  try {
    if (useSessionStore.persist.hasHydrated()) {
      if (useSessionStore.getState().isActive) {
        useSessionStore.getState().stopSession();
        if (notify) {
          await sendLocalNotification(
            "Monitoring Stopped",
            "Your guardian stopped monitoring.",
          );
        }
      }
      return;
    }

    const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const state = parsed.state;
    if (!state?.isActive) return;

    const sessionId: string | null = state.sessionId ?? null;
    const userId: string | null = state.userId ?? null;

    parsed.state = {
      ...state,
      isActive: false,
      sessionId: null,
      sessionStartTime: null,
      lastRiskLevel: null,
      lastAISummary: null,
      cycleCount: 0,
    };
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed));
    syncSurveillanceWidget();

    await stopBackgroundLocationTracking();

    if (sessionId && userId) {
      const { error } = await supabase
        .from("sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", sessionId);
      if (error) {
        console.error(
          "[location] endMonitoringSession: failed to close session row:",
          error.message,
        );
      }
    }

    if (notify) {
      await sendLocalNotification(
        "Monitoring Stopped",
        "Your guardian stopped monitoring.",
      );
    }
  } catch (err) {
    console.error("[location] endMonitoringSession failed:", err);
  }
}

const LAST_PING_KEY = "@surveillance_ai/last_location_ping";
const PING_INTERVAL_MS = 12000; // denser than the AI monitoring cycle, independent of it

// The single source of truth for "where is this session right now" from
// the server's point of view — updates sessions.last_lat/last_lng (what
// Live Share and the guardian dashboard's Live Map both read) and
// appends to location_points (the trail behind the guardian's Location
// History tab). Called from both the foreground watcher
// (useSessionStore's startLocationHistoryTracking) and the background
// task (tasks/locationTask.ts), throttled via AsyncStorage rather than a
// module variable so the throttle survives the background task's
// headless JS context being freshly spun up per invocation.
export async function maybePushLocationPing(
  userId: string,
  sessionId: string,
  lat: number,
  lng: number,
): Promise<void> {
  try {
    const lastPingRaw = await AsyncStorage.getItem(LAST_PING_KEY);
    const lastPingAt = lastPingRaw ? Number(lastPingRaw) : 0;
    if (Date.now() - lastPingAt < PING_INTERVAL_MS) return;
    await AsyncStorage.setItem(LAST_PING_KEY, String(Date.now()));

    await Promise.all([
      supabase.from("location_points").insert({
        user_id: userId,
        session_id: sessionId,
        lat,
        lng,
      }),
      supabase
        .from("sessions")
        .update({
          last_lat: lat,
          last_lng: lng,
          last_location_at: new Date().toISOString(),
        })
        .eq("id", sessionId),
    ]);
  } catch (err) {
    console.error("[location] maybePushLocationPing failed:", err);
  }
}

// Starts/stops with the session (see useSessionStore) rather than once at
// app launch — unlike the Wellness/Escalation background tasks, there's no
// point receiving location updates when no session is running. The
// foregroundService option is required on Android 8+ for any background
// location tracking and shows a persistent notification while active.
export async function startBackgroundLocationTracking(): Promise<void> {
  try {
    const { status } = await Location.getBackgroundPermissionsAsync();
    if (status !== "granted") {
      console.warn(
        "[location] startBackgroundLocationTracking: background permission not granted",
      );
      return;
    }

    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TASK_NAME,
    ).catch(() => false);
    if (alreadyStarted) return;

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 5,
      foregroundService: {
        notificationTitle: "Surveillance AI",
        notificationBody: "Monitoring your location",
      },
    });
  } catch (err) {
    console.error("[location] startBackgroundLocationTracking failed:", err);
  }
}

export async function stopBackgroundLocationTracking(): Promise<void> {
  try {
    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TASK_NAME,
    ).catch(() => false);
    if (!alreadyStarted) return;

    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch (err) {
    console.error("[location] stopBackgroundLocationTracking failed:", err);
  }
}
