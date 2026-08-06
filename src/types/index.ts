export type RiskLevel = 'low' | 'medium' | 'high';

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
};
