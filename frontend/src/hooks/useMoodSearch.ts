import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Hotspot, RankedHotspot } from '../../../shared/types';

interface UseMoodSearchResult {
  rank: (mood: string) => Promise<RankedHotspot[]>;
  ranked: RankedHotspot[];
  loading: boolean;
  error: string | null;
}

interface RankResponse {
  ranked: RankedHotspot[];
}

export function useMoodSearch(hotspots: Hotspot[]): UseMoodSearchResult {
  const [ranked, setRanked] = useState<RankedHotspot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rank = useCallback(
    async (mood: string): Promise<RankedHotspot[]> => {
      setLoading(true);
      setError(null);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id ?? null;

        const payload = {
          mood,
          user_id: userId,
          hotspots: hotspots.map((h) => ({
            id: h.id,
            title: h.title,
            description: h.description ?? '',
          })),
        };

        const { data, error: fnErr } = await supabase.functions.invoke<RankResponse>(
          'claude_rank_hotspots',
          { body: payload }
        );
        if (fnErr) throw new Error(fnErr.message);
        const result = data?.ranked ?? [];
        setRanked(result);
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'rank failed';
        setError(msg);
        setRanked([]);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [hotspots]
  );

  return { rank, ranked, loading, error };
}
