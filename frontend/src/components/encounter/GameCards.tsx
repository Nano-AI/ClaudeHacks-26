import { useState } from 'react';
import type { GameCard } from '../../../../shared/types';

export interface GameCardsProps {
  cards: GameCard[];
  onPick: (cardId: string) => void;
  disabled?: boolean;
}

const BACK_GRADIENTS = [
  'from-indigo-600 via-violet-600 to-fuchsia-600',
  'from-fuchsia-600 via-pink-600 to-rose-500',
  'from-sky-600 via-indigo-600 to-violet-600',
];

export function GameCards({ cards, onPick, disabled }: GameCardsProps): JSX.Element {
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const locked = disabled === true || picked !== null;

  const flip = (id: string): void => {
    setRevealed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handle = (id: string): void => {
    if (locked) {
      flip(id);
      return;
    }
    if (!revealed.has(id)) {
      flip(id);
      return;
    }
    setPicked(id);
    onPick(id);
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {cards.map((card, idx) => {
        const isPicked = picked === card.id;
        const isRevealed = revealed.has(card.id);
        const dim = locked && !isPicked;
        const gradient = BACK_GRADIENTS[idx % BACK_GRADIENTS.length];
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => handle(card.id)}
            disabled={disabled === true}
            className={[
              'group relative h-60 w-full perspective-1000 focus:outline-none',
              'transition duration-300',
              dim ? 'opacity-60' : 'hover:-translate-y-1',
            ].join(' ')}
            style={{ perspective: '1000px' }}
          >
            <div
              className="relative h-full w-full transition-transform duration-700"
              style={{
                transformStyle: 'preserve-3d',
                transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              {/* Back */}
              <div
                className={[
                  'absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br p-6 text-white shadow-xl',
                  gradient,
                ].join(' ')}
                style={{ backfaceVisibility: 'hidden' }}
              >
                <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/70">
                  Mystery
                </div>
                <div className="mt-2 text-2xl font-bold tracking-tight">
                  VIBE #{idx + 1}
                </div>
                <div className="mt-3 text-xs text-white/80">Tap to reveal</div>
              </div>

              {/* Front */}
              <div
                className={[
                  'absolute inset-0 flex flex-col rounded-2xl border bg-white p-5 text-left shadow-md',
                  isPicked ? 'border-emerald-500 ring-2 ring-emerald-300' : 'border-slate-200',
                ].join(' ')}
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
              >
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-indigo-600">
                  Interest
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {card.name}
                </div>
                {card.description && (
                  <p className="mt-2 line-clamp-5 text-xs leading-relaxed text-slate-700">
                    {card.description}
                  </p>
                )}
                <div className="mt-auto pt-3">
                  {isPicked ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                      Picked
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-indigo-600">
                      {locked ? '—' : 'Tap to pick'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
