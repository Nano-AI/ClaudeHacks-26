import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getDemoUserId } from '../lib/demoUser';
import type { Encounter, GamePayload, GameCard, GameResult } from '../../../shared/types';

export interface UseEncounter {
  encounter: Encounter | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  pickCard: (cardId: string) => Promise<void>;
  markMet: () => Promise<void>;
}

export function useEncounter(id: string | undefined): UseEncounter {
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const encRef = useRef<Encounter | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!id) return;
    const { data, error: qErr } = await supabase
      .from('encounters')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (qErr) {
      setError(qErr.message);
      return;
    }
    const row = (data as unknown as Encounter) ?? null;
    encRef.current = row;
    setEncounter(row);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    void refresh().finally(() => setLoading(false));
    const t = setInterval(() => {
      void refresh();
    }, 2000);
    return () => clearInterval(t);
  }, [id, refresh]);

  const pickCard = useCallback(
    async (cardId: string): Promise<void> => {
      const current = encRef.current;
      if (!current || !id) return;
      const payload = current.game_payload as GamePayload | null;
      if (!payload) return;
      const card = payload.cards.find((c: GameCard) => c.id === cardId);
      const correct = card?.is_real === true;
      const uid = await getDemoUserId();
      const side: 'user_a_pick' | 'user_b_pick' =
        uid === current.user_a ? 'user_a_pick' : 'user_b_pick';
      const correctKey: 'user_a_correct' | 'user_b_correct' =
        uid === current.user_a ? 'user_a_correct' : 'user_b_correct';

      const prev = (current.game_result ?? {}) as GameResult;
      const nextResult: GameResult = {
        ...prev,
        [side]: cardId,
        [correctKey]: correct,
      } as GameResult;

      const { error: upErr } = await supabase
        .from('encounters')
        .update({ game_result: nextResult })
        .eq('id', id);
      if (upErr) {
        setError(upErr.message);
        return;
      }
      await refresh();
    },
    [id, refresh]
  );

  const markMet = useCallback(async (): Promise<void> => {
    if (!id) return;
    const { error: rpcErr } = await supabase.rpc('mark_encounter_met', {
      p_encounter_id: id,
    });
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    await refresh();
  }, [id, refresh]);

  return { encounter, loading, error, refresh, pickCard, markMet };
}
