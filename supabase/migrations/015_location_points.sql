-- =============================================================
-- Surveillance AI — Location Points (trail)
-- =============================================================
-- A dedicated, denser location ping independent of the AI monitoring
-- cycle (see lib/location.ts's maybePushLocationPing, ~every 12s during
-- an active session) -- this is what actually populates a real
-- location trail for a guardian to view, replacing the old fragile
-- path where sessions.last_lat/last_lng only updated while a Live
-- Share link happened to be active. Append-only; no update/delete
-- policy. Table growth over time is a known, deliberately deferred
-- follow-up (a retention job) -- reads already cap what's fetched.
-- =============================================================

create table if not exists location_points (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  session_id  uuid not null references sessions (id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  recorded_at timestamptz not null default now()
);

alter table location_points enable row level security;

create policy "location_points: insert own"
  on location_points for insert
  with check ((select auth.uid()) = user_id);

create policy "location_points: select own"
  on location_points for select
  using ((select auth.uid()) = user_id);

-- Same pattern as the sessions/events/alerts guardian-read policies in
-- migrations 009/011.
create policy "location_points: select as linked guardian"
  on location_points for select
  using (
    exists (
      select 1 from guardian_links
      where guardian_links.ward_id = location_points.user_id
      and guardian_links.guardian_id = (select auth.uid())
      and guardian_links.status = 'active'
    )
  );

create index if not exists idx_location_points_user_id on location_points (user_id);
create index if not exists idx_location_points_session_id on location_points (session_id);
