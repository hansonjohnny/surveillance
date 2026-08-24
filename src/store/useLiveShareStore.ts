// Tracks the currently active Live Share link (if any) so the Live screen
// can show a "sharing" chip and offer to stop it, and so
// lib/monitoring.ts knows whether to push location updates for Supabase
// to serve to the public share page.

import type { ShareLink } from "@/lib/liveShare";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type LiveShareStore = {
  activeLink: ShareLink | null;
  setActiveLink: (link: ShareLink) => void;
  clearActiveLink: () => void;
};

export const useLiveShareStore = create<LiveShareStore>()(
  persist(
    (set) => ({
      activeLink: null,
      setActiveLink: (link) => set({ activeLink: link }),
      clearActiveLink: () => set({ activeLink: null }),
    }),
    {
      name: "@surveillance_ai/live_share",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
