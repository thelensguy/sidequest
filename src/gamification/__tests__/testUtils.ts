import type { AppEvent, AppEventType, ApplicationStatus } from '../../lib/types';

let idCounter = 0;

/**
 * Builds a mock AppEvent for tests. Keeps callers terse — most tests only
 * care about `type`, `metadata.toStatus`, and sometimes `timestamp`.
 */
export function makeEvent(
  type: AppEventType,
  opts: {
    jobEntryId?: string;
    timestamp?: string;
    fromStatus?: ApplicationStatus;
    toStatus?: ApplicationStatus;
  } = {}
): AppEvent {
  idCounter += 1;
  return {
    id: `evt-${idCounter}`,
    type,
    jobEntryId: opts.jobEntryId ?? 'job-1',
    timestamp: opts.timestamp ?? `2026-01-${String((idCounter % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
    metadata:
      opts.fromStatus || opts.toStatus
        ? { fromStatus: opts.fromStatus, toStatus: opts.toStatus }
        : undefined,
  };
}

export function statusChange(
  toStatus: ApplicationStatus,
  timestamp?: string,
  fromStatus?: ApplicationStatus
): AppEvent {
  return makeEvent('status_change', { toStatus, fromStatus, timestamp });
}
