import type {
  AppEvent,
  BubbleSettings,
  CaptureSite,
  JobEntry,
  LootTableEntry,
  ThemePreference,
} from './types';

const KEYS = {
  jobEntries: 'jobEntries',
  appEvents: 'appEvents',
  lootTable: 'lootTable',
  bubbleSettings: 'bubbleSettings',
  themePreference: 'themePreference',
  wheelCadence: 'wheelCadence',
} as const;

const SESSION_KEYS = {
  bubbleHiddenUntilRestart: 'bubbleHiddenUntilRestart',
} as const;

const DEFAULT_BUBBLE_SETTINGS: BubbleSettings = {
  verticalPercent: 50,
  hiddenDomains: [],
  hiddenGlobally: false,
};

const DEFAULT_THEME_PREFERENCE: ThemePreference = 'dark';

/**
 * Default weighted loot table, seeded the first time a user opens Options
 * or spins the wheel. Weights are relative, not percentages — see
 * pickWeightedTreat() in src/gamification/wheel.ts for how they're
 * normalized into odds.
 */
const DEFAULT_LOOT_TABLE: LootTableEntry[] = [
  { id: 'boba', label: 'Get boba', tier: 'common', weight: 40 },
  { id: 'episode', label: 'Watch an episode', tier: 'common', weight: 35 },
  { id: 'afternoon', label: 'Take the afternoon off', tier: 'rare', weight: 15 },
  { id: 'daytrip', label: 'Plan a day trip', tier: 'epic', weight: 6 },
  { id: 'splurge', label: 'Treat yourself to something nice', tier: 'epic', weight: 4 },
];

async function getLocal<T>(key: string, fallback: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as T) ?? fallback;
}

async function setLocal<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

/**
 * chrome.storage.session (not .local) — cleared when the browser fully
 * restarts, which is exactly the lifecycle "hide until next visit" needs:
 * it should survive a page refresh or opening a new tab, but shouldn't
 * require a trip to Options to come back.
 */
async function getSession<T>(key: string, fallback: T): Promise<T> {
  const result = await chrome.storage.session.get(key);
  return (result[key] as T) ?? fallback;
}

async function setSession<T>(key: string, value: T): Promise<void> {
  await chrome.storage.session.set({ [key]: value });
}

/** Single id generator so every JobEntry/AppEvent id is produced the same way. */
function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (shouldn't happen in
  // a real Chrome extension context, but keeps this safe to unit test anywhere).
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Job entries

export function getJobEntries(): Promise<JobEntry[]> {
  return getLocal<JobEntry[]>(KEYS.jobEntries, []);
}

export function setJobEntries(entries: JobEntry[]): Promise<void> {
  return setLocal(KEYS.jobEntries, entries);
}

/** Generates an id automatically if the caller doesn't supply one. */
export async function addJobEntry(
  entry: Omit<JobEntry, 'id'> & { id?: string }
): Promise<JobEntry> {
  const full: JobEntry = { ...entry, id: entry.id ?? generateId() };
  const entries = await getJobEntries();
  entries.push(full);
  await setLocal(KEYS.jobEntries, entries);
  return full;
}

/**
 * Appends many entries in one read + one write. Bulk import used to call
 * addJobEntry per row, which re-reads and re-writes the entire (growing)
 * array every time — O(n²) storage traffic for an n-row paste.
 */
export async function addJobEntries(
  inputs: Array<Omit<JobEntry, 'id'> & { id?: string }>
): Promise<JobEntry[]> {
  const added = inputs.map((entry) => ({ ...entry, id: entry.id ?? generateId() }));
  const entries = await getJobEntries();
  await setLocal(KEYS.jobEntries, [...entries, ...added]);
  return added;
}

export async function updateJobEntry(
  id: string,
  updates: Partial<Omit<JobEntry, 'id'>>
): Promise<void> {
  const entries = await getJobEntries();
  const next = entries.map((entry) =>
    entry.id === id ? { ...entry, ...updates } : entry
  );
  await setLocal(KEYS.jobEntries, next);
}

/**
 * Removes a JobEntry and every AppEvent logged against it. Cascading the
 * delete (rather than leaving orphaned events behind) matters because XP,
 * levels, and badges are derived from the event log — a bad capture left
 * un-cleaned would keep silently contributing XP after the entry itself
 * is gone.
 */
export async function deleteJobEntry(id: string): Promise<void> {
  const entries = await getJobEntries();
  await setLocal(
    KEYS.jobEntries,
    entries.filter((entry) => entry.id !== id)
  );
  const events = await getEvents();
  await setLocal(
    KEYS.appEvents,
    events.filter((event) => event.jobEntryId !== id)
  );
}

// Event log

export function getEvents(): Promise<AppEvent[]> {
  return getLocal<AppEvent[]>(KEYS.appEvents, []);
}

export function setEvents(events: AppEvent[]): Promise<void> {
  return setLocal(KEYS.appEvents, events);
}

/** Generates an id automatically if the caller doesn't supply one. */
export async function appendEvent(
  event: Omit<AppEvent, 'id'> & { id?: string }
): Promise<AppEvent> {
  const full: AppEvent = { ...event, id: event.id ?? generateId() };
  const events = await getEvents();
  events.push(full);
  await setLocal(KEYS.appEvents, events);
  return full;
}

/** Bulk counterpart to appendEvent — one read + one write, same as addJobEntries. */
export async function appendEvents(
  inputs: Array<Omit<AppEvent, 'id'> & { id?: string }>
): Promise<AppEvent[]> {
  const added = inputs.map((event) => ({ ...event, id: event.id ?? generateId() }));
  const events = await getEvents();
  await setLocal(KEYS.appEvents, [...events, ...added]);
  return added;
}

// Gamification settings

export function getLootTable(): Promise<LootTableEntry[]> {
  return getLocal<LootTableEntry[]>(KEYS.lootTable, DEFAULT_LOOT_TABLE);
}

export function setLootTable(entries: LootTableEntry[]): Promise<void> {
  return setLocal(KEYS.lootTable, entries);
}

// Capture bubble settings

export function getBubbleSettings(): Promise<BubbleSettings> {
  return getLocal<BubbleSettings>(KEYS.bubbleSettings, DEFAULT_BUBBLE_SETTINGS);
}

/** Merges partial updates onto the current settings — callers only pass what changed. */
export async function setBubbleSettings(
  updates: Partial<BubbleSettings>
): Promise<BubbleSettings> {
  const current = await getBubbleSettings();
  const next = { ...current, ...updates };
  await setLocal(KEYS.bubbleSettings, next);
  return next;
}

/**
 * Adds or removes a single site from hiddenDomains without the caller
 * having to read the current array first — used both by the bubble's own
 * hide menu (hidden: true) and the Options page toggles that reverse it
 * (hidden: false).
 */
export async function setBubbleHiddenOnDomain(
  site: CaptureSite,
  hidden: boolean
): Promise<BubbleSettings> {
  const current = await getBubbleSettings();
  const hiddenDomains = hidden
    ? current.hiddenDomains.includes(site)
      ? current.hiddenDomains
      : [...current.hiddenDomains, site]
    : current.hiddenDomains.filter((s) => s !== site);
  return setBubbleSettings({ hiddenDomains });
}

export function isBubbleHiddenUntilRestart(): Promise<boolean> {
  return getSession<boolean>(SESSION_KEYS.bubbleHiddenUntilRestart, false);
}

export function hideBubbleUntilRestart(): Promise<void> {
  return setSession(SESSION_KEYS.bubbleHiddenUntilRestart, true);
}

// Dashboard/Options theme

export function getThemePreference(): Promise<ThemePreference> {
  return getLocal<ThemePreference>(KEYS.themePreference, DEFAULT_THEME_PREFERENCE);
}

export function setThemePreference(theme: ThemePreference): Promise<void> {
  return setLocal(KEYS.themePreference, theme);
}

// Reward wheel cadence

export const DEFAULT_WHEEL_CADENCE = 5;

/** How many distinct applications between wheel-spin milestones (the "every N applications" rule). */
export function getWheelCadence(): Promise<number> {
  return getLocal<number>(KEYS.wheelCadence, DEFAULT_WHEEL_CADENCE);
}

export function setWheelCadence(cadence: number): Promise<void> {
  return setLocal(KEYS.wheelCadence, cadence);
}
