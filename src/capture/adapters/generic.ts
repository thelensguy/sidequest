import type { ExtractedJob } from './types';

export const source = 'generic' as const;

/**
 * Fallback adapter — matches every URL. `adapters/index.ts` tries the
 * site-specific adapters first and only reaches this one if none of
 * them matched the tab's hostname.
 */
export function matches(_url: string): boolean {
  return true;
}

/**
 * Injected into the target page via chrome.scripting.executeScript — must
 * stay fully self-contained (no references to module-level bindings).
 * See the longer explanation in linkedin.ts's extract().
 *
 * There's no reliable DOM selector for "company" on an arbitrary site, so
 * this just reads document.title and location.href (per the v1 spec) and
 * makes a best-effort attempt to split a "Role at Company" / "Role -
 * Company" style title into role/company. When that heuristic doesn't
 * find a clean split, company is left blank and role falls back to the
 * full title — the popup treats a blank company as an incomplete capture
 * and prompts the user to fill it in by hand rather than guess wrong.
 */
export function extract(doc: Document = document): ExtractedJob | null {
  const title = doc.title.trim();
  const url = doc.location.href;
  if (!title || !url) return null;

  const separators = [/ at /i, / \| /, / - /];
  for (const separator of separators) {
    const [rolePart, companyPart] = title.split(separator);
    if (rolePart?.trim() && companyPart?.trim()) {
      return { role: rolePart.trim(), company: companyPart.trim(), url };
    }
  }

  return { role: title, company: '', url };
}
