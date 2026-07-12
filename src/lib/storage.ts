import type { AppEvent, JobEntry, LootTableEntry } from './types';

const KEYS = {
  jobEntries: 'jobEntries',
  appEvents: 'appEvents',
  lootTable: 'lootTable',
} as const;

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

// Gamification settings

export function getLootTable(): Promise<LootTableEntry[]> {
  return getLocal<LootTableEntry[]>(KEYS.lootTable, DEFAULT_LOOT_TABLE);
}

export function setLootTable(entries: LootTableEntry[]): Promise<void> {
  return setLocal(KEYS.lootTable, entries);
}
