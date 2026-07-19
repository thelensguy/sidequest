import type { AppEvent, LootTableEntry } from '../lib/types';
import { computeXp } from './xp';
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
 *  - a new multiple-of-5 "applied" milestone was crossed (5th, 10th, 15th...
 *    distinct application — counting job entries that have ever reached
 *    'applied', not raw status_change events)
 *
 * `lastSpunAtEventCount` is the length of the events array at the time of
 * the last spin (0 if never spun). Passing the full current `events` array
 * plus that count lets this stay a pure function with no hidden state —
 * callers (the UI) are responsible for persisting the count after a spin.
 *
 * Events are assumed append-only in chronological order, matching
 * src/lib/storage.ts's appendEvent behavior, so slicing by count is a valid
 * way to isolate "events since last spin."
 */
export function shouldUnlockWheel(
  events: AppEvent[],
  lastSpunAtEventCount: number
): boolean {
  const clampedCount = Math.max(0, Math.min(lastSpunAtEventCount, events.length));
  const priorEvents = events.slice(0, clampedCount);
  const newEvents = events.slice(clampedCount);

  if (newEvents.length === 0) {
    return false;
  }

  const priorKeys = reachedStatusKeys(priorEvents);
  const currentKeys = reachedStatusKeys(events);

  // Rejection milestone: a job entry reached 'rejected' for the first time
  // within this window — not just any 'rejected' status_change event.
  for (const key of currentKeys) {
    if (key.endsWith(':rejected') && !priorKeys.has(key)) {
      return true;
    }
  }

  // Level-up milestone. Naturally immune to farming now that computeXp
  // itself dedupes per (entry, status) — toggling doesn't grow XP.
  const priorLevel = levelForXp(computeXp(priorEvents)).level;
  const currentLevel = levelForXp(computeXp(events)).level;
  if (currentLevel > priorLevel) {
    return true;
  }

  // Every-5-applications milestone, counting distinct entries that have
  // ever reached 'applied', not raw status_change events.
  const priorMilestones = Math.floor(countDistinctEntriesWithStatus(priorKeys, 'applied') / 5);
  const currentMilestones = Math.floor(countDistinctEntriesWithStatus(currentKeys, 'applied') / 5);
  if (currentMilestones > priorMilestones) {
    return true;
  }

  return false;
}

/**
 * Goal Gradient countdown: how many more distinct "applied" entries are
 * needed to cross the next every-5-applications milestone, counting only
 * applications reached since `lastSpunAtEventCount` — the same window
 * shouldUnlockWheel() uses for its own every-5 check, so this stays
 * consistent with when the wheel actually unlocks.
 *
 * Deliberately ignores the rejection/level-up unlock paths: those are
 * "any moment" triggers with no meaningful countdown, so the HUD's
 * countdown text is specifically about the applications milestone (the
 * mockup's dial-hint text mirrors this — "N more applications to next
 * spin (or any rejection)").
 *
 * Always returns a value in [1, 5]: 5 right after a spin (or if nothing's
 * happened yet), counting down as applications land, wrapping back to 5
 * the instant a multiple of 5 is crossed (at which point the caller should
 * be reading shouldUnlockWheel() as true anyway, not this countdown).
 */
export function applicationsUntilNextMilestone(
  events: AppEvent[],
  lastSpunAtEventCount: number
): number {
  const clampedCount = Math.max(0, Math.min(lastSpunAtEventCount, events.length));
  const priorEvents = events.slice(0, clampedCount);

  const priorApplied = countDistinctEntriesWithStatus(reachedStatusKeys(priorEvents), 'applied');
  const currentApplied = countDistinctEntriesWithStatus(reachedStatusKeys(events), 'applied');
  const sinceLastSpin = Math.max(0, currentApplied - priorApplied);

  const remainder = sinceLastSpin % 5;
  return remainder === 0 ? 5 : 5 - remainder;
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
