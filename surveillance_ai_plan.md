# Surveillance AI — App Plan

**React Native + Expo | Personal Safety Application**

---

## Core Function

> "Surveillance AI silently monitors your surroundings using your phone's sensors and immediately alerts your emergency contact by SMS, email, and call if danger is detected."

This is the one sentence that defines the entire product. Everything built must serve this statement.

---

## Onboarding Flow

The onboarding runs once on first launch. It is modelled on the same pattern used by high-converting apps like Cal AI: data-collection screens are separated by motivational interstitials, social proof appears before any friction, and the paywall (if applicable) is shown only after the user is emotionally invested. The flow ends with a personalised plan reveal as the reward.

### Screen 1 — Landing

**Headline:** "Your safety, always on."

**Subtext:** Surveillance AI watches over you so the people who love you do not have to worry.

**Button:** Get Started

_No sign-in required yet. Lower the barrier. Let the user feel the value before asking for anything._

---

### Screen 2 — Who are you protecting?

**Headline:** "Who will this app protect?"

Tap-to-select options:

- Myself
- My daughter / son
- My partner
- A family member

_Sets the emotional context immediately. Makes the app feel personal. The answer is passed to the AI risk-scoring context._

---

### Screen 3 — When do you need it?

**Headline:** "When do you usually want protection?"

Multi-select options:

- Parties and social events
- Travelling alone
- Late nights out
- Commuting or walking alone
- All the time

_Multi-select allowed. Used later to contextualise AI analysis prompts._

---

### Screen 4 — Motivational interstitial

**Headline:** "You are already thinking ahead."

**Illustration:** Shield with a checkmark

**Body:** Most safety incidents happen when no one knows where you are. Surveillance AI changes that — silently and automatically.

**Button:** Continue

_Reduces drop-off between data-collection screens. Validates the user's decision._

---

### Screen 5 — Your biggest concern

**Headline:** "What worries you most?"

Tap-to-select options:

- Not being able to call for help
- No one knowing my location
- Feeling unsafe in public
- Not knowing if something is really wrong

_Builds empathy and shapes how the AI risk-scoring system is presented._

---

### Screen 6 — Emergency contact

**Headline:** "Who should we contact if something is wrong?"

Fields:

- Contact name
- Phone number
- Email address

**Subtext:** This person will receive an SMS, email, and phone call if the app detects a high-risk situation.

**Button:** Continue

_Core data collection. Positioned here because emotional investment is now high — the user understands why this matters._

---

### Screen 7 — Motivational interstitial (speed comparison)

**Headline:** "In an emergency, every second counts."

| Without Surveillance AI       | With Surveillance AI           |
| ----------------------------- | ------------------------------ |
| Average response time: 11 min | Alert sent in under 30 seconds |

**Button:** Continue

_Modelled directly on the Cal AI "2X vs 20%" comparison card. Converts abstract value into a concrete stat._

---

### Screen 8 — Preferences

**Headline:** "How should the app monitor you?"

Settings:

- Monitoring interval — 20s / 30s / 60s (tap to select)
- Shake sensitivity — Low / Medium / High
- Stealth mode — On / Off with a one-line explanation

**Subtext:** You can change these any time in Settings.

---

### Screen 9 — Social proof

**Headline:** "Trusted by people who travel alone"

- 4.8 star rating badge — "50,000+ users protected"
- Testimonial card: _"My daughter travels for work every week. This app is the only reason I sleep at night." — Margaret A._

**Button:** Continue

_Positioned before the permissions screen, exactly as Cal AI places its rating screen before the paywall. Builds trust before friction._

---

### Screen 10 — Permissions pre-sell

**Headline:** "Surveillance AI needs a few permissions to protect you."

Illustrated checklist with plain-language explanations, granted one at a time:

- Camera — "To capture visual evidence silently"
- Microphone — "To listen for threats around you"
- Location (Always) — "To track your position at all times"
- Notifications — "To alert you of medium-risk events"

**Subtext:** Your data is handled securely. Location coordinates, AI analysis prompts and responses, contact identifiers, and alert message payloads are transmitted to third-party services (Twilio for SMS and calls, SendGrid for email, Anthropic for AI processing) solely for delivery and safety analysis. Only the minimum necessary data is shared, all transmissions are encrypted in transit, and data is not retained beyond each service's standard processing window.

**Button:** Grant Permissions

_Each native permission dialog fires one at a time after the button is tapped. If any permission is denied, a degraded-mode banner is shown on the Home screen — the app never blocks or crashes._

---

### Screen 11 — Loading / setup

**Headline:** "Setting up your protection profile..."

Animated progress bar (0% to 100%) with items ticking off in sequence:

- Emergency contact saved
- Monitoring interval configured
- Shake detection calibrated
- Alert channels ready
- Running first sensor check...

Completion: **"You are protected."**

_Modelled on Cal AI's "We are setting everything up for you" screen. Creates the perception of meaningful AI work happening. The user feels they received something personalised._

---

### Screen 12 — Plan reveal (reward screen)

**Headline:** "Surveillance AI is ready."

Shield illustration with a green glow.

Personalised summary card:

- Protecting: **[who the user selected on Screen 2]**
- Emergency contact: **[name entered on Screen 6]**
- Monitoring every: **[interval selected on Screen 8]**
- Alerts via: **SMS + Email + Call**

**Button:** Start My First Session

_This is the reward for completing the full onboarding. Equivalent to Cal AI's plan reveal showing daily calories and macros._

---

### What this onboarding borrows from Cal AI

| Cal AI pattern                                  | Surveillance AI equivalent                        |
| ----------------------------------------------- | ------------------------------------------------- |
| Progress bar throughout                         | Progress bar on every screen                      |
| Motivational interstitials between data screens | Screens 4 and 7                                   |
| Social proof before paywall                     | Screen 9 before permissions Screen 10             |
| Loading screen with checkmarks                  | Screen 11                                         |
| Personalised plan reveal as reward              | Screen 12                                         |
| Emotional investment before hard asks           | Emergency contact Screen 6 after 5 softer screens |

---

## Core Loop

The monitoring cycle runs every **20–30 seconds** (configurable). Four Expo sensors collect data in parallel, feed into a single AI analysis call, and produce a risk score.

### 1. GPS Location — `expo-location`

- Tracks the user's coordinates continuously using `watchPositionAsync`
- Logs every position update with a timestamp
- Flags if the user moves outside a configured safe zone using `startGeofencingAsync`

### 2. Camera Snapshot — `expo-camera`

- Silently captures a photo using the camera API
- Image is sent to Claude API (vision) or GPT-4o with the prompt:
  > _"Describe this scene. Are there signs of danger, distress, or risk to the person holding this phone? Rate: Low / Medium / High."_

### 3. Audio Recording & Transcription — `expo-av`

- Records a 5–10 second ambient audio clip
- Clip is sent to OpenAI Whisper API for transcription
- Transcript is analysed by the AI with the prompt:
  > _"This is a transcript of ambient conversation. Is there any threat, argument, distress, or danger present? Rate: Low / Medium / High."_

### 4. Shake Detection — `expo-sensors` (Accelerometer)

- Runs as a continuous background listener
- If a g-force spike above **3.0g** is sustained for **0.5 seconds**, immediately triggers a High-risk alert — bypassing the cycle timer
- Catches falls, struggles, crashes, or violent activity

### AI Risk Score

All four outputs — location, image analysis, transcript analysis, shake flag — are combined into one payload for a final consolidated risk score: **Low / Medium / High**.

---

## Alert Pipeline

When the risk score reaches **High**, three alerts fire simultaneously to the emergency contact configured in onboarding or Settings.

| Channel    | Tool                             | Message                                    |
| ---------- | -------------------------------- | ------------------------------------------ |
| SMS        | `expo-sms` / Twilio REST API     | Location, AI summary, timestamp            |
| Email      | SendGrid / Mailgun API           | Full report with AI breakdown and GPS link |
| Phone call | `Linking.openURL` / Twilio Voice | Automated call reading the alert aloud     |

The call is reserved for the highest-confidence events — a shake event combined with a High AI score, for example.

---

## Accessory Features

Only features that directly serve the core loop are included.

| Feature                        | Detail                                                                  |
| ------------------------------ | ----------------------------------------------------------------------- |
| Geo-fence alerts               | Notify if the monitored person leaves a defined safe area               |
| Trusted contact SMS/email/call | Auto-fire to the number and email set during onboarding                 |
| Stealth mode                   | Screen stays dark and locked while monitoring continues                 |
| Manual SOS button              | One large panic button on the Home screen — skips AI, fires immediately |

**Cut for MVP:** history charts, social sharing, AI model selection. Add these post-launch.

---

## Expo & React Native APIs

| API                     | Purpose                                                                         |
| ----------------------- | ------------------------------------------------------------------------------- |
| `expo-location`         | Continuous GPS tracking, geo-fencing                                            |
| `expo-camera`           | Silent background photo capture                                                 |
| `expo-av`               | Audio recording for ambient transcription                                       |
| `expo-sensors`          | Accelerometer for shake and impact detection                                    |
| `expo-task-manager`     | Defines background tasks so the loop keeps running when the app is backgrounded |
| `expo-background-fetch` | Registers the monitoring cycle as a background job on iOS and Android           |
| `expo-notifications`    | Sends local push alerts for Medium risk events                                  |
| `expo-sms`              | Opens SMS composer; silent auto-send via Twilio REST API                        |
| `expo-secure-store`     | Safely stores emergency contact details and API keys on-device                  |
| `expo-keep-awake`       | Prevents the screen from sleeping during an active session                      |
| `Linking.openURL`       | Triggers a phone call to the emergency contact                                  |

---

## Surface Area — 5 Screens

Well within the 5–7 screen maximum.

### 1. Home

- Large "Start Surveillance" button
- Status indicator: Active / Inactive
- Profile picker: "Who are you monitoring?" (self or a named contact)
- Quick access to Manual SOS

### 2. Live Status

- Real-time GPS map
- Live risk badge (green / amber / red)
- Last AI analysis summary
- Updates every monitoring cycle

### 3. Event Log

- Scrollable list of every cycle: timestamp, risk level, AI summary, photo thumbnail, transcript excerpt
- Tap any event to expand the full report

### 4. Alerts

- All High-risk events that fired an SOS
- Shows what was sent, to whom, at what time, and what the AI detected

### 5. Settings

- Emergency contact: name, phone number, email address
- Monitoring interval: 20 / 30 / 60 seconds
- Shake sensitivity slider
- Stealth mode toggle
- Permissions management
- Wellness check-in configuration

---

## Retention Hook

After every session ends, the app shows a **session summary card**:

> _"2 hr 14 min monitored · 1 medium alert · all clear."_

Over time the Event Log becomes a personal safety journal. The hook that keeps users returning:

**Wellness check-in** — if the monitored person has not manually confirmed they are safe by a set time, the app automatically fires a wellness check notification to the emergency contact. This pending check-in creates an open loop that brings people back to the app regularly.

---

## Top Engineering Risks

### 1. Background execution on iOS (highest risk)

iOS aggressively kills background tasks. Register the monitoring loop using `TaskManager.defineTask` and `BackgroundFetch.registerTaskAsync` **before building anything else**, and test with the app backgrounded and screen locked. If this fails, the whole app fails.

### 2. Permissions at first launch

The app requires camera, microphone, location (must be set to **"Always"**), and notifications. Request them one at a time in Screen 10 of onboarding with a plain-language explanation before each native dialog. Design graceful degradation for denied permissions.

### 3. Audio transcription latency

Uploading and transcribing a 10-second clip adds latency to the cycle. Run audio analysis asynchronously — do not block the rest of the cycle. Cache the result and include it in the next AI scoring call if needed.

### 4. AI cost at scale

Each monitoring cycle makes at least one AI API call. At 30-second intervals over a 3-hour session, that is 360 calls per user session. Set a daily usage cap per user and consider batching low-stakes cycles.

---

## Recommended Tech Stack

| Layer            | Choice                                               |
| ---------------- | ---------------------------------------------------- |
| Framework        | React Native + Expo SDK 51+                          |
| Navigation       | Expo Router (file-based)                             |
| State management | Zustand                                              |
| Background tasks | `expo-task-manager` + `expo-background-fetch`        |
| AI vision + text | Claude API (claude-sonnet-4-20250514) or GPT-4o      |
| Speech-to-text   | OpenAI Whisper API                                   |
| SMS              | Twilio Programmable SMS                              |
| Email            | SendGrid                                             |
| Phone call       | Twilio Programmable Voice                            |
| Local storage    | `expo-secure-store` (sensitive), AsyncStorage (logs) |
| Maps             | Leaflet via `react-native-webview` (CartoDB Dark Matter tiles, no API key) |

---

_Document version 2.0 — Surveillance AI App Plan_
