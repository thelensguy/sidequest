/**
 * LEGACY read-only shim. Spins used to persist a "last spun at event count"
 * checkpoint under this chrome.storage.local key; spins are now recorded as
 * 'wheel_spin' events in the log itself and the checkpoint is derived from
 * there (deriveLastSpunCheckpoint in wheel.ts) — which also removed the
 * read-then-write race the old scheme documented, and made the checkpoint
 * survive export/import round-trips.
 *
 * This read exists only so an install that spun under the old scheme
 * doesn't see its wheel spuriously re-unlock after updating: until the
 * first new-style spin appends a wheel_spin event, the derived checkpoint
 * is 0 and callers fall back to this stored value. Once a wheel_spin event
 * exists, this is never consulted again.
 *
 * Still uses chrome.storage.local directly rather than src/lib/storage.ts,
 * for the same reason the old implementation did: that file is the shared
 * data contract, and this is gamification-scoped bookkeeping.
 */
const LAST_SPUN_KEY = 'gamification.lastSpunAtEventCount';

export async function getLegacyLastSpunAtEventCount(): Promise<number> {
  const result = await chrome.storage.local.get(LAST_SPUN_KEY);
  return (result[LAST_SPUN_KEY] as number) ?? 0;
}
