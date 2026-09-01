// A cheap, instant, non-AI safety signal that runs the moment a transcript
// arrives — no waiting on a GPT-4o round trip. Mirrors the shake-detection
// philosophy (AGENTS.md: "no AI call needed") for audio: a handful of
// alarm phrases are a strong enough signal on their own to escalate risk
// immediately.
//
// Unlike shake, this does NOT bypass the AI cycle and fire instantly — a
// single matched phrase inside ambient conversation is a noisier signal
// than a physical impact (a transcript containing "help me find my keys"
// or a line from a TV show nearby shouldn't trigger the same instant call
// a real fall does). Instead it's folded into the same combineRisks()
// pipeline as image/audio AI analysis in lib/monitoring.ts, so it still
// gets the same 12-second cancel window as any other AI-driven High.

export const ALARM_KEYWORDS = [
  "help me",
  "help",
  "let me go",
  "let go of me",
  "stop it",
  "don't hurt me",
  "please stop",
  "call the police",
  "call 911",
  "i'm scared",
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Returns the first matching keyword, or null. Word-boundary and case-
// insensitive, so e.g. "help" won't match inside "helping".
export function detectAlarmKeyword(transcript: string): string | null {
  for (const keyword of ALARM_KEYWORDS) {
    const pattern = new RegExp(`\\b${escapeRegex(keyword)}\\b`, "i");
    if (pattern.test(transcript)) return keyword;
  }
  return null;
}
