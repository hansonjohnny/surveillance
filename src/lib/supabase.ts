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
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
