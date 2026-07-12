import { getAdapterForUrl } from '../capture/adapters';
import type { ExtractedJob } from '../capture/adapters';

/**
 * Runs the site adapter's extract() against the current page, in-process
 * (no chrome.scripting.executeScript injection needed — a content script
 * already runs directly in the page's own context, unlike the popup which
 * has to inject one-shot from a different context).
 *
 * Wrapped in try/catch because an adapter's extract() assumes a certain
 * DOM shape that a site can always change or deviate from (a redesign, an
 * A/B test, a logged-out layout, ...). A throw here must not crash the
 * content script or block the review panel from opening — per the brief,
 * the panel should still open with empty, hand-fillable fields even when
 * extraction fails outright, same fallback spirit as the popup's manual
 * entry form.
 */
export function safeExtract(url: string, doc: Document): ExtractedJob | null {
  try {
    const adapter = getAdapterForUrl(url);
    return adapter.extract(doc);
  } catch {
    return null;
  }
}
