/**
 * Level thresholds: 100 XP per level, starting at Level 1.
 *
 * Level 1: 0-99 XP, Level 2: 100-199 XP, etc.
 * Flat 100 XP/level (no scaling curve) is a deliberate simplicity choice
 * for v1 — a job search is short enough (weeks/months, not a year-long
 * grind) that a growing curve would mostly just make later levels feel
 * unreachable rather than aspirational.
 */
const XP_PER_LEVEL = 100;

export interface LevelInfo {
  level: number;
  label: string;
}

/**
 * Pure function: derives level + display label from a raw XP total.
 * Negative XP is clamped to 0 defensively (shouldn't happen given computeXp
 * never returns negative values, but keeps this function safe standalone).
 */
export function levelForXp(xp: number): LevelInfo {
  const safeXp = Math.max(0, xp);
  const level = Math.floor(safeXp / XP_PER_LEVEL) + 1;
  return {
    level,
    label: `Level ${level} Job Seeker`,
  };
}
