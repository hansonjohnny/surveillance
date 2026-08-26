/*
 * lib/auth.ts
 * Complete authentication logic for Surveillance AI.
 * Uses Supabase Auth — built-in, free, auth.uid() works
 * natively in all RLS policies. No Clerk; using Supabase Auth.
 *
 * Covers: registration, login, logout, password reset.
 * Google OAuth and Apple Sign In are added in a later step.
 *
 * Every function returns { success, error } instead of
 * throwing so callers never need a try/catch at the call site.
 */

import type { Session, User } from "@supabase/supabase-js";
import { CONFIRM_BRIDGE_URL, supabase } from "./supabase";

// ─── Registration ─────────────────────────────────────────────────────────────

export async function signUp(
  email: string,
  password: string,
  options?: { data?: Record<string, unknown> },
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.auth.signUp({ email, password, options });
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch {
    return { success: false, error: "An unexpected error occurred." };
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function signIn(
  email: string,
  password: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch {
    return { success: false, error: "An unexpected error occurred." };
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// ─── Current user ─────────────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

// ─── Password reset — step 1: send the email ─────────────────────────────────

export async function sendPasswordResetEmail(
  email: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    // redirectTo must be in Supabase's Auth > URL Configuration redirect
    // allowlist or it silently falls back to the project's Site URL.
    // Supabase sends an email containing a link like:
    //   https://[project].supabase.co/auth/v1/verify?...&redirect_to=<CONFIRM_BRIDGE_URL>
    //
    // Supabase's server processes the token, then 302-redirects the
    // user's browser to CONFIRM_BRIDGE_URL#access_token=...&refresh_token=...
    // — a real https page (confirm.html, hosted on GitHub Pages) rather
    // than the raw surveillanceai:// scheme directly, since some mail
    // clients' in-app browsers refuse to follow a redirect straight to an
    // unknown scheme. That page forwards into the app; the deep link
    // listener in app/_layout.tsx catches it there and routes to
    // /(auth)/reset-password with the tokens as params.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: CONFIRM_BRIDGE_URL,
    });
    if (error) return { success: false, error: error.message };

    // Supabase intentionally returns success even when the email
    // address does not exist in auth.users — this prevents an
    // attacker from using this endpoint to discover which emails
    // are registered (known as "email enumeration").
    return { success: true, error: null };
  } catch {
    return { success: false, error: "An unexpected error occurred." };
  }
}

// ─── Password reset — step 2: set the new password ───────────────────────────

export async function updatePassword(
  newPassword: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    // supabase.auth.updateUser() only works when the user has an
    // active session. The reset-password screen calls
    // supabase.auth.setSession({ access_token, refresh_token })
    // with the tokens extracted from the deep link URL before
    // calling this function. That setSession call restores the
    // user's session from the one-time recovery tokens in the
    // email link, authorising this password update.
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch {
    return { success: false, error: "An unexpected error occurred." };
  }
}
