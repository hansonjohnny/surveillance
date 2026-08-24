-- =============================================================
-- Surveillance AI — Alert Escalation
-- =============================================================
-- Lets a High-risk alert's SMS/email include a tap-to-acknowledge
-- link (ack-alert Edge Function). If the primary contact never
-- taps it within the escalation window, lib/escalation.ts notifies
-- the backup contact configured in Settings and records that here.
-- =============================================================

alter table alerts add column if not exists acknowledged_at    timestamptz;
alter table alerts add column if not exists escalated_at       timestamptz;
alter table alerts add column if not exists backup_contact_name text;
