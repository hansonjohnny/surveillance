export type RiskLevel = "low" | "medium" | "high";

export type Address = {
  name: string | null;
  street: string | null;
  streetNumber: string | null;
  district: string | null;
  city: string | null;
  subregion: string | null;
  region: string | null;
  country: string | null;
  isoCountryCode: string | null;
  postalCode: string | null;
};

export type Location = {
  lat: number;
  lng: number;
  address?: Address | null;
};

// A single breadcrumb in the path recorded during a session.
export type LocationPoint = {
  lat: number;
  lng: number;
  timestamp: number;
};

// A breadcrumb tagged with the AI risk level known at that point in time.
export type RiskPathPoint = LocationPoint & { riskLevel: RiskLevel | null };

// An archived, completed surveillance session — the full path taken plus a
// risk breakdown, so past sessions can be reviewed from the History tab.
export type SessionRecord = {
  id: string;
  startTime: number;
  endTime: number;
  path: RiskPathPoint[];
  riskCounts: { low: number; medium: number; high: number };
};

export type Event = {
  id: string;
  sessionId: string;
  timestamp: number;
  riskLevel: RiskLevel;
  aiSummary: string;
  audioSummary: string | null | undefined;
  audioUri: string | null | undefined;
  photoUri: string | null;
  transcript: string | null | undefined;
  location: Location | null;
  // 'ai' | 'shake' | 'shake+ai' — used by alert pipeline to decide whether
  // to place a phone call (call fires only when source includes 'shake').
  source?: string;
};

export type Contact = {
  name: string;
  phone: string;
  email: string;
};

export type Alert = {
  id: string;
  eventId: string;
  timestamp: number;
  contactName: string;
  smsSent: boolean;
  emailSent: boolean;
  callMade: boolean;
  aiSummary: string;
  location: Location | null;
  // Escalation — see lib/escalation.ts. acknowledgedAt is set when the
  // contact taps the ack link in the SMS/email; escalatedAt/backupContactName
  // are set if the escalation window elapses without an acknowledgment.
  acknowledgedAt: number | null;
  escalatedAt: number | null;
  backupContactName: string | null;
};

// A High-risk alert that didn't fully go out — channels, Supabase sync, or
// both failed, usually because the device was offline. Held for retry the
// next time connectivity returns.
export type QueuedAlert = {
  id: string;
  alertId: string;
  event: Event;
  contact: Contact;
  isUrgent: boolean;
  channelsSent: boolean;
  supabaseSynced: boolean;
  attempts: number;
  createdAt: number;
};
