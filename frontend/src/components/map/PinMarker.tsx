import maplibregl from 'maplibre-gl';
import type { Hotspot } from '../../../../shared/types';

interface AttachOptions {
  map: maplibregl.Map;
  hotspot: Hotspot;
  onClick: () => void;
  index?: number;
}

export function attachPinMarker(opts: AttachOptions): maplibregl.Marker {
  const { map, hotspot, onClick, index = 0 } = opts;
  const el = document.createElement('button');
  el.type = 'button';
  el.setAttribute('aria-label', hotspot.title);
  el.className = 'group relative block focus:outline-none';
  el.style.animationDelay = `${index * 80}ms`;
  el.style.opacity = '0';
  el.innerHTML = renderPinHtml(hotspot.title);
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });

  const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
    .setLngLat([hotspot.lng, hotspot.lat])
    .addTo(map);

  // Next frame: kick off the drop animation via class so keyframe delay applies
  requestAnimationFrame(() => {
    el.classList.add('animate-pin-drop');
    el.style.opacity = '';
  });

  return marker;
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPinHtml(title: string): string {
  const safe = escape(title);
  return `
    <span class="pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-pink-400/60 to-indigo-500/60 blur-md"></span>
    <span class="pointer-events-none absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-fuchsia-400/60"></span>
    <span class="relative flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-indigo-600 ring-2 ring-white shadow-lg shadow-fuchsia-500/40">
      <span class="h-2 w-2 rounded-full bg-white"></span>
    </span>
    <span class="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-slate-800 shadow ring-1 ring-slate-900/5">${safe}</span>
  `;
}
