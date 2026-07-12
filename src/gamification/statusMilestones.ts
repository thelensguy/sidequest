import type { AppEvent, ApplicationStatus } from '../lib/types';

/**
 * Shared primitive behind both xp.ts and wheel.ts: the set of
 * "jobEntryId:status" pairs that have EVER been reached at least once
 * within the given events, each pair counted only once no matter how many
 * times a status_change event re-reaches it.
 *
 * This exists specifically to prevent farming — without it, toggling one
 * job's status back and forth (applied -> interviewing -> applied ->
 * interviewing -> ...) would award XP and cross wheel milestones on every
 * single toggle, since each toggle is its own status_change event. Every
 * derived stat that cares about "did X happen" rather than "how many
 * status_change events exist" should go through this.
 */
export function reachedStatusKeys(events: AppEvent[]): Set<string> {
  const keys = new Set<string>();
  for (const event of events) {
    if (event.type !== 'status_change') continue;
    const toStatus = event.metadata?.toStatus;
    if (toStatus) keys.add(statusKey(event.jobEntryId, toStatus));
  }
  return keys;
}

export function statusKey(jobEntryId: string, status: ApplicationStatus): string {
  return `${jobEntryId}:${status}`;
}

/** Counts distinct job entries represented in `keys` that reached `status`. */
export function countDistinctEntriesWithStatus(
  keys: Set<string>,
  status: ApplicationStatus
): number {
  let count = 0;
  const suffix = `:${status}`;
  for (const key of keys) {
    if (key.endsWith(suffix)) count++;
  }
  return count;
}
