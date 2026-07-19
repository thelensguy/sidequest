import type { ApplicationStatus, AppEvent } from '../lib/types';
import { countDistinctEntriesWithStatus, reachedStatusKeys } from './statusMilestones';

/**
 * XP point values.
 *
 * Design choices (tuned, not derived from any spec):
 * - capture / manual_add: +5 XP each. These are "logging" actions —
 *   low effort, so low reward, but still worth something since a tracked
 *   application beats an untracked one.
 * - import: +0. Bulk-importing a backfill spreadsheet isn't new effort —
 *   at +5 each, pasting 100 historical rows instantly granted +500 XP,
 *   ~5 level-ups, and a wheel spin per level-up. History should carry
 *   over without feeling like a jackpot.
 * - wheel_spin: +0 (no case below — it's reward-dial bookkeeping, not a
 *   progress action).
 * - status_change -> 'applied': +10. Actually applying is the first real
 *   piece of follow-through after a capture.
 * - status_change -> 'interviewing': +20. A meaningfully bigger deal than
 *   applying — external validation that the application worked.
 * - status_change -> 'rejected': +15. This is the "resilience XP" called out
 *   in the PRD (see PRD.md "Gamification layer"): rejections should NOT
 *   feel like zero reward, so this is intentionally priced *above* the
 *   +10 for applying — showing up and getting a "no" still counts as
 *   progress, arguably more effort-rewarding than a still-pending application.
 * - status_change -> 'offer': +50. The end goal, weighted heavily above
 *   everything else.
 * - status_change -> 'saved' or any other/unrecognized toStatus: +0.
 *   Moving something back to "saved" isn't forward progress, so it's not
 *   rewarded (and also guards against double-counting weirdness).
 *
 * Anti-farming rule: each status only ever pays out ONCE per job entry,
 * no matter how many times that entry's status_change events re-reach it.
 * Without this, toggling one job between applied <-> interviewing
 * repeatedly would earn unlimited XP from a single application — see
 * reachedStatusKeys() in statusMilestones.ts, the shared primitive this
 * and wheel.ts's milestone checks both rely on.
 */
export const XP_VALUES = {
  capture: 5,
  manual_add: 5,
  import: 0,
  status_change_applied: 10,
  status_change_interviewing: 20,
  status_change_rejected: 15,
  status_change_offer: 50,
} as const;

const STATUS_CHANGE_XP: Partial<Record<ApplicationStatus, number>> = {
  applied: XP_VALUES.status_change_applied,
  interviewing: XP_VALUES.status_change_interviewing,
  rejected: XP_VALUES.status_change_rejected,
  offer: XP_VALUES.status_change_offer,
};

/**
 * Pure function: computes total XP from the full event log.
 * Never mutates, never reads storage — callers pass in whatever events
 * they've already fetched via storage.getEvents().
 */
export function computeXp(events: AppEvent[]): number {
  const creationXp = events.reduce((total, event) => {
    switch (event.type) {
      case 'capture':
        return total + XP_VALUES.capture;
      case 'manual_add':
        return total + XP_VALUES.manual_add;
      case 'import':
        return total + XP_VALUES.import;
      default:
        return total;
    }
  }, 0);

  const reachedKeys = reachedStatusKeys(events);
  const statusXp = (Object.keys(STATUS_CHANGE_XP) as ApplicationStatus[]).reduce(
    (total, status) =>
      total + countDistinctEntriesWithStatus(reachedKeys, status) * (STATUS_CHANGE_XP[status] ?? 0),
    0
  );

  return creationXp + statusXp;
}
