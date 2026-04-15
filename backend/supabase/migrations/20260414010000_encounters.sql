-- Encounters, claude_cache, user_repos + demo seed users.

create extension if not exists pgcrypto;

-- ---------- encounters ----------

create table if not exists public.encounters (
  id uuid primary key default gen_random_uuid(),
  hotspot_id uuid not null references public.hotspots(id) on delete cascade,
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  game_payload jsonb,
  game_result jsonb not null default '{}'::jsonb,
  icebreaker text,
  user_a_met boolean not null default false,
  user_b_met boolean not null default false,
  xp_awarded integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists encounters_pair_hotspot_uniq
  on public.encounters (hotspot_id, user_a, user_b);

create index if not exists encounters_created_idx on public.encounters (created_at desc);
create index if not exists encounters_user_a_idx on public.encounters (user_a);
create index if not exists encounters_user_b_idx on public.encounters (user_b);

alter table public.encounters enable row level security;

drop policy if exists "Encounters readable by authenticated" on public.encounters;
create policy "Encounters readable by authenticated"
  on public.encounters for select
  to authenticated
  using (true);

-- writes via service role / security-definer RPCs

-- ---------- claude_cache ----------

create table if not exists public.claude_cache (
  cache_key text primary key,
  response jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.claude_cache enable row level security;

drop policy if exists "Claude cache readable by authenticated" on public.claude_cache;
create policy "Claude cache readable by authenticated"
  on public.claude_cache for select
  to authenticated
  using (true);

-- ---------- user_repos ----------

create table if not exists public.user_repos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  readme_excerpt text
);

create index if not exists user_repos_user_idx on public.user_repos (user_id);

alter table public.user_repos enable row level security;

drop policy if exists "User repos readable by authenticated" on public.user_repos;
create policy "User repos readable by authenticated"
  on public.user_repos for select
  to authenticated
  using (true);

-- ---------- RPC: find_or_create_encounter ----------

create or replace function public.find_or_create_encounter(p_hotspot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_other uuid;
  v_a uuid;
  v_b uuid;
  v_existing public.encounters%rowtype;
  v_new public.encounters%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- find another user checked in at same hotspot in last 30 minutes
  select c.user_id into v_other
  from public.checkins c
  where c.hotspot_id = p_hotspot_id
    and c.user_id <> v_uid
    and c.checked_in_at >= now() - interval '30 minutes'
  order by c.checked_in_at desc
  limit 1;

  if v_other is null then
    return null;
  end if;

  if v_uid < v_other then
    v_a := v_uid;
    v_b := v_other;
  else
    v_a := v_other;
    v_b := v_uid;
  end if;

  -- existing encounter in last 30 min?
  select * into v_existing
  from public.encounters
  where hotspot_id = p_hotspot_id
    and user_a = v_a
    and user_b = v_b
    and created_at >= now() - interval '30 minutes'
  order by created_at desc
  limit 1;

  if found then
    return to_jsonb(v_existing);
  end if;

  insert into public.encounters (hotspot_id, user_a, user_b)
  values (p_hotspot_id, v_a, v_b)
  on conflict (hotspot_id, user_a, user_b) do update
    set hotspot_id = excluded.hotspot_id
  returning * into v_new;

  return to_jsonb(v_new);
end;
$$;

grant execute on function public.find_or_create_encounter(uuid) to authenticated;

-- ---------- RPC: mark_encounter_met ----------

create or replace function public.mark_encounter_met(p_encounter_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_enc public.encounters%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_enc from public.encounters where id = p_encounter_id;
  if not found then
    raise exception 'encounter not found' using errcode = 'P0002';
  end if;

  if v_uid = v_enc.user_a then
    update public.encounters set user_a_met = true where id = p_encounter_id;
  elsif v_uid = v_enc.user_b then
    update public.encounters set user_b_met = true where id = p_encounter_id;
  else
    raise exception 'not a participant' using errcode = '42501';
  end if;

  select * into v_enc from public.encounters where id = p_encounter_id;

  if v_enc.user_a_met and v_enc.user_b_met and v_enc.xp_awarded = 0 then
    update public.encounters
      set xp_awarded = 25
      where id = p_encounter_id;

    update public.profiles
      set xp = xp + 25,
          level = 1 + floor(sqrt((xp + 25)::double precision / 50))::integer
      where id in (v_enc.user_a, v_enc.user_b);

    select * into v_enc from public.encounters where id = p_encounter_id;
  end if;

  return to_jsonb(v_enc);
end;
$$;

grant execute on function public.mark_encounter_met(uuid) to authenticated;

-- ---------- seed demo users ----------

insert into auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'alex@demo',
    crypt('demo-password-123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Alex Demo"}'::jsonb,
    now(), now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'jordan@demo',
    crypt('demo-password-123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Jordan Demo"}'::jsonb,
    now(), now()
  )
on conflict (id) do nothing;

-- Ensure profiles rows exist (handle_new_user trigger usually does this,
-- but be idempotent in case it's skipped during re-runs).
insert into public.profiles (id, email, full_name, xp, level)
values
  ('11111111-1111-1111-1111-111111111111', 'alex@demo', 'Alex Demo', 0, 1),
  ('22222222-2222-2222-2222-222222222222', 'jordan@demo', 'Jordan Demo', 0, 1)
on conflict (id) do nothing;

-- ---------- seed user_repos ----------

insert into public.user_repos (user_id, name, description, readme_excerpt)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'sunbot',
    'A Go-powered Discord bot for small gaming communities.',
    'Sunbot is a lightweight Discord bot written in Go. It handles role self-assignment, match scheduling with time-zone aware reminders, and a small XP system. Built to run on a $5 VPS with SQLite as the only dependency. Focus on clear logs, hot-reloadable command handlers, and graceful degradation when Discord rate-limits.'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'sidequest',
    'A Next.js + TypeScript side project tracker.',
    'Sidequest is a personal project tracker built with Next.js 14 App Router, TypeScript, and Supabase. It lets you log unfinished side projects, tag them, and generate a weekly nudge email. Uses server actions for all mutations and Drizzle for the schema. The UI leans into a calm, minimal typographic style.'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'notebook-tidy',
    'A Python CLI that cleans up Jupyter notebooks for ML work.',
    'notebook-tidy strips outputs, sorts imports, and normalizes cell metadata across a directory of Jupyter notebooks. Originally written for a graduate ML class where messy diffs made code review painful. Includes an optional pre-commit hook and a small Streamlit viewer for before/after comparison.'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'ripgrok',
    'A small Rust CLI for structured log search.',
    'ripgrok is a Rust command-line tool for searching structured (JSON-lines) logs with a familiar ripgrep-style UX. It supports field filters, time-range queries, and pretty-printed output with colorized keys. Designed for local development — point it at a dumped log file and explore without setting up a full log stack.'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'paceline',
    'A React Native fitness app for group runs.',
    'Paceline is a React Native + Expo app for coordinating group runs. It syncs planned routes, tracks per-runner pace, and shares a live map with your group during the run. Uses Supabase for auth + realtime, and a tiny Go service for route simplification. Built for a running club that outgrew a Discord channel.'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'quorum',
    'A TypeScript Discord bot for community polls and decisions.',
    'Quorum is a Discord bot written in TypeScript for running lightweight structured polls, ranked-choice votes, and decision logs inside a server. It stores history in Postgres and exposes a tiny web dashboard (Next.js) for reviewing past decisions. Built for an open-source maintainer group that kept losing important votes in chat scrollback.'
  )
on conflict do nothing;
