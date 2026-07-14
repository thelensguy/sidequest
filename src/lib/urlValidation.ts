/**
 * Restricts stored job-link URLs to http(s) so a pasted or typed
 * `javascript:...` (or `data:`, `file:`, etc.) string can never be stored
 * and later rendered as a live clickable `href` in JobRow.
 */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Returns a trimmed, safe URL string:
 *  - empty input -> '' (no link is fine)
 *  - valid http(s) URL -> the trimmed URL
 *  - anything else (bad protocol, unparseable) -> null, so callers can
 *    reject/flag it instead of silently storing it.
 */
export function validateJobUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    return ALLOWED_PROTOCOLS.has(parsed.protocol) ? trimmed : null;
  } catch {
    return null;
  }
}
