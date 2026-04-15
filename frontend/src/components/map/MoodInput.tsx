import { useState, type FormEvent } from 'react';
import type { Hotspot, RankedHotspot } from '../../../../shared/types';
import { useMoodSearch } from '../../hooks/useMoodSearch';

interface MoodInputProps {
  hotspots: Hotspot[];
  onRanked: (ranked: RankedHotspot[]) => void;
  onLoadingChange?: (loading: boolean) => void;
}

export function MoodInput({
  hotspots,
  onRanked,
  onLoadingChange,
}: MoodInputProps): JSX.Element {
  const { rank, loading, error } = useMoodSearch(hotspots);
  const [text, setText] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    onLoadingChange?.(true);
    try {
      const result = await rank(trimmed);
      onRanked(result);
    } finally {
      onLoadingChange?.(false);
    }
  }

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-[min(92vw,640px)]">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 rounded-full border border-white/70 bg-white/95 p-1.5 pl-5 shadow-xl shadow-indigo-500/10 ring-1 ring-slate-900/5 backdrop-blur"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-slate-400"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="feeling bored, creative, burned out, curious…"
          className="flex-1 bg-transparent px-1 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-fuchsia-500/20 transition-all duration-200 hover:from-indigo-700 hover:to-fuchsia-700 hover:shadow-lg hover:shadow-fuchsia-500/30 disabled:opacity-50"
        >
          {loading ? 'Thinking…' : 'Find the move'}
        </button>
      </form>
      {error && (
        <div className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700 shadow">
          {error}
        </div>
      )}
    </div>
  );
}
