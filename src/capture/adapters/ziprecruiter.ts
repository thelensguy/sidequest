import type { ExtractedJob } from './types';

export const source = 'ziprecruiter' as const;

export function matches(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('ziprecruiter.com');
  } catch {
    return false;
  }
}

/**
 * IMPORTANT: this function is injected into the target page via
 * `chrome.scripting.executeScript({ func: extract })` (see
 * `src/capture/capture.ts`) — must stay fully self-contained, same
 * constraint explained in linkedin.ts's extract(). No calls out to
 * module-level helpers; everything lives inside this function body.
 *
 * Verified against a live jobseeker/home page: ZipRecruiter's personalized
 * feed renders "view posting" as a client-side `[role="dialog"]` overlay —
 * not a real navigation and not a native <dialog> element, so
 * doc.title/doc.location never update to match the open posting, and
 * there's no JSON-LD JobPosting schema on this view to lean on instead.
 * Every job card in the background list shares the *exact same* title and
 * company-link classes as the one in the open panel, so a page-wide
 * selector would grab whichever card happens to come first in the DOM —
 * extraction has to be scoped inside the dialog specifically.
 *
 * `role="dialog"` isn't unique to the job panel, either — testing against
 * a live page turned up an account/settings popover using the same role,
 * sitting earlier in the DOM than the job dialog, so a bare
 * `querySelector('[role="dialog"]')` grabbed that instead. Narrowed here
 * to a dialog that's actually visible AND looks like a job posting
 * specifically (has a heading and a company-page link) — a settings
 * dialog wouldn't have both.
 *
 * A second, separate layout exists — the two-pane search-results page
 * (`/jobs-search?...`; list left, selected job's detail rendered inline
 * right, no dialog at all). Verified against a live page: every job title
 * on the page (in every list card, selected or not) appears twice —
 * ZipRecruiter renders both a mobile and desktop variant of each card and
 * toggles visibility with a CSS breakpoint, not a "list vs. detail pane"
 * duplication — so scoping still has to happen structurally. There's a
 * reliable "Job description" section heading inside the detail pane;
 * walking up from it and stopping at the ancestor just before the
 * heading count jumps sharply (crossing over into the sibling job list,
 * which carries dozens of headings from every list card) isolates the
 * pane itself. Its first <h2> is the title — the only other <h2> in
 * there is "Job description" itself, always later in DOM order — and its
 * first /co/ link is the company, same first-match-in-scope pattern as
 * the dialog case above.
 *
 * The tab's own URL (an encoded `?jk=`/`?lk=` param on either layout)
 * still works as a deep link back to this posting even though it's ugly,
 * so it's used as-is rather than trying to construct a cleaner one.
 */
export function extract(doc: Document = document): ExtractedJob | null {
  const url = doc.location.href;
  if (!url) return null;

  let panel: HTMLElement | null = null;
  for (const candidate of doc.querySelectorAll<HTMLElement>('[role="dialog"]')) {
    const isVisible = candidate.offsetParent !== null;
    const hasHeading = candidate.querySelector('h2') !== null;
    const hasCompanyLink = candidate.querySelector('a[href*="/co/"]') !== null;
    if (isVisible && hasHeading && hasCompanyLink) {
      panel = candidate;
      break;
    }
  }
  if (panel) {
    const role = panel.querySelector('h2')?.textContent?.trim() ?? '';
    if (role) {
      const company =
        panel.querySelector<HTMLAnchorElement>('a[href*="/co/"]')?.textContent?.trim() ?? '';
      return { role, company, url };
    }
  }

  const headings = Array.from(doc.querySelectorAll('h1, h2, h3'));
  const jobDescHeading = headings.find((h) =>
    h.textContent?.trim().toLowerCase().startsWith('job description')
  );
  if (jobDescHeading?.parentElement) {
    let container: HTMLElement = jobDescHeading.parentElement;
    let prevCount = container.querySelectorAll('h1, h2, h3').length;
    let ancestor = container.parentElement;
    for (let i = 0; i < 14 && ancestor; i++) {
      const count = ancestor.querySelectorAll('h1, h2, h3').length;
      if (count - prevCount > 15) break;
      container = ancestor;
      prevCount = count;
      ancestor = ancestor.parentElement;
    }

    const role = container.querySelector('h2')?.textContent?.trim() ?? '';
    if (role) {
      const company =
        container.querySelector<HTMLAnchorElement>('a[href*="/co/"]')?.textContent?.trim() ?? '';
      return { role, company, url };
    }
  }

  return null;
}
