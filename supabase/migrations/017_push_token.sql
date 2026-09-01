-- =============================================================
-- Surveillance AI — Push Token
-- =============================================================
-- Persists the Expo push token already fetched during onboarding
-- (registerForPushNotifications, lib/notifications.ts) but previously
-- discarded. Needed so a guardian can remotely start monitoring on a
-- ward's device (supabase/functions/remote-start-session) by sending a
-- push to this token.
-- =============================================================

alter table users add column if not exists push_token text;
