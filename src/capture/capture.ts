import type { JobEntrySource } from '../lib/types';
import { getAdapterForUrl, type ExtractedJob } from './adapters';

export type { ExtractedJob } from './adapters';

export interface ActiveTabInfo {
  tabId: number;
  url: string;
  title: string;
}

/**
 * Reads the currently active tab in the current window. Requires the
 * `activeTab` permission (already declared in manifest.config.ts) — it's
 * granted for the duration the popup is open because opening the popup
 * itself is the user gesture that activates it.
 */
export async function getActiveTab(): Promise<ActiveTabInfo> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    throw new Error('Could not find an active tab to capture from.');
  }
  return { tabId: tab.id, url: tab.url, title: tab.title ?? '' };
}

/**
 * Picks the right adapter for the tab's URL and injects its extract()
 * function into the page via chrome.scripting.executeScript. Returns
 * whatever the adapter found (possibly incomplete/null fields) plus the
 * JobEntrySource that should be recorded if the capture is saved as-is.
 */
export async function captureFromTab(
  tab: ActiveTabInfo
): Promise<{ job: ExtractedJob | null; source: JobEntrySource }> {
  const adapter = getAdapterForUrl(tab.url);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.tabId },
    func: adapter.extract,
  });
  const job = (results[0]?.result as ExtractedJob | null | undefined) ?? null;
  return { job, source: adapter.source };
}

/**
 * A capture only counts as "complete" (safe to save without asking the
 * user anything) when all three fields came back non-empty. Anything
 * else — null result, or any blank field — should route through the
 * manual-entry fallback in the popup.
 */
export function isCompleteJob(job: ExtractedJob | null): job is ExtractedJob {
  return (
    !!job &&
    job.company.trim().length > 0 &&
    job.role.trim().length > 0 &&
    job.url.trim().length > 0
  );
}
