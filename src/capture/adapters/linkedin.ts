import type { ExtractedJob } from './types';

export const source = 'linkedin' as const;

export function matches(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('linkedin.com');
  } catch {
    return false;
  }
}

/**
 * IMPORTANT: this function is injected into the target page via
 * `chrome.scripting.executeScript({ func: extract })` (see
 * `src/capture/capture.ts`). Chrome serializes the function by its own
 * source text and re-runs it in an isolated world on the page — it does
 * NOT carry closures over anything defined outside this function body.
 * So everything this function needs (selector lists, helpers) must be
 * declared *inside* it; no calls out to module-level consts/helpers.
 *
 * The `doc: Document = document` default is what makes this work both
 * ways: when injected with no `args`, `doc` resolves to the target
 * page's own global `document`; when unit-tested directly, you can pass
 * a fake Document-like object in.
 */
export function extract(doc: Document = document): ExtractedJob | null {
  const url = doc.location.href;
  if (!url) return null;

  function firstText(selectors: string[]): string {
    for (const selector of selectors) {
      const text = doc.querySelector(selector)?.textContent?.trim();
      if (text) return text;
    }
    return '';
  }

  // LinkedIn ships a few different job-page layouts (logged-in "unified
  // top card" vs. the public/guest "top card") so we try several known
  // selectors before giving up on a field.
  const role = firstText([
    '.job-details-jobs-unified-top-card__job-title',
    '.jobs-unified-top-card__job-title',
    '.top-card-layout__title',
    'h1',
  ]);

  const company = firstText([
    '.job-details-jobs-unified-top-card__company-name a',
    '.job-details-jobs-unified-top-card__company-name',
    '.jobs-unified-top-card__company-name a',
    '.jobs-unified-top-card__company-name',
    '.topcard__org-name-link',
    '.topcard__flavor a',
  ]);

  return { company, role, url };
}
