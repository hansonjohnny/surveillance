-- =============================================================
-- Surveillance AI — Backup Contact on contacts
-- =============================================================
-- Flat columns on the existing one-row-per-user contacts table rather
-- than a second row -- every existing code path already assumes one
-- row per user, and this maps directly onto useSettingsStore's
-- existing backupContactName/Phone/Email naming with no filtering
-- logic needed. Populated by a guardian at ward-creation time (see
-- create-ward-account/index.ts) and synced down to the ward's device
-- via useOnboardingStore's hydrateFromSupabase on first sign-in.
-- =============================================================

alter table contacts add column if not exists backup_name  text;
alter table contacts add column if not exists backup_phone text;
alter table contacts add column if not exists backup_email text;
