-- ClaudeHacks-26 — hotspots, check-ins, XP.
-- Adds map/game schema on top of the existing profiles table.

create extension if not exists postgis;

-- ---------- profiles: XP + level ----------

alter table public.profiles
  add column if not exists xp integer not null default 0,
  add column if not exists level integer not null default 1;

-- Allow any authenticated user to read basic profile info (for creator attribution on hotspots).
-- The existing "Users can view own profile" policy is narrower; we add a second select policy.
drop policy if exists "Authenticated can view profiles" on public.profiles;
create policy "Authenticated can view profiles"
  on public.profiles for select
  to authenticated
  using (true);

-- ---------- hotspots ----------

create table if not exists public.hotspots (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 500),
  location geography(Point, 4326) not null,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists hotspots_location_gix on public.hotspots using gist (location);
create index if not exists hotspots_created_at_idx on public.hotspots (created_at desc);

alter table public.hotspots enable row level security;

drop policy if exists "Hotspots are readable by authenticated" on public.hotspots;
create policy "Hotspots are readable by authenticated"
  on public.hotspots for select
  to authenticated
  using (true);

drop policy if exists "Users can create hotspots as themselves" on public.hotspots;
create policy "Users can create hotspots as themselves"
  on public.hotspots for insert
  to authenticated
  with check (creator_id = auth.uid());

drop policy if exists "Creators can delete their hotspots" on public.hotspots;
create policy "Creators can delete their hotspots"
  on public.hotspots for delete
  to authenticated
  using (creator_id = auth.uid());

-- ---------- checkins ----------

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  hotspot_id uuid not null references public.hotspots(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  xp_awarded integer not null default 0,
  was_first_visit boolean not null default false,
  was_daily_discovery boolean not null default false
);

create index if not exists checkins_user_idx on public.checkins (user_id, checked_in_at desc);
create index if not exists checkins_hotspot_idx on public.checkins (hotspot_id);
create index if not exists checkins_user_hotspot_idx on public.checkins (user_id, hotspot_id);

-- Block rapid duplicates at the minute level.
create unique index if not exists checkins_dedup_minute
  on public.checkins (user_id, hotspot_id, date_trunc('minute', checked_in_at));

alter table public.checkins enable row level security;

drop policy if exists "Users can read own checkins" on public.checkins;
create policy "Users can read own checkins"
  on public.checkins for select
  to authenticated
  using (user_id = auth.uid());

-- Writes go through the check_in() RPC (security definer), so no insert policy needed.

-- ---------- aggregate view: hotspot check-in counts ----------

create or replace view public.hotspot_stats as
select
  h.id as hotspot_id,
  coalesce(count(c.id), 0)::integer as total_checkins,
  coalesce(count(distinct c.user_id), 0)::integer as unique_visitors
from public.hotspots h
left join public.checkins c on c.hotspot_id = h.id
group by h.id;

grant select on public.hotspot_stats to authenticated;

-- ---------- check_in RPC ----------

create or replace function public.check_in(
  p_hotspot_id uuid,
  p_user_lat double precision,
  p_user_lng double precision
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hotspot public.hotspots%rowtype;
  v_distance_m double precision;
  v_first_visit boolean;
  v_daily_discovery boolean;
  v_xp integer;
  v_new_xp integer;
  v_new_level integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_hotspot from public.hotspots where id = p_hotspot_id;
  if not found then
    raise exception 'hotspot not found' using errcode = 'P0002';
  end if;

  v_distance_m := ST_Distance(
    v_hotspot.location,
    ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)::geography
  );

  if v_distance_m > 100 then
    raise exception 'too far from hotspot (% m)', round(v_distance_m)
      using errcode = 'P0001';
  end if;

  v_first_visit := not exists (
    select 1 from public.checkins
    where user_id = v_uid and hotspot_id = p_hotspot_id
  );

  v_daily_discovery := v_first_visit and not exists (
    select 1 from public.checkins
    where user_id = v_uid
      and was_first_visit = true
      and checked_in_at::date = current_date
  );

  v_xp := 10
        + case when v_first_visit then 20 else 0 end
        + case when v_daily_discovery then 30 else 0 end;

  insert into public.checkins (
    user_id, hotspot_id, xp_awarded, was_first_visit, was_daily_discovery
  ) values (
    v_uid, p_hotspot_id, v_xp, v_first_visit, v_daily_discovery
  );

  update public.profiles
    set xp = xp + v_xp,
        level = 1 + floor(sqrt((xp + v_xp)::double precision / 50))::integer
    where id = v_uid
    returning xp, level into v_new_xp, v_new_level;

  return jsonb_build_object(
    'xp_awarded', v_xp,
    'new_xp', v_new_xp,
    'new_level', v_new_level,
    'was_first_visit', v_first_visit,
    'was_daily_discovery', v_daily_discovery,
    'distance_m', round(v_distance_m)
  );
end;
$$;

grant execute on function public.check_in(uuid, double precision, double precision) to authenticated;

-- ---------- seed: ~25 Madison hotspots ----------

insert into public.hotspots (creator_id, title, description, location)
values
  (null, 'Memorial Union Terrace', 'Sunburst chairs, lake views, live music weekends.',
    ST_SetSRID(ST_MakePoint(-89.3998, 43.0765), 4326)::geography),
  (null, 'Library Mall', 'Central gathering spot — food carts and foot traffic.',
    ST_SetSRID(ST_MakePoint(-89.3982, 43.0749), 4326)::geography),
  (null, 'Bascom Hill', 'The hill. Climb it, meet someone at the Lincoln statue.',
    ST_SetSRID(ST_MakePoint(-89.4045, 43.0760), 4326)::geography),
  (null, 'Union South — Sett', 'Bowling, arcade, casual food — cross-major hangout.',
    ST_SetSRID(ST_MakePoint(-89.4081, 43.0716), 4326)::geography),
  (null, 'Picnic Point', 'Lake Mendota trails. Good for a walk with a stranger.',
    ST_SetSRID(ST_MakePoint(-89.4191, 43.0895), 4326)::geography),
  (null, 'Observatory Hill', 'Sunset watchers meet here. Bring a layer.',
    ST_SetSRID(ST_MakePoint(-89.4085, 43.0772), 4326)::geography),
  (null, 'Helen C. White Café', 'Quiet study and coffee on the lakeshore.',
    ST_SetSRID(ST_MakePoint(-89.4007, 43.0777), 4326)::geography),
  (null, 'Memorial Library Stacks', 'Deep-focus study floors — noise-levels posted.',
    ST_SetSRID(ST_MakePoint(-89.4008, 43.0762), 4326)::geography),
  (null, 'Camp Randall', 'Stadium grounds — game-day pickup and tailgates.',
    ST_SetSRID(ST_MakePoint(-89.4126, 43.0695), 4326)::geography),
  (null, 'Capitol Square', 'Farmers market, protests, rallies, concerts.',
    ST_SetSRID(ST_MakePoint(-89.3841, 43.0747), 4326)::geography),
  (null, 'State Street Brats', 'Cheese curds and strangers at the bar.',
    ST_SetSRID(ST_MakePoint(-89.3916, 43.0753), 4326)::geography),
  (null, 'Colectivo on the Square', 'Coffee shop, heavy foot traffic, open tables.',
    ST_SetSRID(ST_MakePoint(-89.3823, 43.0749), 4326)::geography),
  (null, 'Monroe Street Coffee', 'Neighborhood-vibe spot away from campus bubble.',
    ST_SetSRID(ST_MakePoint(-89.4275, 43.0641), 4326)::geography),
  (null, 'Tenney Park', 'Lagoon, pavilion, ice skating in winter.',
    ST_SetSRID(ST_MakePoint(-89.3668, 43.0942), 4326)::geography),
  (null, 'Olin Park', 'Lake Monona shoreline, walking paths, skyline view.',
    ST_SetSRID(ST_MakePoint(-89.3786, 43.0545), 4326)::geography),
  (null, 'Nick''s Restaurant', 'Classic diner booth — low-stakes conversation.',
    ST_SetSRID(ST_MakePoint(-89.3944, 43.0754), 4326)::geography),
  (null, 'Chazen Museum of Art', 'Free. Pair with someone and pick your favorite piece.',
    ST_SetSRID(ST_MakePoint(-89.4019, 43.0746), 4326)::geography),
  (null, 'UW Arboretum — Visitor Center', 'Trails, prairie, quiet. Good walking-meeting spot.',
    ST_SetSRID(ST_MakePoint(-89.4223, 43.0442), 4326)::geography),
  (null, 'Nitty Gritty', 'Birthday-bar tradition — strangers become friends.',
    ST_SetSRID(ST_MakePoint(-89.3945, 43.0738), 4326)::geography),
  (null, 'Willy Street Co-op', 'East-side grocery + café; meet a non-student.',
    ST_SetSRID(ST_MakePoint(-89.3680, 43.0852), 4326)::geography),
  (null, 'Badger Herald Office', 'Student paper HQ — open-desk hours.',
    ST_SetSRID(ST_MakePoint(-89.4031, 43.0714), 4326)::geography),
  (null, 'Union South — Atrium Couches', 'Low-pressure study + people-watching.',
    ST_SetSRID(ST_MakePoint(-89.4078, 43.0716), 4326)::geography),
  (null, 'Lakeshore Path — Willow Creek', 'Midpoint of the Lakeshore path. Jogging pair-ups.',
    ST_SetSRID(ST_MakePoint(-89.4148, 43.0821), 4326)::geography),
  (null, 'Memorial Union Rathskeller', 'Historic hall, long tables — force mingling.',
    ST_SetSRID(ST_MakePoint(-89.3995, 43.0761), 4326)::geography),
  (null, 'Madison Public Library — Central', 'Community programming + study; not a campus bubble.',
    ST_SetSRID(ST_MakePoint(-89.3889, 43.0746), 4326)::geography)
on conflict do nothing;
