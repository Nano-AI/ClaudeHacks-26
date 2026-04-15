import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getDemoUser, getDemoUserId } from '../lib/demoUser';
import { useEncounter } from '../hooks/useEncounter';
import { GameCards } from '../components/encounter/GameCards';
import { MatchCard } from '../components/encounter/MatchCard';
import { celebrateEncounterWin } from '../components/xp/XpCelebration';
import type { GamePayload, GameResult } from '../../../shared/types';

type Phase = 'PREPARING' | 'GAME' | 'WAITING' | 'REVEAL' | 'DONE';

interface ProfileLite {
  id: string;
  full_name: string | null;
  email: string | null;
}

export default function EncounterPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { encounter, refresh, pickCard, markMet } = useEncounter(id);
  const [uid, setUid] = useState<string | null>(null);
  const [other, setOther] = useState<ProfileLite | null>(null);
  const [decoyLoading, setDecoyLoading] = useState(false);
  const [iceLoading, setIceLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const userId = await getDemoUserId();
      setUid(userId);
    })();
  }, []);

  // Persist current encounter id for both sides to resume after account switch.
  useEffect(() => {
    if (id) {
      try {
        window.localStorage.setItem('witm_active_encounter', id);
      } catch {
        /* ignore */
      }
    }
  }, [id]);

  // On transition to DONE, show XP toast + refresh profile so Nav updates.
  const [celebratedDone, setCelebratedDone] = useState(false);
  useEffect(() => {
    if (!encounter || celebratedDone) return;
    const both = encounter.user_a_met && encounter.user_b_met;
    if (both && encounter.xp_awarded > 0) {
      setCelebratedDone(true);
      void (async () => {
        if (!uid) return;
        const { data } = await supabase
          .from('profiles')
          .select('xp, level')
          .eq('id', uid)
          .maybeSingle();
        const prof = data as { xp?: number; level?: number } | null;
        celebrateEncounterWin(encounter.xp_awarded, prof?.level ?? 1, prof?.xp ?? 0);
      })();
    }
  }, [encounter, celebratedDone, uid]);

  const side: 'A' | 'B' | null = useMemo(() => {
    if (!encounter || !uid) return null;
    if (uid === encounter.user_a) return 'A';
    if (uid === encounter.user_b) return 'B';
    return null;
  }, [encounter, uid]);

  const otherId = useMemo(() => {
    if (!encounter || !side) return null;
    return side === 'A' ? encounter.user_b : encounter.user_a;
  }, [encounter, side]);

  useEffect(() => {
    if (!otherId) return;
    void (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', otherId)
        .maybeSingle();
      if (data) setOther(data as ProfileLite);
    })();
  }, [otherId]);

  const result: GameResult = (encounter?.game_result ?? {}) as GameResult;
  const payload: GamePayload | null =
    (encounter?.game_payload as GamePayload | null) ?? null;

  const myPick = side === 'A' ? result.user_a_pick : result.user_b_pick;
  const theirPick = side === 'A' ? result.user_b_pick : result.user_a_pick;
  const bothMet =
    encounter?.user_a_met === true && encounter?.user_b_met === true;
  const iMet =
    side === 'A' ? encounter?.user_a_met === true : encounter?.user_b_met === true;

  const phase: Phase = useMemo(() => {
    if (!encounter) return 'PREPARING';
    if (!payload) return 'PREPARING';
    if (bothMet) return 'DONE';
    if (myPick && theirPick) return 'REVEAL';
    if (myPick && !theirPick) return 'WAITING';
    return 'GAME';
  }, [encounter, payload, bothMet, myPick, theirPick]);

  // Build the game from SHARED interests between both players (client-side, always works).
  useEffect(() => {
    if (!encounter || payload || decoyLoading || !otherId || !uid) return;
    setDecoyLoading(true);
    void (async () => {
      try {
        const { data: rows } = await supabase
          .from('profiles')
          .select('id, socials')
          .in('id', [uid, otherId]);
        const mySocials = (rows ?? []).find((r) => (r as { id: string }).id === uid) as { socials?: Record<string, unknown> } | undefined;
        const otherSocials = (rows ?? []).find((r) => (r as { id: string }).id === otherId) as { socials?: Record<string, unknown> } | undefined;
        const pool = (s: Record<string, unknown> | undefined): string[] => {
          if (!s) return [];
          const out: string[] = [];
          for (const k of ['interests', 'spotify_top_artists', 'letterboxd_favs'] as const) {
            const v = s[k];
            if (Array.isArray(v)) for (const x of v) if (typeof x === 'string') out.push(x);
          }
          return out;
        };
        const mine = pool(mySocials?.socials);
        const theirs = pool(otherSocials?.socials);
        const lcMine = new Set(mine.map((x) => x.toLowerCase()));
        const lcTheirs = new Set(theirs.map((x) => x.toLowerCase()));
        const shared = mine.filter((x) => lcTheirs.has(x.toLowerCase()));
        const onlyTheirs = theirs.filter((x) => !lcMine.has(x.toLowerCase()));
        const onlyMine = mine.filter((x) => !lcTheirs.has(x.toLowerCase()));

        // Real card: a shared interest. Decoys: one of each not-shared.
        const real = shared[0] ?? theirs[0] ?? 'new to campus';
        const decoyA = onlyTheirs[0] ?? onlyMine[0] ?? 'late-night coffee';
        const decoyB = onlyMine[0] ?? onlyTheirs[1] ?? 'weekend hikes';
        const rid = (): string => Math.random().toString(36).slice(2, 10);
        const cards = [
          { id: rid(), name: real, description: '', is_real: true },
          { id: rid(), name: decoyA, description: '', is_real: false },
          { id: rid(), name: decoyB, description: '', is_real: false },
        ].sort(() => Math.random() - 0.5);
        const newPayload = { cards, target_user_id: otherId } as GamePayload;
        const { error: upErr } = await supabase
          .from('encounters')
          .update({ game_payload: newPayload })
          .eq('id', encounter.id);
        if (upErr) throw new Error(upErr.message);
        await refresh();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'Failed to prepare game');
      } finally {
        setDecoyLoading(false);
      }
    })();
  }, [encounter, payload, decoyLoading, otherId, uid, refresh]);

  useEffect(() => {
    if (phase !== 'REVEAL' || !encounter) return;
    if (encounter.icebreaker || iceLoading) return;
    setIceLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('claude_icebreaker', {
          body: {
            user_a_id: encounter.user_a,
            user_b_id: encounter.user_b,
          },
        });
        if (error) throw new Error(error.message);
        const resp = data as { icebreaker?: unknown } | null;
        const ice =
          resp && typeof resp.icebreaker === 'string' ? resp.icebreaker : null;
        if (!ice) throw new Error('Bad icebreaker response');
        const { error: upErr } = await supabase
          .from('encounters')
          .update({ icebreaker: ice })
          .eq('id', encounter.id);
        if (upErr) throw new Error(upErr.message);
        await refresh();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : 'Failed to generate icebreaker');
      } finally {
        setIceLoading(false);
      }
    })();
  }, [phase, encounter, iceLoading, refresh]);

  if (!encounter) {
    return <div className="p-6 text-slate-500">Loading encounter…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
          Encounter
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          {other
            ? `${other.full_name ?? other.email ?? 'A stranger'} is here too`
            : 'Someone is here too'}
        </h1>
      </header>

      {err && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {err}
        </div>
      )}

      <div>
        {phase === 'PREPARING' && (
          <div key="preparing" className="animate-fade-in rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
            <div className="mt-3 text-sm text-slate-600">Preparing the mini-game…</div>
          </div>
        )}

        {phase === 'GAME' && payload && (
          <div key="game" className="animate-fade-in space-y-4">
            <p className="text-slate-700">
              Three vibes. One you <span className="font-semibold text-indigo-600">actually share</span>. Tap to flip — pick the match.
            </p>
            <GameCards
              cards={payload.cards}
              onPick={(cardId) => {
                void pickCard(cardId);
              }}
            />
          </div>
        )}

        {phase === 'WAITING' && (
          <div key="waiting" className="animate-fade-in rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <div className="mx-auto h-2 w-24 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" />
            </div>
            <div className="mt-3 text-sm text-slate-600">
              Pick locked in. Waiting on {other?.full_name ?? 'them'}…
            </div>
          </div>
        )}

        {phase === 'REVEAL' && other && (
          <div key="reveal" className="animate-fade-in">
            <MatchCard
              encounter={encounter}
              otherUser={other}
              onMet={() => void markMet()}
              alreadyMet={iMet}
              selfName={getDemoUser()?.fullName ?? null}
            />
          </div>
        )}

        {phase === 'DONE' && (
          <div
            key="done"
            className="animate-pop-in relative overflow-hidden rounded-3xl border border-amber-300/30 bg-gradient-to-br from-amber-100 via-orange-100 to-rose-100 p-10 text-center shadow-2xl shadow-amber-500/30"
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-amber-400/40 blur-3xl" />
              <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-rose-400/40 blur-3xl" />
            </div>
            <div className="relative flex flex-col items-center gap-4">
              <div className="relative h-24 w-24">
                <div className="absolute inset-0 animate-ping rounded-full bg-rose-500/30" />
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-b from-rose-500 to-rose-700 shadow-2xl shadow-rose-500/40">
                  <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-slate-900" />
                  <div className="absolute inset-0 rounded-full border-[6px] border-slate-900/80" />
                  <div className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-4 border-slate-900 bg-white">
                    <div className="h-3 w-3 rounded-full bg-slate-900" />
                  </div>
                </div>
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-700">
                It's a catch!
              </div>
              <div className="text-3xl font-bold tracking-tight text-slate-900">
                You met {other?.full_name ?? 'them'}.
              </div>
              {encounter?.xp_awarded ? (
                <div className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-bold text-white shadow-lg">
                  +{encounter.xp_awarded} XP
                </div>
              ) : null}
              <div className="text-xs text-slate-600">Added to your caught list on your profile.</div>
              <button
                type="button"
                onClick={() => {
                  try { window.localStorage.removeItem('witm_active_encounter'); } catch { /* ignore */ }
                  window.location.assign('/map');
                }}
                className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                Back to the map
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
