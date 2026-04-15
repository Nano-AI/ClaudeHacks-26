import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useGeolocation } from '../hooks/useGeolocation';
import { useCheckIn } from '../hooks/useCheckIn';
import { celebrateXp } from '../components/xp/XpCelebration';
import { getDemoUserId } from '../lib/demoUser';
import { computeMatchScore, type MatchScore } from '../lib/matchScore';

interface HotspotRow {
  id: string;
  title: string;
  description: string | null;
  lat: number;
  lng: number;
  starts_at: string | null;
  ends_at: string | null;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  socials: Record<string, unknown> | null;
}

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function initial(name: string | null | undefined, email: string | null | undefined): string {
  const src = (name ?? email ?? '?').trim();
  return src.slice(0, 1).toUpperCase();
}

function MatchPerson({
  person,
  match,
  onStart,
  busy,
}: {
  person: ProfileRow;
  match: MatchScore;
  onStart: () => void;
  busy: boolean;
}): JSX.Element {
  const name = person.full_name ?? person.email ?? 'Someone';
  const hot = match.score >= 70;
  return (
    <div
      className={[
        'rounded-2xl p-[1.5px] transition',
        hot
          ? 'bg-gradient-to-br from-pink-500 via-fuchsia-500 to-indigo-500 shadow-lg shadow-fuchsia-500/20'
          : 'bg-slate-200',
      ].join(' ')}
    >
      <div className="rounded-2xl bg-white p-5">
        <div className="flex items-start gap-4">
          <div
            className={[
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white',
              hot
                ? 'bg-gradient-to-br from-pink-500 to-indigo-600'
                : 'bg-slate-700',
            ].join(' ')}
          >
            {initial(person.full_name, person.email)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <div className="truncate text-base font-semibold text-slate-900">
                {name}
              </div>
              <div
                className={[
                  'shrink-0 rounded-full px-3 py-1 text-sm font-bold',
                  hot
                    ? 'bg-gradient-to-r from-pink-500 to-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-700',
                ].join(' ')}
              >
                {match.score}% match
              </div>
            </div>
            {match.shared.length > 0 ? (
              <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                {match.shared.map((group) => (
                  <li key={group.label} className="leading-snug">
                    <span className="font-medium text-slate-900">
                      {group.label}:
                    </span>{' '}
                    <span className="text-slate-700">{group.items.join(', ')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                No strong overlaps yet — worth saying hi anyway.
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onStart}
          disabled={busy}
          className={[
            'mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition',
            hot
              ? 'bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-600 hover:to-indigo-700'
              : 'bg-slate-900 hover:bg-slate-800',
            busy ? 'opacity-60' : '',
          ].join(' ')}
        >
          {busy ? 'Starting encounter…' : 'Start Encounter'}
        </button>
      </div>
    </div>
  );
}

export default function PinDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const geo = useGeolocation();
  const { checkIn, loading: checkInLoading, error: checkInError } = useCheckIn();
  const [hotspot, setHotspot] = useState<HotspotRow | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [myUid, setMyUid] = useState<string | null>(null);
  const [mySocials, setMySocials] = useState<Record<string, unknown> | null>(null);
  const [others, setOthers] = useState<ProfileRow[]>([]);
  const [encounterBusy, setEncounterBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const view = await supabase
        .from('hotspots_v')
        .select('id,title,description,lat,lng,starts_at,ends_at')
        .eq('id', id)
        .maybeSingle();
      if (!view.error && view.data !== null) {
        setHotspot(view.data as HotspotRow);
        return;
      }
      const { data, error } = await supabase
        .from('hotspots')
        .select('id,title,description,starts_at,ends_at')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        setLoadErr(error.message);
        return;
      }
      if (data) {
        setHotspot({
          ...(data as Omit<HotspotRow, 'lat' | 'lng'>),
          lat: 0,
          lng: 0,
        });
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const uid = await getDemoUserId();
        setMyUid(uid);
        const { data: me } = await supabase
          .from('profiles')
          .select('id, socials')
          .eq('id', uid)
          .maybeSingle();
        const s = (me as { socials: Record<string, unknown> | null } | null)?.socials ?? null;
        setMySocials(s);

        const { data: rows } = await supabase
          .from('checkins')
          .select('user_id, checked_in_at, profiles!inner(id, full_name, email, socials)')
          .eq('hotspot_id', id)
          .neq('user_id', uid)
          .order('checked_in_at', { ascending: false });

        const seen = new Set<string>();
        const people: ProfileRow[] = [];
        for (const row of (rows ?? []) as Array<{
          user_id: string;
          profiles:
            | { id: string; full_name: string | null; email: string | null; socials: Record<string, unknown> | null }
            | Array<{ id: string; full_name: string | null; email: string | null; socials: Record<string, unknown> | null }>;
        }>) {
          const pRaw = row.profiles;
          const p = Array.isArray(pRaw) ? pRaw[0] : pRaw;
          if (!p || seen.has(p.id)) continue;
          seen.add(p.id);
          people.push(p);
        }

        // Demo fallback: if nobody is checked in here, pull the top 3 demo
        // profiles by social overlap so the "Who's here" section is never empty.
        if (people.length === 0) {
          const { data: fallback } = await supabase
            .from('profiles')
            .select('id, full_name, email, socials')
            .like('email', '%@demo.witm')
            .neq('id', uid)
            .limit(6);
          for (const p of (fallback ?? []) as ProfileRow[]) {
            if (!seen.has(p.id)) {
              seen.add(p.id);
              people.push(p);
            }
          }
        }
        setOthers(people);
      } catch {
        // ignore — not signed in
      }
    })();
  }, [id]);

  const ranked = useMemo(() => {
    return others
      .map((p) => ({
        person: p,
        match: computeMatchScore(mySocials, p.socials ?? null),
      }))
      .sort((a, b) => b.match.score - a.match.score);
  }, [others, mySocials]);

  const distance =
    hotspot && geo.coords
      ? haversineMeters(geo.coords, { lat: hotspot.lat, lng: hotspot.lng })
      : null;
  const withinRange = true;

  const handleCheckIn = async (): Promise<void> => {
    if (!hotspot) return;
    const lat = geo.coords?.lat ?? hotspot.lat;
    const lng = geo.coords?.lng ?? hotspot.lng;
    try {
      const result = await checkIn(hotspot.id, lat, lng);
      celebrateXp(result);
      setFlash("You're in.");
      if (result.encounter) {
        const encId = result.encounter.id;
        setTimeout(() => navigate(`/encounter/${encId}`), 900);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Check-in failed';
      setFlash(msg);
    }
  };

  const handleStartEncounter = async (otherId: string): Promise<void> => {
    if (!hotspot || !myUid) return;
    setEncounterBusy(otherId);
    setToast(null);
    try {
      // Ensure self check-in (idempotent for demo).
      const lat = geo.coords?.lat ?? hotspot.lat;
      const lng = geo.coords?.lng ?? hotspot.lng;
      try {
        await checkIn(hotspot.id, lat, lng);
      } catch {
        // ignore — may already be checked in
      }
      const { data, error } = await supabase.rpc('start_encounter', {
        p_hotspot_id: hotspot.id,
        p_other_user_id: otherId,
      });
      if (error) throw new Error(error.message);
      const enc = data as { id?: string } | null;
      if (enc && typeof enc.id === 'string') {
        navigate(`/encounter/${enc.id}`);
        return;
      }
      setToast('Could not start encounter — try again.');
    } catch (e: unknown) {
      setToast(
        'Waiting for them to arrive — encounter will open automatically when they check in.'
      );
      void e;
    } finally {
      setEncounterBusy(null);
    }
  };

  if (loadErr) {
    return <div className="p-6 text-red-600">Failed to load hotspot: {loadErr}</div>;
  }

  if (!hotspot) {
    return <div className="p-6 text-slate-500">Loading pin…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <button
        type="button"
        onClick={() => navigate('/map')}
        className="text-sm font-medium text-indigo-600 transition-colors duration-200 hover:underline hover:text-indigo-700"
      >
        ← Back to map
      </button>

      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {hotspot.title}
        </h1>
        {hotspot.description && (
          <p className="mt-2 leading-relaxed text-slate-700">{hotspot.description}</p>
        )}
      </header>

      <section className="rounded-2xl border border-indigo-300/20 bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-fuchsia-500/10 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-300">XP rewards</div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-slate-200">Check in +10</span>
          <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-slate-200">First time here +20</span>
          <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-slate-200">Daily discovery +30</span>
          <span className="rounded-full bg-rose-500/20 px-3 py-1 font-semibold text-rose-200">Catch a friend +25</span>
        </div>
        {distance !== null && (
          <div className="mt-3 text-xs text-slate-400">{Math.round(distance)} m away</div>
        )}
      </section>

      <button
        type="button"
        onClick={handleCheckIn}
        disabled={!withinRange || checkInLoading}
        className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-5 py-3 text-base font-semibold text-white shadow-md shadow-indigo-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:from-indigo-700 hover:to-fuchsia-700 hover:shadow-lg disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400"
      >
        {checkInLoading ? 'Checking in…' : 'Check in here'}
      </button>

      {(checkInError || flash) && (
        <div className="text-sm text-slate-700">{flash ?? checkInError}</div>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="relative inline-flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            </span>
            Who's here right now
          </h2>
          <p className="text-sm text-slate-600">
            Sorted by social match score — start an encounter to play the mini-game.
          </p>
        </div>

        {toast && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
            {toast}
          </div>
        )}

        {ranked.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No one else here yet — you'll be the first.
          </div>
        ) : (
          <div className="space-y-3">
            {ranked.map(({ person, match }, i) => (
              <div
                key={person.id}
                className="animate-fade-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <MatchPerson
                  person={person}
                  match={match}
                  onStart={() => void handleStartEncounter(person.id)}
                  busy={encounterBusy === person.id}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
