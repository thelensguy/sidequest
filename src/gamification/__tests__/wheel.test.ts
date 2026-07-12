import { describe, expect, it, vi, afterEach } from 'vitest';
import { pickTreat, shouldUnlockWheel } from '../wheel';
import { statusChange } from './testUtils';

describe('shouldUnlockWheel', () => {
  it('is false with no events', () => {
    expect(shouldUnlockWheel([], 0)).toBe(false);
  });

  it('is false when nothing has happened since the last spin', () => {
    const events = [statusChange('applied')];
    expect(shouldUnlockWheel(events, events.length)).toBe(false);
  });

  it('unlocks on a new rejection since the last spin', () => {
    const events = [statusChange('applied'), statusChange('rejected')];
    expect(shouldUnlockWheel(events, 1)).toBe(true);
  });

  it('does not unlock for a rejection that happened before the last spin', () => {
    const events = [statusChange('rejected'), statusChange('applied')];
    // lastSpunAtEventCount = 2 means both events already accounted for.
    expect(shouldUnlockWheel(events, 2)).toBe(false);
  });

  it('unlocks every 5th application milestone', () => {
    // 5 DISTINCT job entries each reaching 'applied' — not the same job
    // toggled 5 times, which the farming-guard now correctly ignores.
    const events = Array.from({ length: 5 }, (_, i) => statusChange('applied', undefined, undefined, `job-${i}`));
    // Spun after the 4th application; the 5th should unlock it.
    expect(shouldUnlockWheel(events, 4)).toBe(true);
  });

  it('does not unlock between application milestones', () => {
    const events = Array.from({ length: 4 }, (_, i) => statusChange('applied', undefined, undefined, `job-${i}`));
    expect(shouldUnlockWheel(events, 3)).toBe(false);
  });

  it('unlocks on a level-up (crossing 100 XP)', () => {
    // Each distinct entry reaching 'applied' is +10 XP. 9 = 90 XP (Level 1). 10th tips to 100 XP (Level 2).
    const events = Array.from({ length: 10 }, (_, i) => statusChange('applied', undefined, undefined, `job-${i}`));
    expect(shouldUnlockWheel(events, 9)).toBe(true);
  });

  it('does not unlock when XP grows but stays within the same level and no application milestone is crossed', () => {
    // 3 distinct entries reaching 'applied' = 30 XP (Level 1 the whole way), and 3 is not a multiple of 5.
    const events = Array.from({ length: 3 }, (_, i) => statusChange('applied', undefined, undefined, `job-${i}`));
    expect(shouldUnlockWheel(events, 2)).toBe(false);
  });

  it('does not unlock by toggling one entry back and forth (farming guard)', () => {
    // Regression test: this exact pattern used to cross both the
    // every-5-applications milestone and the level-up milestone despite
    // being a single job entry with no real progress.
    const events = [
      statusChange('applied', undefined, 'saved'),
      statusChange('interviewing', undefined, 'applied'),
      statusChange('applied', undefined, 'interviewing'),
      statusChange('interviewing', undefined, 'applied'),
      statusChange('applied', undefined, 'interviewing'),
      statusChange('interviewing', undefined, 'applied'),
      statusChange('applied', undefined, 'interviewing'),
    ];
    // Spun right after the very first toggle — everything after is repeats
    // of statuses already reached on this one entry, so nothing new should
    // ever unlock the wheel again from this history.
    expect(shouldUnlockWheel(events, 2)).toBe(false);
  });

  it('a repeated rejection on the same entry does not re-unlock the wheel', () => {
    const events = [
      statusChange('rejected', undefined, 'applied', 'job-1'),
      statusChange('applied', undefined, 'rejected', 'job-1'),
      statusChange('rejected', undefined, 'applied', 'job-1'), // same entry, same status again
    ];
    // Spun after the first rejection (index 1) — the second rejection on
    // the same entry is a repeat, not a new milestone.
    expect(shouldUnlockWheel(events, 1)).toBe(false);
  });

  it('clamps an out-of-range lastSpunAtEventCount instead of throwing', () => {
    const events = [statusChange('applied')];
    expect(() => shouldUnlockWheel(events, 999)).not.toThrow();
    expect(shouldUnlockWheel(events, 999)).toBe(false);
    expect(() => shouldUnlockWheel(events, -5)).not.toThrow();
  });
});

describe('pickTreat', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an empty string for an empty list', () => {
    expect(pickTreat([])).toBe('');
  });

  it('returns the only treat when there is exactly one', () => {
    expect(pickTreat(['Get boba'])).toBe('Get boba');
  });

  it('picks deterministically based on Math.random', () => {
    const treats = ['Get boba', 'Watch an episode', 'Take the afternoon off'];
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // index 1 of 3
    expect(pickTreat(treats)).toBe('Watch an episode');
  });

  it('only ever returns a value from the input list', () => {
    const treats = ['A', 'B', 'C', 'D'];
    for (let i = 0; i < 20; i++) {
      expect(treats).toContain(pickTreat(treats));
    }
  });
});
