# DESIGN.md — Surveillance AI

**Design System & Visual Language**
React Native + Expo | Young Adult Personal Safety App

---

## Design Direction

### Audience

Young adults aged 18–32. They go to parties, travel solo, commute late at night, use apps like Snapchat, Instagram, and BeReal. They are visually literate, immediately sceptical of anything that looks dated or clinical, and deeply loyal to apps that feel like they were built _for_ them rather than _at_ them.

This app handles real fear and real danger — but the UI should never feel heavy, hospital-like, or paranoid. The design must balance **trustworthiness** with **coolness**. It should feel like a smart friend who has your back, not a corporate security product.

---

### Aesthetic Direction

**Dark-first. Neon-accented. Minimal but charged.**

Think: the intersection of a cybersecurity dashboard and a late-night rideshare app. Clean dark backgrounds with a single electric accent. Typography that is confident and tight. Subtle glassmorphism for cards. Micro-animations that feel alive without being flashy.

The one thing someone will remember: **the glowing shield pulse** on the Home screen when surveillance is active — a breathing ring of light that says "I am watching over you" without a single word.

**Mood references:** Night-mode Uber, Notion dark, Apple Health dark, Robinhood.

---

## Color System

```css
/* Base palette — dark-first */
--color-bg-primary: #0a0a0f /* near-black, slightly blue-tinted */
  --color-bg-secondary: #111118 /* card and panel backgrounds */
  --color-bg-tertiary: #1a1a24 /* elevated surfaces, modals */
  --color-bg-glass: rgba(255, 255, 255, 0.04) /* glassmorphism base */
  /* Electric accent — the brand color */ --color-accent: #00e5ff
  /* electric cyan */ --color-accent-dim: #00b8cc
  /* muted accent for secondary use */
  --color-accent-glow: rgba(0, 229, 255, 0.15) /* glow halo */
  --color-accent-glow-soft: rgba(0, 229, 255, 0.06) /* very subtle glow */
  /* Risk colors — semantic, never decorative */ --color-risk-low: #00e676
  /* electric green — all clear */ --color-risk-medium: #ffd740
  /* amber — pay attention */ --color-risk-high: #ff3d3d /* hard red — danger */
  --color-risk-high-glow: rgba(255, 61, 61, 0.2) /* Text */
  --color-text-primary: #f0f0f5 /* near-white */ --color-text-secondary: #8888a0
  /* muted grey-lavender */ --color-text-tertiary: #555568
  /* disabled / placeholder */ --color-text-inverse: #0a0a0f
  /* for use on light surfaces */ /* Borders */
  --color-border-subtle: rgba(255, 255, 255, 0.06)
  --color-border-default: rgba(255, 255, 255, 0.1)
  --color-border-accent: rgba(0, 229, 255, 0.3);
```

### Usage Rules

- The background is always `--color-bg-primary`. Never use pure black (#000) or pure white.
- `--color-accent` (electric cyan) is used for: the active shield pulse, CTA buttons, selected states, live indicators, and links. It appears nowhere else.
- Risk colors are strictly semantic — `--color-risk-low` for Low, `--color-risk-medium` for Medium, `--color-risk-high` for High. Never use them decoratively.
- White text on dark backgrounds only. Never dark text on dark backgrounds.
- The accent color must never appear on a coloured background — only on dark surfaces.

---

## Typography

### Typeface Pairing

```text
Display / Headings:    Outfit (weights 600, 700)
Body / UI:             DM Sans (weights 400, 500)
Monospace / Data:      JetBrains Mono (weight 400)
```

**Why this pairing:**

- Outfit at 700 is geometric, modern, and tight — it reads as confident and youthful without being childish. Perfect for headlines like "Start Surveillance" and "You are protected."
- DM Sans is clean, slightly rounded, and highly legible at small sizes — ideal for body copy, labels, and form fields.
- JetBrains Mono for timestamps, GPS coordinates, and risk scores — gives the data-display elements a technical, precise feel that reinforces the surveillance theme.

### Type Scale (React Native / Expo)

```javascript
// All sizes in sp (scale-independent pixels)

typography: {
  // Display — used on onboarding headlines and major screens
  displayLarge:  { fontFamily: 'Outfit_700Bold',   fontSize: 36, lineHeight: 44 },
  displayMedium: { fontFamily: 'Outfit_700Bold',   fontSize: 28, lineHeight: 36 },
  displaySmall:  { fontFamily: 'Outfit_600SemiBold', fontSize: 22, lineHeight: 30 },

  // Headings — screen titles, section headers
  headingLarge:  { fontFamily: 'Outfit_600SemiBold', fontSize: 20, lineHeight: 28 },
  headingMedium: { fontFamily: 'Outfit_600SemiBold', fontSize: 17, lineHeight: 24 },
  headingSmall:  { fontFamily: 'DM_Sans_500Medium',  fontSize: 15, lineHeight: 22 },

  // Body — paragraphs, descriptions, card content
  bodyLarge:     { fontFamily: 'DM_Sans_400Regular', fontSize: 16, lineHeight: 26 },
  bodyMedium:    { fontFamily: 'DM_Sans_400Regular', fontSize: 14, lineHeight: 22 },
  bodySmall:     { fontFamily: 'DM_Sans_400Regular', fontSize: 12, lineHeight: 18 },

  // Labels — buttons, tags, badges
  labelLarge:    { fontFamily: 'DM_Sans_500Medium',  fontSize: 15, lineHeight: 20 },
  labelMedium:   { fontFamily: 'DM_Sans_500Medium',  fontSize: 13, lineHeight: 18 },
  labelSmall:    { fontFamily: 'DM_Sans_500Medium',  fontSize: 11, lineHeight: 16 },

  // Data — timestamps, coordinates, risk scores
  dataLarge:     { fontFamily: 'JetBrainsMono_400Regular', fontSize: 16, lineHeight: 24 },
  dataMedium:    { fontFamily: 'JetBrainsMono_400Regular', fontSize: 13, lineHeight: 20 },
  dataSmall:     { fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, lineHeight: 16 },
}
```

### Typography Rules

- Headlines are always `--color-text-primary`. Never coloured headlines except on the onboarding reward screen.
- Body text is `--color-text-secondary` by default. Use `--color-text-primary` only when the content demands full attention.
- The accent colour (`--color-accent`) may appear on a single word in a headline for emphasis — e.g. "You are **protected**."
- Risk scores and live data always use `JetBrains Mono` so they read as technical and precise.
- Letter spacing: display text gets `letterSpacing: -0.5`. Labels and buttons get `letterSpacing: 0.3`.
- NEVER use all-caps on body text. All-caps is reserved for badge labels and status chips only.

---

## Spacing System

Based on an 8px base unit. All spacing values are multiples of 4 or 8.

```javascript
spacing: {
  xs:   4,
  sm:   8,
  md:   16,
  lg:   24,
  xl:   32,
  xxl:  48,
  xxxl: 64,
}

// Screen horizontal padding
screenPadding: 20

// Card internal padding
cardPadding: { vertical: 20, horizontal: 20 }

// Section gap (vertical space between major sections)
sectionGap: 32

// List item gap
listItemGap: 12
```

---

## Border Radius

```javascript
radius: {
  sm:    8,    // tags, chips, small buttons
  md:    12,   // input fields, small cards
  lg:    16,   // standard cards, modals
  xl:    24,   // large cards, bottom sheets
  full:  9999, // pill buttons, badges
}
```

---

## Elevation & Shadow

Dark apps use glow instead of traditional shadow. Shadows darken; glows illuminate.

```javascript
// Standard card elevation — barely visible lift
elevation.card: {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.4,
  shadowRadius: 12,
  elevation: 6,
}

// Accent glow — active states, shield pulse, live indicators
elevation.glowAccent: {
  shadowColor: '#00E5FF',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.5,
  shadowRadius: 20,
  elevation: 0,
}

// Danger glow — high risk alerts
elevation.glowDanger: {
  shadowColor: '#FF3D3D',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.5,
  shadowRadius: 20,
  elevation: 0,
}
```

---

## Glassmorphism Cards

Cards use a frosted-glass treatment on top of the dark background. This gives depth without heavy shadows and aligns with the "tech but human" aesthetic.

```javascript
glassCard: {
  backgroundColor: 'rgba(255, 255, 255, 0.04)',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.10)',
  borderRadius: 16,
  overflow: 'hidden',

  // iOS blur effect
  // Wrap content in <BlurView intensity={20} tint="dark">
}
```

Use `expo-blur` (`BlurView`) on iOS for the true frosted effect. On Android, fall back to the solid `rgba` background — the border and colour are sufficient.

---

## Component Library

### Primary CTA Button

The main action button. Used for "Start Surveillance", "Start My First Session", "Send SOS".

```javascript
// Active state
primaryButton: {
  height: 56,
  borderRadius: 9999,           // full pill
  backgroundColor: '#00E5FF',
  paddingHorizontal: 32,
  alignItems: 'center',
  justifyContent: 'center',
  // Glow
  shadowColor: '#00E5FF',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.45,
  shadowRadius: 18,
}

primaryButtonText: {
  fontFamily: 'DM_Sans_500Medium',
  fontSize: 16,
  letterSpacing: 0.3,
  color: '#0A0A0F',              // dark text on bright button
}

// Danger variant — SOS button
dangerButton: {
  ...primaryButton,
  backgroundColor: '#FF3D3D',
  shadowColor: '#FF3D3D',
}
```

### Ghost / Secondary Button

Used for "No", "Skip", "Cancel".

```javascript
ghostButton: {
  height: 56,
  borderRadius: 9999,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.15)',
  backgroundColor: 'transparent',
  paddingHorizontal: 32,
  alignItems: 'center',
  justifyContent: 'center',
}

ghostButtonText: {
  fontFamily: 'DM_Sans_500Medium',
  fontSize: 16,
  letterSpacing: 0.3,
  color: '#F0F0F5',
}
```

### Tap-to-Select Option Card

Used throughout onboarding for single and multi-select choices.

```javascript
// Unselected
optionCard: {
  height: 60,
  borderRadius: 14,
  backgroundColor: 'rgba(255, 255, 255, 0.04)',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.08)',
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 20,
  marginBottom: 12,
}

// Selected
optionCardSelected: {
  ...optionCard,
  backgroundColor: 'rgba(0, 229, 255, 0.08)',
  borderColor: 'rgba(0, 229, 255, 0.40)',
}

optionCardText: {
  fontFamily: 'DM_Sans_400Regular',
  fontSize: 15,
  color: '#F0F0F5',
  marginLeft: 14,
}

optionCardTextSelected: {
  ...optionCardText,
  color: '#00E5FF',
  fontFamily: 'DM_Sans_500Medium',
}
```

### Risk Badge

A small pill-shaped indicator showing the current risk level. Used on the Home screen and Event Log.

```javascript
// Low
riskBadgeLow: {
  paddingHorizontal: 12,
  paddingVertical: 5,
  borderRadius: 9999,
  backgroundColor: 'rgba(0, 230, 118, 0.12)',
  borderWidth: 1,
  borderColor: 'rgba(0, 230, 118, 0.30)',
}
riskBadgeLowText: {
  fontFamily: 'DM_Sans_500Medium',
  fontSize: 12,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
  color: '#00E676',
}

// Medium — same structure, amber colours
// High — same structure, red colours + glow shadow
```

### Input Field

```javascript
inputField: {
  height: 54,
  borderRadius: 12,
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.10)',
  paddingHorizontal: 18,
  fontFamily: 'DM_Sans_400Regular',
  fontSize: 15,
  color: '#F0F0F5',
}

// Focused state
inputFieldFocused: {
  borderColor: 'rgba(0, 229, 255, 0.50)',
  backgroundColor: 'rgba(0, 229, 255, 0.04)',
}
```

### Live Indicator Dot

A small pulsing dot used alongside "Active" status labels.

```javascript
// Base dot
liveDot: {
  width: 8,
  height: 8,
  borderRadius: 4,
  backgroundColor: '#00E676',
}

// Animate with Animated.loop + Animated.sequence
// Scale from 1.0 to 1.6 and back, opacity from 1 to 0.3
// Duration: 1400ms ease-in-out
```

---

## The Shield Pulse — Signature Component

This is the centrepiece of the Home screen and the most memorable element in the entire app. When surveillance is active, a large shield icon sits in the middle of the screen surrounded by a breathing ring of electric cyan light.

```
Visual structure (centre of Home screen):

  [ soft outer glow ring — animated scale + opacity ]
  [ middle ring — border only, 1px, semi-transparent ]
  [ inner ring — animated breathing, thicker ]
  [ shield icon — Lucide Shield, filled, cyan ]
  [ "ACTIVE" label below — JetBrains Mono, cyan ]
```

```javascript
// Container
shieldContainer: {
  width: 200,
  height: 200,
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'center',
}

// Outer breathing ring — Animated
outerRing: {
  position: 'absolute',
  width: 180,
  height: 180,
  borderRadius: 90,
  borderWidth: 1,
  borderColor: 'rgba(0, 229, 255, 0.15)',
  // Animate: scale 1.0 → 1.15, opacity 0.6 → 0, duration 2000ms loop
}

// Inner solid ring
innerRing: {
  position: 'absolute',
  width: 130,
  height: 130,
  borderRadius: 65,
  borderWidth: 1.5,
  borderColor: 'rgba(0, 229, 255, 0.40)',
  backgroundColor: 'rgba(0, 229, 255, 0.04)',
}

// Shield icon — Lucide <Shield> size={52} color="#00E5FF" strokeWidth={1.5}
// With accent glow shadow beneath it
```

**Animation spec:**

- Outer ring: breathes outward — scale 1.0 to 1.2, opacity 1 to 0 — loop every 2000ms with ease-out
- Inner ring: slower breath — scale 1.0 to 1.05 — loop every 3000ms ease-in-out
- Shield icon: no animation during active state — it is the calm centre
- On HIGH risk: all rings turn `--color-risk-high`, outer ring pulses fast (800ms), shield icon becomes the Lucide `<ShieldAlert>` icon

---

## Onboarding Design Specifics

### Progress Bar

A thin (3px) horizontal bar at the top of every onboarding screen. Fills left to right as the user progresses.

```javascript
progressBarTrack: {
  height: 3,
  borderRadius: 9999,
  backgroundColor: 'rgba(255, 255, 255, 0.08)',
  marginHorizontal: 20,
  marginTop: 16,
}

progressBarFill: {
  height: 3,
  borderRadius: 9999,
  backgroundColor: '#00E5FF',
  // Animate width change with Animated.timing duration: 300ms
}
```

### Onboarding Headlines

Large, bold, left-aligned. The Outfit font at 700 weight makes these feel punchy and modern.

```javascript
// Standard onboarding headline
onboardingHeadline: {
  fontFamily: 'Outfit_700Bold',
  fontSize: 34,
  lineHeight: 42,
  color: '#F0F0F5',
  letterSpacing: -0.5,
  marginTop: 40,
  marginHorizontal: 24,
}
```

### Motivational Interstitial Screens

These break up the question flow. They have a larger illustration, centred layout, and slightly different tone.

- Background: same `--color-bg-primary`
- Illustration: a simple SVG icon inside a soft circular glow — the glow is `rgba(0, 229, 255, 0.08)` with a 120px radius
- Headline: centred, `displayLarge`, white
- Subtext: centred, `bodyLarge`, `--color-text-secondary`
- No progress bar on motivational screens — let the user breathe

### Comparison Cards (Screen 7)

```javascript
comparisonRow: {
  flexDirection: 'row',
  gap: 12,
  marginHorizontal: 24,
  marginTop: 32,
}

comparisonCard: {
  flex: 1,
  padding: 20,
  borderRadius: 16,
  backgroundColor: 'rgba(255, 255, 255, 0.04)',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.08)',
}

// "With Surveillance AI" card — accent bordered
comparisonCardActive: {
  ...comparisonCard,
  borderColor: 'rgba(0, 229, 255, 0.35)',
  backgroundColor: 'rgba(0, 229, 255, 0.06)',
}
```

### Permissions Screen (Screen 10)

Each permission item is a row with an icon on the left, label and description in the middle, and a checkmark on the right that fills in as the permission is granted.

```javascript
permissionRow: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 18,
  borderBottomWidth: 1,
  borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  paddingHorizontal: 24,
}

permissionIcon: {
  width: 44,
  height: 44,
  borderRadius: 12,
  backgroundColor: 'rgba(0, 229, 255, 0.10)',
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 16,
}

// Granted checkmark: Lucide <CheckCircle2> color="#00E676" size={22}
// Pending: Lucide <Circle> color="#555568" size={22}
```

---

## Screen-by-Screen Design Notes

### Home Screen

The emotional centrepiece. The shield pulse dominates the upper 55% of the screen. Below it:

- Status label: "ACTIVE" or "INACTIVE" in `JetBrains Mono`, uppercase, `--color-accent` or `--color-text-tertiary`
- Session timer if active: `JetBrains Mono`, `--color-text-secondary`, e.g. "01:24:37"
- Last risk badge just below the timer
- "Start Surveillance" / "Stop" pill button — full width, 56px height, at the bottom above the tab bar
- Manual SOS button: a smaller red ghost pill button above the CTA — visible but not dominant

**When inactive:** shield is dimmed, rings invisible, background is flat dark.
**When active:** shield glows, rings breathe, a very subtle animated gradient washes across the background — cyan to transparent, barely perceptible.

### Live Status Screen

Split into two zones:

- Top 50%: `react-native-maps` in dark map style (`mapType="mutedStandard"` with a dark custom map style JSON). A pulsing cyan dot marks the user's live position.
- Bottom 50%: a bottom-sheet style panel with the risk badge, last AI analysis summary, and cycle countdown timer.

Map dark style uses the standard Google Maps dark JSON (Night Mode). The user's position marker is a filled cyan circle with a glow.

### Event Log Screen

A scrollable flat list. Each item is a glass card with:

- Left edge: a 3px coloured bar indicating risk level (green / amber / red)
- Top row: risk badge (pill) + timestamp in `JetBrains Mono`
- Body: AI summary in `bodyMedium`, `--color-text-secondary`
- Bottom row: small photo thumbnail (if available) + transcript excerpt in italics

Tapping expands the card with a smooth height animation to reveal the full report.

### Alerts Screen

Same card style as Event Log but with an additional "What was sent" section showing SMS / Email / Call chips.

Chips:

```javascript
alertChip: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: 9999,
  backgroundColor: 'rgba(255, 61, 61, 0.10)',
  borderWidth: 1,
  borderColor: 'rgba(255, 61, 61, 0.25)',
  marginRight: 8,
}
```

### Settings Screen

A grouped list layout. Each section has a small all-caps label header in `labelSmall`, `--color-text-tertiary`. Items are rows with a left label, right control (toggle, chevron, or value).

Toggles use React Native's `Switch` component with `trackColor={{ true: '#00E5FF' }}` and `thumbColor="#FFFFFF"`.

---

## Icons

Use **Lucide React Native** exclusively. Stroke width: `1.5` throughout. Never use filled icons except for the active shield state.

Key icons used:

| Context               | Icon                 |
| --------------------- | -------------------- |
| Home — inactive       | `Shield`             |
| Home — active         | `Shield` (with glow) |
| Home — high risk      | `ShieldAlert`        |
| SOS button            | `Siren`              |
| GPS / location        | `MapPin`             |
| Camera                | `Camera`             |
| Audio / microphone    | `Mic`                |
| Shake / accelerometer | `Vibrate`            |
| SMS                   | `MessageSquare`      |
| Email                 | `Mail`               |
| Phone call            | `Phone`              |
| Risk — Low            | `ShieldCheck`        |
| Risk — Medium         | `ShieldEllipsis`     |
| Risk — High           | `ShieldAlert`        |
| Settings              | `Settings2`          |
| Event log             | `ScrollText`         |
| Alerts                | `BellRing`           |
| Live                  | `Radio`              |

---

## Animation Principles

- **Duration:** Most transitions are 250–350ms. The shield pulse is 2000ms. Loading screen items tick in at 600ms intervals.
- **Easing:** `Easing.out(Easing.cubic)` for entrances. `Easing.in(Easing.cubic)` for exits. `Easing.inOut(Easing.sine)` for breathing loops.
- **Stagger:** Onboarding option cards stagger in at 60ms intervals on mount.
- **Page transitions:** Slide from right using Expo Router's default stack animation.
- **Risk level change:** When risk level changes, the badge crossfades over 200ms — never a hard cut.
- **Never animate colour directly.** Fade between two coloured views using opacity instead.

---

## Dark Map Style (react-native-maps)

Apply this custom map style for the Live screen to match the dark app theme:

```json
[
  { "elementType": "geometry", "stylers": [{ "color": "#0d0d14" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#555570" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#0d0d14" }] },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{ "color": "#1a1a2a" }]
  },
  {
    "featureType": "road.arterial",
    "elementType": "geometry",
    "stylers": [{ "color": "#1f1f32" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#08080f" }]
  },
  { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
  { "featureType": "transit", "stylers": [{ "visibility": "off" }] }
]
```

---

## Loading Screen Design (Onboarding Screen 11)

The setup loading screen is a key moment. Do not rush it. Even if setup completes instantly, animate the progress bar and tick items over 4 seconds to make the AI feel substantial.

- Progress bar: animated width, `--color-accent` fill, 3px height
- Percentage label: centred, `displayLarge`, white — counts up from 0 to 100
- Status text: `bodyMedium`, `--color-text-secondary`, updates with each step — "Estimating your risk profile...", "Calibrating shake sensitivity...", etc.
- Checklist items fade in and tick one by one with a 600ms stagger
- Checkmark animation: Lucide `<Check>` fades in at scale 0.5 → 1.0 over 200ms

---

## Fonts — Expo Installation

```bash
npx expo install @expo-google-fonts/outfit @expo-google-fonts/dm-sans @expo-google-fonts/jetbrains-mono
```

```javascript
// app/_layout.tsx
import {
  useFonts,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from "@expo-google-fonts/outfit";
import {
  DM_Sans_400Regular,
  DM_Sans_500Medium,
} from "@expo-google-fonts/dm-sans";
import { JetBrainsMono_400Regular } from "@expo-google-fonts/jetbrains-mono";
```

---

## Accessibility

- All interactive elements have a minimum touch target of 44x44px.
- Risk colours are never used as the _only_ differentiator — always paired with a text label or icon.
- All text meets WCAG AA contrast ratio (4.5:1 minimum) against dark backgrounds.
- The manual SOS button must always be reachable with one thumb from the bottom of the screen.
- Reduced motion: check `AccessibilityInfo.isReduceMotionEnabled()` and skip pulse animations if true.

---

## Do Not

- Do not use white or light backgrounds anywhere in the main app.
- Do not use gradients as backgrounds — only as subtle overlays on the active Home screen.
- Do not use more than two colours in any single component.
- Do not use the accent colour (`--color-accent`) for anything other than its designated roles.
- Do not use drop shadows with visible offsets — use glow shadows only (offset: 0, 0).
- Do not use emojis in the production UI — use Lucide icons only.
- Do not use `Inter`, `Roboto`, `Arial`, or `System` fonts.
- Do not animate background colours directly — crossfade between views.
- Do not use border radius smaller than 8px anywhere in the app.

---

_DESIGN.md version 1.0 — Surveillance AI_
