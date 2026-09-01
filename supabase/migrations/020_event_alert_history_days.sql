-- =============================================================
-- Surveillance AI — Event/Alert History Days
-- =============================================================
-- Same pattern as migration 016's location_history_days -- marks which
-- days in a visible calendar month actually have event/alert data,
-- without pulling every row just to compute that. Backs the Event Log
-- and Alerts tabs' calendar pickers (guardian/[wardId].tsx), mirroring
-- the one already on the Location History tab.
--
-- Deliberately NOT security definer -- runs as the caller, so the
-- existing RLS policies on events/alerts (migration 009: own rows, or as
-- a linked active guardian) already restrict which rows this aggregate
-- can see.
-- =============================================================

create or replace function public.event_history_days(
  p_user_id uuid,
  p_month_start timestamptz,
  p_month_end timestamptz
)
returns table (day date)
language sql
stable
as $$
  select distinct date(timestamp) as day
  from events
  where user_id = p_user_id
  and timestamp >= p_month_start
  and timestamp < p_month_end
  order by day;
$$;

revoke all on function public.event_history_days(uuid, timestamptz, timestamptz) from public;
grant execute on function public.event_history_days(uuid, timestamptz, timestamptz) to authenticated;

create or replace function public.alert_history_days(
  p_user_id uuid,
  p_month_start timestamptz,
  p_month_end timestamptz
)
returns table (day date)
language sql
stable
as $$
  select distinct date(timestamp) as day
  from alerts
  where user_id = p_user_id
  and timestamp >= p_month_start
  and timestamp < p_month_end
  order by day;
$$;

revoke all on function public.alert_history_days(uuid, timestamptz, timestamptz) from public;
grant execute on function public.alert_history_days(uuid, timestamptz, timestamptz) to authenticated;
