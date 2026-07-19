import { addJobEntries, addJobEntry, appendEvent, appendEvents } from '../lib/storage';
import type { ApplicationStatus, JobEntry } from '../lib/types';

export interface NewJobEntryInput {
  company: string;
  role: string;
  url: string;
  status: ApplicationStatus;
  /** ISO 8601 timestamp */
  dateAdded: string;
}

/**
 * Single creation path shared by the "Add entry" form and the bulk-import
 * parser — both are just manually-entered JobEntry records, differing only
 * in how the fields were gathered (typed vs. pasted) and which AppEvent
 * type they log.
 */
export async function createJobEntry(
  input: NewJobEntryInput,
  eventType: 'manual_add' | 'import'
): Promise<JobEntry> {
  const now = new Date().toISOString();

  const entry = await addJobEntry({
    company: input.company,
    role: input.role,
    url: input.url,
    status: input.status,
    dateAdded: input.dateAdded,
    lastUpdated: now,
    source: eventType === 'import' ? 'import' : 'manual',
  });

  await appendEvent({
    type: eventType,
    jobEntryId: entry.id,
    timestamp: now,
  });

  return entry;
}

/**
 * Bulk counterpart to createJobEntry, for the paste-a-spreadsheet import:
 * all rows land in two storage writes (entries, then their events) instead
 * of a full read-modify-write of the growing array per row.
 */
export async function createJobEntries(
  inputs: NewJobEntryInput[],
  eventType: 'manual_add' | 'import'
): Promise<JobEntry[]> {
  if (inputs.length === 0) return [];
  const now = new Date().toISOString();

  const entries = await addJobEntries(
    inputs.map((input) => ({
      company: input.company,
      role: input.role,
      url: input.url,
      status: input.status,
      dateAdded: input.dateAdded,
      lastUpdated: now,
      source: eventType === 'import' ? ('import' as const) : ('manual' as const),
    }))
  );

  await appendEvents(
    entries.map((entry) => ({
      type: eventType,
      jobEntryId: entry.id,
      timestamp: now,
    }))
  );

  return entries;
}
