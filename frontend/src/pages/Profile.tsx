import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getDemoUser } from '@/lib/demoUser';
import { progressToNextLevel } from '@/lib/leveling';
import { toast } from 'sonner';

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  xp: number;
  level: number;
  socials: Record<string, unknown> | null;
}

interface RecentCheckIn {
  id: string;
  checked_in_at: string;
  hotspot: { id: string; title: string } | null;
}

interface CaughtRow {
  id: string;
  created_at: string;
  user_a: string;
  user_b: string;
  xp_awarded: number;
  icebreaker: string | null;
  hotspot: { id: string; title: string } | null;
  other: { id: string; full_name: string | null; email: string | null } | null;
}

const HOBBY_OPTIONS = [
  'trail running', 'climbing', 'jazz', 'ramen', 'board games', 'design critique',
  'rust CLIs', 'discord bots', 'indie film', 'yoga', 'jazz bass', 'specialty coffee',
  'lo-fi coding', 'ceramics', 'spanish language',
];

function arr(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export default function Profile(): JSX.Element {
  const demo = getDemoUser();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [checkins, setCheckins] = useState<RecentCheckIn[]>([]);
  const [caught, setCaught] = useState<CaughtRow[]>([]);
  const [leaderboard, setLeaderboard] = useState<Array<{ id: string; full_name: string | null; email: string; xp: number; level: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [hobbies, setHobbies] = useState<Set<string>>(new Set());
  const [customHobby, setCustomHobby] = useState('');
  const [artists, setArtists] = useState('');
  const [films, setFilms] = useState('');
  const [hometown, setHometown] = useState('');
  const [year, setYear] = useState('');
  const [major, setMajor] = useState('');
  const [lookingFor, setLookingFor] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      if (!demo) return;
      const [{ data: p }, { data: c }, { data: e }] = await Promise.all([
        supabase.from('profiles').select('id, email, full_name, xp, level, socials').eq('id', demo.id).maybeSingle(),
        supabase
          .from('checkins')
          .select('id, checked_in_at, hotspot:hotspots(id, title)')
          .eq('user_id', demo.id)
          .order('checked_in_at', { ascending: false })
          .limit(20),
        supabase
          .from('encounters')
          .select('id, created_at, user_a, user_b, xp_awarded, icebreaker, user_a_met, user_b_met, hotspot:hotspots(id, title)')
          .or(`user_a.eq.${demo.id},user_b.eq.${demo.id}`)
          .eq('user_a_met', true)
          .eq('user_b_met', true)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      if (cancelled) return;
      if (p) {
        const prof = p as ProfileRow;
        setProfile(prof);
        const s = prof.socials ?? {};
        setHobbies(new Set(arr(s['interests'])));
        setArtists(arr(s['spotify_top_artists']).join(', '));
        setFilms(arr(s['letterboxd_favs']).join(', '));
        setHometown(str(s['hometown']));
        setYear(str(s['year']));
        setMajor(str(s['major']));
        setLookingFor(str(s['looking_for']));
      }
      if (c) {
        const rows = (c as unknown as Array<Record<string, unknown>>).map((r) => {
          const hotspotRaw = r.hotspot as
            | { id: string; title: string }
            | Array<{ id: string; title: string }>
            | null;
          const hotspot = Array.isArray(hotspotRaw) ? hotspotRaw[0] ?? null : hotspotRaw;
          return {
            id: r.id as string,
            checked_in_at: r.checked_in_at as string,
            hotspot,
          } satisfies RecentCheckIn;
        });
        setCheckins(rows);
      }
      if (e && demo) {
        const rawEnc = e as unknown as Array<Record<string, unknown>>;
        const otherIds = rawEnc.map((r) => (r.user_a === demo.id ? r.user_b : r.user_a) as string);
        let others: Record<string, { id: string; full_name: string | null; email: string | null }> = {};
        if (otherIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', otherIds);
          for (const pr of (profs ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
            others[pr.id] = pr;
          }
        }
        const rows: CaughtRow[] = rawEnc.map((r) => {
          const hsRaw = r.hotspot as { id: string; title: string } | Array<{ id: string; title: string }> | null;
          const hotspot = Array.isArray(hsRaw) ? hsRaw[0] ?? null : hsRaw;
          const otherId = (r.user_a === demo.id ? r.user_b : r.user_a) as string;
          return {
            id: r.id as string,
            created_at: r.created_at as string,
            user_a: r.user_a as string,
            user_b: r.user_b as string,
            xp_awarded: (r.xp_awarded as number) ?? 0,
            icebreaker: (r.icebreaker as string | null) ?? null,
            hotspot,
            other: others[otherId] ?? null,
          };
        });
        setCaught(rows);
      }
      const { data: lb } = await supabase
        .from('profiles')
        .select('id, full_name, email, xp, level')
        .order('xp', { ascending: false })
        .limit(5);
      if (!cancelled && lb) setLeaderboard(lb as Array<{ id: string; full_name: string | null; email: string; xp: number; level: number }>);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [demo?.id]);

  function toggleHobby(h: string): void {
    setHobbies((prev) => {
      const next = new Set(prev);
      if (next.has(h)) next.delete(h);
      else next.add(h);
      return next;
    });
  }

  function addCustomHobby(): void {
    const v = customHobby.trim();
    if (!v) return;
    setHobbies((prev) => new Set(prev).add(v));
    setCustomHobby('');
  }

  async function handleSave(): Promise<void> {
    if (!demo || !profile) return;
    setSaving(true);
    const parse = (s: string): string[] =>
      s.split(/[,;\n]/).map((x) => x.trim()).filter((x) => x.length > 0).slice(0, 5);
    const socials = {
      ...(profile.socials ?? {}),
      interests: Array.from(hobbies),
      spotify_top_artists: parse(artists),
      letterboxd_favs: parse(films),
      hometown: hometown.trim() || null,
      year: year.trim() || null,
      major: major.trim() || null,
      looking_for: lookingFor.trim() || null,
    };
    const { error } = await supabase.from('profiles').update({ socials }).eq('id', demo.id);
    setSaving(false);
    if (error) {
      toast.error('Could not save', { description: error.message });
      return;
    }
    setProfile({ ...profile, socials });
    setEditing(false);
    toast.success('Profile updated');
  }

  if (!demo) {
    return <div className="p-6 text-sm text-slate-400">Not signed in.</div>;
  }
  if (loading || !profile) {
    return <div className="p-6 text-sm text-slate-400">Loading profile…</div>;
  }

  const s = profile.socials ?? {};
  const inputCls = 'mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition focus:border-indigo-400 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-400/30';
  const labelCls = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-300';
  const initial = (profile.full_name ?? profile.email).slice(0, 1).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl p-6">
      <header className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-2xl font-bold text-white shadow-md">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-slate-100">{profile.full_name ?? profile.email}</h1>
          <p className="text-sm text-slate-400">{profile.email}</p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
          >
            Edit profile
          </button>
        )}
      </header>

      <section className="mb-6 rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-fuchsia-500/15 p-5">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-300">Level {profile.level}</div>
            <div className="mt-1 text-3xl font-bold text-slate-100">{profile.xp} <span className="text-base font-semibold text-slate-400">XP</span></div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">To Lv {profile.level + 1}</div>
            <div className="text-sm font-semibold text-slate-200">{progressToNextLevel(profile.xp).xpForNextLevel} XP</div>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 transition-all duration-700"
            style={{ width: `${Math.round(progressToNextLevel(profile.xp).progress * 100)}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/5 p-2">
            <div className="text-base font-bold text-slate-100">{checkins.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Check-ins</div>
          </div>
          <div className="rounded-xl bg-white/5 p-2">
            <div className="text-base font-bold text-slate-100">{caught.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Caught</div>
          </div>
          <div className="rounded-xl bg-white/5 p-2">
            <div className="text-base font-bold text-slate-100">{caught.reduce((a, c) => a + (c.xp_awarded || 25), 0)}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">From catches</div>
          </div>
        </div>
      </section>

      {!editing ? (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
          <div className={labelCls}>Your vibes</div>
          <div className="flex flex-wrap gap-2">
            {arr(s['interests']).length === 0 && <span className="text-sm text-slate-400">No interests set yet.</span>}
            {arr(s['interests']).map((h) => (
              <span key={h} className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-slate-200">{h}</span>
            ))}
          </div>
          {arr(s['spotify_top_artists']).length > 0 && (
            <div>
              <div className="text-xs text-slate-500">On repeat</div>
              <div className="mt-1 text-sm text-slate-200">{arr(s['spotify_top_artists']).join(' · ')}</div>
            </div>
          )}
          {arr(s['letterboxd_favs']).length > 0 && (
            <div>
              <div className="text-xs text-slate-500">Favorite films</div>
              <div className="mt-1 text-sm text-slate-200">{arr(s['letterboxd_favs']).join(' · ')}</div>
            </div>
          )}
          {(str(s['hometown']) || str(s['year']) || str(s['major'])) && (
            <div className="text-sm text-slate-300">
              {[str(s['year']), str(s['major']), str(s['hometown'])].filter(Boolean).join(' · ')}
            </div>
          )}
          {str(s['looking_for']) && (
            <div>
              <div className="text-xs text-slate-500">Looking for</div>
              <div className="mt-1 text-sm text-slate-200">{str(s['looking_for'])}</div>
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-5 animate-fade-in">
          <div>
            <span className={labelCls}>Hobbies & vibes</span>
            <div className="mt-3 flex flex-wrap gap-2">
              {HOBBY_OPTIONS.map((h) => {
                const on = hobbies.has(h);
                return (
                  <button
                    type="button"
                    key={h}
                    onClick={() => toggleHobby(h)}
                    className={[
                      'rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200',
                      on
                        ? 'bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-md shadow-fuchsia-500/20'
                        : 'border border-white/10 bg-white/5 text-slate-300 hover:border-indigo-400/50 hover:bg-white/10 hover:text-slate-100',
                    ].join(' ')}
                  >
                    {h}
                  </button>
                );
              })}
              {Array.from(hobbies).filter((h) => !HOBBY_OPTIONS.includes(h)).map((h) => (
                <button
                  type="button"
                  key={h}
                  onClick={() => toggleHobby(h)}
                  className="rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-3 py-1.5 text-xs font-medium text-white shadow-md shadow-fuchsia-500/20"
                >
                  {h} ×
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={customHobby}
                onChange={(e) => setCustomHobby(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomHobby(); } }}
                placeholder="add your own…"
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-400 focus:bg-white/10 focus:outline-none"
              />
              <button type="button" onClick={addCustomHobby} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-slate-100">
                Add
              </button>
            </div>
          </div>
          <label className="block">
            <span className={labelCls}>Top Spotify artists</span>
            <input type="text" value={artists} onChange={(e) => setArtists(e.target.value)} className={inputCls} placeholder="Phoebe Bridgers, MF DOOM, Alvvays" />
          </label>
          <label className="block">
            <span className={labelCls}>Favorite films</span>
            <input type="text" value={films} onChange={(e) => setFilms(e.target.value)} className={inputCls} placeholder="Past Lives, Whiplash, Paddington 2" />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Hometown</span>
              <input type="text" value={hometown} onChange={(e) => setHometown(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>Year</span>
              <input type="text" value={year} onChange={(e) => setYear(e.target.value)} className={inputCls} />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelCls}>Major</span>
              <input type="text" value={major} onChange={(e) => setMajor(e.target.value)} className={inputCls} />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelCls}>Looking for</span>
              <textarea value={lookingFor} onChange={(e) => setLookingFor(e.target.value)} rows={2} className={inputCls} />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-fuchsia-500/20 transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className={`${labelCls} mb-2`}>Leaderboard</h2>
        <ol className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {leaderboard.map((r, i) => {
            const isMe = r.id === profile.id;
            return (
              <li key={r.id} className={['flex items-center justify-between px-4 py-2.5', isMe ? 'bg-indigo-500/10' : ''].join(' ')}>
                <div className="flex items-center gap-3">
                  <span className="w-5 text-sm font-bold text-slate-400">{i + 1}</span>
                  <span className={['text-sm', isMe ? 'font-bold text-slate-100' : 'font-medium text-slate-200'].join(' ')}>
                    {r.full_name ?? r.email}{isMe ? ' (you)' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold text-slate-300">Lv {r.level}</span>
                  <span className="font-semibold text-slate-100">{r.xp} XP</span>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-6">
        <h2 className={`${labelCls} mb-2`}>Caught friends</h2>
        {caught.length === 0 ? (
          <p className="text-sm text-slate-400">No catches yet — go meet someone.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {caught.map((c) => {
              const name = c.other?.full_name ?? c.other?.email ?? 'Someone';
              const letter = name.slice(0, 1).toUpperCase();
              return (
                <li
                  key={c.id}
                  className="relative overflow-hidden rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-50/5 via-white/5 to-rose-50/5 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-rose-700 text-sm font-bold text-white shadow-md">
                      {letter}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-100">{name}</div>
                      <div className="truncate text-xs text-slate-400">
                        {c.hotspot?.title ?? 'Unknown spot'} · {new Date(c.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-200">
                      +{c.xp_awarded || 25} XP
                    </span>
                  </div>
                  {c.icebreaker && (
                    <p className="mt-3 line-clamp-2 text-xs italic text-slate-300">"{c.icebreaker}"</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className={`${labelCls} mb-2`}>Recent check-ins</h2>
        {checkins.length === 0 ? (
          <p className="text-sm text-slate-400">No check-ins yet.</p>
        ) : (
          <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            {checkins.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-200">{c.hotspot?.title ?? 'Unknown hotspot'}</div>
                  <div className="text-xs text-slate-500">{new Date(c.checked_in_at).toLocaleString()}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
