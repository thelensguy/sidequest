import {
  APP_EVENT_TYPES,
  JOB_ENTRY_SOURCES,
  STATUS_ORDER,
  type AppEvent,
  type AppEventType,
  type ApplicationStatus,
  type JobEntry,
  type JobEntrySource,
} from './types';
import { validateJobUrl } from './urlValidation';

// An import file is fully attacker-controlled (a friend could be handed a
// crafted or corrupted export). These caps aren't tuned to any real export
// size — they just bound how much a single JSON file can force this tab to
// hold in memory/render, without getting in the way of any genuine export.
const MAX_ENTRIES = 20_000;
const MAX_STRING_LENGTH = 5_000;

export interface ExportData {
  jobEntries: JobEntry[];
  appEvents: AppEvent[];
}

export type ValidateExportResult = { data: ExportData } | { error: string };

function isBoundedString(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_STRING_LENGTH;
}

function isJobEntry(value: unknown): value is JobEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    isBoundedString(entry.id) &&
    isBoundedString(entry.company) &&
    isBoundedString(entry.role) &&
    isBoundedString(entry.url) &&
    // Reject anything except http(s)/blank the same way every other entry
    // point (AddEntryForm, bulk import, JobRow's inline edit) does — a
    // captured/typed `javascript:...` URL must never make it into storage
    // and later render as a live href in JobRow.
    validateJobUrl(entry.url as string) !== null &&
    STATUS_ORDER.includes(entry.status as ApplicationStatus) &&
    isBoundedString(entry.dateAdded) &&
    isBoundedString(entry.lastUpdated) &&
    isBoundedString(entry.source) &&
    JOB_ENTRY_SOURCES.includes(entry.source as JobEntrySource)
  );
}

function isAppEvent(value: unknown): value is AppEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  return (
    isBoundedString(event.id) &&
    isBoundedString(event.type) &&
    APP_EVENT_TYPES.includes(event.type as AppEventType) &&
    isBoundedString(event.jobEntryId) &&
    isBoundedString(event.timestamp)
  );
}

/**
 * Validates that parsed JSON (untrusted — could be any file the user picked,
 * hand-edited, or corrupted) matches the shape of a SideQuest export before
 * anything is written to storage. Returns the typed data on success, or an
 * error message naming what's wrong so the caller can show it inline.
 */
export function validateExportData(parsed: unknown): ValidateExportResult {
  if (typeof parsed !== 'object' || parsed === null) {
    return { error: 'Not a SideQuest export file — expected a JSON object.' };
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.jobEntries) || !Array.isArray(obj.appEvents)) {
    return { error: 'Not a SideQuest export file — missing jobEntries/appEvents arrays.' };
  }

  if (obj.jobEntries.length > MAX_ENTRIES || obj.appEvents.length > MAX_ENTRIES) {
    return { error: `Not a SideQuest export file — more than ${MAX_ENTRIES} entries.` };
  }

  if (!obj.jobEntries.every(isJobEntry)) {
    return {
      error: 'Not a SideQuest export file — one or more job entries are missing required fields, have an invalid status/URL, or have a field that is too long.',
    };
  }

  if (!obj.appEvents.every(isAppEvent)) {
    return { error: 'Not a SideQuest export file — one or more events are missing required fields.' };
  }

  return { data: { jobEntries: obj.jobEntries, appEvents: obj.appEvents } };
}
