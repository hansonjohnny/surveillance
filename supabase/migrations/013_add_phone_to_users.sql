-- =============================================================
-- Surveillance AI — Guardian Phone Number
-- =============================================================
-- Collected at signup for a guardian account (see (auth)/sign-up.tsx).
-- Used to auto-fill a ward's primary emergency contact at creation time
-- (see supabase/functions/create-ward-account/index.ts) so nothing
-- needs to be configured on the ward's end for SOS to reach the
-- guardian. Nullable — only guardians populate it.
-- =============================================================

alter table users add column if not exists phone text;
