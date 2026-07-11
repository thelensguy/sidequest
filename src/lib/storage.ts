import type { AppEvent, JobEntry } from './types';

const KEYS = {
  jobEntries: 'jobEntries',
  appEvents: 'appEvents',
  treats: 'treats',
} as const;

const DEFAULT_TREATS = ['Get boba', 'Watch an episode', 'Take the afternoon off'];

async function getLocal<T>(key: string, fallback: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as T) ?? fallback;
}

async function setLocal<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

// Job entries

export function getJobEntries(): Promise<JobEntry[]> {
  return getLocal<JobEntry[]>(KEYS.jobEntries, []);
}

export async function addJobEntry(entry: JobEntry): Promise<void> {
  const entries = await getJobEntries();
  entries.push(entry);
  await setLocal(KEYS.jobEntries, entries);
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

// Event log

export function getEvents(): Promise<AppEvent[]> {
  return getLocal<AppEvent[]>(KEYS.appEvents, []);
}

export async function appendEvent(event: AppEvent): Promise<void> {
  const events = await getEvents();
  events.push(event);
  await setLocal(KEYS.appEvents, events);
}

// Gamification settings

export function getTreats(): Promise<string[]> {
  return getLocal<string[]>(KEYS.treats, DEFAULT_TREATS);
}

export function setTreats(treats: string[]): Promise<void> {
  return setLocal(KEYS.treats, treats);
}
