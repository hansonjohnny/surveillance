# Surveillance AI — Manual Testing Checklist

Run these checks on a physical device before every release. The simulator
cannot test camera, microphone, accelerometer, background execution, or
push notifications.

---

## Auth

- [ ] **Sign up** — enter a new email and password, tap Sign Up, verify
      you are routed to onboarding (or Home if already onboarded)
- [ ] **Sign in** — sign out, then sign in with the same credentials,
      verify you land on Home
- [ ] **Wrong password** — enter an incorrect password, verify an error
      message appears and the app does not crash
- [ ] **Password reset** — tap "Forgot password", enter your email,
      open the reset link from the email, verify the deep link opens the
      app and lands on the reset-password screen, set a new password,
      verify you can sign in with it
- [ ] **Sign out** — go to Settings, sign out, verify you are routed to
      Sign In and cannot access Home without signing in again

---

## Onboarding

- [ ] Complete all 12 onboarding screens from a fresh install (or after
      clearing AsyncStorage in Settings > clear data on Android)
- [ ] Verify the progress bar advances on every screen
- [ ] Verify entered emergency contact name, phone, and email appear on
      the Plan Reveal screen (screen 12)
- [ ] Tap "Start My First Session" — verify you land on Home, not
      onboarding again
- [ ] Force-quit and reopen the app — verify onboarding does not replay
- [ ] Verify emergency contact details persist: go to Settings, confirm
      name, phone, and email are pre-filled

---

## Permissions — Denied-Permission Degraded Mode

- [ ] **Camera denied**
      - On iOS: Settings > Privacy > Camera > Surveillance AI — set to Off
      - Reopen app, go to Home
      - Verify amber banner: "Camera disabled — visual analysis unavailable"
      - Tap "Fix in Settings" — verify iOS Settings opens
- [ ] **Microphone denied**
      - On iOS: Settings > Privacy > Microphone > Surveillance AI — set to Off
      - Reopen app, go to Home
      - Verify amber banner: "Microphone disabled — audio analysis unavailable"
      - Tap "Fix in Settings" — verify iOS Settings opens
- [ ] **Both denied** — verify two banners stack below the header
- [ ] **Both granted** — verify no banner appears
- [ ] Start a surveillance session with camera denied — verify app does
      not crash, monitoring cycle continues with GPS only, event log shows
      "No visual analysis available"

---

## Session

- [ ] Tap "Start Surveillance" on Home — verify:
      - Shield pulse animates with cyan rings
      - Status changes to ACTIVE
      - Timer counts up from 00:00:00
      - Screen stays awake (Keep Awake active)
- [ ] Let the session run for 60 seconds — verify at least one event
      appears in the Log tab with a timestamp, risk level, and AI summary
- [ ] Tap "Stop Surveillance" — verify:
      - Shield dims
      - Status changes to INACTIVE
      - Timer stops and resets to 00:00:00
      - Screen wake-lock releases (screen can dim normally)
- [ ] Verify the event log entries from the session are still visible
      after stopping

---

## Background Execution

- [ ] Start a surveillance session
- [ ] Press the Home button to minimise the app (do not force-quit)
- [ ] Lock the screen
- [ ] Wait at least 30 seconds (one full monitoring cycle)
- [ ] Unlock and reopen the app
- [ ] Verify new events have been added to the Log tab since the app was
      backgrounded — timestamps should show cycles ran while backgrounded
- [ ] Verify the session timer resumed correctly

---

## Shake Detection

- [ ] Start a surveillance session
- [ ] Shake the phone hard and sustained for at least half a second
- [ ] Verify within 1–2 seconds:
      - Risk level updates to HIGH on the Home screen badge
      - A high-risk event appears in the Log tab with source "shake"
      - If an emergency contact is configured, check that SMS and email
        were sent (check the contact's phone and inbox)
      - If both shake AND AI score are high, verify a phone call was made
- [ ] Shake again within 5 seconds — verify no duplicate alert fires
      (5-second cooldown must be respected)

---

## Medium Risk — Push Notification

- [ ] To mock a medium AI response, temporarily edit
      `supabase/functions/analyse-image/index.ts` to always return
      `{ riskLevel: "medium", summary: "Test medium risk" }`
- [ ] Start a session and wait for one monitoring cycle
- [ ] Verify a push notification appears: "Safety alert — Potential
      concern detected: Test medium risk"
- [ ] Verify the risk badge on Home shows MEDIUM (amber)
- [ ] Verify no SMS or email is sent for a medium event
- [ ] Revert the Edge Function after testing

---

## High Risk — SMS and Email

- [ ] Ensure emergency contact name, phone, and email are set in Settings
- [ ] To mock a high AI response, temporarily edit
      `supabase/functions/analyse-image/index.ts` to always return
      `{ riskLevel: "high", summary: "Test high risk" }`
- [ ] Start a session and wait for one monitoring cycle
- [ ] Verify:
      - Risk badge on Home shows HIGH (red)
      - SMS received on the emergency contact's phone with GPS link and
        AI summary
      - Email received at the emergency contact's address with full report
      - The Alerts tab shows one entry for this event
- [ ] Start a second session — trigger high risk again — verify the same
      event is NOT alerted twice (deduplication by event ID)
- [ ] Revert the Edge Function after testing

---

## Stealth Mode

- [ ] In Settings, enable Stealth Mode
- [ ] Return to Home and tap "Start Surveillance"
- [ ] Verify the screen immediately fades to black
- [ ] Verify no UI is visible to a bystander — the screen appears off
- [ ] Tap anywhere on the black screen
- [ ] Verify the UI is visible for approximately 3 seconds, then fades
      back to black
- [ ] Stop the session — verify the black overlay disappears
- [ ] Disable Stealth Mode in Settings — verify Home screen behaves
      normally on the next session

---

## Wellness Check-In

- [ ] In Settings, set the wellness check-in time to 2 minutes from now
- [ ] Do NOT tap the notification or open the app during the window
- [ ] After 10 minutes from the check-in time, verify:
      - SMS sent to the emergency contact: "has not confirmed they are safe"
      - Email sent with wellness alert subject
- [ ] Reset: set a new check-in time, wait for the notification, tap
      "I'm Safe" — verify no SMS or email fires

---

## Live Screen

- [ ] Start a surveillance session
- [ ] Navigate to the Live tab
- [ ] Walk or drive for 30+ seconds
- [ ] Verify the cyan GPS marker on the dark map updates to follow your
      real position
- [ ] Verify the risk badge and last AI summary update each monitoring cycle

---

## Settings Persistence

- [ ] In Settings, update the emergency contact name, phone, and email
      to new values
- [ ] Change monitoring interval to 60 s and shake sensitivity to High
- [ ] Force-quit the app completely
- [ ] Reopen the app — navigate to Settings
- [ ] Verify all changed values are still shown (name, phone, email,
      interval, sensitivity)
- [ ] Start a session — verify it uses the new 60-second interval
      (observe the event log: events should appear every ~60 seconds)

---

## Edge Cases

- [ ] Start a session with no internet connection — verify the app does
      not crash, cycles continue, events log with "No visual analysis
      available", and no alert fires
- [ ] Revoke location permission mid-session — verify the monitoring
      cycle continues without crashing (GPS returns null gracefully)
- [ ] Fill the event log with 50+ events — verify scrolling is smooth
      and the app does not slow down
