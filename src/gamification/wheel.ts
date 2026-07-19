import type { AppEvent, LootTableEntry } from '../lib/types';
import { DEFAULT_WHEEL_CADENCE } from '../lib/storage';
import { computeXpWithKeys } from './xp';
import { levelForXp } from './levels';
import { countDistinctEntriesWithStatus, reachedStatusKeys } from './statusMilestones';

/**
 * The wheel's spin checkpoint, derived from the event log itself: every
 * spin appends a 'wheel_spin' AppEvent, so "events since the last spin"
 * is everything after the most recent one. Deriving this (instead of the
 * separately-persisted counter this replaced) means it survives
 * export/import round-trips, can't race between two open pages, and the
 * last-won treat (in the event's metadata) becomes real, persistent
 * history. Returns 0 when no spin event exists — callers fall back to
 * the legacy stored counter in that case (see wheelState.ts).
 */
export function deriveLastSpunCheckpoint(events: AppEvent[]): number {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === 'wheel_spin') return i + 1;
  }
  return 0;
}

/** The treat label recorded by the most recent wheel_spin event, or null if never spun. */
export function lastWonTreatLabel(events: AppEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === 'wheel_spin') return events[i].metadata?.treatLabel ?? null;
  }
  return null;
}

export interface WheelStatus {
  unlocked: boolean;
  /** Countdown to the next every-N-applications milestone, in [1, cadence]. */
  applicationsUntilNext: number;
}

/**
 * Milestone rule (per PRD "Reward wheel"): unlock a spin when, since the
 * last spin, ANY of the following became newly true:
 *  - a job entry reached 'rejected' for the first time ever (every
 *    distinct rejection re-unlocks the wheel — same "resilience" framing
 *    as the rejection XP bonus in xp.ts). Toggling an already-rejected
 *    entry's status back and forth does NOT re-trigger this — see
 *    reachedStatusKeys() in statusMilestones.ts, which both this and
 *    xp.ts rely on to guard against exactly that kind of farming.
 *  - the job seeker leveled up (every level-up unlocks a spin)
 *  - a new multiple-of-`milestoneEvery` "applied" milestone was crossed
 *    (counting distinct job entries that have ever reached 'applied', not
 *    raw status_change events). The cadence is user-configurable from the
 *    Options page; 5 is the default.
 *
 * The countdown (applicationsUntilNext) deliberately ignores the
 * rejection/level-up unlock paths: those are "any moment" triggers with no
 * meaningful countdown, so the HUD's hint text is specifically about the
 * applications milestone. It's always in [1, cadence]: cadence right after
 * a spin, counting down as applications land, wrapping the instant a
 * milestone is crossed (at which point `unlocked` is what matters).
 *
 * `lastSpunAtEventCount` is the length of the events array at the time of
 * the last spin (0 if never spun) — normally derived from the log via
 * deriveLastSpunCheckpoint(). Events are assumed append-only in
 * chronological order, matching src/lib/storage.ts's appendEvent behavior,
 * so slicing by count is a valid way to isolate "events since last spin."
 *
 * Both checks share one computation of the (entry, status) reach-sets —
 * with logs at import scale (thousands of events), rebuilding those sets
 * per check was the panel's dominant refresh cost.
 */
export function deriveWheelStatus(
  events: AppEvent[],
  lastSpunAtEventCount: number,
  milestoneEvery: number = DEFAULT_WHEEL_CADENCE
): WheelStatus {
  const cadence = Math.max(1, Math.floor(milestoneEvery));
  const clampedCount = Math.max(0, Math.min(lastSpunAtEventCount, events.length));
  const priorEvents = events.slice(0, clampedCount);

  const priorKeys = reachedStatusKeys(priorEvents);
  const currentKeys = reachedStatusKeys(events);

  const priorApplied = countDistinctEntriesWithStatus(priorKeys, 'applied');
  const currentApplied = countDistinctEntriesWithStatus(currentKeys, 'applied');
  const sinceLastSpin = Math.max(0, currentApplied - priorApplied);
  const remainder = sinceLastSpin % cadence;
  const applicationsUntilNext = remainder === 0 ? cadence : cadence - remainder;

  if (events.length === clampedCount) {
    return { unlocked: false, applicationsUntilNext };
  }

  // Rejection milestone: a job entry reached 'rejected' for the first time
  // within this window — not just any 'rejected' status_change event.
  for (const key of currentKeys) {
    if (key.endsWith(':rejected') && !priorKeys.has(key)) {
      return { unlocked: true, applicationsUntilNext };
    }
  }

  // Level-up milestone. Naturally immune to farming now that computeXp
  // itself dedupes per (entry, status) — toggling doesn't grow XP.
  const priorLevel = levelForXp(computeXpWithKeys(priorEvents, priorKeys)).level;
  const currentLevel = levelForXp(computeXpWithKeys(events, currentKeys)).level;
  if (currentLevel > priorLevel) {
    return { unlocked: true, applicationsUntilNext };
  }

  // Every-N-applications milestone.
  const priorMilestones = Math.floor(priorApplied / cadence);
  const currentMilestones = Math.floor(currentApplied / cadence);
  if (currentMilestones > priorMilestones) {
    return { unlocked: true, applicationsUntilNext };
  }

  return { unlocked: false, applicationsUntilNext };
}

/** Convenience wrapper over deriveWheelStatus — see its doc comment for the full rule. */
export function shouldUnlockWheel(
  events: AppEvent[],
  lastSpunAtEventCount: number,
  milestoneEvery: number = DEFAULT_WHEEL_CADENCE
): boolean {
  return deriveWheelStatus(events, lastSpunAtEventCount, milestoneEvery).unlocked;
}

/** Convenience wrapper over deriveWheelStatus — see its doc comment for the full rule. */
export function applicationsUntilNextMilestone(
  events: AppEvent[],
  lastSpunAtEventCount: number,
  milestoneEvery: number = DEFAULT_WHEEL_CADENCE
): number {
  return deriveWheelStatus(events, lastSpunAtEventCount, milestoneEvery).applicationsUntilNext;
}

/**
 * Weighted-random pick from the user-configured loot table (Part D: Custom
 * Admin Loot Table). Same algorithm as the mockup's pickWeightedTreat():
 * walk the list subtracting each entry's weight from a running random
 * value in [0, total weight) until it goes non-positive. Entries with
 * larger weight occupy a proportionally larger slice of that range, so
 * they're proportionally more likely to be the one the countdown lands on.
 *
 * Returns null for an empty table or a table whose weights sum to <= 0 —
 * callers (the UI) should already be disabling the wheel in that case, so
 * this is a defensive fallback, not the primary guard.
 */
export function pickWeightedTreat(entries: LootTableEntry[]): LootTableEntry | null {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (entries.length === 0 || total <= 0) {
    return null;
  }
  let r = Math.random() * total;
  for (const entry of entries) {
    r -= entry.weight;
    if (r <= 0) return entry;
  }
  return entries[entries.length - 1];
}
