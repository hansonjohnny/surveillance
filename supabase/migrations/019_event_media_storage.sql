-- Guardian-visible photo/audio for Medium/High events. Previously the
-- ward's photo/audio clips never left the device -- events.photo_url held
-- a meaningless local file:// path (useAlertStore.ts) that a guardian's
-- device could never resolve (lib/guardian.ts's mapEvent nulled it out).
--
-- Storage cost is bounded deliberately: only Medium/High events upload
-- media (see lib/monitoring.ts) -- not every Low cycle. The bucket is
-- private; both the ward and a linked guardian read via a short-lived
-- signed URL (see lib/guardian.ts's getSignedMediaUrl), generated only
-- when a card is actually opened, not upfront for every event.

insert into storage.buckets (id, name, public)
values ('event-media', 'event-media', false)
on conflict (id) do nothing;

alter table events add column if not exists photo_storage_path text;
alter table events add column if not exists audio_storage_path text;

-- Objects are stored at {user_id}/{event_id}.{ext} -- the leading path
-- segment is the ward's own user id, checked against auth.uid() directly
-- for the ward, or against an active guardian_links row for a guardian.
-- Mirrors the exact guardian-read pattern already used on
-- sessions/events/alerts/location_points (see migration 009).

create policy "ward can upload own event media"
on storage.objects for insert
with check (
  bucket_id = 'event-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "ward can read own event media"
on storage.objects for select
using (
  bucket_id = 'event-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "guardian can read linked ward's event media"
on storage.objects for select
using (
  bucket_id = 'event-media'
  and exists (
    select 1 from guardian_links
    where guardian_links.ward_id::text = (storage.foldername(name))[1]
      and guardian_links.guardian_id = auth.uid()
      and guardian_links.status = 'active'
  )
);
