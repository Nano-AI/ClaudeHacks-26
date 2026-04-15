import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Hotspot } from '../../../../shared/types';
import { attachPinMarker } from './PinMarker';

interface MapViewProps {
  hotspots: Hotspot[];
  userLocation?: { lat: number; lng: number };
  onPinClick: (id: string) => void;
}

const MADISON_CENTER: [number, number] = [-89.4012, 43.0731];
const MADISON_ZOOM = 15.5;
const TILE_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

export function MapView({
  hotspots,
  userLocation,
  onPinClick,
}: MapViewProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: TILE_STYLE,
      center: MADISON_CENTER,
      zoom: MADISON_ZOOM,
      pitch: 55,
      bearing: -17,
      antialias: true,
    });
    mapRef.current = map;
    map.on('load', () => {
      setMapReady(true);
      try {
        const layers = map.getStyle().layers ?? [];
        const labelLayerId = layers.find(
          (l) => l.type === 'symbol' && (l.layout as { 'text-field'?: unknown })?.['text-field']
        )?.id;
        if (!map.getLayer('3d-buildings') && map.getSource('openmaptiles')) {
          map.addLayer(
            {
              id: '3d-buildings',
              source: 'openmaptiles',
              'source-layer': 'building',
              type: 'fill-extrusion',
              minzoom: 13,
              paint: {
                'fill-extrusion-color': '#cbd5e1',
                'fill-extrusion-height': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  13, 0,
                  15.05, ['coalesce', ['get', 'render_height'], 6],
                ],
                'fill-extrusion-base': [
                  'coalesce',
                  ['get', 'render_min_height'],
                  0,
                ],
                'fill-extrusion-opacity': 0.85,
              },
            },
            labelLayerId
          );
        }
      } catch (e) {
        console.warn('3d buildings layer failed', e);
      }
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    hotspots.forEach((h, i) => {
      const marker = attachPinMarker({
        map,
        hotspot: h,
        onClick: () => onPinClick(h.id),
        index: i,
      });
      markersRef.current.push(marker);
    });
  }, [hotspots, onPinClick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
    if (!userLocation) return;
    const el = document.createElement('div');
    el.className =
      'w-3 h-3 rounded-full bg-blue-500 ring-4 ring-blue-300/60 shadow';
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map);
    userMarkerRef.current = marker;
  }, [userLocation]);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" />
      <div
        aria-hidden
        className={[
          'pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-slate-950 transition-opacity duration-500',
          mapReady ? 'opacity-0' : 'opacity-100',
        ].join(' ')}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-300/80">
            Loading map
          </div>
        </div>
      </div>
    </>
  );
}
