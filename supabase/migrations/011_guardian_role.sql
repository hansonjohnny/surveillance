-- =============================================================
-- Surveillance AI — Guardian Role at Signup (Phase 3)
-- =============================================================
-- role is chosen at signup (via the "who will this app protect" screen)
-- and is independent of `plan` (the pricing tier) -- they happen to
-- share the word "guardian" for unrelated reasons. No plan-tier gating
-- or plan inheritance yet; deferred until pricing is actually built.
--
-- guardian_links gains a status so linking an *existing* independent
-- account requires that person to actively accept before any read
-- access is granted -- unlike a guardian-provisioned new ward account,
-- where setting a password via the invite email is itself the
-- confirmation step.
-- =============================================================

alter table users add column if not exists role text not null default 'self'
  check (role in ('self', 'guardian'));

alter table guardian_links add column if not exists status text not null default 'pending'
  check (status in ('pending', 'active'));

-- Lets the ward-side confirm screen show who's requesting without a
-- lookup the ward has no permission to make (they can't resolve another
-- user's email/name themselves) -- same reasoning as ward_email in
-- 010_guardian_links_ward_email.sql, just the other direction.
alter table guardian_links add column if not exists guardian_email text;

-- Backfill: every guardian_links row created before this migration was
-- created under the Phase 1/2 "instant activation" model -- without this,
-- they'd silently lose guardian read access the moment this ships.
update guardian_links set status = 'active' where status = 'pending';


-- -------------------------------------------------------------
-- accept_guardian_link
-- -------------------------------------------------------------
-- A function rather than a raw UPDATE policy so a ward can only ever
-- flip their own pending link to active -- never reassign guardian_id
-- or ward_id on it.
-- -------------------------------------------------------------

create or replace function public.accept_guardian_link(link_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update guardian_links
  set status = 'active'
  where id = link_id
  and ward_id = (select auth.uid());
end;
$$;

revoke all on function public.accept_guardian_link(uuid) from public;
grant execute on function public.accept_guardian_link(uuid) to authenticated;


-- -------------------------------------------------------------
-- Guardian read policies — require an active link
-- -------------------------------------------------------------
-- Same three policies from 009_guardian_links.sql, re-created with a
-- status = 'active' check added to each. A pending link (awaiting the
-- ward's confirmation) must not grant any read access.
-- -------------------------------------------------------------

drop policy if exists "sessions: select as linked guardian" on sessions;
create policy "sessions: select as linked guardian"
  on sessions for select
  using (
    exists (
      select 1 from guardian_links
      where guardian_links.ward_id = sessions.user_id
      and guardian_links.guardian_id = (select auth.uid())
      and guardian_links.status = 'active'
    )
  );

drop policy if exists "events: select as linked guardian" on events;
create policy "events: select as linked guardian"
  on events for select
  using (
    exists (
      select 1 from guardian_links
      where guardian_links.ward_id = events.user_id
      and guardian_links.guardian_id = (select auth.uid())
      and guardian_links.status = 'active'
    )
  );

drop policy if exists "alerts: select as linked guardian" on alerts;
create policy "alerts: select as linked guardian"
  on alerts for select
  using (
    exists (
      select 1 from guardian_links
      where guardian_links.ward_id = alerts.user_id
      and guardian_links.guardian_id = (select auth.uid())
      and guardian_links.status = 'active'
    )
  );
