// Uploads a captured photo/audio clip to the private event-media Storage
// bucket so a linked guardian can actually see/hear what a session looked
// like, not just an AI-generated sentence. Called for every non-covered
// frame/clip regardless of risk level (see lib/monitoring.ts) -- GPT-4o/
// Whisper already run on all of them either way, so the extra storage
// cost is comparatively small. Old media is swept by the retention job
// (supabase/functions/cleanup-old-media) rather than kept forever.
//
// Fire-and-forget by design: a failed upload should never block the
// monitoring cycle or delay an alert. Returns null on any failure so the
// caller can just skip patching the event's storage path field.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "./supabase";

const BUCKET = "event-media";

function extensionOf(uri: string): string {
  const match = uri.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : "bin";
}

function contentTypeFor(kind: "photo" | "audio", ext: string): string {
  if (kind === "photo") return "image/jpeg";
  if (ext === "wav") return "audio/wav";
  if (ext === "mp4" || ext === "m4a") return "audio/mp4";
  return "application/octet-stream";
}

// Path convention: {userId}/{eventId}-{kind}.{ext} -- the leading segment
// is what the storage RLS policies in migration 019 check against
// auth.uid() (ward) or an active guardian_links row (guardian).
export async function uploadEventMedia(
  userId: string,
  eventId: string,
  localUri: string,
  kind: "photo" | "audio",
): Promise<string | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const ext = kind === "photo" ? "jpg" : extensionOf(localUri);
    const path = `${userId}/${eventId}-${kind}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, decode(base64), {
        contentType: contentTypeFor(kind, ext),
        upsert: true,
      });

    if (error) {
      console.error(`[storage] uploadEventMedia (${kind}) failed:`, error.message);
      return null;
    }

    return path;
  } catch (err) {
    console.error(`[storage] uploadEventMedia (${kind}) failed:`, err);
    return null;
  }
}

// Both the ward's own device and a linked guardian's call this the same
// way -- the storage RLS policies decide who's actually allowed to read
// a given path, this just asks for a temporary signed URL to it.
export async function getSignedMediaUrl(
  storagePath: string,
  expiresInSeconds: number = 3600,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      console.error("[storage] getSignedMediaUrl failed:", error?.message);
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.error("[storage] getSignedMediaUrl failed:", err);
    return null;
  }
}

const CLEANUP_LAST_RUN_KEY = "@surveillance_ai/media_cleanup_last_run";
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // once a day is plenty for a 30-day retention window

// Triggers the server-side retention sweep (supabase/functions/
// cleanup-old-media) at most once a day, regardless of how often the app
// is opened -- called from app/_layout.tsx on every signed-in launch, this
// AsyncStorage guard is what keeps it from actually hitting the network
// every single time.
export async function maybeRunMediaCleanup(): Promise<void> {
  try {
    const lastRunRaw = await AsyncStorage.getItem(CLEANUP_LAST_RUN_KEY);
    const lastRun = lastRunRaw ? Number(lastRunRaw) : 0;
    if (Date.now() - lastRun < CLEANUP_INTERVAL_MS) return;

    await AsyncStorage.setItem(CLEANUP_LAST_RUN_KEY, String(Date.now()));

    const { error } = await supabase.functions.invoke("cleanup-old-media");
    if (error) {
      console.error("[storage] maybeRunMediaCleanup failed:", error.message);
    }
  } catch (err) {
    console.error("[storage] maybeRunMediaCleanup failed:", err);
  }
}
