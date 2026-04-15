import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Hotspot } from '../../../shared/types';

interface HotspotsState {
  hotspots: Hotspot[];
  loading: boolean;
  error: string | null;
}

interface HotspotRow {
  id: string;
  creator_id: string | null;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  lat: number;
  lng: number;
}

export function useHotspots(): HotspotsState {
  const [state, setState] = useState<HotspotsState>({
    hotspots: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('hotspots_v')
        .select(
          'id,creator_id,title,description,starts_at,ends_at,created_at,lat,lng'
        );
      if (cancelled) return;
      if (error) {
        setState({ hotspots: [], loading: false, error: error.message });
        return;
      }
      const rows = (data ?? []) as unknown as HotspotRow[];
      const hotspots: Hotspot[] = rows.map((r) => ({
        id: r.id,
        creator_id: r.creator_id,
        title: r.title,
        description: r.description,
        starts_at: r.starts_at,
        ends_at: r.ends_at,
        created_at: r.created_at,
        lat: r.lat,
        lng: r.lng,
      }));
      setState({ hotspots, loading: false, error: null });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
