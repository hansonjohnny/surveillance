-- =============================================================
-- Surveillance AI — Guardian-Ward Monitoring (Phase 2)
-- =============================================================
-- Two small additive changes needed to make the guardian dashboard UI
-- correct rather than misleading:
--
-- 1. public.users has no name/email column (email lives only in private
--    auth.users), so the ward list needs something human-readable to
--    display. Persisting the email the guardian typed at invite time
--    directly on the link row is simpler and more robust than trying
--    to re-resolve it later through another RPC call.
--
-- 2. events.audio_summary was never added when audio analysis was
--    built -- only ai_summary (image) and transcript are synced today.
--    Without it, ExpandedEventCard's "Audio Analysis" section would
--    show a permanently-stuck "Analysing audio..." for every ward
--    event that has a transcript but no summary, since it can't tell
--    "not synced" from "still processing". Cheap to fix: it's just
--    text, same as ai_summary.
-- =============================================================

alter table guardian_links add column if not exists ward_email text;

alter table events add column if not exists audio_summary text;
