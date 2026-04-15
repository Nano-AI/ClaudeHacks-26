# WhatIsTheMove

Pokemon-Go-style map of live campus activities. Pick a mood, Claude ranks nearby happenings, check in, and match with another person there via a socials-grounded mini-game and Claude-written icebreaker.

## Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind + MapLibre GL JS (openfreemap Liberty style, 3D building extrusions)
- **Backend:** Supabase (Postgres + PostGIS + Edge Functions + Auth)
- **AI:** Anthropic `claude-sonnet-4-6` via Edge Functions (ranking, decoy generation, icebreaker)

## Layout

```
frontend/           React app (Vite)
  src/
    pages/          Map, PinDetail, Encounter, Profile, Onboarding
    components/     map/, encounter/, layout/, xp/
    hooks/          useHotspots, useCheckIn, useEncounter, useMoodSearch, useGeolocation
    lib/            supabase client, matchScore, demoUser, leveling
backend/
  supabase/
    migrations/     init_profiles, hotspots, encounters, hotspots_v view
    functions/      claude_rank_hotspots, claude_game_decoys, claude_interest_decoys,
                    claude_icebreaker, onboard, seed_demo_users
shared/types/       shared TS types between frontend and edge functions
```

## Local dev

```bash
npm install --prefix frontend
# fill frontend/.env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev --prefix frontend
```

## Deployment

Frontend → Vercel. Supabase project already provisioned and linked.
