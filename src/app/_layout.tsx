/*
 * app/_layout.tsx — Root layout
 *
 * Three responsibilities added in this auth step:
 *
 * 1. Auth gate
 *    On mount, await supabase.auth.getSession() and the
 *    useSettingsStore hydration. Then route once:
 *      - No session         → /(auth)/sign-in
 *      - Session, no OB     → /(onboarding)/contact
 *      - Session, OB done   → /(tabs)/home
 *    onAuthStateChange keeps session state fresh for the
 *    lifetime of the app. Sign-out anywhere auto-routes to
 *    sign-in; sign-in from other screens lets those screens
 *    navigate themselves.
 *
 * 2. Deep link listener (password reset)
 *    The Supabase reset email redirects to:
 *      surveillanceai://reset-password#access_token=...&refresh_token=...
 *    This listener catches that URL whether the app was cold-
 *    started from the link or already running. It stores the
 *    tokens in state, which triggers the routing effect to
 *    send the user to /(auth)/reset-password.
 *
 * 3. Splash screen management
 *    expo-splash-screen stays visible until fonts are loaded
 *    AND the session check is complete, preventing any flash
 *    of an unauthenticated screen.
 */

import {
  DMSans_400Regular,
  DMSans_500Medium,
} from "@expo-google-fonts/dm-sans";
import { JetBrainsMono_400Regular } from "@expo-google-fonts/jetbrains-mono";
import {
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from "@expo-google-fonts/outfit";
import type { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import "../../global.css";
import { startOfflineQueueWatcher } from "../lib/offlineQueue";
import { setupNotificationHandler } from "../lib/notifications";
import { supabase } from "../lib/supabase";
import {
  confirmSafe,
  registerWellnessCategory,
  WELLNESS_ACTION_SAFE,
  WELLNESS_CATEGORY,
} from "../lib/wellness";
import { useAlertStore } from "../store/useAlertStore";
import { useOnboardingStore } from "../store/useOnboardingStore";
import { useSessionStore } from "../store/useSessionStore";
import {
  ONBOARDING_SECURE_KEY,
  useSettingsStore,
} from "../store/useSettingsStore";
// Side-effect import — registers WELLNESS_CHECK_TASK with TaskManager at module
// load time so the background runtime can find the task definition.
import "../tasks/wellnessTask";
import { registerWellnessTask } from "../tasks/wellnessTask";
import { colors } from "../theme/colors";

SplashScreen.preventAutoHideAsync().catch(console.warn);
setupNotificationHandler();

// Tokens extracted from a surveillanceai://reset-password deep link.
type ResetTokens = { access_token: string; refresh_token: string };

// Parses a surveillanceai://reset-password URL and returns the
// access_token and refresh_token from its hash fragment, or null.
function parseResetUrl(url: string): ResetTokens | null {
  if (!url.startsWith("surveillanceai://reset-password")) return null;

  const fragment = url.includes("#")
    ? url.split("#")[1]
    : url.includes("?")
      ? url.split("?")[1]
      : "";

  const params = Object.fromEntries(new URLSearchParams(fragment));
  if (!params.access_token) return null;

  return {
    access_token: params.access_token,
    refresh_token: params.refresh_token ?? "",
  };
}

export default function RootLayout() {
  const router = useRouter();

  const [fontsLoaded, fontError] = useFonts({
    Outfit_700Bold,
    Outfit_600SemiBold,
    DMSans_400Regular,
    DMSans_500Medium,
    JetBrainsMono_400Regular,
  });

  // Set to true once the Supabase session check AND the settings store
  // hydration are both complete. Keeps the splash visible until then.
  const [ready, setReady] = useState(false);

  // Current Supabase auth session — null means unauthenticated.
  const [session, setSession] = useState<Session | null>(null);

  // Derived auth-presence signal — stable across token refreshes.
  const isAuthenticated = !!session?.user;

  // Tokens from a password-reset deep link, if one arrived before
  // the app was ready to navigate. Set to non-null to trigger routing
  // to /(auth)/reset-password in the routing effect below.
  const [pendingReset, setPendingReset] = useState<ResetTokens | null>(null);

  // Prevents the routing effect from re-running on token refreshes while
  // the user is mid-onboarding, which caused the contact screen to glitch.
  const hasInitialRouted = useRef(false);

  // ── 1. Init: check session + await settings hydration ────────────────────

  useEffect(() => {
    let mounted = true;

    async function init() {
      // Wait for both persistent stores to finish loading from AsyncStorage
      // before reading any settings or clearing the event log.
      await new Promise<void>((resolve) => {
        if (useSettingsStore.persist.hasHydrated()) {
          resolve();
          return;
        }
        const unsub = useSettingsStore.persist.onFinishHydration(() => {
          unsub();
          resolve();
        });
      });

      await new Promise<void>((resolve) => {
        if (useAlertStore.persist.hasHydrated()) {
          resolve();
          return;
        }
        const unsub = useAlertStore.persist.onFinishHydration(() => {
          unsub();
          resolve();
        });
      });

      // Reset stale daily usage counter after store hydration.
      useSettingsStore.getState().resetUsageIfNewDay();

      // Auto-clear event log now that both stores are guaranteed hydrated.
      {
        const { logClearScheduledAt, lastAutoCleared, updateSettings } =
          useSettingsStore.getState();

        if (logClearScheduledAt) {
          if (Date.now() >= new Date(logClearScheduledAt).getTime()) {
            useAlertStore.getState().clearEvents();
            updateSettings({
              logClearScheduledAt: null,
              lastAutoCleared: Date.now(),
            });
          }
        } else {
          const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
          if (!lastAutoCleared || Date.now() - lastAutoCleared >= FIVE_DAYS) {
            useAlertStore.getState().clearEvents();
            updateSettings({ lastAutoCleared: Date.now() });
          }
        }
      }

      // Fetch the current Supabase session (reads from the secure
      // on-device token cache — no network request needed).
      const {
        data: { session: s },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (s?.user?.id) {
        useSessionStore.getState().setUserId(s.user.id);

        // Reset to safe defaults before the fetch so a previous user's tier
        // is never visible while the request is in flight or if it fails.
        useSettingsStore.getState().setPlan("free");
        useSettingsStore.getState().setTodayUsage(0);

        // Sync plan from DB to local store so the monitoring cycle uses the
        // correct tier even after a reinstall or AsyncStorage wipe.
        supabase
          .from("users")
          .select("plan")
          .eq("id", s.user.id)
          .single()
          .then(({ data }) => {
            if (data?.plan) useSettingsStore.getState().setPlan(data.plan);
          })
          .catch(console.warn);
      }

      // Recovery: if AsyncStorage was wiped (reinstall, Clear Data, OS eviction),
      // restore onboardingComplete and all user data from Supabase.
      //
      // Two signals prove onboarding was done:
      //   1. A valid Supabase session — the user registered, so they finished.
      //   2. Secure Store flag — survives iOS app reinstall (Keychain persists).
      if (s?.user) {
        // Always hydrate from Supabase on cold start so settings, contact, and
        // wellness time are restored even if AsyncStorage was wiped after reinstall.
        useOnboardingStore
          .getState()
          .hydrateFromSupabase(s.user.id)
          .catch(console.warn);

        if (!useSettingsStore.getState().onboardingComplete) {
          useSettingsStore.getState().markOnboardingComplete();
        }
      } else if (!useSettingsStore.getState().onboardingComplete) {
        // No session — fall back to Secure Store (handles iOS reinstall and
        // the gap between session expiry and next sign-in).
        const stored = await SecureStore.getItemAsync(ONBOARDING_SECURE_KEY);
        if (stored === "true") {
          useSettingsStore.getState().markOnboardingComplete();
        }
      }

      // Await the initial deep-link parse so pendingReset is resolved
      // before we flip the ready flag and the splash screen hides.
      const initialUrl = await Linking.getInitialURL();
      if (!mounted) return;
      if (initialUrl) {
        const tokens = parseResetUrl(initialUrl);
        if (tokens) setPendingReset(tokens);
      }

      // Register the wellness notification category and background task.
      // Both calls are safe to repeat — they no-op if already registered.
      registerWellnessCategory().catch(console.warn);
      registerWellnessTask().catch(console.warn);

      setSession(s);
      setReady(true);
    }

    init();
    return () => {
      mounted = false;
    };
  }, []);

  // ── 2. Auth state listener ────────────────────────────────────────────────

  useEffect(() => {
    // onAuthStateChange fires on every sign-in, sign-out, and token
    // refresh for the lifetime of the app. This keeps the session
    // state in sync so the routing effect can auto-redirect on sign-out.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);

      if (newSession?.user?.id) {
        useSessionStore.getState().setUserId(newSession.user.id);

        // On explicit sign-in, restore settings and contact from Supabase.
        // This covers the reinstall → expired session → manual sign-in path
        // where init() couldn't hydrate because there was no active session.
        if (event === "SIGNED_IN") {
          useOnboardingStore
            .getState()
            .hydrateFromSupabase(newSession.user.id)
            .catch(console.warn);

          // Reset to safe defaults before the fetch — see the same comment in init().
          useSettingsStore.getState().setPlan("free");
          useSettingsStore.getState().setTodayUsage(0);

          // Re-sync plan on every sign-in so the local store always
          // matches what the admin assigned in the database.
          supabase
            .from("users")
            .select("plan")
            .eq("id", newSession.user.id)
            .single()
            .then(({ data }) => {
              if (data?.plan) useSettingsStore.getState().setPlan(data.plan);
            })
            .catch(console.warn);
        }
      } else {
        // Signed out — clear active session data and the stored user ID
        useSessionStore.getState().stopSession();
        useSessionStore.getState().setUserId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── 3. Deep link listener (password reset) ────────────────────────────────

  useEffect(() => {
    // Cold-start URL is already handled in init() above.
    // This listener handles deep links that arrive while the app is
    // already running (foreground or background).
    const sub = Linking.addEventListener("url", (event) => {
      const tokens = parseResetUrl(event.url);
      if (tokens) setPendingReset(tokens);
    });

    return () => sub.remove();
  }, []);

  // ── 4. Wellness notification response listener ────────────────────────────

  useEffect(() => {
    // Fires when the user interacts with any notification. We only act on
    // the "I'm Safe" action from wellness check-in notifications.
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const category =
          response.notification.request.content.categoryIdentifier;
        if (
          category === WELLNESS_CATEGORY &&
          response.actionIdentifier === WELLNESS_ACTION_SAFE
        ) {
          confirmSafe().catch(console.warn);
        }
      },
    );

    return () => sub.remove();
  }, []);

  // ── 5. Offline alert queue ────────────────────────────────────────────────

  useEffect(() => {
    return startOfflineQueueWatcher();
  }, []);

  // ── 6. Routing effect ─────────────────────────────────────────────────────

  useEffect(() => {
    // Wait for fonts (prevents flash of unstyled text) and session check.
    if (!(fontsLoaded || fontError) || !ready) return;

    SplashScreen.hideAsync().catch(console.warn);

    // A pending reset deep link always takes priority.
    if (pendingReset) {
      router.replace({
        pathname: "/(auth)/reset-password",
        params: pendingReset,
      });
      setPendingReset(null);
      return;
    }

    // After the initial route, only react to sign-out. Token refreshes
    // change the session object without changing isAuthenticated — ignoring
    // them prevents the onboarding screens from glitching mid-flow.
    if (hasInitialRouted.current) {
      if (!isAuthenticated) {
        router.replace("/(auth)/sign-in");
      }
      return;
    }

    hasInitialRouted.current = true;

    const { onboardingComplete } = useSettingsStore.getState();

    // No active session — if onboarding has never been completed, start the
    // full welcome and onboarding flow. If it has been completed (returning
    // user whose session expired), show sign-in.
    if (!isAuthenticated) {
      router.replace(onboardingComplete ? "/(auth)/sign-in" : "/");
      return;
    }

    // Signed in but onboarding not completed — resume at the last saved
    // screen if available (handles Android Activity restarts during permission
    // dialogs), otherwise start from the beginning.
    if (!onboardingComplete) {
      const { onboardingResumePath } = useSettingsStore.getState();
      router.replace((onboardingResumePath ?? "/") as never);
      return;
    }

    // Fully authenticated and onboarded — go to the main app.
    router.replace("/(tabs)/home");
  }, [fontsLoaded, fontError, ready, isAuthenticated, pendingReset]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg.primary },
        animation: "slide_from_right",
      }}
    />
  );
}
