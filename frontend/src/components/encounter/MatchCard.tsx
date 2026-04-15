import type { Encounter } from '../../../../shared/types';

export interface MatchCardOtherUser {
  id: string;
  full_name?: string | null;
  email?: string | null;
}

export interface MatchCardProps {
  encounter: Encounter;
  otherUser: MatchCardOtherUser;
  onMet: () => void;
  alreadyMet?: boolean;
  selfName?: string | null;
}

function firstLetter(s: string | null | undefined, fallback = '?'): string {
  const src = (s ?? '').trim();
  if (src.length === 0) return fallback;
  return src.slice(0, 1).toUpperCase();
}

export function MatchCard({
  encounter,
  otherUser,
  onMet,
  alreadyMet,
  selfName,
}: MatchCardProps): JSX.Element {
  const name = otherUser.full_name ?? otherUser.email ?? 'your match';
  const hint = 'Look for them near the entrance — blue jacket.';
  const selfInitial = firstLetter(selfName, 'Y');
  const otherInitial = firstLetter(otherUser.full_name ?? otherUser.email, '?');

  return (
    <div className="mx-auto max-w-xl rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 p-[1.5px] shadow-2xl shadow-fuchsia-500/20">
      <div className="rounded-[22px] bg-white p-7">
        <div className="flex items-center justify-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xl font-bold text-white shadow-md">
            {selfInitial}
          </div>
          <div className="text-2xl text-slate-300">✦</div>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 text-xl font-bold text-white shadow-md">
            {otherInitial}
          </div>
        </div>

        <div className="mt-5 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
            It's a match
          </div>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            You and {name}
          </h2>
        </div>

        <div className="mt-6 rounded-2xl bg-gradient-to-br from-indigo-50 via-violet-50 to-pink-50 p-5 ring-1 ring-indigo-100">
          <p
            className="text-center text-xl leading-relaxed text-slate-800"
            style={{ fontFamily: 'ui-serif, Georgia, "Times New Roman", serif' }}
          >
            {encounter.icebreaker ?? 'Generating an opener…'}
          </p>
        </div>

        <div className="mt-4 text-center text-xs italic text-slate-500">
          {hint}
        </div>

        <button
          type="button"
          onClick={onMet}
          disabled={alreadyMet === true}
          className="mt-6 w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition hover:from-indigo-700 hover:to-fuchsia-700 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400 disabled:shadow-none"
        >
          {alreadyMet === true ? 'Waiting for them…' : 'Met Them!'}
        </button>
      </div>
    </div>
  );
}
