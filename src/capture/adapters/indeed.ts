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
  const url = doc.location.href;
  if (!url) return null;

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
