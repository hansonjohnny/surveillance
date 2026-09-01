-- GPT-4o already returns structured `concerns` (specific flagged details)
-- and `confidence` (0.0-1.0) alongside riskLevel/summary for both the
-- image and audio analysis calls (see supabase/functions/analyse-image
-- and analyse-audio) -- the client only ever stored riskLevel/summary,
-- discarding the rest. Add columns to persist it for both the ward's own
-- log and a linked guardian's read of the same row.

alter table events add column if not exists concerns text[];
alter table events add column if not exists confidence numeric;
alter table events add column if not exists audio_concerns text[];
alter table events add column if not exists audio_confidence numeric;
