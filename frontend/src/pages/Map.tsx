import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapView } from '../components/map/MapView';
import { MoodInput } from '../components/map/MoodInput';
import { useHotspots } from '../hooks/useHotspots';
import { useGeolocation } from '../hooks/useGeolocation';
import type { Hotspot, RankedHotspot } from '../../../shared/types';

function timingLabel(starts: string | null | undefined, ends: string | null | undefined): string | null {
  if (!starts && !ends) return null;
  const now = Date.now();
  const start = starts ? Date.parse(starts) : NaN;
  const end = ends ? Date.parse(ends) : NaN;
  if (!Number.isNaN(start) && !Number.isNaN(end) && now >= start && now <= end) {
    return 'Happening now';
  }
  if (!Number.isNaN(start) && start > now) {
    const diffMin = Math.round((start - now) / 60000);
    const fmt = new Date(start).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
    if (diffMin <= 90) return `Starts ${fmt}`;
    return `Starts ${fmt}`;
  }
  if (!Number.isNaN(end) && end < now) return 'Wrapped up';
  return null;
}

function findHotspot(list: Hotspot[], id: string): Hotspot | undefined {
  return list.find((h) => h.id === id);
}

export default function Map(): JSX.Element {
  const navigate = useNavigate();
  const { hotspots, loading, error } = useHotspots();
  const { coords } = useGeolocation();
  const [ranked, setRanked] = useState<RankedHotspot[]>([]);
  const [ranking, setRanking] = useState(false);

  const titleById = useMemo(() => {
    const m = new globalThis.Map<string, string>();
    for (const h of hotspots) m.set(h.id, h.title);
    return m;
  }, [hotspots]);

  const visibleHotspots = useMemo<Hotspot[]>(() => {
    if (ranked.length === 0) return [];
    const topIds = new Set(ranked.slice(0, 5).map((r) => r.hotspot_id));
    return (hotspots as Hotspot[]).filter((h) => topIds.has(h.id));
  }, [hotspots, ranked]);

  const hasSubmitted = ranking || ranked.length > 0;

  const userLocation = coords ? { lat: coords.lat, lng: coords.lng } : undefined;

  function handlePinClick(id: string): void {
    navigate(`/pin/${id}`);
  }

  const activeEncounterId = typeof window !== 'undefined' ? window.localStorage.getItem('witm_active_encounter') : null;

  return (
    <div className="relative h-full w-full">
      <MapView
        hotspots={visibleHotspots}
        userLocation={userLocation}
        onPinClick={handlePinClick}
      />
      <MoodInput
        hotspots={hotspots as Hotspot[]}
        onRanked={setRanked}
        onLoadingChange={setRanking}
      />

      {activeEncounterId && (
        <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 animate-fade-in">
          <button
            onClick={() => navigate(`/encounter/${activeEncounterId}`)}
            className="flex items-center gap-3 rounded-full border border-indigo-300/40 bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
          >
            <span className="relative inline-flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
            </span>
            Resume encounter →
          </button>
        </div>
      )}

      {!hasSubmitted && (
        <div className="pointer-events-none absolute top-20 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/70 bg-white/85 px-4 py-1.5 text-xs font-medium text-slate-600 shadow-sm backdrop-blur">
          Tell the map what you're looking for
          <span className="ml-1 text-indigo-600">→</span>
        </div>
      )}

      {(ranking || ranked.length > 0) && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 w-[min(92vw,640px)] rounded-2xl border border-white/70 bg-white/95 p-4 shadow-xl shadow-indigo-500/10 ring-1 ring-slate-900/5 backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600">
              Top picks for you
            </div>
            {ranking && (
              <div className="text-[11px] font-medium text-slate-400">
                ranking…
              </div>
            )}
          </div>

          {ranking && ranked.length === 0 ? (
            <ul key="skel" className="mt-3 space-y-2 animate-cross-fade">
              {[0, 1, 2].map((i) => (
                <li
                  key={i}
                  className="animate-pulse rounded-xl bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 p-3"
                >
                  <div className="h-3 w-1/2 rounded bg-slate-200" />
                  <div className="mt-2 h-2.5 w-3/4 rounded bg-slate-200/80" />
                </li>
              ))}
            </ul>
          ) : (
            <ol key="list" className="mt-3 space-y-1.5 animate-cross-fade">
              {ranked.slice(0, 3).map((r, i) => {
                const h = findHotspot(hotspots as Hotspot[], r.hotspot_id);
                const tag = h ? timingLabel(h.starts_at ?? null, h.ends_at ?? null) : null;
                return (
                  <li key={r.hotspot_id}>
                    <button
                      onClick={() => handlePinClick(r.hotspot_id)}
                      className="group flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition-all duration-200 hover:bg-indigo-50 hover:translate-x-0.5"
                    >
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-[11px] font-bold text-white">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-slate-900">
                            {titleById.get(r.hotspot_id) ?? r.hotspot_id}
                          </span>
                          {tag && (
                            <span
                              className={[
                                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                                tag === 'Happening now'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-100 text-slate-600',
                              ].join(' ')}
                            >
                              {tag}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                          {r.reason}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {loading && (
        <div className="absolute bottom-4 left-4 z-10 rounded bg-white/95 px-3 py-1 text-xs text-slate-600 shadow">
          Loading hotspots...
        </div>
      )}
      {error && (
        <div className="absolute bottom-4 left-4 z-10 rounded bg-red-50 px-3 py-1 text-xs text-red-700 shadow">
          {error}
        </div>
      )}
    </div>
  );
}
