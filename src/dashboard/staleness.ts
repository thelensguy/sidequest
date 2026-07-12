/**
 * Pure staleness logic — no chrome.* calls, easy to unit test in isolation.
 *
 * An entry is considered "stale" once it's gone STALE_DAYS_THRESHOLD days
 * without any update (status change, edit, etc. all bump lastUpdated).
 */

export const STALE_DAYS_THRESHOLD = 14;

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
