// Live Share — lets a user generate a link an emergency contact can open
// in any browser (no login, no app install) to watch their live position
// while a session is active. The link's security boundary is the token
// itself, checked in supabase/functions/share-location against
// expires_at/revoked_at — see that function for the read side.

import { generateUUID } from "./id";
import { supabase } from "./supabase";

const LINK_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours

export type ShareLink = {
  id: string;
  token: string;
  url: string;
  sessionId: string;
  expiresAt: number;
};

export async function createShareLink(
  sessionId: string,
  userId: string,
): Promise<ShareLink | null> {
  const token = generateUUID();
  const id = generateUUID();
  const expiresAt = Date.now() + LINK_LIFETIME_MS;

  const { error } = await supabase.from("share_links").insert({
    id,
    token,
    user_id: userId,
    session_id: sessionId,
    expires_at: new Date(expiresAt).toISOString(),
  });

  if (error) {
    console.error("[liveShare] Failed to create share link:", error.message);
    return null;
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/share-location?token=${token}`;

  return { id, token, url, sessionId, expiresAt };
}

export async function revokeShareLink(id: string): Promise<void> {
  const { error } = await supabase
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[liveShare] Failed to revoke share link:", error.message);
  }
}

// Called once per monitoring cycle while a share link is active for the
// current session — see lib/monitoring.ts. Not synced anywhere else, so a
// failure here just means the shared map is briefly stale, not lost data.
export async function pushLiveLocationUpdate(
  sessionId: string,
  lat: number,
  lng: number,
): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .update({
      last_lat: lat,
      last_lng: lng,
      last_location_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) {
    console.error(
      "[liveShare] Failed to push live location update:",
      error.message,
    );
  }
}
