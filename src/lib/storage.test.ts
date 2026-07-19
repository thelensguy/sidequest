import { beforeEach, describe, expect, it } from 'vitest';
import {
  addJobEntries,
  appendEvents,
  getBubbleSettings,
  getEvents,
  getJobEntries,
  hideBubbleUntilRestart,
  isBubbleHiddenUntilRestart,
  setBubbleHiddenOnDomain,
  setBubbleSettings,
  setEvents,
  setJobEntries,
} from './storage';
import type { AppEvent, JobEntry } from './types';

/**
 * Minimal in-memory fake for chrome.storage.local/session — just enough
 * of get/set for storage.ts's getLocal/setLocal/getSession/setSession
 * helpers to run against. Fresh store per test via beforeEach, so tests
 * don't leak state into each other.
 */
function createFakeArea() {
  const store: Record<string, unknown> = {};
  return {
    get: (key: string) => Promise.resolve(key in store ? { [key]: store[key] } : {}),
    set: (items: Record<string, unknown>) => {
      Object.assign(store, items);
      return Promise.resolve();
    },
  };
}

beforeEach(() => {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: createFakeArea(),
      session: createFakeArea(),
    },
  };
});

describe('bubble settings (chrome.storage.local)', () => {
  it('returns defaults when nothing has been stored yet', async () => {
    expect(await getBubbleSettings()).toEqual({
      verticalPercent: 50,
      hiddenDomains: [],
      hiddenGlobally: false,
    });
  });

  it('merges partial updates onto the existing settings', async () => {
    await setBubbleSettings({ verticalPercent: 30 });
    const next = await setBubbleSettings({ hiddenGlobally: true });
    expect(next).toEqual({ verticalPercent: 30, hiddenDomains: [], hiddenGlobally: true });
  });

  it('adds a site to hiddenDomains without duplicating it', async () => {
    await setBubbleHiddenOnDomain('linkedin', true);
    const next = await setBubbleHiddenOnDomain('linkedin', true);
    expect(next.hiddenDomains).toEqual(['linkedin']);
  });

  it('removes a site from hiddenDomains, leaving others untouched', async () => {
    await setBubbleHiddenOnDomain('linkedin', true);
    await setBubbleHiddenOnDomain('indeed', true);
    const next = await setBubbleHiddenOnDomain('linkedin', false);
    expect(next.hiddenDomains).toEqual(['indeed']);
  });
});

describe('setJobEntries / setEvents (chrome.storage.local)', () => {
  it('replaces the full job entries list rather than merging', async () => {
    const first: JobEntry = {
      id: 'a',
      company: 'Acme',
      role: 'Engineer',
      url: '',
      status: 'saved',
      dateAdded: '2026-01-01T00:00:00.000Z',
      lastUpdated: '2026-01-01T00:00:00.000Z',
      source: 'manual',
    };
    await setJobEntries([first]);

    const second: JobEntry = { ...first, id: 'b', company: 'Globex' };
    await setJobEntries([second]);

    expect(await getJobEntries()).toEqual([second]);
  });

  it('replaces the full event log rather than merging', async () => {
    const first: AppEvent = {
      id: 'e1',
      type: 'manual_add',
      jobEntryId: 'a',
      timestamp: '2026-01-01T00:00:00.000Z',
    };
    await setEvents([first]);

    const second: AppEvent = { ...first, id: 'e2', jobEntryId: 'b' };
    await setEvents([second]);

    expect(await getEvents()).toEqual([second]);
  });
});

describe('addJobEntries / appendEvents (bulk append)', () => {
  const base: Omit<JobEntry, 'id'> = {
    company: 'Acme',
    role: 'Engineer',
    url: '',
    status: 'saved',
    dateAdded: '2026-01-01T00:00:00.000Z',
    lastUpdated: '2026-01-01T00:00:00.000Z',
    source: 'import',
  };

  it('appends all entries after the existing ones, generating ids', async () => {
    await setJobEntries([{ ...base, id: 'existing' }]);
    const added = await addJobEntries([
      { ...base, company: 'Globex' },
      { ...base, company: 'Initech' },
    ]);

    expect(added).toHaveLength(2);
    expect(added[0].id).toBeTruthy();
    expect(added[0].id).not.toBe(added[1].id);

    const all = await getJobEntries();
    expect(all.map((e) => e.company)).toEqual(['Acme', 'Globex', 'Initech']);
  });

  it('appends all events after the existing ones, generating ids', async () => {
    await setEvents([
      { id: 'e1', type: 'manual_add', jobEntryId: 'a', timestamp: '2026-01-01T00:00:00.000Z' },
    ]);
    const added = await appendEvents([
      { type: 'import', jobEntryId: 'b', timestamp: '2026-01-02T00:00:00.000Z' },
      { type: 'import', jobEntryId: 'c', timestamp: '2026-01-02T00:00:00.000Z' },
    ]);

    expect(added).toHaveLength(2);
    expect(added[0].id).not.toBe(added[1].id);

    const all = await getEvents();
    expect(all.map((e) => e.jobEntryId)).toEqual(['a', 'b', 'c']);
  });

  it('bulk-appending nothing leaves storage untouched', async () => {
    await setJobEntries([{ ...base, id: 'only' }]);
    expect(await addJobEntries([])).toEqual([]);
    expect((await getJobEntries()).map((e) => e.id)).toEqual(['only']);
  });
});

describe('bubble hidden-until-restart (chrome.storage.session)', () => {
  it('defaults to false', async () => {
    expect(await isBubbleHiddenUntilRestart()).toBe(false);
  });

  it('is true after hideBubbleUntilRestart(), independent of local storage', async () => {
    await hideBubbleUntilRestart();
    expect(await isBubbleHiddenUntilRestart()).toBe(true);
    // Session-scoped hide shouldn't touch the persisted local settings.
    expect(await getBubbleSettings()).toEqual({
      verticalPercent: 50,
      hiddenDomains: [],
      hiddenGlobally: false,
    });
  });
});
