/**
 * Tracks the event-count "checkpoint" the reward wheel was last spun at, so
 * shouldUnlockWheel() (in wheel.ts) can tell what's happened *since* the
 * last spin.
 *
 * This is the one file in src/gamification/ that touches chrome.* — every
 * other file here (xp.ts, levels.ts, badges.ts, wheel.ts) is a pure
 * function of AppEvent[], per CLAUDE.md's "pure functions only" rule for
 * this folder. This piece of state doesn't fit that mold: it's UI
 * bookkeeping ("did the user already claim this milestone's spin?"), not
 * derived game data, so it can't be recomputed from the event log the way
 * XP/levels/badges can.
 *
 * It intentionally does NOT live in src/lib/storage.ts. That file is owned
 * by another part of the app and its instructions are to only ever read
 * from it, not extend it with new keys/functions. So this uses
 * chrome.storage.local directly, under its own namespaced key, scoped
 * entirely to gamification concerns.
 */
const LAST_SPUN_KEY = 'gamification.lastSpunAtEventCount';

export async function getLastSpunAtEventCount(): Promise<number> {
  const result = await chrome.storage.local.get(LAST_SPUN_KEY);
  return (result[LAST_SPUN_KEY] as number) ?? 0;
}

export async function setLastSpunAtEventCount(count: number): Promise<void> {
  await chrome.storage.local.set({ [LAST_SPUN_KEY]: count });
}

// Known, accepted gap: this read-then-write has no compare-and-swap. If two
// extension pages are open at once (e.g. Options and the dashboard) and both
// read the same stale checkpoint before either writes, both could let the
// user spin for what's really one milestone. Given this is a single-user,
// local-only extension (per PRD.md), that's judged an acceptable tradeoff
// rather than something worth adding real synchronization for — flagged
// here so it stays a conscious call, not a silent one.
