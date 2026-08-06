# IMPLEMENTATION.md — Surveillance AI

**Step-by-step build order with vibe coding prompts**
React Native + Expo | Build one feature at a time

---

## How to use this file

Each step below has:

- **What it builds** — what gets implemented
- **Why this order** — why this step comes before the next
- **Files touched** — which files you will create or edit
- **Vibe coding prompt** — paste this directly into Claude to implement the step

Work through the steps in order. Do not skip ahead. Each step
depends on the one before it.

---

## Step 1 — Project foundation, environment, and Zustand stores

### What it builds

Sets up the `.env` file, installs all dependencies, creates the
three Zustand stores (session, alert, settings), and wires up
AsyncStorage persistence so data survives app restarts.

### Why this order

Everything else reads from these stores. Getting them right first
means no refactoring later.

### Files touched

```
.env
.gitignore
store/useSessionStore.ts
store/useAlertStore.ts
store/useSettingsStore.ts
lib/storage.ts
```

### Vibe coding prompt

```
Read AGENTS.md before writing any code.

Set up the foundational data layer for Surveillance AI.

1. Create a .env file with placeholder keys for:
   ANTHROPIC_API_KEY, OPENAI_API_KEY, TWILIO_ACCOUNT_SID,
   TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, SENDGRID_API_KEY,
   SUPABASE_URL, SUPABASE_ANON_KEY,
   EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY

2. Add .env to .gitignore if not already there.

3. Install these packages:
   npx expo install zustand @react-native-async-storage/async-storage
   expo-secure-store

4. Create store/useSessionStore.ts with Zustand + AsyncStorage
   persistence. The store must hold:
   - isActive: boolean (is surveillance running)
   - sessionId: string | null
   - sessionStartTime: number | null
   - lastRiskLevel: 'low' | 'medium' | 'high' | null
   - lastAISummary: string | null
   - lastLocation: { lat: number; lng: number } | null
   - cycleCount: number
   Actions: startSession(), stopSession(), updateRiskLevel(),
   updateLocation(), incrementCycle()

5. Create store/useAlertStore.ts with Zustand + AsyncStorage
   persistence. The store must hold:
   - events: Event[] (all monitoring cycle results)
   - alerts: Alert[] (only High-risk SOS events)
   Types:
   Event: { id, sessionId, timestamp, riskLevel, aiSummary,
            photoUri, transcript, location }
   Alert: { id, eventId, timestamp, contactName, smsSent,
            emailSent, callMade, aiSummary, location }
   Actions: addEvent(), addAlert(), clearEvents()

6. Create store/useSettingsStore.ts with Zustand + AsyncStorage
   persistence. The store must hold:
   - contactName: string
   - contactPhone: string
   - contactEmail: string
   - monitoringInterval: 20 | 30 | 60
   - shakeSensitivity: 'low' | 'medium' | 'high'
   - stealthMode: boolean
   - wellnessCheckInTime: string | null (e.g. '22:00')
   - onboardingComplete: boolean
   Actions: updateSettings(), markOnboardingComplete()

7. Create lib/storage.ts with two helper functions:
   saveSecure(key, value) — wraps expo-secure-store setItemAsync
   getSecure(key) — wraps expo-secure-store getItemAsync
   Use these for the emergency contact phone and email only.

Keep all types in a single types/index.ts file.
Show me the complete code for every file.
```

---

## Step 2 — Supabase setup and database schema

### What it builds

Creates the Supabase project schema, enables Row Level Security
on all tables, and wires up the Supabase client in the app.

### Why this order

The Edge Functions in later steps write to these tables. The schema
must exist before any function is deployed.

### Files touched

```
lib/supabase.ts
supabase/migrations/001_initial_schema.sql
```

### Vibe coding prompt

```
Read AGENTS.md before writing any code.

Set up Supabase for Surveillance AI.

1. Install the Supabase client:
   npx expo install @supabase/supabase-js

2. Create lib/supabase.ts that initialises the Supabase client
   using EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
   from the environment. Export a single `supabase` instance.

3. Create supabase/migrations/001_initial_schema.sql with these
   six tables. Enable Row Level Security on every table.
   Add RLS policies so users can only read and write their own rows.

   users:
     id uuid primary key references auth.users
     created_at timestamptz default now()

   sessions:
     id uuid primary key default gen_random_uuid()
     user_id uuid references users(id)
     started_at timestamptz
     ended_at timestamptz
     total_cycles integer default 0

   events:
     id uuid primary key default gen_random_uuid()
     session_id uuid references sessions(id)
     user_id uuid references users(id)
     timestamp timestamptz default now()
     risk_level text check (risk_level in ('low','medium','high'))
     ai_summary text
     photo_url text
     transcript text
     latitude double precision
     longitude double precision

   alerts:
     id uuid primary key default gen_random_uuid()
     event_id uuid references events(id)
     user_id uuid references users(id)
     timestamp timestamptz default now()
     contact_name text
     sms_sent boolean default false
     email_sent boolean default false
     call_made boolean default false
     ai_summary text
     latitude double precision
     longitude double precision

   contacts:
     id uuid primary key default gen_random_uuid()
     user_id uuid references users(id)
     name text not null
     phone text not null
     email text not null

   settings:
     id uuid primary key default gen_random_uuid()
     user_id uuid references users(id) unique
     monitoring_interval integer default 30
     shake_sensitivity text default 'medium'
     stealth_mode boolean default false
     wellness_checkin_time text

4. Write clear comments in the SQL explaining each table and its
   RLS policy. This is a teaching project.

Show me the complete code for every file.
```

---

## Step 3 — Supabase Auth (registration, login, password reset)

### What it builds

A complete email/password authentication system with three flows:

1. **Registration** — sign-up screen with email, password, and
   confirm password. Creates the account and sends a verification
   email (disabled in dev, enabled in production).
2. **Login** — sign-in screen with email and password.
   "Forgot password?" link on this screen.
3. **Password reset** — two screens:
   - Forgot password screen: user enters their email, Supabase
     sends a reset link
   - New password screen: user arrives from the reset email link,
     enters and confirms a new password

All four screens share the same dark design from DESIGN.md.
The tab navigation is fully protected — no user reaches the
app without a valid Supabase session.

Google OAuth and Apple Sign In are deferred to a later step.
Note: Apple Sign In becomes a legal App Store requirement on
iOS the moment any social login is offered in a published app.

### Why this order

Auth must be complete before onboarding runs. "Complete" means
the full lifecycle: create account, log in, recover access when
the password is forgotten. A user locked out of their account
with no reset option is a support problem from day one.

### Files touched

```
app/_layout.tsx
app/(auth)/sign-up.tsx
app/(auth)/sign-in.tsx
app/(auth)/forgot-password.tsx
app/(auth)/reset-password.tsx
lib/auth.ts
supabase/migrations/002_auth_trigger.sql
```

### How password reset works in Supabase + Expo

Supabase sends a password reset email containing a magic link.
That link opens the app via a deep link URL with an access token
and refresh token in the URL hash. The app must:

1. Catch the deep link when the app opens from the email
2. Extract the tokens from the URL
3. Set the Supabase session using those tokens
4. Navigate the user to the reset-password screen
5. User enters new password, app calls updateUser()

This requires the app scheme in app.json and a URL listener
in \_layout.tsx. The prompt covers all of this.

### Vibe coding prompt

```
Read AGENTS.md before writing any code.

Implement complete Supabase Auth for Surveillance AI:
registration, login, and password reset. Email/password only.
No Google, no Apple yet. Those come in a later step.

The Supabase client is already in lib/supabase.ts from Step 2.
No new packages are needed for auth itself.
Install expo-linking for deep link handling:
npx expo install expo-linking

Add to app.json under "expo":
"scheme": "surveillanceai"
This is required so the password reset email link can open
the app and land on the reset-password screen.

--- MIGRATION ---
1. Create supabase/migrations/002_auth_trigger.sql:

   -- Automatically creates a public.users row whenever a new
   -- user registers. Fires for all auth methods (email, and
   -- later Google/Apple). ON CONFLICT DO NOTHING is important
   -- -- if the trigger fires more than once for the same user
   -- (e.g. during OAuth) it will not throw an error.

   CREATE OR REPLACE FUNCTION public.handle_new_user()
   RETURNS trigger AS $$
   BEGIN
     INSERT INTO public.users (id, created_at)
     VALUES (new.id, now())
     ON CONFLICT (id) DO NOTHING;
     RETURN new;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   CREATE OR REPLACE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

--- LIB/AUTH.TS ---
2. Create lib/auth.ts with ALL of these functions:

   /*
    * lib/auth.ts
    * Complete authentication logic for Surveillance AI.
    * Uses Supabase Auth -- built-in, free, auth.uid() works
    * natively in all RLS policies. No Clerk; using Supabase Auth.
    *
    * Covers: registration, login, logout, password reset.
    * Google OAuth and Apple Sign In added in a later step.
    */

   signUp(email: string, password: string):
     Promise<{ success: boolean; error: string | null }>
   - Calls supabase.auth.signUp({ email, password })
   - Returns { success: true } on creation
   - Returns { success: false, error: message } on failure
   - Never throws -- always catch and return error as string

   signIn(email: string, password: string):
     Promise<{ success: boolean; error: string | null }>
   - Calls supabase.auth.signInWithPassword({ email, password })
   - Returns { success: true } on success
   - Returns { success: false, error: message } on failure

   signOut(): Promise<void>
   - Calls supabase.auth.signOut()

   getCurrentUser(): Promise<User | null>
   - Calls supabase.auth.getUser()
   - Returns the user object or null

   getSession(): Promise<Session | null>
   - Calls supabase.auth.getSession()
   - Returns the session or null

   sendPasswordResetEmail(email: string):
     Promise<{ success: boolean; error: string | null }>
   - Calls supabase.auth.resetPasswordForEmail(email, {
       redirectTo: 'surveillanceai://reset-password'
     })
   - The redirectTo URL must match the app scheme in app.json
     so the reset email link opens this app, not a browser
   - Returns { success: true } if the email was sent
   - Returns { success: false, error: message } on failure
   - Note: Supabase returns success even if the email does not
     exist -- this is intentional to prevent email enumeration

   updatePassword(newPassword: string):
     Promise<{ success: boolean; error: string | null }>
   - Calls supabase.auth.updateUser({ password: newPassword })
   - Only works when the user has an active session (which is
     set automatically when they open the reset link)
   - Returns { success: true } on success
   - Returns { success: false, error: message } on failure

--- APP/(AUTH)/SIGN-UP.TSX ---
3. Create app/(auth)/sign-up.tsx:

   Full screen, background: #0A0A0F, KeyboardAvoidingView

   Top branding (centred, marginTop 60):
   - Lucide Shield icon, size 48, color #00E5FF
   - "Surveillance AI" — Outfit_700Bold, #00E5FF, 26px
   - "Your safety, always on" — DM_Sans_400Regular, #8888A0, 14px

   Form (marginTop 40):
   - Headline: "Create your account" — Outfit_700Bold, #F0F0F5, 28px
   - Subtext: "Start protecting yourself today"
     DM_Sans_400Regular, #8888A0, 14px, marginBottom 28px

   Fields (gap 12px between each):
   - Email input:
     height 54, borderRadius 12
     backgroundColor rgba(255,255,255,0.05)
     borderWidth 1, borderColor rgba(255,255,255,0.10)
     focused: borderColor rgba(0,229,255,0.50),
              backgroundColor rgba(0,229,255,0.04)
     placeholder "Email address", placeholderTextColor #555568
     keyboardType email-address, autoCapitalize none

   - Password input (same style):
     placeholder "Password"
     secureTextEntry toggled by Lucide Eye/EyeOff icon (right)
     icon color #555568

   - Confirm password input (same style):
     placeholder "Confirm password"
     Same show/hide toggle
     Client-side validation: if passwords do not match, show
     "Passwords do not match" in red below this field
     Do NOT call the API if passwords do not match

   "Create Account" button:
   - height 56, borderRadius 9999, backgroundColor #00E5FF
   - marginTop 24, full width
   - Text: DM_Sans_500Medium, #0A0A0F, 16px
   - Loading: ActivityIndicator #0A0A0F, button opacity 0.7
   - Disabled while loading

   Error message (show only on API error):
   - DM_Sans_400Regular, #FF3D3D, 13px, centred, marginTop 12

   Bottom link (marginTop 32, centred):
   - "Already have an account? " — #8888A0
   - "Sign in" — #00E5FF, navigates to /(auth)/sign-in

   On success: router.replace('/(onboarding)/contact')

--- APP/(AUTH)/SIGN-IN.TSX ---
4. Create app/(auth)/sign-in.tsx:

   Same dark layout as sign-up with:
   - Headline: "Welcome back"
   - Subtext: "Sign in to continue"
   - Two fields only: Email and Password
   - "Sign In" button (same cyan pill style)

   Below the Sign In button:
   - "Forgot your password?" — DM_Sans_400Regular, #8888A0, 13px
   - Centred, marginTop 16
   - Tappable -- navigates to /(auth)/forgot-password

   Error message same as sign-up.

   Bottom link: "Don't have an account? Sign up"
   navigates to /(auth)/sign-up

   On success:
   - Check useSettingsStore.getState().onboardingComplete
   - false: router.replace('/(onboarding)/contact')
   - true: router.replace('/(tabs)/home')

--- APP/(AUTH)/FORGOT-PASSWORD.TSX ---
5. Create app/(auth)/forgot-password.tsx:

   Full screen, background: #0A0A0F

   Top (centred, marginTop 60):
   - Lucide Mail icon, size 48, color #00E5FF
   - "Reset your password" — Outfit_700Bold, #F0F0F5, 28px
   - "Enter your email and we will send you a reset link."
     DM_Sans_400Regular, #8888A0, 15px, centred, marginTop 8

   Back arrow:
   - Lucide ChevronLeft icon, top-left, navigates back to sign-in

   Form (marginTop 40):
   - Email input (same dark glass style as sign-up)
   - "Send Reset Link" button (same cyan pill style)
   - Loading state while request is in progress

   Success state (shown after the email is sent, replaces form):
   - Lucide MailCheck icon, size 56, color #00E676 (green)
   - "Check your email" — Outfit_700Bold, #F0F0F5, 24px
   - "We sent a password reset link to [email]"
     DM_Sans_400Regular, #8888A0, 15px, centred
   - "Back to sign in" ghost pill button below
     borderColor rgba(255,255,255,0.15), text #F0F0F5

   Error message same pattern as other screens.

   Calls sendPasswordResetEmail() from lib/auth.ts on submit.

--- APP/(AUTH)/RESET-PASSWORD.TSX ---
6. Create app/(auth)/reset-password.tsx:

   This screen is opened when the user taps the reset link in
   their email. The link opens the app via the deep link scheme
   surveillanceai://reset-password?access_token=...&refresh_token=...

   On mount this screen must:
   - Read the access_token and refresh_token from the URL params
     using useLocalSearchParams() from expo-router
   - Call supabase.auth.setSession({ access_token, refresh_token })
   - If setSession fails, show an error: "This reset link has
     expired. Please request a new one." with a button to go
     back to forgot-password.

   Layout (same dark design):
   - Lucide ShieldCheck icon, size 48, color #00E5FF
   - "Set new password" — Outfit_700Bold, #F0F0F5, 28px
   - "Choose a strong password for your account."
     DM_Sans_400Regular, #8888A0, 15px

   Form:
   - New password input (dark glass, show/hide toggle)
     placeholder "New password"
   - Confirm new password input (same)
     placeholder "Confirm new password"
   - Client-side validation: passwords must match
   - Password strength hint: at least 8 characters, shown
     in #8888A0 below the first field

   "Update Password" button (same cyan pill style)

   Success state (after password is updated):
   - Lucide CheckCircle2 icon, size 56, color #00E676
   - "Password updated!" — Outfit_700Bold, #F0F0F5, 24px
   - "You can now sign in with your new password."
   - "Go to Sign In" cyan pill button
     navigates to router.replace('/(auth)/sign-in')

   Calls updatePassword() from lib/auth.ts on submit.

--- APP/_LAYOUT.TSX ---
7. Update app/_layout.tsx:

   Deep link handler for password reset:
   - Use Linking.addEventListener('url', handler) in a useEffect
   - When a URL matching 'surveillanceai://reset-password' arrives,
     extract the tokens from the URL hash or query params
   - Navigate to /(auth)/reset-password with the tokens as params:
     router.push({
       pathname: '/(auth)/reset-password',
       params: { access_token, refresh_token }
     })
   - Clean up the listener in the useEffect return function

   Auth state listener:
   - supabase.auth.getSession() on first load
   - supabase.auth.onAuthStateChange() for future changes
   - Routing logic:
     session null -> /(auth)/sign-in
     session + onboardingComplete false -> /(onboarding)/contact
     session + onboardingComplete true -> /(tabs)/home
   - Store session.user.id in useSessionStore when signed in
   - Clear it on sign-out
   - Return cleanup for both listeners in useEffect

Write clear inline comments throughout, especially in:
- lib/auth.ts sendPasswordResetEmail() explaining the
  redirectTo URL and why it must match the app scheme
- lib/auth.ts updatePassword() explaining it requires an
  active session set from the reset link tokens
- app/(auth)/reset-password.tsx explaining the full flow
  from email link to session to password update
- app/_layout.tsx explaining the deep link listener

Show me the complete code for every file.
```

---

## Step 4 — GPS location tracking

### What it builds

Implements continuous GPS tracking using expo-location, logs
coordinates on every monitoring cycle, and provides a
`getCurrentLocation()` helper used by the rest of the app.

### Why this order

Location is the simplest sensor to implement and test. Getting
it working first gives confidence before tackling camera and audio.

### Files touched

```
lib/location.ts
app/(onboarding)/preferences.tsx  (permission request only)
```

### Vibe coding prompt

```
Read AGENTS.md before writing any code.

Implement GPS location tracking for Surveillance AI.

1. Install expo-location:
   npx expo install expo-location

2. Create lib/location.ts with these functions:

   requestLocationPermission(): Promise<boolean>
   - Requests foreground permission first
   - Then requests background permission (needed for Always)
   - Returns true if both are granted, false otherwise
   - Shows a plain-language explanation before the native dialog
     (use Alert.alert with the explanation before calling
     requestPermissionsAsync)

   getCurrentLocation(): Promise<{ lat: number; lng: number } | null>
   - Gets the current GPS position with accuracy: high
   - Returns null if permission is denied or location unavailable
   - Logs any errors to console — never throws

   startLocationTracking(onUpdate: (coords) => void): Promise<() => void>
   - Starts watchPositionAsync with high accuracy
   - Calls onUpdate with every new position
   - Returns a cleanup function that stops the watcher

   getGoogleMapsLink(lat: number, lng: number): string
   - Returns a Google Maps URL for the coordinates
   - Format: https://maps.google.com/?q=lat,lng

3. In app/(onboarding)/preferences.tsx, call
   requestLocationPermission() when the user taps
   "Grant Permissions" — after the camera and microphone
   requests. Show a banner if denied.

4. Add expo-location to app.json plugins array.

5. Write a short comment at the top of lib/location.ts explaining
   what the file does and why background location is required.

Show me the complete code for every file.
```

---

## Step 5 — Camera snapshot capture

### What it builds

Implements silent background photo capture using expo-camera,
saves the photo URI locally, and provides a `takeSnapshot()`
helper for the monitoring loop.

### Why this order

The camera snapshot is the input for the AI vision analysis in
the next step. It must work in isolation before AI is added.

### Files touched

```
lib/camera.ts
app/(onboarding)/preferences.tsx  (permission request)
```

### Vibe coding prompt

```
Read AGENTS.md before writing any code.

Implement silent camera snapshot capture for Surveillance AI.

1. Install expo-camera:
   npx expo install expo-camera

2. Create lib/camera.ts with these functions:

   requestCameraPermission(): Promise<boolean>
   - Requests camera permission
   - Returns true if granted

   takeSnapshot(): Promise<string | null>
   - Takes a photo using the device camera
   - Uses the back camera (facing: back)
   - Quality: 0.6 (balance between size and clarity for AI analysis)
   - Returns the local URI of the saved photo
   - Returns null if permission denied or capture fails
   - Never shows a camera UI — this is a silent capture
   - Log any errors to console

   photoToBase64(uri: string): Promise<string | null>
   - Reads the photo file and returns a base64 string
   - Used to send the image to Claude Vision
   - Returns null if the file cannot be read

3. Important note on silent capture:
   expo-camera requires a mounted CameraView component to take
   photos. Create a 1x1 pixel transparent CameraView component
   called SilentCamera in components/ui/SilentCamera.tsx that
   stays mounted on the Home screen when surveillance is active.
   The takeSnapshot() function should use a ref to this component.
   Explain this architecture clearly in a comment.

4. In app/(onboarding)/preferences.tsx, call
   requestCameraPermission() as the first permission in the
   sequence. Show a degraded-mode warning if denied.

5. Add expo-camera to app.json plugins with the microphone
   permission disabled (we handle that separately).

Show me the complete code for every file.
```

---

## Step 6 — Audio recording and Whisper transcription

### What it builds

Implements 10-second ambient audio recording using expo-av,
uploads the clip to OpenAI Whisper API via a Supabase Edge
Function, and returns the transcript.

### Why this order

Audio transcription feeds the AI threat analysis. The Edge
Function pattern established here is reused for Claude Vision
in the next step.

### Files touched

```
lib/audio.ts
supabase/functions/analyse-audio/index.ts
```

### Vibe coding prompt

```
Read AGENTS.md before writing any code.

Implement ambient audio recording and transcription for
Surveillance AI.

1. Install expo-av:
   npx expo install expo-av

2. Create lib/audio.ts with these functions:

   requestMicrophonePermission(): Promise<boolean>
   - Requests microphone permission via expo-av
   - Returns true if granted

   recordAudioClip(durationMs: number = 10000): Promise<string | null>
   - Records an audio clip for durationMs milliseconds
   - Uses low-quality preset (sufficient for voice, smaller file)
   - Saves to the app's cache directory
   - Returns the local URI of the recorded file
   - Returns null if permission denied or recording fails
   - Stops and unloads the recording object cleanly after capture

   transcribeAudio(audioUri: string): Promise<string | null>
   - Reads the audio file and converts to base64
   - Calls the Supabase Edge Function 'analyse-audio'
   - Passes the base64 audio and mime type
   - Returns the transcript string or null on failure
   - Run this ASYNCHRONOUSLY — do not await it in the main
     monitoring cycle. Return a Promise and let the cycle
     continue without waiting.

3. Create supabase/functions/analyse-audio/index.ts:
   - Accept POST with { audioBase64: string, mimeType: string }
   - Decode base64 to a buffer
   - Send to OpenAI Whisper API (model: whisper-1)
   - Return { transcript: string }
   - Use OPENAI_API_KEY from Supabase Edge Function secrets
   - Handle errors gracefully — return { transcript: null } on failure
   - Add CORS headers for the Expo client

4. In app/(onboarding)/preferences.tsx, call
   requestMicrophonePermission() as the second permission.

5. Write a comment in lib/audio.ts explaining why transcription
   is async — it should never block the monitoring cycle.

Show me the complete code for every file.
```

---

## Step 7 — Accelerometer shake detection

### What it builds

Implements continuous accelerometer monitoring using expo-sensors
to detect sudden impacts or violent shaking, and immediately
triggers a High-risk alert when the threshold is crossed.

### Why this order

The shake detector runs independently of the timed cycle. It
must be registered before the main monitoring loop so it can
fire at any time.

### Files touched

```
lib/sensors.ts
store/useSessionStore.ts  (add shake handler)
```

### Vibe coding prompt

```
Read AGENTS.md before writing any code.

Implement accelerometer shake detection for Surveillance AI.

1. Install expo-sensors:
   npx expo install expo-sensors

2. Create lib/sensors.ts with these functions:

   getShakeThreshold(sensitivity: 'low' | 'medium' | 'high'): number
   - Returns the g-force threshold for each sensitivity level
   - low: 4.0g  (only very violent impacts)
   - medium: 3.0g  (the default — falls, struggles)
   - high: 2.0g  (more sensitive — aggressive movement)

   startShakeDetection(
     sensitivity: 'low' | 'medium' | 'high',
     onShake: () => void
   ): () => void
   - Subscribes to Accelerometer updates at 100ms intervals
   - Calculates magnitude: Math.sqrt(x*x + y*y + z*z)
   - If magnitude exceeds threshold for 500ms continuously,
     calls onShake() once and resets the counter
   - Prevents double-firing: once onShake fires, wait 5 seconds
     before it can fire again
   - Returns a cleanup function that removes the subscription

   stopShakeDetection(cleanup: () => void): void
   - Calls the cleanup function from startShakeDetection

3. In store/useSessionStore.ts, add:
   - shakeDetectionCleanup: (() => void) | null
   - startShakeDetection(sensitivity, onShake) action
   - stopShakeDetection() action

4. The onShake callback (wired up in the monitoring task) must:
   - Set lastRiskLevel to 'high' in the session store
   - Set lastAISummary to 'Sudden violent movement detected'
   - Trigger the alert pipeline immediately (Step 10 covers this)
   - For now, just log 'SHAKE DETECTED' to console

5. Write a clear comment explaining why shake detection is
   separate from the timed monitoring cycle and why the
   5-second cooldown matters.

Show me the complete code for every file.
```

---

## Step 8 — AI image analysis (Claude Vision)

### What it builds

Creates the Supabase Edge Function that sends a camera snapshot
to Claude Vision alongside GPS context and returns a structured
risk score and summary.

### Why this order

This is the core intelligence of the app. Once this works,
the monitoring loop can produce meaningful output.

### Files touched

```
lib/prompts.ts
lib/anthropic.ts
supabase/functions/analyse-image/index.ts
```

### Vibe coding prompt

```
Read AGENTS.md before writing any code.

Implement AI image analysis using Claude Vision for Surveillance AI.

1. Create lib/prompts.ts with the image analysis prompt:

   export const IMAGE_ANALYSIS_PROMPT = (
     lat: number,
     lng: number,
     situation: string
   ) => `
   You are a personal safety AI monitoring a person's surroundings.
   The person is at coordinates ${lat}, ${lng}.
   Context: ${situation}

   Analyse this image for potential safety risks. Look for:
   - Signs of physical confrontation or aggression
   - People appearing distressed or threatened
   - Dangerous environments (dark alleys, isolated areas)
   - Suspicious behaviour directed at the camera holder
   - Any situation that could indicate immediate danger

   Respond ONLY with a JSON object in this exact format:
   {
     "riskLevel": "low" | "medium" | "high",
     "summary": "One sentence description of what you see",
     "concerns": ["specific concern 1", "specific concern 2"],
     "confidence": 0.0 to 1.0
   }

   Do not use em-dashes in any text. Be conservative — only rate
   high if there is clear evidence of danger. Rate low for normal
   scenes.
   `

2. Create supabase/functions/analyse-image/index.ts:
   - Accept POST with { imageBase64: string, lat: number,
     lng: number, situation: string }
   - Send to Claude API using model claude-sonnet-4-20250514
   - Pass the image as a base64 vision message
   - Parse the JSON response
   - Return { riskLevel, summary, concerns, confidence }
   - Use ANTHROPIC_API_KEY from Supabase Edge Function secrets
   - Add CORS headers
   - Handle JSON parse errors gracefully — return riskLevel: 'low'
     on any parsing failure

3. Create lib/anthropic.ts with:
   analyseImage(imageBase64, lat, lng, situation):
     Promise<{ riskLevel, summary, concerns, confidence } | null>
   - Calls the Supabase Edge Function 'analyse-image'
   - Returns null on any network or parsing error
   - Log errors to console — never throw

4. Add the audio threat analysis prompt to lib/prompts.ts:

   export const AUDIO_ANALYSIS_PROMPT = (transcript: string) => `
   You are a personal safety AI monitoring ambient conversation.

   Analyse this transcript for potential threats to the person
   carrying the recording device:
   "${transcript}"

   Look for: threats, aggressive language, sounds of distress,
   instructions to harm someone, or anything alarming.

   Respond ONLY with JSON:
   {
     "riskLevel": "low" | "medium" | "high",
     "summary": "One sentence about what was heard",
     "concerns": ["concern 1"],
     "confidence": 0.0 to 1.0
   }

   Do not use em-dashes. Be conservative.
   `

5. Add analyseAudio(transcript) to lib/anthropic.ts following
   the same pattern as analyseImage but calling a 'analyse-audio'
   text endpoint.

Show me the complete code for every file.
```

---

## Step 9 — The monitoring loop (background task)

### What it builds

Implements the core timed monitoring cycle using expo-task-manager
and expo-background-fetch. Every N seconds: capture location,
take snapshot, record audio, combine results, produce a risk
score, and save the event to the store and Supabase.

### Why this order

This is the heart of the app. All sensors from Steps 4-8 are
now available. The loop wires them together.

### Files touched

```
tasks/monitoringTask.ts
lib/monitoring.ts
app/(tabs)/home.tsx  (start/stop wiring)
app/_layout.tsx  (task registration)
```

### Vibe coding prompt

```
Read AGENTS.md before writing any code.

Implement the core monitoring loop for Surveillance AI.
This is the most important feature in the app.

1. Install background task packages:
   npx expo install expo-task-manager expo-background-fetch

2. Create tasks/monitoringTask.ts:
   - Define a background task named 'SURVEILLANCE_MONITORING_TASK'
   - The task runs one full monitoring cycle:
     a. Get current GPS location (lib/location.ts)
     b. Take a camera snapshot (lib/camera.ts)
     c. Record a 10-second audio clip (lib/audio.ts)
     d. Run image analysis on the snapshot (lib/anthropic.ts)
     e. Run audio transcription ASYNC — do not await it here
     f. Combine the image analysis result into a risk score
     g. Save the event to useAlertStore and Supabase events table
     h. Update useSessionStore with latest risk level and location
     i. If riskLevel is 'high', trigger the alert pipeline
        (call a triggerAlert() function — stub it for now)
     j. If riskLevel is 'medium', send a push notification
   - Wrap everything in try/catch — the task must never crash

3. Create lib/monitoring.ts:

   registerMonitoringTask(): Promise<void>
   - Registers the background task with TaskManager.defineTask
   - Registers with BackgroundFetch using the configured interval
   - Call this in app/_layout.tsx on app start

   startMonitoringSession(settings): Promise<string>
   - Generates a new sessionId (uuid)
   - Starts shake detection (lib/sensors.ts)
   - Starts location watcher (lib/location.ts)
   - Updates useSessionStore: isActive = true, new sessionId
   - Returns the sessionId

   stopMonitoringSession(): Promise<void>
   - Stops location watcher
   - Stops shake detection
   - Unregisters the background fetch task
   - Updates useSessionStore: isActive = false
   - Closes the session in Supabase (sets ended_at)

4. In app/_layout.tsx, call registerMonitoringTask() once on
   app load inside a useEffect.

5. In app/(tabs)/home.tsx, wire the Start/Stop button to:
   - startMonitoringSession() when starting
   - stopMonitoringSession() when stopping
   - Also start/stop expo-keep-awake accordingly

6. Add critical comments throughout explaining:
   - Why tasks must be registered before they are triggered
   - Why audio transcription is non-blocking
   - Why the task must be idempotent (safe to run multiple times)

Show me the complete code for every file.
```

---

## Step 10 — Alert pipeline (SMS, email, phone call)

### What it builds

Implements the three-channel alert system using Supabase Edge
Functions for Twilio SMS, Twilio Voice call, and SendGrid email.
Fires all three simultaneously when risk is High.

### Why this order

The monitoring loop (Step 9) already calls `triggerAlert()` as
a stub. This step implements the real function.

### Files touched

```
lib/alerts.ts
supabase/functions/send-sms/index.ts
supabase/functions/send-email/index.ts
supabase/functions/make-call/index.ts
```

### Vibe coding prompt

```
Read AGENTS.md before writing any code.

Implement the three-channel alert pipeline for Surveillance AI.

1. Create supabase/functions/send-sms/index.ts:
   - Accept POST with { to, message }
   - Send SMS via Twilio REST API
   - Use TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
     from Edge Function secrets
   - Return { success: boolean }
   - Add CORS headers

2. Create supabase/functions/send-email/index.ts:
   - Accept POST with { to, subject, body, contactName }
   - Send email via SendGrid API
   - Use SENDGRID_API_KEY from Edge Function secrets
   - Format the email as a clean plain-text safety report
   - Return { success: boolean }
   - Add CORS headers

3. Create supabase/functions/make-call/index.ts:
   - Accept POST with { to, message }
   - Create a Twilio Programmable Voice call
   - The call reads the message aloud using TwiML
   - Use Twilio secrets from Edge Function environment
   - Return { success: boolean }
   - Add CORS headers

4. Create lib/alerts.ts with:

   triggerAlert(event: Event, contact: Contact): Promise<void>
   - Deduplicate: check useAlertStore — if an alert with the same
     eventId already exists, return immediately
   - Build the SMS message:
     "SAFETY ALERT: [contact name] may need help.
      Location: [Google Maps link]
      AI detected: [summary]
      Time: [timestamp]"
   - Build the email subject and body (full report)
   - Fire all three channels using Promise.all:
     [sendSMS(), sendEmail(), makeCall()]
   - makeCall() is only called if event.source includes 'shake'
     (shake + high AI = call. AI high alone = SMS + email only)
   - Save the alert to useAlertStore and Supabase alerts table
   - Log success/failure for each channel to console

   sendSMS(to, message): Promise<boolean>
   sendEmail(to, subject, body, contactName): Promise<boolean>
   makeCall(to, message): Promise<boolean>
   - Each calls its respective Supabase Edge Function
   - Returns true on success, false on failure
   - Never throws

5. Replace the triggerAlert stub in tasks/monitoringTask.ts with
   a real call to lib/alerts.ts triggerAlert().

Show me the complete code for every file.
```

---

## Step 11 — Push notifications (Medium risk)

### What it builds

Implements expo-notifications to send a local push notification
to the user when a Medium risk event is detected. No contact
is alerted for Medium — only the user is warned.

### Why this order

Notifications complete the risk response pipeline. Low = silent
log. Medium = push to user. High = alert contact. All three
tiers are now handled.

### Files touched

```
lib/notifications.ts
tasks/monitoringTask.ts  (wire up medium risk notification)
app/(onboarding)/preferences.tsx  (permission request)
```

### Vibe coding prompt

```
Read AGENTS.md before writing any code.

Implement push notifications for medium-risk events in
Surveillance AI.

1. Install expo-notifications:
   npx expo install expo-notifications

2. Create lib/notifications.ts with:

   requestNotificationPermission(): Promise<boolean>
   - Requests notification permission
   - Returns true if granted

   registerForPushNotifications(): Promise<string | null>
   - Gets the Expo push token
   - Stores it in AsyncStorage as 'pushToken'
   - Returns the token or null on failure

   sendLocalNotification(title: string, body: string): Promise<void>
   - Sends an immediate local push notification
   - Uses Notifications.scheduleNotificationAsync with a trigger
     of 0 seconds (fires immediately)
   - Category: 'safety-alert'

   scheduleWellnessCheckIn(time: string): Promise<string>
   - Takes a time string like '22:00'
   - Schedules a repeating daily notification at that time
   - Title: "Safety check-in"
   - Body: "Tap to confirm you are safe"
   - Returns the notification identifier for cancellation

   cancelWellnessCheckIn(id: string): Promise<void>
   - Cancels a scheduled notification by identifier

   setupNotificationHandler(): void
   - Calls Notifications.setNotificationHandler with
     shouldShowAlert: true, shouldPlaySound: true,
     shouldSetBadge: false
   - Call this once in app/_layout.tsx

3. In tasks/monitoringTask.ts, add the medium risk notification:
   if (riskLevel === 'medium') {
     await sendLocalNotification(
       'Safety alert',
       `Potential concern detected: ${summary}`
     )
   }

4. In app/(onboarding)/preferences.tsx, add notification
   permission as the fourth and final permission request.
   Call registerForPushNotifications() after permission is granted.

5. Call setupNotificationHandler() in app/_layout.tsx.

Show me the complete code for every file.
```

---

## Step 12 — Stealth mode

### What it builds

Implements the stealth mode overlay — a black screen that covers
the UI when surveillance is active and stealth mode is enabled,
with a tap-to-wake behaviour that shows the UI for 3 seconds.

### Why this order

Stealth mode wraps the existing Home screen. All the underlying
features must be working first.

### Files touched

```
components/ui/StealthOverlay.tsx
app/(tabs)/home.tsx  (integrate overlay)
```

### Vibe coding prompt

```
Read AGENTS.md before writing any code.

Implement stealth mode for Surveillance AI.

1. Create components/ui/StealthOverlay.tsx:
   - A full-screen absolute-positioned View with black background
   - Animated opacity: when stealthMode is active and surveillance
     is running, fade to opacity 1 over 600ms
   - When tapped anywhere, fade to opacity 0 for 3 seconds,
     then fade back to opacity 1
   - While opacity is 0, the underlying Home screen is visible
   - The timer resets if the user taps again during the 3 seconds
   - expo-keep-awake is activated when this overlay is visible
     so the screen does not actually sleep (it just looks black)
   - The surveillance session continues running behind the overlay
     — this overlay is purely visual

2. Props:
   isVisible: boolean  (stealthMode on AND session active)
   onWake: () => void  (called when user taps to wake)

3. In app/(tabs)/home.tsx:
   - Import StealthOverlay
   - Read stealthMode from useSettingsStore
   - Read isActive from useSessionStore
   - Render <StealthOverlay isVisible={stealthMode && isActive} />
     as the last child so it renders on top of everything

4. Add a clear comment explaining why expo-keep-awake is needed
   here — the phone would normally turn off the screen after
   inactivity, but we need it to stay on (looking black) so
   background tasks keep running.

Show me the complete code for every file.
```

---

## Step 13 — Live map screen

### What it builds

Implements the Live screen with a real-time dark-styled map
showing the user's current location, the live risk badge,
and the latest AI analysis summary.

### Why this order

The Live screen reads from the session store which is now
fully populated by the monitoring loop.

### Files touched

```
app/(tabs)/live.tsx
components/map/LiveMap.tsx
components/map/UserMarker.tsx
```

### Vibe coding prompt

```
Read AGENTS.md before writing any code.

Implement the Live Status screen for Surveillance AI.

1. Ask before installing react-native-maps — explain it is needed
   for the map and ask the user to confirm.

2. Create components/map/UserMarker.tsx:
   - A custom map marker showing the user's live position
   - A filled cyan circle (8px radius) with a glow effect
   - A larger semi-transparent cyan circle pulsing around it
     (animated scale 1.0 to 2.0, opacity 1 to 0, 2000ms loop)
   - This communicates "live tracking" without any text

3. Create components/map/LiveMap.tsx:
   - A react-native-maps MapView set to the dark map style
     (use the dark JSON from DESIGN.md)
   - Region follows the user's lastLocation from useSessionStore
   - Shows the UserMarker at the current location
   - mapType: "standard" with the custom dark JSON style
   - No zoom controls, no toolbar, no Google logo visible

4. Create app/(tabs)/live.tsx:
   - Top 55%: LiveMap component
   - Bottom 45%: a glass card panel showing:
     - Current risk badge (styled per DESIGN.md)
     - Last AI summary text
     - "Last checked: X seconds ago" countdown timer
       (counts up from 0, resets on each new cycle)
     - Current GPS coordinates in JetBrains Mono
   - If session is not active, show a centred message:
     "Start a session on the Home screen to see live tracking"
   - Read all data from useSessionStore

Show me the complete code for every file.
```

---

## Step 14 — Event log screen

### What it builds

Implements the Log screen with a scrollable list of all
monitoring cycle events, expandable cards with full AI
reports, and photo thumbnails.

### Files touched

```
app/(tabs)/log.tsx
components/log/EventCard.tsx
components/log/ExpandedEventCard.tsx
```

### Vibe coding prompt

```
Read AGENTS.md before writing any code.

Implement the Event Log screen for Surveillance AI.

1. Create components/log/EventCard.tsx:
   A collapsed event card showing:
   - Left edge: 3px coloured bar (green/amber/red per risk level)
   - Top row: risk badge pill + timestamp in JetBrains Mono
   - Body: AI summary in bodyMedium, --color-text-secondary
   - Bottom row: small photo thumbnail (40x40, rounded-8)
     + transcript excerpt in italic if available
   - Background: glass card style from DESIGN.md
   - Tap to expand

2. Create components/log/ExpandedEventCard.tsx:
   The full expanded view showing:
   - Full-width photo (if available), 200px height, rounded-12
   - Full AI summary
   - Full transcript (if available)
   - GPS coordinates as a tappable link (opens Google Maps)
   - Risk level, confidence score, concerns list
   - Timestamp (full date and time)
   - Collapse button at the bottom

3. Create app/(tabs)/log.tsx:
   - FlatList of events from useAlertStore
   - Each item renders EventCard
   - Tapping an item expands it inline using Animated height
     (do not navigate to a new screen — expand in place)
   - Only one card can be expanded at a time
   - Empty state: shield icon + "No events yet. Start a session
     to begin monitoring."
   - Sort newest first

Show me the complete code for every file.
```

---

## Step 15 — Alerts screen

### What it builds

Implements the Alerts screen showing all High-risk SOS events
with details of what was sent, to whom, and when.

### Files touched

```
app/(tabs)/alerts.tsx
components/alerts/AlertCard.tsx
```

### Vibe coding prompt

```
Read AGENTS.md before writing any code.

Implement the Alerts screen for Surveillance AI.

1. Create components/alerts/AlertCard.tsx:
   A card for each High-risk SOS event showing:
   - Red left edge bar (3px, --color-risk-high)
   - "SOS FIRED" badge in red pill — JetBrains Mono uppercase
   - Timestamp (full date and time)
   - Contact name: "Sent to [name]"
   - Three channel chips showing what was sent:
     SMS chip (green if sent, grey if failed)
     Email chip (green if sent, grey if failed)
     Call chip (green if made, grey if not triggered)
     Use the alertChip style from DESIGN.md
   - AI summary below
   - GPS link (tappable, opens Google Maps)
   - Background: glass card with red glow border:
     borderColor: rgba(255, 61, 61, 0.25)
     shadowColor: #FF3D3D

2. Create app/(tabs)/alerts.tsx:
   - FlatList of alerts from useAlertStore
   - Each item renders AlertCard
   - Empty state: checkmark icon (green) + "No SOS alerts fired.
     Stay safe out there."
   - Sort newest first
   - Header stat: "X SOS alerts total" in small muted text

Show me the complete code for every file.
```

---

## Step 16 — Wellness check-in system

### What it builds

Implements the daily wellness check-in using scheduled push
notifications. If the user does not confirm they are safe by
the configured time, the app fires an SMS and email to the
emergency contact.

### Files touched

```
tasks/wellnessTask.ts
lib/wellness.ts
app/(tabs)/settings.tsx  (time picker)
```

### Vibe coding prompt

```
Read AGENTS.md before writing any code.

Implement the wellness check-in system for Surveillance AI.

1. Create lib/wellness.ts:

   scheduleWellnessCheckIn(time: string): Promise<void>
   - Cancels any existing wellness notification
   - Schedules a new daily notification at the configured time
   - Stores the notification ID in AsyncStorage
   - The notification body: "Are you safe? Tap to confirm."
   - The notification has an action button: "I'm Safe"

   cancelWellnessCheckIn(): Promise<void>
   - Retrieves the stored notification ID
   - Cancels the notification
   - Clears the stored ID

   confirmSafe(): Promise<void>
   - Called when the user taps "I'm Safe" on the notification
   - Cancels the pending alert window
   - Logs a 'safe' event to AsyncStorage with timestamp

   triggerWellnessAlert(contact: Contact): Promise<void>
   - Called if 10 minutes pass after the notification with
     no confirmation
   - Sends SMS: "Wellness check: [name] has not confirmed
     they are safe. Last known location: [GPS link]"
   - Sends email: same information with full context
   - Does NOT make a phone call for wellness alerts

2. Create tasks/wellnessTask.ts:
   - A background task named 'WELLNESS_CHECK_TASK'
   - Runs 10 minutes after the wellness notification fires
   - Checks AsyncStorage for a 'safe' confirmation
   - If no confirmation found, calls triggerWellnessAlert()
   - If confirmation found, does nothing

3. In app/(tabs)/settings.tsx, add a wellness check-in row:
   - A time picker (use a simple text input + time parsing
     for MVP — no external picker library)
   - Displayed as "Daily check-in at 10:00 PM"
   - A toggle to enable/disable
   - When enabled + time set, call scheduleWellnessCheckIn()
   - When disabled, call cancelWellnessCheckIn()

4. In app/_layout.tsx, add a notification response listener
   that catches the "I'm Safe" action and calls confirmSafe().

Show me the complete code for every file.
```

---

## Step 17 — Settings screen and onboarding completion

### What it builds

Completes the Settings screen with all controls, and ensures
the onboarding flow saves all data correctly to Zustand,
AsyncStorage, expo-secure-store, and Supabase.

### Files touched

```
app/(tabs)/settings.tsx
app/(onboarding)/contact.tsx
app/(onboarding)/preferences.tsx
```

### Vibe coding prompt

```
Read AGENTS.md before writing any code.

Complete the Settings screen and onboarding data flow for
Surveillance AI.

1. Complete app/(tabs)/settings.tsx with grouped sections:

   Section: Emergency Contact
   - Contact name, phone, email (editable text fields)
   - Save button — updates useSettingsStore, saves phone/email
     to expo-secure-store, syncs to Supabase contacts table

   Section: Monitoring
   - Interval selector: 20s / 30s / 60s (three pill buttons)
   - Shake sensitivity: Low / Medium / High (three pill buttons)

   Section: Behaviour
   - Stealth mode toggle
   - Wellness check-in time + toggle (from Step 16)

   Section: Permissions
   - Shows current status of each permission (Camera, Mic,
     Location, Notifications) with a green check or red X
   - "Open Settings" button that takes the user to their
     device settings to grant any denied permissions using
     Linking.openSettings()

   Section: Account
   - User email (read-only from Supabase Auth)
   - Sign out button

2. Complete app/(onboarding)/contact.tsx:
   - Name, phone, email fields
   - Validate: all three fields required, phone must start with +
   - On Continue: save to useSettingsStore, save phone + email
     to expo-secure-store, save to Supabase contacts table

3. Complete app/(onboarding)/preferences.tsx:
   - Show the 12-screen onboarding flow from the app plan
   - On final screen completion: call
     useSettingsStore.markOnboardingComplete()
   - Navigate to /(tabs)/home

4. Add a resetOnboarding() action to useSettingsStore that
   clears onboardingComplete — useful for testing.

Show me the complete code for every file.
```

---

## Step 18 — Final wiring, error handling, and testing checklist

### What it builds

Adds a degraded-mode banner for denied permissions, ensures
all error states are handled gracefully, and provides a
testing checklist to verify every feature works end-to-end.

### Files touched

```
components/ui/DegradedModeBanner.tsx
app/(tabs)/home.tsx  (final state)
TESTING.md
```

### Vibe coding prompt

```
Read AGENTS.md before writing any code.

Complete the final wiring and error handling for Surveillance AI.

1. Create components/ui/DegradedModeBanner.tsx:
   - A non-dismissable amber banner shown at the top of the
     Home screen when camera or microphone permission is denied
   - Text: "Camera disabled — visual analysis unavailable" or
     "Microphone disabled — audio analysis unavailable"
   - Background: rgba(255, 215, 64, 0.12)
   - Border: 1px solid rgba(255, 215, 64, 0.30)
   - A "Fix in Settings" button that calls Linking.openSettings()

2. In app/(tabs)/home.tsx, check camera and microphone
   permissions on mount and show the appropriate banner.

3. Audit every lib/ function and ensure:
   - Every async function has a try/catch
   - No function throws — all return null or false on failure
   - Every catch logs the error to console with a clear prefix
     e.g. "[camera] takeSnapshot failed: ..."

4. Create TESTING.md with a manual testing checklist:
   - Auth: sign up, sign in, sign out
   - Onboarding: complete all 12 screens, data persists
   - Permissions: test each denied permission + degraded mode
   - Session: start, run for 60 seconds, stop, check event log
   - Background: minimise app, wait 30 seconds, reopen — events added
   - Shake: shake phone hard — check risk goes to high
   - Medium risk: mock a medium AI response — check notification fires
   - High risk: mock a high AI response — check SMS, email sent
   - Stealth: enable stealth, start session — screen goes black,
     tap wakes it for 3 seconds
   - Wellness: set check-in time 2 minutes from now, do not
     confirm — verify SMS fires after 10 minutes
   - Live screen: GPS marker follows real position
   - Settings: update contact, restart app — changes persist

Show me the complete code for every file.
```

---

## Build order summary

| Step | Feature                      | Depends on |
| ---- | ---------------------------- | ---------- |
| 1    | Stores + AsyncStorage        | Nothing    |
| 2    | Supabase schema              | Step 1     |
| 3    | Supabase Auth authentication | Steps 1–2  |
| 4    | GPS location                 | Step 3     |
| 5    | Camera snapshot              | Step 3     |
| 6    | Audio + Whisper              | Step 3     |
| 7    | Shake detection              | Step 1     |
| 8    | Claude Vision AI             | Steps 5–6  |
| 9    | Monitoring loop              | Steps 4–8  |
| 10   | Alert pipeline               | Step 9     |
| 11   | Push notifications           | Step 9     |
| 12   | Stealth mode                 | Step 9     |
| 13   | Live map screen              | Step 9     |
| 14   | Event log screen             | Step 9     |
| 15   | Alerts screen                | Step 10    |
| 16   | Wellness check-in            | Step 11    |
| 17   | Settings + onboarding        | Steps 1–16 |
| 18   | Final wiring + testing       | Steps 1–17 |

---

_IMPLEMENTATION.md version 1.0 — Surveillance AI_
