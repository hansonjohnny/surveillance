-- A saved "home" point the ward's device geofences against while a
-- session is active (see tasks/geofenceTask.ts) -- arriving triggers a
-- push to the linked guardian. Lives on the same settings table/RLS as
-- monitoring_interval/shake_sensitivity/wellness_checkin_time (migration
-- 001 + 021), but is ward-set only -- the guardian can read it (to know
-- it's configured) but the UI never lets them write it remotely, since
-- only the ward can actually be standing at the location to set it.

alter table settings add column if not exists home_lat double precision;
alter table settings add column if not exists home_lng double precision;
