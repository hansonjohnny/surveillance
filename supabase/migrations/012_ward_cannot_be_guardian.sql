-- =============================================================
-- Surveillance AI — Ward Accounts Cannot Be Guardians
-- =============================================================
-- Overrides 009_guardian_links.sql's original "any user can be a
-- guardian, a ward, both, or neither" design: a ward can no longer
-- also act as a guardian. Enforced at the RLS layer so it holds
-- regardless of which client path (app UI, direct API call) attempts
-- the insert.
-- =============================================================

drop policy if exists "guardian_links: insert as guardian" on guardian_links;
create policy "guardian_links: insert as guardian"
  on guardian_links for insert
  with check (
    (select auth.uid()) = guardian_id
    and not exists (
      select 1 from guardian_links existing
      where existing.ward_id = (select auth.uid())
      and existing.status in ('pending', 'active')
    )
  );
