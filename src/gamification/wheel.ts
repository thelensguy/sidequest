import type { AppEvent } from '../lib/types';
import { computeXp } from './xp';
import { levelForXp } from './levels';
import { countDistinctEntriesWithStatus, reachedStatusKeys } from './statusMilestones';

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
 * Pure random pick from the user-configured treat list. Returns '' for an
 * empty list rather than throwing — callers (the UI) should already be
 * disabling the wheel button when there are no treats configured, so this
 * is a defensive fallback, not the primary guard.
 */
export function pickTreat(treats: string[]): string {
  if (treats.length === 0) {
    return '';
  }
  const index = Math.floor(Math.random() * treats.length);
  return treats[index];
}
