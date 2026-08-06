-- =============================================================
-- Surveillance AI — Initial Schema
-- =============================================================
-- Six tables, all with Row Level Security enabled.
-- Every RLS policy uses auth.uid() so each user can only
-- read and write their own rows — no data leaks between users.
-- =============================================================


-- -------------------------------------------------------------
-- users
-- -------------------------------------------------------------
-- One row per authenticated user. The row is created
-- automatically by the trigger at the bottom of this file
-- the first time someone signs up via Supabase Auth.
-- We store only the id (which mirrors auth.users.id) and the
-- creation timestamp — all other profile data lives in
-- contacts and settings.
-- -------------------------------------------------------------

create table if not exists users (
  id         uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table users enable row level security;

-- Users can read and update only their own row.
create policy "users: select own row"
  on users for select
  using (auth.uid() = id);

create policy "users: insert own row"
  on users for insert
  with check (auth.uid() = id);

create policy "users: update own row"
  on users for update
  using (auth.uid() = id);


-- -------------------------------------------------------------
-- sessions
-- -------------------------------------------------------------
-- Each time the user taps "Start Surveillance" a new session
-- row is created. When they tap "Stop", ended_at is filled in.
-- total_cycles counts how many monitoring cycles ran so the
-- session summary card ("2 hr 14 min · 6 cycles") can be
-- rendered without counting the events table every time.
-- -------------------------------------------------------------

create table if not exists sessions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references users (id) on delete cascade,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  total_cycles integer     not null default 0
);

alter table sessions enable row level security;

create policy "sessions: select own rows"
  on sessions for select
  using ((select auth.uid()) = user_id);

create policy "sessions: insert own rows"
  on sessions for insert
  with check ((select auth.uid()) = user_id);

create policy "sessions: update own rows"
  on sessions for update
  using ((select auth.uid()) = user_id);

create policy "sessions: delete own rows"
  on sessions for delete
  using ((select auth.uid()) = user_id);


-- -------------------------------------------------------------
-- events
-- -------------------------------------------------------------
-- One row per monitoring cycle. Each cycle produces a risk
-- level, an AI summary, GPS coordinates, and optionally a
-- photo URL and audio transcript. The Event Log screen reads
-- directly from this table.
--
-- risk_level is constrained to 'low', 'medium', or 'high' so
-- the app never stores an unexpected value.
-- -------------------------------------------------------------

create table if not exists events (
  id          uuid             primary key default gen_random_uuid(),
  session_id  uuid             not null references sessions (id) on delete cascade,
  user_id     uuid             not null references users (id) on delete cascade,
  timestamp   timestamptz      not null default now(),
  risk_level  text             not null check (risk_level in ('low', 'medium', 'high')),
  ai_summary  text,
  photo_url   text,
  transcript  text,
  latitude    double precision,
  longitude   double precision
);

alter table events enable row level security;

create policy "events: select own rows"
  on events for select
  using ((select auth.uid()) = user_id);

create policy "events: insert own rows"
  on events for insert
  with check ((select auth.uid()) = user_id);

create policy "events: update own rows"
  on events for update
  using ((select auth.uid()) = user_id);

create policy "events: delete own rows"
  on events for delete
  using ((select auth.uid()) = user_id);


-- -------------------------------------------------------------
-- alerts
-- -------------------------------------------------------------
-- Created only for High-risk events that triggered an SOS.
-- Tracks which channels fired (SMS, email, call) so the Alerts
-- screen can show exactly what was sent, to whom, and when.
-- The deduplication check in the app uses this table — if an
-- alert row already exists for a given event_id, the app will
-- not fire the channels a second time.
-- -------------------------------------------------------------

create table if not exists alerts (
  id           uuid        primary key default gen_random_uuid(),
  event_id     uuid        not null references events (id) on delete cascade,
  user_id      uuid        not null references users (id) on delete cascade,
  timestamp    timestamptz not null default now(),
  contact_name text,
  sms_sent     boolean     not null default false,
  email_sent   boolean     not null default false,
  call_made    boolean     not null default false,
  ai_summary   text,
  latitude     double precision,
  longitude    double precision
);

alter table alerts enable row level security;

create policy "alerts: select own rows"
  on alerts for select
  using ((select auth.uid()) = user_id);

create policy "alerts: insert own rows"
  on alerts for insert
  with check ((select auth.uid()) = user_id);

create policy "alerts: update own rows"
  on alerts for update
  using ((select auth.uid()) = user_id);

create policy "alerts: delete own rows"
  on alerts for delete
  using ((select auth.uid()) = user_id);


-- -------------------------------------------------------------
-- contacts
-- -------------------------------------------------------------
-- The emergency contact entered during onboarding (or updated
-- in Settings). The app reads this row to know who to SMS,
-- email, and call when a High-risk alert fires.
-- One user typically has one contact row, but the schema allows
-- for multiple contacts in a future version.
-- -------------------------------------------------------------

create table if not exists contacts (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  name    text not null,
  phone   text not null,
  email   text not null
);

alter table contacts enable row level security;

create policy "contacts: select own rows"
  on contacts for select
  using ((select auth.uid()) = user_id);

create policy "contacts: insert own rows"
  on contacts for insert
  with check ((select auth.uid()) = user_id);

create policy "contacts: update own rows"
  on contacts for update
  using ((select auth.uid()) = user_id);

create policy "contacts: delete own rows"
  on contacts for delete
  using ((select auth.uid()) = user_id);


-- -------------------------------------------------------------
-- settings
-- -------------------------------------------------------------
-- One row per user (enforced by the unique constraint on
-- user_id). Stores the preferences set during onboarding and
-- editable in the Settings screen:
--   monitoring_interval  — seconds between cycles (20/30/60)
--   shake_sensitivity    — 'low', 'medium', or 'high'
--   stealth_mode         — dims the screen during active sessions
--   wellness_checkin_time — "HH:MM" string, e.g. "22:00"
-- -------------------------------------------------------------

create table if not exists settings (
  id                    uuid    primary key default gen_random_uuid(),
  user_id               uuid    not null references users (id) on delete cascade unique,
  monitoring_interval   integer not null default 30,
  shake_sensitivity     text    not null default 'medium',
  stealth_mode          boolean not null default false,
  wellness_checkin_time text
);

alter table settings enable row level security;

create policy "settings: select own row"
  on settings for select
  using ((select auth.uid()) = user_id);

create policy "settings: insert own row"
  on settings for insert
  with check ((select auth.uid()) = user_id);

create policy "settings: update own row"
  on settings for update
  using ((select auth.uid()) = user_id);

create policy "settings: delete own row"
  on settings for delete
  using ((select auth.uid()) = user_id);


-- =============================================================
-- Trigger: auto-create a users row on first sign-up
-- =============================================================
-- When Supabase Auth creates a new entry in auth.users (i.e.
-- when someone signs up via email/password, Google, or Apple),
-- this trigger immediately inserts a matching row into our
-- public.users table so every downstream table (sessions,
-- events, etc.) has a valid foreign key to reference.
-- =============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================================
-- Indexes: FK and RLS predicate columns
-- =============================================================
-- Explicit indexes on user_id, session_id, and event_id speed
-- up RLS policy checks and ON DELETE CASCADE operations.
-- =============================================================

create index if not exists idx_sessions_user_id  on sessions (user_id);
create index if not exists idx_events_user_id    on events   (user_id);
create index if not exists idx_events_session_id on events   (session_id);
create index if not exists idx_alerts_user_id    on alerts   (user_id);
create index if not exists idx_alerts_event_id   on alerts   (event_id);
create index if not exists idx_contacts_user_id  on contacts (user_id);
