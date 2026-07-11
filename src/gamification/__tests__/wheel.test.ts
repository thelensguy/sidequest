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
    const events = Array.from({ length: 5 }, () => statusChange('applied'));
    // Spun after the 4th application; the 5th should unlock it.
    expect(shouldUnlockWheel(events, 4)).toBe(true);
  });

  it('does not unlock between application milestones', () => {
    const events = Array.from({ length: 4 }, () => statusChange('applied'));
    expect(shouldUnlockWheel(events, 3)).toBe(false);
  });

  it('unlocks on a level-up (crossing 100 XP)', () => {
    // Each 'applied' is +10 XP. 9 applied = 90 XP (Level 1). 10th tips to 100 XP (Level 2).
    const events = Array.from({ length: 10 }, () => statusChange('applied'));
    expect(shouldUnlockWheel(events, 9)).toBe(true);
  });

  it('does not unlock when XP grows but stays within the same level and no application milestone is crossed', () => {
    // 3 applied events = 30 XP (Level 1 the whole way), and 3 is not a multiple of 5.
    const events = Array.from({ length: 3 }, () => statusChange('applied'));
    expect(shouldUnlockWheel(events, 2)).toBe(false);
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
