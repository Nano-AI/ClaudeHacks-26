-- View that exposes hotspot lat/lng as plain columns for PostgREST consumption.
create or replace view public.hotspots_v as
select
  id,
  creator_id,
  title,
  description,
  starts_at,
  ends_at,
  created_at,
  ST_X(location::geometry) as lng,
  ST_Y(location::geometry) as lat
from public.hotspots;

grant select on public.hotspots_v to authenticated;
grant select on public.hotspots_v to anon;
