-- =============================================================
-- Surveillance AI — Location History Days
-- =============================================================
-- Marks which days in a visible calendar month actually have location
-- data, without pulling every row just to compute that (see
-- lib/guardian.ts's fetchWardLocationHistoryDays,
-- guardian/[wardId].tsx's calendar picker).
--
-- Deliberately NOT security definer -- runs as the caller, so the
-- existing RLS policies on location_points (migration 015: own rows,
-- or as a linked active guardian) already restrict which rows this
-- aggregate can see. No manual guardian-check needed here.
-- =============================================================

create or replace function public.location_history_days(
  p_user_id uuid,
  p_month_start timestamptz,
  p_month_end timestamptz
)
returns table (day date)
language sql
stable
as $$
  select distinct date(recorded_at) as day
  from location_points
  where user_id = p_user_id
  and recorded_at >= p_month_start
  and recorded_at < p_month_end
  order by day;
$$;

revoke all on function public.location_history_days(uuid, timestamptz, timestamptz) from public;
grant execute on function public.location_history_days(uuid, timestamptz, timestamptz) to authenticated;
