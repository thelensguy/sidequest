import type { AppEvent } from '../lib/types';

/**
 * XP point values.
 *
 * Design choices (tuned, not derived from any spec):
 * - capture / manual_add / import: +5 XP each. These are "logging" actions —
 *   low effort, so low reward, but still worth something since a tracked
 *   application beats an untracked one.
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
 */
export const XP_VALUES = {
  capture: 5,
  manual_add: 5,
  import: 5,
  status_change_applied: 10,
  status_change_interviewing: 20,
  status_change_rejected: 15,
  status_change_offer: 50,
} as const;

/**
 * Pure function: computes total XP from the full event log.
 * Never mutates, never reads storage — callers pass in whatever events
 * they've already fetched via storage.getEvents().
 */
export function computeXp(events: AppEvent[]): number {
  return events.reduce((total, event) => {
    switch (event.type) {
      case 'capture':
        return total + XP_VALUES.capture;
      case 'manual_add':
        return total + XP_VALUES.manual_add;
      case 'import':
        return total + XP_VALUES.import;
      case 'status_change': {
        const toStatus = event.metadata?.toStatus;
        switch (toStatus) {
          case 'applied':
            return total + XP_VALUES.status_change_applied;
          case 'interviewing':
            return total + XP_VALUES.status_change_interviewing;
          case 'rejected':
            return total + XP_VALUES.status_change_rejected;
          case 'offer':
            return total + XP_VALUES.status_change_offer;
          default:
            return total;
        }
      }
      default:
        return total;
    }
  }, 0);
}
