/**
 * Date-only ("YYYY-MM-DD") handling, kept separate from full timestamps.
 *
 * `new Date("YYYY-MM-DD")` is parsed as UTC midnight per the ES spec, but
 * `.toLocaleDateString()` renders in the browser's local timezone — for any
 * timezone behind UTC (all of the US), that silently shifts the displayed
 * calendar day back by one. The fix is to never round-trip a date-only
 * string through UTC-based parsing: always build/read the Date using its
 * local year/month/day components instead.
 */

/** Today's date as a local "YYYY-MM-DD" string — matches what a native
 *  `<input type="date">` expects/displays, with no UTC conversion. */
export function todayLocalDateString(): string {
  return toLocalDateString(new Date());
}

export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses a strict "YYYY-MM-DD" date-only string as LOCAL midnight (not UTC
 * midnight) and returns it as an ISO 8601 timestamp suitable for storage.
 * Returns null if the string isn't in that shape, or isn't a real calendar
 * date (e.g. "2026-02-30").
 */
export function localDateOnlyToIso(dateOnly: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  // Guards against JS's rollover behavior (e.g. Feb 30 -> Mar 2).
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date.toISOString();
}
