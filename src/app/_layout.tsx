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
import { AppState, Platform } from "react-native";
import "../../global.css";
import { PendingAlertBanner } from "../components/alerts/PendingAlertBanner";
import { checkEscalations } from "../lib/escalation";
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
// Side-effect imports — register background tasks with TaskManager at
// module load time so the background runtime can find the task definitions.
// locationTask has no register*Task() call here — it's started/stopped with
// the session itself (see useSessionStore), but still needs its definition
// registered up front like the other two.
import "../tasks/wellnessTask";
import "../tasks/escalationTask";
import "../tasks/locationTask";
import "../tasks/remoteSessionTask";
import { registerWellnessTask } from "../tasks/wellnessTask";
import { registerEscalationTask } from "../tasks/escalationTask";
import { registerRemoteSessionTask } from "../tasks/remoteSessionTask";
import { maybeRunMediaCleanup } from "../lib/storage";
import { syncSettingsFromSupabase } from "../lib/settingsSync";
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

// Parses a surveillanceai://guardian-confirm?linkId=... deep link (sent
// via the confirmation email lib/guardian.ts's inviteWard fires) and
// returns the guardian_links row id, or null.
function parseGuardianConfirmUrl(url: string): string | null {
  if (!url.startsWith("surveillanceai://guardian-confirm")) return null;
  const query = url.includes("?") ? url.split("?")[1] : "";
  const params = Object.fromEntries(new URLSearchParams(query));
  return params.linkId ?? null;
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

  // A guardian-confirm deep link's linkId, if one arrived — non-null
  // triggers routing to /guardian-confirm in the routing effect below,
  // same pattern as pendingReset. Lives in useSettingsStore (not local
  // state) so guardian-confirm.tsx can also set it when the person needs
  // to sign in first — the routing effect below picks it up the moment
  // isAuthenticated flips true, regardless of which path set it.
  const pendingGuardianConfirm = useSettingsStore(
    (s) => s.pendingGuardianConfirmLinkId,
  );

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
        useSettingsStore.getState().setRole("self");
        useSettingsStore.getState().setIsWard(false);

        // Sync plan + role from DB to local store so the monitoring cycle
        // and post-onboarding routing use the correct values even after a
        // reinstall or AsyncStorage wipe.
        supabase
          .from("users")
          .select("plan, role")
          .eq("id", s.user.id)
          .single()
          .then(({ data }) => {
            if (data?.plan) useSettingsStore.getState().setPlan(data.plan);
            if (data?.role) useSettingsStore.getState().setRole(data.role);
          })
          .catch(console.warn);

        // Sync isWard too — a separate table, so a separate query.
        // Determines whether the Guardian menu row in Settings should be
        // shown; see migration 012.
        supabase
          .from("guardian_links")
          .select("id")
          .eq("ward_id", s.user.id)
          .in("status", ["pending", "active"])
          .limit(1)
          .then(({ data }) => {
            useSettingsStore.getState().setIsWard((data?.length ?? 0) > 0);
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

        // Picks up a guardian's remotely-set monitoring interval/shake
        // sensitivity (see lib/settingsSync.ts) — harmless round-trip for
        // a non-linked user, since it just re-syncs their own values.
        syncSettingsFromSupabase(s.user.id).catch(console.warn);

        if (!useSettingsStore.getState().onboardingComplete) {
          useSettingsStore.getState().markOnboardingComplete();
        }

        // Opportunistic, at-most-once-a-day retention sweep for old event
        // media (see supabase/functions/cleanup-old-media) — any signed-in
        // user can trigger it, it's a global sweep, not scoped to them.
        maybeRunMediaCleanup().catch(console.warn);
      } else if (Platform.OS !== "web" && !useSettingsStore.getState().onboardingComplete) {
        // No session — fall back to Secure Store (handles iOS reinstall and
        // the gap between session expiry and next sign-in). SecureStore has
        // no real implementation on web (its web module is an empty stub —
        // calling it throws) and the "reinstall" concept this recovers from
        // doesn't apply to a web visitor anyway, so skip entirely there.
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
        const linkId = parseGuardianConfirmUrl(initialUrl);
        if (linkId) {
          useSettingsStore.getState().updateSettings({
            pendingGuardianConfirmLinkId: linkId,
          });
        }
      }

      // Register the wellness notification category and background task.
      // Both calls are safe to repeat — they no-op if already registered.
      registerWellnessCategory().catch(console.warn);
      registerWellnessTask().catch(console.warn);
      registerEscalationTask().catch(console.warn);
      registerRemoteSessionTask().catch(console.warn);

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
          useSettingsStore.getState().setRole("self");
          useSettingsStore.getState().setIsWard(false);

          // Re-sync plan + role on every sign-in so the local store always
          // matches what's in the database.
          supabase
            .from("users")
            .select("plan, role")
            .eq("id", newSession.user.id)
            .single()
            .then(({ data }) => {
              if (data?.plan) useSettingsStore.getState().setPlan(data.plan);
              if (data?.role) useSettingsStore.getState().setRole(data.role);
            })
            .catch(console.warn);

          supabase
            .from("guardian_links")
            .select("id")
            .eq("ward_id", newSession.user.id)
            .in("status", ["pending", "active"])
            .limit(1)
            .then(({ data }) => {
              useSettingsStore.getState().setIsWard((data?.length ?? 0) > 0);
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
      const linkId = parseGuardianConfirmUrl(event.url);
      if (linkId) {
        useSettingsStore.getState().updateSettings({
          pendingGuardianConfirmLinkId: linkId,
        });
      }
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

  // ── 6. Escalation check on foreground ─────────────────────────────────────
  // The background task (registered above) checks on its own coarse
  // ~5min-at-best cadence; this catches most real cases faster by also
  // checking the moment the user actually opens the app. rehydrate() pulls
  // any change checkEscalations() made to AsyncStorage back into the live
  // store so the Alerts screen reflects it without needing a restart.

  useEffect(() => {
    checkEscalations()
      .then(() => useAlertStore.persist.rehydrate())
      .catch(console.warn);

    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      checkEscalations()
        .then(() => useAlertStore.persist.rehydrate())
        .catch(console.warn);
    });

    return () => sub.remove();
  }, []);

  // ── 7. Routing effect ─────────────────────────────────────────────────────

  useEffect(() => {
    // Wait for fonts (prevents flash of unstyled text) and session check.
    if (!(fontsLoaded || fontError) || !ready) return;

    SplashScreen.hideAsync().catch(console.warn);

    // Web is a guardian-only companion dashboard for an existing account —
    // not a place to run the ward-oriented landing/onboarding flow (camera/
    // location permission screens, "Start Surveillance" preview, etc. make
    // no sense in a browser, and a ward account has no reason to be here at
    // all). Kept fully separate from the native routing logic below rather
    // than threaded through it, so this can never affect native's
    // onboarding-resume/deep-link handling.
    if (Platform.OS === "web") {
      if (hasInitialRouted.current) {
        if (!isAuthenticated) router.replace("/(auth)/sign-in");
        return;
      }
      hasInitialRouted.current = true;
      router.replace(isAuthenticated ? "/guardian" : "/(auth)/sign-in");
      return;
    }

    // A pending reset deep link always takes priority.
    if (pendingReset) {
      router.replace({
        pathname: "/(auth)/reset-password",
        params: pendingReset,
      });
      setPendingReset(null);
      return;
    }

    // Same priority for a guardian-confirm link — only meaningful once
    // signed in (the ward needs their own session to accept/decline), so
    // it waits behind sign-in rather than being handled here directly.
    if (pendingGuardianConfirm && isAuthenticated) {
      router.replace({
        pathname: "/guardian-confirm",
        params: { linkId: pendingGuardianConfirm },
      });
      useSettingsStore.getState().updateSettings({
        pendingGuardianConfirmLinkId: null,
      });
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

    // Fully authenticated and onboarded — go to the main app. A guardian
    // lands on their ward list instead of the self-monitoring Home screen
    // (sign-up.tsx does the equivalent explicit redirect right after a
    // fresh sign-up; this covers every later app open).
    const { role } = useSettingsStore.getState();
    router.replace(role === "guardian" ? "/guardian" : "/(tabs)/home");
  }, [
    fontsLoaded,
    fontError,
    ready,
    isAuthenticated,
    pendingReset,
    pendingGuardianConfirm,
  ]);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg.primary },
          animation: "slide_from_right",
        }}
      />
      <PendingAlertBanner />
    </>
  );
}
