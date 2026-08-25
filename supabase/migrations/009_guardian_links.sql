-- =============================================================
-- Surveillance AI — Guardian-Ward Monitoring (Phase 1)
-- =============================================================
-- Lets a guardian read a linked ward's live status, event log, and
-- alert history in real time. Read-only for the guardian: this
-- migration only ever adds SELECT policies, never insert/update/delete,
-- on the ward's data. A guardian invites a ward by email and the link
-- activates immediately — no separate ward-side accept step.
--
-- No new "account type" — any user can be a guardian, a ward, both, or
-- neither, purely by which guardian_links rows reference them.
-- =============================================================


-- -------------------------------------------------------------
-- find_user_id_by_email
-- -------------------------------------------------------------
-- Email lives only in Supabase's private auth.users table, which a
-- regular client can't (and shouldn't) query directly. This is the
-- minimal safe surface for the invite-by-email flow: given an email,
-- returns the matching user id and nothing else about that account.
-- security definer so it can read auth.users despite the caller not
-- having direct access to that schema.
-- -------------------------------------------------------------

create or replace function public.find_user_id_by_email(lookup_email text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  found_id uuid;
begin
  select id into found_id
  from auth.users
  where lower(email) = lower(lookup_email)
  limit 1;

  return found_id;
end;
$$;

-- Callable by any authenticated user (not the anon/public role) — the
-- default grants on a new function already exclude anon, but this is
-- explicit so the intent is clear from reading the migration.
revoke all on function public.find_user_id_by_email(text) from public;
grant execute on function public.find_user_id_by_email(text) to authenticated;


-- -------------------------------------------------------------
-- guardian_links
-- -------------------------------------------------------------

create table if not exists guardian_links (
  id           uuid        primary key default gen_random_uuid(),
  guardian_id  uuid        not null references users (id) on delete cascade,
  ward_id      uuid        not null references users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  check (guardian_id <> ward_id),
  unique (guardian_id, ward_id)
);

alter table guardian_links enable row level security;

-- Both sides of the relationship can see the link — the ward should be
-- able to see who is monitoring them, not just the guardian.
create policy "guardian_links: select as guardian or ward"
  on guardian_links for select
  using ((select auth.uid()) = guardian_id or (select auth.uid()) = ward_id);

-- Only the guardian creates the link in this phase's flow.
create policy "guardian_links: insert as guardian"
  on guardian_links for insert
  with check ((select auth.uid()) = guardian_id);

-- Either party can revoke it.
create policy "guardian_links: delete as guardian or ward"
  on guardian_links for delete
  using ((select auth.uid()) = guardian_id or (select auth.uid()) = ward_id);

-- No update policy — a link is created or removed, never edited.

create index if not exists idx_guardian_links_guardian_id on guardian_links (guardian_id);
create index if not exists idx_guardian_links_ward_id     on guardian_links (ward_id);


-- -------------------------------------------------------------
-- Guardian read access — sessions, events, alerts
-- -------------------------------------------------------------
-- Additional SELECT policies only. Postgres OR's multiple permissive
-- policies of the same command together, so these add a read path for
-- linked guardians without touching the existing owner-only SELECT
-- policy or any insert/update/delete policy on these tables — a
-- guardian can never write a ward's data.
--
-- sessions already carries last_lat/last_lng/last_location_at (added
-- for Live Share), so extending its SELECT policy covers the ward's
-- live location too, with no separate handling needed.
--
-- contacts and settings are deliberately NOT extended here — out of
-- scope for this phase, matching the aim's own wording ("live status,
-- event log, and alert history").
-- -------------------------------------------------------------

create policy "sessions: select as linked guardian"
  on sessions for select
  using (
    exists (
      select 1 from guardian_links
      where guardian_links.ward_id = sessions.user_id
      and guardian_links.guardian_id = (select auth.uid())
    )
  );

create policy "events: select as linked guardian"
  on events for select
  using (
    exists (
      select 1 from guardian_links
      where guardian_links.ward_id = events.user_id
      and guardian_links.guardian_id = (select auth.uid())
    )
  );

create policy "alerts: select as linked guardian"
  on alerts for select
  using (
    exists (
      select 1 from guardian_links
      where guardian_links.ward_id = alerts.user_id
      and guardian_links.guardian_id = (select auth.uid())
    )
  );
