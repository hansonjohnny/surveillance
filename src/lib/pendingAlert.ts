// Cancel window for AI-only High-risk alerts — gives the user a chance to
// catch a false positive (loud party audio, a bad photo) before the
// emergency contact actually gets SMS/email/call. Shake and manual SOS
// stay instant; only the two AI-triggered High call sites in
// lib/monitoring.ts route through here instead of calling triggerAlert
// directly.

import { usePendingAlertStore } from "../store/usePendingAlertStore";
import type { Contact, Event } from "../types";
import { triggerAlert } from "./alerts";

export const CANCEL_WINDOW_SECONDS = 12;

// Not persisted in the store — a setTimeout handle isn't serializable and
// wouldn't survive a restart anyway.
let fireTimer: ReturnType<typeof setTimeout> | null = null;

function clearFireTimer() {
  if (fireTimer) {
    clearTimeout(fireTimer);
    fireTimer = null;
  }
}

export function schedulePendingAlert(event: Event, contact: Contact): void {
  const existing = usePendingAlertStore.getState().pending;

  // A second High signal for the same session while one is already
  // counting down is corroborating evidence, not ambiguity — fire now
  // with the newer event instead of restarting (or stacking) the countdown.
  if (existing && existing.event.sessionId === event.sessionId) {
    clearFireTimer();
    usePendingAlertStore.getState().setPending(null);
    triggerAlert(event, contact).catch((err) =>
      console.error("[pendingAlert] triggerAlert (corroborated) failed:", err),
    );
    return;
  }

  clearFireTimer();
  const deadline = Date.now() + CANCEL_WINDOW_SECONDS * 1000;
  usePendingAlertStore.getState().setPending({ event, contact, deadline });

  fireTimer = setTimeout(() => {
    fireTimer = null;
    // Confirm it wasn't cancelled/sent-now in the meantime.
    const current = usePendingAlertStore.getState().pending;
    if (!current || current.event.id !== event.id) return;

    usePendingAlertStore.getState().setPending(null);
    triggerAlert(event, contact).catch((err) =>
      console.error("[pendingAlert] triggerAlert failed:", err),
    );
  }, CANCEL_WINDOW_SECONDS * 1000);
}

export function cancelPendingAlert(): void {
  clearFireTimer();
  usePendingAlertStore.getState().setPending(null);
}

export function sendPendingAlertNow(): void {
  const pending = usePendingAlertStore.getState().pending;
  if (!pending) return;

  clearFireTimer();
  usePendingAlertStore.getState().setPending(null);
  triggerAlert(pending.event, pending.contact).catch((err) =>
    console.error("[pendingAlert] triggerAlert (send now) failed:", err),
  );
}
