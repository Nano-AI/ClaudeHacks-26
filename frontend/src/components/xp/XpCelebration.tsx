import { toast } from 'sonner';
import type { CheckInResult } from '../../../../shared/types';

let lastKnownLevel: number | null = null;

function maybeLevelUpToast(newLevel: number): void {
  if (lastKnownLevel !== null && newLevel > lastKnownLevel) {
    toast.success(`Level up → Lv ${newLevel}`, {
      description: 'Fresh badge unlocked.',
      duration: 4000,
    });
  }
  lastKnownLevel = newLevel;
}

export function celebrateXp(result: CheckInResult): void {
  const parts: string[] = [`+${result.xp_awarded} XP`];
  if (result.was_first_visit) parts.push('fresh spot +20');
  if (result.was_daily_discovery) parts.push('daily discovery +30');
  toast.success(`Level ${result.new_level} · ${result.new_xp} XP`, {
    description: parts.join(' · '),
    duration: 3200,
  });
  maybeLevelUpToast(result.new_level);
}

export function celebrateEncounterWin(xp: number, newLevel: number, newXp: number): void {
  toast.success(`Encounter complete · +${xp} XP`, {
    description: `Level ${newLevel} · ${newXp} XP total`,
    duration: 3600,
  });
  maybeLevelUpToast(newLevel);
}

export interface XpCelebrationProps {
  result: CheckInResult;
}

export function XpCelebration(props: XpCelebrationProps): JSX.Element {
  const { result } = props;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-sm">
      <div className="text-base font-semibold">+{result.xp_awarded} XP</div>
      <div className="mt-1 text-sm text-slate-600">
        Level {result.new_level} · {result.new_xp} XP
      </div>
    </div>
  );
}
