import type { ExtractedJob } from './types';

export const source = 'indeed' as const;

export function matches(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('indeed.com');
  } catch {
    return false;
  }
}

/**
 * Injected into the target page via chrome.scripting.executeScript — must
 * stay fully self-contained (no references to module-level bindings).
 * See the longer explanation in linkedin.ts's extract().
 */
export function extract(doc: Document = document): ExtractedJob | null {
  const currentUrl = doc.location.href;
  if (!currentUrl) return null;

  // Prefer a clean canonical permalink over the raw current URL — same
  // reasoning as linkedin.ts. On Indeed's search-results pages the posting
  // being viewed is identified by the `vjk` query param (`jk` on /viewjob
  // pages); the rest is a long tracking-laden search query that may not
  // even reopen the same posting later.
  let url = currentUrl;
  try {
    const parsed = new URL(currentUrl);
    const jobKey = parsed.searchParams.get('jk') ?? parsed.searchParams.get('vjk');
    if (jobKey) url = `https://www.indeed.com/viewjob?jk=${jobKey}`;
  } catch {
    // Unparseable URL — keep the raw one rather than dropping the capture.
  }

  function firstText(selectors: string[]): string {
    for (const selector of selectors) {
      const text = doc.querySelector(selector)?.textContent?.trim();
      if (text) return text;
    }
    return '';
  }

  const role = firstText([
    '[data-testid="jobsearch-JobInfoHeader-title"]',
    '.jobsearch-JobInfoHeader-title',
    'h1.jobsearch-JobInfoHeader-title',
    'h1',
  ]);

  const company = firstText([
    '[data-testid="inlineHeader-companyName"]',
    '.jobsearch-CompanyInfoContainer a',
    '.jobsearch-CompanyInfoContainer',
    '.jobsearch-InlineCompanyRating a',
  ]);

  return { company, role, url };
}
