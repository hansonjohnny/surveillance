// Tracks a High-risk alert that's counting down before it actually sends —
// see lib/pendingAlert.ts for the countdown logic. Deliberately NOT
// persisted: a countdown surviving an app restart isn't meaningful, and the
// underlying setTimeout that actually fires the alert wouldn't survive a
// restart either.

import type { Contact, Event } from "@/types";
import { create } from "zustand";

export type PendingAlert = {
  event: Event;
  contact: Contact;
  deadline: number; // epoch ms
};

type PendingAlertStore = {
  pending: PendingAlert | null;
  setPending: (pending: PendingAlert | null) => void;
};

export const usePendingAlertStore = create<PendingAlertStore>()((set) => ({
  pending: null,
  setPending: (pending) => set({ pending }),
}));
