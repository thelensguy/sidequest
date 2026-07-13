import { getAdapterForUrl } from '../capture/adapters';
import type { CaptureSite } from '../lib/types';

/**
 * Which of the three supported job sites the current page is on, or null.
 * Reuses the same adapter dispatch the capture pipeline already has,
 * rather than a second hand-maintained hostname list — if a new site
 * adapter is ever added, this stays in sync automatically. In practice
 * this content script only ever runs on these three domains anyway (see
 * manifest.config.ts's content_scripts matches), so null is defensive,
 * not an expected case.
 */
export function getCurrentCaptureSite(url: string = location.href): CaptureSite | null {
  const source = getAdapterForUrl(url).source;
  return source === 'linkedin' || source === 'indeed' || source === 'ziprecruiter' ? source : null;
}
