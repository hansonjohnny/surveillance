# AGENTS.md — Surveillance AI

You are an expert React Native + Expo engineer helping build a
production-quality teaching project.

You write clean, simple, maintainable code. You prioritize clarity
over unnecessary abstraction because this app is used to teach
developers how to build feature by feature.

You should think like a senior mobile developer, but explain and
implement like someone building a practical learning project.

---

## Project Overview

We are building an AI-powered personal safety mobile app called
**Surveillance AI** using Expo.

The app protects users by silently monitoring their surroundings
using the phone's built-in sensors when they are travelling, at a
party, or in any situation where they want passive protection. The
user taps "Start Surveillance" and the app continuously collects
location data, takes random camera snapshots, records ambient audio,
and monitors accelerometer data for sudden impacts. All sensor data
is analysed by AI and a risk score is produced. If risk reaches High,
the app immediately fires an SMS, email, and phone call to a
pre-configured emergency contact.

Core features include:

- One-tap surveillance session start and stop
- GPS location tracking and optional geo-fence alerts via Expo Location
- Silent background camera snapshots analysed by OpenAI GPT-4o Vision
- Ambient audio recording transcribed via Whisper API and analysed for threats
- Accelerometer shake and impact detection via Expo Sensors
- AI risk scoring (Low / Medium / High) on every monitoring cycle
- Automated SMS alert to emergency contact via Twilio
- Automated email alert with full AI report via SendGrid
- Automated phone call to emergency contact via Twilio Voice
- Push notifications for Medium risk events
- Session event log with timestamp, risk level, AI summary, and photo
- Wellness check-in system with missed-check-in auto-alert
- Onboarding to collect emergency contact details and preferences
- Settings screen to update contact info, monitoring interval, and
  shake sensitivity

This is primarily a learning project. The goal is to teach developers
how to build a real-time AI-powered safety app feature by feature.

---

## Tech Stack

Use the following stack:

- Expo
- React Native
- TypeScript
- Expo Router
- NativeWind / Tailwind CSS
- Lucide for react native svg icons
- Zustand for state management
- AsyncStorage for local data persistence
- Supabase Auth for authentication (email/password)
  -- covers registration, login, and password reset
  -- built-in, free, auth.uid() works natively with all RLS policies
  -- password reset uses deep links via the 'surveillanceai' app scheme
  -- Google OAuth and Apple Sign In deferred to a later step
  -- Apple Sign In is legally required on iOS before App Store
  submission if any social login (like Google) is offered
- OpenAI GPT-4o API (`gpt-4o`) for AI vision and risk analysis
- OpenAI Whisper API for audio transcription
- Twilio REST API for SMS and phone calls
- SendGrid API for email alerts
- Expo Camera for silent photo capture
- Expo AV for audio recording
- Expo Location for GPS tracking and geo-fencing
- Expo Sensors for accelerometer and shake detection
- Expo Notifications for push alerts
- Expo Task Manager for background task registration
- Expo Background Fetch for background monitoring loop
- Expo Secure Store for storing API keys and contact details on-device
- Expo Keep Awake for preventing screen sleep during active sessions
- Expo SMS for opening the SMS composer as a fallback
- react-native-webview for rendering the Live map
- Leaflet (via WebView, loaded from unpkg CDN) for the GPS map on the
  Live screen — uses CartoDB Dark Matter tiles, no API key required.
  Do NOT use react-native-maps. The map is implemented in
  LiveMap.tsx using a WebView that loads a self-contained Leaflet HTML
  page. Location updates are pushed into the WebView using
  injectJavaScript so the map pans without a full reload.

Do not introduce new major libraries unless there is a strong reason.

---

## Development Philosophy

Build feature by feature.

For every feature:

1. Understand the user request.
2. Check this file before coding.
3. Keep the implementation simple.
4. Avoid overengineering.
5. Prefer readable code over clever code.
6. Build the smallest useful version first.
7. Refactor only when repetition or complexity appears.
8. Keep the app easy to teach and explain.

This project should feel like a real app, but remain approachable
for students.

---

## AI Integration Rules

All AI calls use the OpenAI API (GPT-4o for vision/analysis, Whisper
for transcription). Follow these rules:

- Always use model `gpt-4o` for all vision and risk-analysis calls
- Always use model `whisper-1` for all audio transcription calls
- Store all API keys in `.env` — never hardcode them anywhere
- Never expose API keys on the client side — all AI calls must go
  through Supabase Edge Functions or a server-side route
- Camera snapshots are sent to GPT-4o Vision alongside the user's
  current GPS location and a risk-analysis prompt
- Audio clips are sent to Whisper for transcription first, then the
  transcript is sent to GPT-4o for threat analysis
- Shake events bypass the AI cycle and immediately trigger a High
  risk alert — no AI call needed for shake-only events
- Risk scores from image analysis and audio analysis are combined
  into one consolidated score per monitoring cycle
- Never include em-dashes in any AI-generated text — add this
  instruction to every prompt sent to GPT-4o
- Keep all AI prompts in a dedicated `/lib/prompts.ts` file so they
  are easy to find, edit, and teach

---

## Monitoring Loop Rules

The core monitoring loop runs every 20–30 seconds (configurable).
Follow these rules:

- Register the loop using `TaskManager.defineTask` and
  `BackgroundFetch.registerTaskAsync` on app launch
- Test background execution with the app minimised and screen locked
  before building any other feature — this is the highest-risk item
- Run all four sensors (GPS, camera, audio, accelerometer) in
  parallel within each cycle — never sequentially
- Run audio transcription asynchronously — never block the cycle
  waiting for a Whisper response
- Cache the most recent AI analysis result so it is available
  instantly when the user opens the app mid-session
- The accelerometer listener runs continuously and independently of
  the timed cycle — a shake event fires immediately at any time
- Stop all sensors and cancel all background tasks the moment the
  user taps "Stop Surveillance"

---

## Alert Rules

When risk reaches High, three channels fire simultaneously:

- SMS via Twilio REST API — short message with GPS coordinates,
  AI summary, and a Google Maps link
- Email via SendGrid — full report with AI analysis breakdown,
  timestamp, GPS link, and photo if available
- Phone call via Twilio Programmable Voice — automated call that
  reads the alert aloud

Additional rules:

- Phone call is reserved for highest-confidence events only —
  a shake event combined with a High AI score, not an AI High alone
- Medium risk fires a push notification to the user only — no
  contact is alerted
- Low risk is logged silently to the Event Log — no notification
- Every alert stores a full record in AsyncStorage and syncs to
  Supabase in the background
- Never alert the same event twice — deduplicate by session cycle
  timestamp before firing

---

## Supabase Rules

- Always enable Row Level Security on every table
- Authentication uses Supabase Auth with email/password
  -- do NOT use Clerk or any external auth provider
  -- auth.uid() works natively in all RLS policies
- Registration: supabase.auth.signUp()
- Login: supabase.auth.signInWithPassword()
- Password reset:
  supabase.auth.resetPasswordForEmail() sends the reset email
  redirectTo must be 'surveillanceai://reset-password' so the
  link opens the app, not a browser
  supabase.auth.setSession() restores the session from the link tokens
  supabase.auth.updateUser() saves the new password
- Use supabase.auth.getSession() to check current user on app load
- Use supabase.auth.onAuthStateChange() to listen for auth changes
- Deep link listener in \_layout.tsx catches the reset link and
  routes to the reset-password screen with the tokens as params
- Google OAuth and Apple Sign In are deferred -- implement them
  in a dedicated later step before App Store submission
- Apple Sign In becomes a legal requirement on iOS the moment
  any social login (like Google) is offered in the published app
- Tables: users, sessions, events, alerts, contacts, settings
- The users table references auth.users(id) -- the row is created
  automatically via a Supabase trigger on first sign-up
- Use local AsyncStorage as the immediate read layer so the app
  feels instant -- sync to Supabase in the background
- Edge Functions handle all AI calls, Twilio SMS/call, and SendGrid
  email so API keys never reach the client
- Disable email confirmation during development for faster testing
  (set in Supabase dashboard: Authentication > Email > Confirm email: OFF)

---

## Onboarding Flow

Onboarding runs once on first launch. The full sequence is 12 screens
(see IMPLEMENTATION.md for the canonical vibe-coding prompts):

1. **Landing** (`index.tsx`) — app intro, "Get Started" CTA
2. **When** — asks when the user wants protection (commuting, travelling, etc.)
3. **Who** — asks who they want to protect (themselves, family, etc.)
4. **Concern** — asks what their primary safety concern is
5. **Interstitial** — bridge screen summarising what the AI will do
6. **Contact** — user enters emergency contact name, phone, and email;
   these are stored in Expo Secure Store and synced to Supabase
7. **Speed** — shows how fast the monitoring cycle responds
8. **Preferences** — user selects monitoring interval (20 / 30 / 60 s),
   shake sensitivity (Low / Medium / High), and stealth mode toggle
9. **Social Proof** — trust signals and use-case testimonials
10. **Permissions** — requests Camera, Microphone, Location (Always),
    and Notifications in sequence, one at a time, with a plain-language
    explanation before each native dialog
11. **Setup** — final configuration confirmation screen
12. **Plan Reveal** — summary of the user's personalised protection plan;
    tapping "Get Started" calls `complete()` and
    `useSettingsStore.markOnboardingComplete()` before routing to Home

All onboarding data flows through `useOnboardingStore` and is committed
to Zustand, AsyncStorage, and Supabase on the final Plan Reveal screen.

---

## App Screens

The app has 5 main screens accessible via bottom tab navigation:

1. **Home** — Start / Stop surveillance button, active session status,
   risk badge, last AI summary, manual SOS button
2. **Live** — Real-time GPS map, current risk level badge, latest
   cycle summary, updates every monitoring cycle
3. **Log** — Scrollable event log: timestamp, risk level, AI summary,
   photo thumbnail, transcript excerpt. Tap to expand full report.
4. **Alerts** — All High-risk events that fired an SOS: what was sent,
   to whom, at what time, and what the AI detected
5. **Settings** — Emergency contact details, monitoring interval,
   shake sensitivity slider, stealth mode toggle, permissions status,
   wellness check-in configuration

---

## Permissions

The app requires four permissions. Request them in this order during
onboarding, one at a time, with a plain-language explanation before
each native dialog:

1. Camera — "To take safety snapshots during surveillance"
2. Microphone — "To listen for threats in your surroundings"
3. Location (Always) — "To log your position and detect safe zones"
4. Notifications — "To warn you of medium-risk events"

If the user denies camera or microphone, show a degraded-mode banner
on the Home screen explaining which features are unavailable. Never
crash or block the app for a denied permission.

---

## Stealth Mode

When stealth mode is enabled:

- The screen dims to black immediately after the session starts
- No UI is visible to a bystander
- A single tap anywhere wakes the screen temporarily for 3 seconds
- The session continues silently in the background
- Implement using `expo-keep-awake` and a black overlay view with
  an opacity animation

---

## Wellness Check-In

- The user configures a check-in time in Settings (e.g. 10 PM)
- If the user has not opened the app and tapped "I'm safe" by that
  time, the app fires a wellness-check SMS and email to the emergency
  contact
- Implement using a scheduled Expo Notification that fires at the
  configured time
- If the user taps the notification and confirms they are safe, the
  alert is cancelled
- If there is no response within 10 minutes of the notification, the
  contact alert fires

---

## GPS and Location

- Use Expo Location for GPS access
- Request "Always" permission during onboarding with a clear
  explanation — this is required for background monitoring
- Log GPS coordinates on every monitoring cycle
- Support optional geo-fence: if the user leaves a defined safe area,
  trigger a Medium risk event immediately
- Never use location data for any purpose other than safety monitoring
  and the event log

---

## Decision Making and Clarifications

If something is unclear or could be improved:

- Proactively suggest better approaches
- If a new library would significantly simplify or improve the
  implementation:
  - Recommend the library
  - Clearly explain why it is useful
  - Ask the user for permission before adding or installing it

Example:

> "This could be implemented manually, but using
> `react-native-maps` would make the live GPS map much cleaner.
> Do you want me to add it?"

Do not install or use new libraries without user approval.

---

## Architecture

Use this folder structure:

```
/app
  /(onboarding)
    contact.tsx
    preferences.tsx
  /(tabs)
    home.tsx
    live.tsx
    log.tsx
    alerts.tsx
    settings.tsx
/components
  /ui
  /map
  /log
  /alerts
/lib
  prompts.ts
  supabase.ts
  openai.ts
  whisper.ts
  twilio.ts
  sendgrid.ts
  location.ts
  sensors.ts
  monitoring.ts
/store
  useSessionStore.ts
  useAlertStore.ts
  useSettingsStore.ts
/supabase
  /functions
    analyse-image/
    analyse-audio/
    send-sms/
    send-email/
    make-call/
    wellness-check/
/tasks
  monitoringTask.ts
  wellnessTask.ts
/assets
```

---

## Environment Variables

```
OPENAI_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
SENDGRID_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

When Google OAuth is added later, also add:
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=

Never commit `.env` to version control. Always add it to `.gitignore`.
