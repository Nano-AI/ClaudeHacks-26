import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { CheckInResult, Encounter } from '../../../shared/types';

export interface CheckInReturn extends CheckInResult {
  encounter?: Encounter;
}

export interface UseCheckIn {
  checkIn: (hotspotId: string, lat: number, lng: number) => Promise<CheckInReturn>;
  loading: boolean;
  error: string | null;
}

export function useCheckIn(): UseCheckIn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkIn = async (
    hotspotId: string,
    lat: number,
    lng: number
  ): Promise<CheckInReturn> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('check_in', {
        p_hotspot_id: hotspotId,
        p_user_lat: lat,
        p_user_lng: lng,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      const result = data as unknown as CheckInResult;

      let encounter: Encounter | undefined;
      const { data: encData, error: encErr } = await supabase.rpc(
        'find_or_create_encounter',
        { p_hotspot_id: hotspotId }
      );
      if (!encErr && encData !== null && encData !== undefined) {
        encounter = encData as unknown as Encounter;
      }

      return encounter ? { ...result, encounter } : { ...result };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Check-in failed';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { checkIn, loading, error };
}
