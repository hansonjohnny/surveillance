-- Lets a linked, active guardian read and write a ward's monitoring
-- settings (interval, shake sensitivity) -- previously settings was
-- owner-only (migration 001), and the client never actually used this
-- table at all (monitoringInterval/shakeSensitivity lived only in local
-- AsyncStorage). See lib/settingsSync.ts for the client-side sync this
-- backs. Same guardian_links-based pattern as every other guardian-read
-- table (sessions/events/alerts/location_points/storage).

create policy "settings: guardian select linked ward's row"
  on settings for select
  using (
    exists (
      select 1 from guardian_links
      where guardian_links.ward_id = settings.user_id
        and guardian_links.guardian_id = auth.uid()
        and guardian_links.status = 'active'
    )
  );

create policy "settings: guardian update linked ward's row"
  on settings for update
  using (
    exists (
      select 1 from guardian_links
      where guardian_links.ward_id = settings.user_id
        and guardian_links.guardian_id = auth.uid()
        and guardian_links.status = 'active'
    )
  );

-- Needed for the upsert path when a ward has never opened Settings yet
-- (no row exists) and the guardian is the first to set a value.
create policy "settings: guardian insert linked ward's row"
  on settings for insert
  with check (
    exists (
      select 1 from guardian_links
      where guardian_links.ward_id = settings.user_id
        and guardian_links.guardian_id = auth.uid()
        and guardian_links.status = 'active'
    )
  );
