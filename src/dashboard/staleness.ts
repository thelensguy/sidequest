/**
 * Pure staleness logic — no chrome.* calls, easy to unit test in isolation.
 *
 * An entry is considered "stale" once it's gone STALE_DAYS_THRESHOLD days
 * without any update (status change, edit, etc. all bump lastUpdated).
 */

import type { ApplicationStatus, JobEntry } from '../lib/types';

export const STALE_DAYS_THRESHOLD = 14;

/**
 * Statuses where "gone quiet" is the expected end state, not a follow-up
 * prompt — a three-week-old rejection isn't stale, it's just over.
 */
const TERMINAL_STATUSES: ReadonlySet<ApplicationStatus> = new Set(['rejected', 'offer']);

/** Whole days elapsed between `isoTimestamp` and `now` (defaults to current time). */
export function daysSince(isoTimestamp: string, now: Date = new Date()): number {
  const then = new Date(isoTimestamp).getTime();
  if (Number.isNaN(then)) return 0;
  const diffMs = now.getTime() - then;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/** True once an entry has gone STALE_DAYS_THRESHOLD+ days without an update. */
export function isStale(lastUpdated: string, now: Date = new Date()): boolean {
  return daysSince(lastUpdated, now) >= STALE_DAYS_THRESHOLD;
}

/** Staleness for a whole entry: terminal statuses (rejected/offer) never flag. */
export function isStaleEntry(
  entry: Pick<JobEntry, 'lastUpdated' | 'status'>,
  now: Date = new Date()
): boolean {
  if (TERMINAL_STATUSES.has(entry.status)) return false;
  return isStale(entry.lastUpdated, now);
}
