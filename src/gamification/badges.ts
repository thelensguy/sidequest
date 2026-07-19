import type { AppEvent, ApplicationStatus } from '../lib/types';
import { toLocalDateString } from '../lib/dateUtils';

export interface Badge {
  /** Stable identifier, used as a React key and for lookups. */
  id: string;
  /** Quest-flavored display name. */
  label: string;
  description: string;
  unlocked: boolean;
  /** ISO 8601 timestamp of the event that unlocked it, if unlocked. */
  unlockedAt?: string;
}

const BADGE_META: Record<string, { label: string; description: string }> = {
  'first-application': {
    label: 'First Quest Accepted',
    description: 'Applied to your first job.',
  },
  'first-rejection': {
    label: 'Battle-Scarred',
    description: 'Took your first rejection and kept going.',
  },
  'first-interview': {
    label: 'Called to Adventure',
    description: 'Landed your first interview.',
  },
  'first-offer': {
    label: 'Quest Complete',
    description: 'Earned your first offer.',
  },
  'seven-day-streak': {
    label: '7-Day Adventurer',
    description: 'Logged activity on 7 different days.',
  },
};

function findFirstStatusChange(
  events: AppEvent[],
  toStatus: ApplicationStatus
): AppEvent | undefined {
  // Events are assumed to be in chronological append order (they're an
  // append-only log per src/lib/storage.ts), but we sort defensively by
  // timestamp so badge unlock order is correct even if callers pass events
  // out of order.
  const matches = events
    .filter((e) => e.type === 'status_change' && e.metadata?.toStatus === toStatus)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return matches[0];
}

/**
 * "7-day streak" badge rule (documented per task spec, since "streak" is
 * ambiguous): unlocks once capture or status_change events have occurred on
 * 7 DISTINCT calendar days, not necessarily consecutive. A true consecutive-
 * day streak felt too easy to break (and punish) in a low-frequency activity
 * like job hunting — someone applying steadily every few days over a few
 * weeks is showing exactly the persistence this badge should reward, even
 * with gaps (weekends, holidays, etc). Calendar day is the user's LOCAL
 * day (via toLocalDateString), not the UTC date slice — an evening
 * session in a US timezone lands after UTC midnight, and bucketing by
 * UTC would silently credit it to "tomorrow" while every date the
 * dashboard displays uses local time.
 */
function computeSevenDayStreakBadge(events: AppEvent[]): Badge {
  const meta = BADGE_META['seven-day-streak'];
  const relevant = events
    .filter((e) => e.type === 'capture' || e.type === 'status_change')
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const seenDays = new Set<string>();
  for (const event of relevant) {
    const day = toLocalDateString(new Date(event.timestamp));
    seenDays.add(day);
    if (seenDays.size >= 7) {
      return {
        id: 'seven-day-streak',
        ...meta,
        unlocked: true,
        unlockedAt: event.timestamp,
      };
    }
  }
  return { id: 'seven-day-streak', ...meta, unlocked: false };
}

function badgeFromFirstStatusChange(
  id: string,
  events: AppEvent[],
  toStatus: ApplicationStatus
): Badge {
  const meta = BADGE_META[id];
  const event = findFirstStatusChange(events, toStatus);
  return event
    ? { id, ...meta, unlocked: true, unlockedAt: event.timestamp }
    : { id, ...meta, unlocked: false };
}

/**
 * Pure function: derives the full badge list (unlocked and locked) from the
 * event log. Order returned is a sensible progression order, not unlock
 * order.
 */
export function computeBadges(events: AppEvent[]): Badge[] {
  return [
    badgeFromFirstStatusChange('first-application', events, 'applied'),
    badgeFromFirstStatusChange('first-interview', events, 'interviewing'),
    badgeFromFirstStatusChange('first-rejection', events, 'rejected'),
    badgeFromFirstStatusChange('first-offer', events, 'offer'),
    computeSevenDayStreakBadge(events),
  ];
}
