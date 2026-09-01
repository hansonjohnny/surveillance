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

  // The page is hosted on GitHub Pages, not Supabase — Supabase's shared
  // *.supabase.co domain (Edge Functions AND Storage) force-rewrites
  // text/html responses to text/plain as an anti-phishing measure (only a
  // Pro-plan custom domain avoids it), so a real static host is required.
  // The static page polls share-location for JSON data, which stays a
  // Supabase Edge Function — that restriction only applies to HTML. See
  // share.html (repo root) and supabase/functions/share-location.
  const url = `https://hansonjohnny.github.io/surveillance/share.html?token=${token}`;

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

// sessions.last_lat/last_lng (what the shared map reads) is now kept
// current by lib/location.ts's maybePushLocationPing, called on every
// active session regardless of whether a share link exists — this used
// to be the only thing writing those columns, gated on a share link
// being active, which meant a ward who never used Live Share never got
// a position synced at all. See supabase/migrations/015_location_points.sql.
