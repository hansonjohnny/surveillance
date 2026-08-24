-- =============================================================
-- Surveillance AI — Backfill public.users
-- =============================================================
-- The on_auth_user_created trigger (002_auth_trigger.sql) only fires on
-- INSERT into auth.users, i.e. new sign-ups. Any account that registered
-- before these migrations were first applied to this project has an
-- auth.users row but no matching public.users row, so every downstream
-- foreign key (sessions/events/alerts/contacts/settings -> users) fails.
-- This backfills the missing rows once; safe to run again (no-op after).
-- =============================================================

insert into public.users (id, created_at)
select id, created_at from auth.users
on conflict (id) do nothing;
