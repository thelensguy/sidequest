import { describe, expect, it } from 'vitest';
import { computeBadges } from '../badges';
import { makeEvent, statusChange } from './testUtils';

function badgeById(badges: ReturnType<typeof computeBadges>, id: string) {
  const badge = badges.find((b) => b.id === id);
  if (!badge) throw new Error(`badge ${id} not found`);
  return badge;
}

describe('computeBadges', () => {
  it('returns all badges locked for an empty event log', () => {
    const badges = computeBadges([]);
    expect(badges).toHaveLength(5);
    expect(badges.every((b) => !b.unlocked)).toBe(true);
  });

  it('unlocks first-application on the first status_change to applied', () => {
    const badges = computeBadges([statusChange('applied', '2026-01-01T00:00:00.000Z')]);
    const badge = badgeById(badges, 'first-application');
    expect(badge.unlocked).toBe(true);
    expect(badge.unlockedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('unlockedAt reflects the FIRST matching event, not the latest', () => {
    const badges = computeBadges([
      statusChange('applied', '2026-01-05T00:00:00.000Z'),
      statusChange('applied', '2026-01-01T00:00:00.000Z'), // earlier, out of order
      statusChange('applied', '2026-01-10T00:00:00.000Z'),
    ]);
    const badge = badgeById(badges, 'first-application');
    expect(badge.unlockedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('unlocks first-rejection on the first status_change to rejected', () => {
    const badges = computeBadges([statusChange('rejected', '2026-01-01T00:00:00.000Z')]);
    expect(badgeById(badges, 'first-rejection').unlocked).toBe(true);
  });

  it('unlocks first-interview on the first status_change to interviewing', () => {
    const badges = computeBadges([statusChange('interviewing', '2026-01-01T00:00:00.000Z')]);
    expect(badgeById(badges, 'first-interview').unlocked).toBe(true);
  });

  it('unlocks first-offer on the first status_change to offer', () => {
    const badges = computeBadges([statusChange('offer', '2026-01-01T00:00:00.000Z')]);
    expect(badgeById(badges, 'first-offer').unlocked).toBe(true);
  });

  it('does not unlock badges for unrelated status changes', () => {
    const badges = computeBadges([statusChange('saved', '2026-01-01T00:00:00.000Z')]);
    expect(badges.every((b) => !b.unlocked)).toBe(true);
  });

  it('does not unlock the 7-day streak badge with fewer than 7 distinct days', () => {
    const events = Array.from({ length: 6 }, (_, i) =>
      makeEvent('capture', { timestamp: `2026-01-0${i + 1}T00:00:00.000Z` })
    );
    const badges = computeBadges(events);
    expect(badgeById(badges, 'seven-day-streak').unlocked).toBe(false);
  });

  it('unlocks the 7-day streak badge on the 7th distinct calendar day, non-consecutive', () => {
    const days = ['01', '02', '05', '09', '10', '20', '28']; // gaps, still 7 distinct days
    const events = days.map((d) => makeEvent('capture', { timestamp: `2026-01-${d}T00:00:00.000Z` }));
    const badges = computeBadges(events);
    const badge = badgeById(badges, 'seven-day-streak');
    expect(badge.unlocked).toBe(true);
    expect(badge.unlockedAt).toBe('2026-01-28T00:00:00.000Z');
  });

  it('does not double count multiple events on the same day toward the streak', () => {
    const events = [
      makeEvent('capture', { timestamp: '2026-01-01T00:00:00.000Z' }),
      makeEvent('capture', { timestamp: '2026-01-01T12:00:00.000Z' }),
      makeEvent('capture', { timestamp: '2026-01-01T18:00:00.000Z' }),
      makeEvent('capture', { timestamp: '2026-01-02T00:00:00.000Z' }),
    ];
    const badges = computeBadges(events);
    // Only 2 distinct days so far, nowhere near 7.
    expect(badgeById(badges, 'seven-day-streak').unlocked).toBe(false);
  });

  it('counts status_change events (not just captures) toward the streak', () => {
    const days = ['01', '02', '03', '04', '05', '06', '07'];
    const events = days.map((d) => statusChange('applied', `2026-01-${d}T00:00:00.000Z`));
    const badges = computeBadges(events);
    expect(badgeById(badges, 'seven-day-streak').unlocked).toBe(true);
  });
});
