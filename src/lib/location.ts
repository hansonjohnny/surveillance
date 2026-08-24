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
import type { Address } from "../types";

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

// ─── Background location ────────────────────────────────────────────────────

export const LOCATION_TASK_NAME = "BACKGROUND_LOCATION_TASK";

const SESSION_STORAGE_KEY = "@surveillance_ai/session";
const MAX_LOCATION_HISTORY = 2000; // must match useSessionStore's own cap

// Called from tasks/locationTask.ts, which can run in a headless JS context
// if Android fully kills and briefly relaunches the process despite the
// foreground service (a known edge case) — so this reads and rewrites the
// persisted AsyncStorage state directly rather than going through
// useSessionStore.getState().updateLocation(), which would persist an
// unhydrated (empty) history array over the real one in that scenario. Same
// precaution as lib/escalation.ts's updateLocalAlert.
export async function updateLocalSessionLocation(
  lat: number,
  lng: number,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const state = parsed.state;
    if (!state?.isActive) return; // no active session to attach this update to

    parsed.state = {
      ...state,
      lastLocation: { lat, lng },
      locationHistory: [
        ...(state.locationHistory ?? []),
        { lat, lng, timestamp: Date.now() },
      ].slice(-MAX_LOCATION_HISTORY),
    };
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(parsed));
  } catch (err) {
    console.error("[location] updateLocalSessionLocation failed:", err);
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
