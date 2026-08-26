import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "[supabase] Missing env vars: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set in .env. " +
    "Run `npx expo start --clear` to pick up new .env values.",
  );
}

// Single shared Supabase client — import this everywhere in the app.
// The anon key is safe to expose on the client because Row Level Security
// ensures every query is scoped to the authenticated user's own data.
//
// auth.storage must be set to AsyncStorage on React Native — without it
// the JS client falls back to localStorage (which doesn't exist here)
// and the session is lost on every cold launch, forcing the user to log
// in again each time they open the app.
// Public bridge page (confirm.html, repo root, hosted on GitHub Pages)
// that every Supabase auth email's redirectTo points at. Must be added to
// Supabase's Auth > URL Configuration redirect allowlist — an
// unlisted redirectTo silently falls back to Site URL instead of erroring,
// which is what previously sent these links to http://localhost:3000.
export const CONFIRM_BRIDGE_URL =
  "https://hansonjohnny.github.io/surveillance/confirm.html";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// supabase.functions.invoke() throws a generic "non-2xx" error that hides
// the actual { success:false, error } body the Edge Function returned —
// pull the real reason out of the response so failures are diagnosable
// from logs instead of always showing the same generic message.
export async function logFunctionError(
  label: string,
  err: unknown,
): Promise<void> {
  const context = (err as { context?: Response })?.context;
  if (context && typeof context.json === "function") {
    try {
      console.error(`${label}:`, await context.json());
      return;
    } catch {
      // fall through to generic logging below
    }
  }
  console.error(`${label}:`, err);
}
