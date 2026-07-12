import type { ApplicationStatus } from '../lib/types';
import type { NewJobEntryInput } from './createEntry';
import { localDateOnlyToIso } from './dateUtils';
import { validateJobUrl } from './urlValidation';

const STATUS_VALUES: ApplicationStatus[] = [
  'saved',
  'applied',
  'interviewing',
  'rejected',
  'offer',
];

function normalizeStatus(raw: string): ApplicationStatus | null {
  const normalized = raw.trim().toLowerCase();
  return STATUS_VALUES.includes(normalized as ApplicationStatus)
    ? (normalized as ApplicationStatus)
    : null;
}

function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    // Missing date is fine — default to "now" rather than rejecting the row.
    return new Date().toISOString();
  }

  // Strict "YYYY-MM-DD" (the common spreadsheet-export shape, and what our
  // own date input produces) must be parsed as LOCAL midnight — never via
  // `new Date(dateOnlyString)`, which the spec parses as UTC midnight and
  // then shifts a day early once displayed in a US timezone.
  const isoDateOnly = localDateOnlyToIso(trimmed);
  if (isoDateOnly) return isoDateOnly;

  // Fall back to generic parsing for other formats (e.g. "6/1/2026"),
  // which browsers parse as local time rather than UTC.
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export interface ParseRowError {
  line: number;
  raw: string;
  message: string;
}

export interface ParseImportResult {
  rows: NewJobEntryInput[];
  errors: ParseRowError[];
}

/**
 * Parses pasted bulk-import text into JobEntry-shaped rows.
 * Each line: company, role, url, status, date — separated by tabs
 * (e.g. pasted from a spreadsheet) or commas.
 */
export function parseBulkImport(text: string): ParseImportResult {
  const rows: NewJobEntryInput[] = [];
  const errors: ParseRowError[] = [];

  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return; // skip blank lines silently

    const delimiter = trimmedLine.includes('\t') ? '\t' : ',';
    const fields = trimmedLine.split(delimiter).map((f) => f.trim());

    const [company, role, url, statusRaw, dateRaw] = fields;
    const lineNumber = index + 1;

    if (!company || !role) {
      errors.push({
        line: lineNumber,
        raw: line,
        message: 'Missing company or role',
      });
      return;
    }

    const status = statusRaw ? normalizeStatus(statusRaw) : 'saved';
    if (!status) {
      errors.push({
        line: lineNumber,
        raw: line,
        message: `Unrecognized status "${statusRaw}" — expected one of ${STATUS_VALUES.join(', ')}`,
      });
      return;
    }

    const dateAdded = normalizeDate(dateRaw ?? '');
    if (!dateAdded) {
      errors.push({
        line: lineNumber,
        raw: line,
        message: `Unrecognized date "${dateRaw}"`,
      });
      return;
    }

    const safeUrl = validateJobUrl(url ?? '');
    if (safeUrl === null) {
      errors.push({
        line: lineNumber,
        raw: line,
        message: `Unsafe or invalid URL "${url}" — only http(s) links are allowed`,
      });
      return;
    }

    rows.push({
      company,
      role,
      url: safeUrl,
      status,
      dateAdded,
    });
  });

  return { rows, errors };
}
