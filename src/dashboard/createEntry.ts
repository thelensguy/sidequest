import { addJobEntry, appendEvent } from '../lib/storage';
import type { ApplicationStatus, JobEntry } from '../lib/types';
import { generateId } from './id';

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

  const entry: JobEntry = {
    id: generateId(),
    company: input.company,
    role: input.role,
    url: input.url,
    status: input.status,
    dateAdded: input.dateAdded,
    lastUpdated: now,
    source: eventType === 'import' ? 'import' : 'manual',
  };

  await addJobEntry(entry);
  await appendEvent({
    id: generateId(),
    type: eventType,
    jobEntryId: entry.id,
    timestamp: now,
  });

  return entry;
}
