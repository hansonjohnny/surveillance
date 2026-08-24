-- =============================================================
-- Surveillance AI — Share Pages Storage Bucket
-- =============================================================
-- Supabase Edge Functions on the default *.supabase.co domain
-- rewrite text/html responses to text/plain — HTML serving only
-- works with a custom domain (Pro plan). Storage has no such
-- restriction, so the Live Share page is hosted here as a static
-- file instead; share-location stays a JSON-only data endpoint
-- that the page polls. See lib/liveShare.ts and
-- supabase/functions/share-location/index.ts.
--
-- public = true serves objects with no auth via
-- /storage/v1/object/public/<bucket>/<path> — no RLS policy
-- needed for that specific public read path.
-- =============================================================

insert into storage.buckets (id, name, public)
values ('share-pages', 'share-pages', true)
on conflict (id) do nothing;
