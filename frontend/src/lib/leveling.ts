// Leveling formula mirrors SQL: level = 1 + floor(sqrt(xp/50))
// So xp needed to reach level L (>=1) is: 50 * (L - 1)^2

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return 50 * (level - 1) * (level - 1);
}

export function levelForXp(xp: number): number {
  if (xp <= 0) return 1;
  return 1 + Math.floor(Math.sqrt(xp / 50));
}

export interface LevelProgress {
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progress: number; // 0..1
}

export function progressToNextLevel(xp: number): LevelProgress {
  const level = levelForXp(xp);
  const currentFloor = xpForLevel(level);
  const nextFloor = xpForLevel(level + 1);
  const span = Math.max(1, nextFloor - currentFloor);
  const into = Math.max(0, xp - currentFloor);
  return {
    level,
    xp,
    xpIntoLevel: into,
    xpForNextLevel: nextFloor - xp,
    progress: Math.min(1, into / span),
  };
}
