-- =============================================================
-- Surveillance AI — Live Share Link
-- =============================================================
-- Lets a user generate a link an emergency contact can open in
-- any browser (no login, no app install) to watch their live
-- position while a session is active. The link itself is the
-- security boundary — access is checked in the share-location
-- Edge Function against expires_at/revoked_at, not RLS, since
-- the viewer has no Supabase session.
-- =============================================================


-- -------------------------------------------------------------
-- sessions — live position columns
-- -------------------------------------------------------------
-- Updated once per monitoring cycle (every 20–30s) only while a
-- share link is active for the session, from lib/monitoring.ts.
-- -------------------------------------------------------------

alter table sessions add column if not exists last_lat double precision;
alter table sessions add column if not exists last_lng double precision;
alter table sessions add column if not exists last_location_at timestamptz;


-- -------------------------------------------------------------
-- share_links
-- -------------------------------------------------------------
-- One row per generated link. token is the secret embedded in
-- the URL — unguessable (a UUID), never looked up by anything
-- else. Auto-expires 24h after creation regardless of session
-- state; can also be revoked early from the app.
-- -------------------------------------------------------------

create table if not exists share_links (
  id          uuid        primary key default gen_random_uuid(),
  token       text        not null unique,
  user_id     uuid        not null references users (id) on delete cascade,
  session_id  uuid        not null references sessions (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz
);

alter table share_links enable row level security;

-- The app (authenticated) manages its own links. The anonymous
-- viewer never queries this table directly — the Edge Function
-- reads it with the service-role key, bypassing RLS entirely.
create policy "share_links: select own rows"
  on share_links for select
  using ((select auth.uid()) = user_id);

create policy "share_links: insert own rows"
  on share_links for insert
  with check ((select auth.uid()) = user_id);

create policy "share_links: update own rows"
  on share_links for update
  using ((select auth.uid()) = user_id);

create index if not exists idx_share_links_token      on share_links (token);
create index if not exists idx_share_links_user_id    on share_links (user_id);
create index if not exists idx_share_links_session_id on share_links (session_id);
