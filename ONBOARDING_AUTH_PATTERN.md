# Onboarding-First Auth Pattern

A reusable pattern for React Native / Expo apps that show onboarding
before asking users to register, while ensuring returning users never
see onboarding again — and never lose their data — regardless of what
happens to their device storage.

---

## The Core Problem

Most apps face a conflict between two goals:

1. **Conversion** — show value before asking for credentials (onboarding first)
2. **Return routing** — get returning users back into the app quickly (skip onboarding, go to login)

The conflict: if you store "onboarding done" in the same place as the
auth session (e.g. only in Supabase), a signed-out user has no signal
to distinguish "never onboarded" from "onboarded but logged out."

A second problem: if all onboarding data (contact info, preferences)
lives only in AsyncStorage, a storage wipe leaves the app empty even
after the user signs back in. Supabase must be both the write
destination on completion and the recovery source when local data
is gone.

---

## The Solution: Three Persistence Layers

```
onboardingComplete flag  →  AsyncStorage (Zustand persist)     primary
                         →  Expo Secure Store (mirror)         backup

Onboarding data          →  AsyncStorage (local, instant)      primary
(contact, preferences)   →  Supabase (remote, recovery)        backup

Auth session             →  Supabase / Secure Store            managed automatically
```

All three are kept independent. Signing out never touches
`onboardingComplete` or the onboarding data. Both outlive the session.

---

## Routing Decision Tree

```
App opens (cold start)
  │
  ├─ Run recovery block (see below)
  │
  ├─ Not authenticated?
  │     ├─ onboardingComplete = true  →  /(auth)/sign-in
  │     └─ onboardingComplete = false →  / (onboarding landing)
  │
  ├─ Authenticated + onboardingComplete = false  →  / (onboarding)
  │     (safety net — shouldn't happen in normal flow)
  │
  └─ Authenticated + onboardingComplete = true   →  /(tabs)/home
```

**Mid-session sign-out** is handled separately — after the initial
route has fired, any loss of auth always goes to sign-in, never
onboarding. A user who was authenticated has definitionally completed
onboarding.

---

## Recovery Block

Run this in `_layout.tsx` init, after AsyncStorage hydration and
after the Supabase session check, before routing fires.

```ts
if (!useSettingsStore.getState().onboardingComplete) {
  if (session?.user) {
    // Session present → user registered → onboarding was completed.
    // Also restore contact/settings data — local AsyncStorage was wiped
    // (that is why onboardingComplete was missing in the first place).
    useSettingsStore.getState().markOnboardingComplete();
    useOnboardingStore.getState().hydrateFromSupabase(session.user.id)
      .catch(console.warn);
  } else {
    // No session — fall back to Secure Store (survives iOS reinstall).
    const stored = await SecureStore.getItemAsync(ONBOARDING_SECURE_KEY);
    if (stored === 'true') {
      useSettingsStore.getState().markOnboardingComplete();
    }
  }
}
```

### Why two signals for the flag?

| Signal            | What it survives                                 |
| ----------------- | ------------------------------------------------ |
| Supabase session  | AsyncStorage wipe if tokens live in Secure Store |
| Secure Store flag | iOS app uninstall (Keychain persists by default) |

---

## All Scenarios Covered

| Scenario | `onboardingComplete` | Secure Store | Session | Result |
|---|---|---|---|---|
| New user | false | empty | none | Onboarding |
| Normal sign-out | true | `'true'` | none | Sign-in |
| Session expired | true | `'true'` | none | Sign-in |
| Android Clear Cache | false | `'true'` | survives | Session recovers flag + data → Sign-in |
| Android Clear Data | false | empty | none | Onboarding + "sign in" link |
| Android uninstall + reinstall | false | empty | none | Onboarding + "sign in" link → sign-in restores flag + data |
| iOS app offload | false | `'true'` | survives | Session recovers flag + data → Sign-in |
| iOS uninstall + reinstall | false | `'true'` | none | Secure Store recovers flag → Sign-in → sign-in restores data |
| Factory Reset | false | cleared | none | Onboarding (correct) |
| Delete Account | false | cleared | none | Onboarding (correct) |

> Android uninstall + reinstall wipes everything including Secure Store
> (unlike iOS). The "Already have an account? Sign in" link on the
> onboarding landing screen is the escape hatch for this case.

---

## Implementation Checklist

### 1. Settings store — mirror flag into Secure Store

```ts
// store/useSettingsStore.ts
import * as SecureStore from 'expo-secure-store';

export const ONBOARDING_SECURE_KEY = 'onboarding_complete';

markOnboardingComplete: () => {
  set({ onboardingComplete: true });
  // Mirror into Secure Store — survives iOS reinstall (Keychain).
  SecureStore.setItemAsync(ONBOARDING_SECURE_KEY, 'true').catch(console.warn);
},
```

`onboardingComplete` must be stored via Zustand `persist` with
AsyncStorage as the storage adapter. This is the primary layer.
Secure Store is the backup — it fires silently and does not block.

### 2. Onboarding store — add `hydrateFromSupabase`

The onboarding store already has `syncToSupabase` (write to Supabase on
completion). Add the mirror function that reads back from Supabase when
local data is missing.

```ts
// store/useOnboardingStore.ts
import { useSettingsStore } from './useSettingsStore';

const SENSITIVITY_MAP   = { 0: 'low',    1: 'medium', 2: 'high'   } as const;
const REVERSE_SENS_MAP  = { low: 0,      medium: 1,   high: 2     } as const;

hydrateFromSupabase: async (userId: string) => {
  try {
    const [contactResult, settingsResult] = await Promise.all([
      supabase.from('contacts')
        .select('name, phone, email')
        .eq('user_id', userId).single(),
      supabase.from('settings')
        .select('monitoring_interval, shake_sensitivity, stealth_mode')
        .eq('user_id', userId).single(),
    ]);

    const restored: Partial<OnboardingData> = {};

    if (contactResult.data) {
      restored.contactName  = contactResult.data.name;
      restored.contactPhone = contactResult.data.phone;
      restored.contactEmail = contactResult.data.email;
    }

    if (settingsResult.data) {
      const s = settingsResult.data;
      restored.interval     = s.monitoring_interval as 20 | 30 | 60;
      restored.sensitivity  = REVERSE_SENS_MAP[s.shake_sensitivity] ?? 1;
      restored.stealthMode  = s.stealth_mode;
    }

    if (Object.keys(restored).length === 0) return;

    // Update both stores so every screen has fresh data.
    set(state => ({ data: { ...state.data, ...restored }, isComplete: true }));

    useSettingsStore.getState().updateSettings({
      contactName:       restored.contactName      ?? '',
      contactPhone:      restored.contactPhone     ?? '',
      contactEmail:      restored.contactEmail     ?? '',
      monitoringInterval: restored.interval        ?? 30,
      shakeSensitivity:  SENSITIVITY_MAP[restored.sensitivity ?? 1],
      stealthMode:       restored.stealthMode      ?? false,
    });

    // Persist locally so the next cold start uses AsyncStorage, not Supabase.
    const merged = { ...get().data, ...restored };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (e) {
    console.warn('[OnboardingStore] hydrateFromSupabase failed:', e);
  }
},
```

### 3. `_layout.tsx` — recovery + routing

```ts
// Init function (runs once on cold start):

// Step 1 — wait for Zustand hydration from AsyncStorage
await new Promise<void>((resolve) => {
  if (useSettingsStore.persist.hasHydrated()) { resolve(); return; }
  const unsub = useSettingsStore.persist.onFinishHydration(() => {
    unsub(); resolve();
  });
});

// Step 2 — get Supabase session
const { data: { session } } = await supabase.auth.getSession();

// Step 3 — recovery block
if (!useSettingsStore.getState().onboardingComplete) {
  if (session?.user) {
    useSettingsStore.getState().markOnboardingComplete();
    useOnboardingStore.getState().hydrateFromSupabase(session.user.id)
      .catch(console.warn);
  } else {
    const stored = await SecureStore.getItemAsync(ONBOARDING_SECURE_KEY);
    if (stored === 'true') {
      useSettingsStore.getState().markOnboardingComplete();
    }
  }
}

// Step 4 — set state and let routing effect fire
setSession(session);
setReady(true);
```

```ts
// Routing effect:
const hasInitialRouted = useRef(false);

useEffect(() => {
  if (!ready || !fontsLoaded) return;

  // Mid-session sign-out — always sign-in, never onboarding
  if (hasInitialRouted.current) {
    if (!isAuthenticated) router.replace('/(auth)/sign-in');
    return;
  }

  hasInitialRouted.current = true;
  const { onboardingComplete } = useSettingsStore.getState();

  if (!isAuthenticated) {
    router.replace(onboardingComplete ? '/(auth)/sign-in' : '/');
    return;
  }

  if (!onboardingComplete) {
    router.replace('/');
    return;
  }

  router.replace('/(tabs)/home');
}, [ready, fontsLoaded, isAuthenticated]);
```

### 4. Call `markOnboardingComplete()` in exactly three places

| Where | Why |
|---|---|
| Final onboarding screen (plan reveal) | Normal first-time completion |
| Sign-in success handler | Restores flag after Android reinstall |
| `_layout.tsx` recovery block | Restores flag silently on cold start |

Do not call it anywhere else. Do not call it in the sign-up success
handler — the user is still mid-onboarding at that point.

### 5. Sign-in success handler — restore flag + data, always go home

```ts
// (auth)/sign-in.tsx
if (!success) { ... return; }

// Successful sign-in proves the user registered → completed onboarding.
// Restore the flag, then pull data from Supabase in the background.
useSettingsStore.getState().markOnboardingComplete();

supabase.auth.getUser().then(({ data }) => {
  if (data.user?.id) {
    useOnboardingStore.getState().hydrateFromSupabase(data.user.id);
  }
});

router.replace('/(tabs)/home');
```

Fire `hydrateFromSupabase` without awaiting it — do not block
navigation. The data arrives before the user has time to open Settings.

Never use `onboardingComplete ? home : onboarding` here. If sign-in
succeeds, the user always has an account and always goes to home.

### 6. Onboarding landing screen — escape hatch link

```tsx
// app/index.tsx — below the primary CTA button
<Pressable onPress={() => router.push('/(auth)/sign-in')} hitSlop={12}>
  <Text>
    Already have an account?{' '}
    <Text style={{ color: colors.accent }}>Sign in</Text>
  </Text>
</Pressable>
```

This is the only reliable escape hatch for Android uninstall +
reinstall, where all on-device storage is wiped and no recovery
signal survives.

### 7. Factory Reset and Delete Account — clear both Secure Store keys

```ts
// Any action that intentionally resets the user to a blank slate must
// also delete the Secure Store flag. Otherwise the recovery block will
// restore it on the next cold start.

await AsyncStorage.clear();
await SecureStore.deleteItemAsync(ONBOARDING_SECURE_KEY);

// Normal sign-out does NOT need to clear either key.
// Only full wipe / delete account actions should clear them.
```

---

## What NOT to do

- Do not store `onboardingComplete` only in Supabase — it requires a
  network call and is unavailable when the session has expired.
- Do not store onboarding data only in AsyncStorage — it is wiped on
  Android Clear Data and uninstall. Write to Supabase on completion,
  read from Supabase on recovery.
- Do not reset `onboardingComplete` on sign-out — signing out is not
  the same as deleting the account. The flag should outlive the session.
- Do not use `onboardingComplete ? home : onboarding` in the sign-in
  success handler — successful auth always means home.
- Do not await `hydrateFromSupabase` before navigating — fire it in
  the background so sign-in feels instant. The data arrives before the
  user can open Settings.
- Do not check `onboardingComplete` from the auth state listener
  (`onAuthStateChange`) — that fires on every token refresh and will
  cause routing glitches mid-session. Only check it in the initial
  routing effect, guarded by `hasInitialRouted`.

---

## Key Packages

```
expo-secure-store       — Keychain (iOS) / EncryptedSharedPreferences (Android)
zustand + persist       — AsyncStorage-backed settings store
@supabase/supabase-js   — Auth session management and remote data recovery
expo-router             — File-based navigation with replace()
```

---

## Platform Behaviour Reference

| Storage | iOS uninstall | Android uninstall | Android Clear Data | Android Clear Cache |
|---|---|---|---|---|
| AsyncStorage | wiped | wiped | wiped | wiped |
| Expo Secure Store | **survives** (Keychain) | wiped | wiped | survives |
| Supabase session tokens (in Secure Store) | **survives** | wiped | wiped | survives |
| Supabase remote data | **survives** | **survives** | **survives** | **survives** |

iOS's Keychain persistence after uninstall is the default system
behaviour. It can be changed per-item with `kSecAttrAccessible` flags
but Expo Secure Store does not expose that option directly.

Supabase remote data is the only storage that survives every scenario
on both platforms — it is the ultimate recovery source.
