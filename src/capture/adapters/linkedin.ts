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
  const currentUrl = doc.location.href;
  if (!currentUrl) return null;

  function firstText(selectors: string[]): string {
    for (const selector of selectors) {
      const text = doc.querySelector(selector)?.textContent?.trim();
      if (text) return text;
    }
    return '';
  }

  function extractJobId(href: string): string | null {
    const match = href.match(/\/jobs\/view\/(\d+)/);
    return match ? match[1] : null;
  }

  // Primary strategy: on every LinkedIn layout we've actually inspected
  // (search-results with a side detail panel, job collections), the job
  // title itself is rendered as a link straight to the canonical
  // /jobs/view/<id> URL. LinkedIn's own CSS classes here are build-hashed
  // (e.g. "_69ebbc25") and change across deploys/layouts, so matching by
  // href pattern is far more durable than matching by class name — which
  // is what silently failed before this fix.
  const roleLink = doc.querySelector<HTMLAnchorElement>('a[href*="/jobs/view/"]');

  let role = '';
  let company = '';
  let jobId: string | null = null;

  if (roleLink) {
    role = roleLink.textContent?.trim() ?? '';
    jobId = extractJobId(roleLink.href);

    // The company link lives in the same "top card" as the title, but the
    // page can contain many other /company/ links (other postings in a
    // results list, "people who work here" sections). Rather than one
    // global query, walk up from the title looking for the nearest
    // ancestor whose subtree contains a company link — that scopes the
    // search to this job's card specifically.
    let ancestor: Element | null = roleLink.parentElement;
    for (let i = 0; i < 6 && ancestor && !company; i++) {
      const companyLink = ancestor.querySelector<HTMLAnchorElement>(
        'a[href*="linkedin.com/company/"]'
      );
      if (companyLink) company = companyLink.textContent?.trim() ?? '';
      ancestor = ancestor.parentElement;
    }
  }

  // Fallbacks for layouts without a title link (e.g. some standalone
  // /jobs/view/ pages render the title as a plain heading rather than a
  // self-link). Kept as a last resort, not the primary strategy — these
  // guessed class names are exactly what broke on the layout above.
  if (!role) {
    role = firstText([
      '.job-details-jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title',
      '.top-card-layout__title',
      'h1',
    ]);
  }
  if (!company) {
    company = firstText([
      '.job-details-jobs-unified-top-card__company-name a',
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name',
      '.topcard__org-name-link',
      '.topcard__flavor a',
    ]);
  }

  // Prefer a clean canonical permalink over the raw current URL, which on
  // search-results/collections pages is a long tracking-param-laden query
  // string, not a usable link back to this specific posting.
  if (!jobId) {
    try {
      jobId = new URL(currentUrl).searchParams.get('currentJobId') ?? extractJobId(currentUrl);
    } catch {
      jobId = null;
    }
  }
  const url = jobId ? `https://www.linkedin.com/jobs/view/${jobId}/` : currentUrl;

  return { company, role, url };
}
