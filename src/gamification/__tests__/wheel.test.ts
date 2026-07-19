import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  applicationsUntilNextMilestone,
  deriveLastSpunCheckpoint,
  lastWonTreatLabel,
  pickWeightedTreat,
  shouldUnlockWheel,
} from '../wheel';
import { makeEvent, statusChange } from './testUtils';
import type { AppEvent } from '../../lib/types';
import type { LootTableEntry } from '../../lib/types';

function wheelSpin(treatLabel?: string): AppEvent {
  const event = makeEvent('wheel_spin');
  return treatLabel ? { ...event, metadata: { treatLabel } } : event;
}

describe('deriveLastSpunCheckpoint', () => {
  it('is 0 with no events', () => {
    expect(deriveLastSpunCheckpoint([])).toBe(0);
  });

  it('is 0 when no wheel_spin event exists', () => {
    expect(deriveLastSpunCheckpoint([statusChange('applied'), statusChange('rejected')])).toBe(0);
  });

  it('points just past the only wheel_spin event', () => {
    const events = [statusChange('applied'), wheelSpin(), statusChange('rejected')];
    expect(deriveLastSpunCheckpoint(events)).toBe(2);
  });

  it('uses the most recent wheel_spin when there are several', () => {
    const events = [wheelSpin(), statusChange('applied'), wheelSpin(), statusChange('rejected')];
    expect(deriveLastSpunCheckpoint(events)).toBe(3);
  });

  it('locks the wheel immediately after a spin (checkpoint covers everything before it)', () => {
    const events = [statusChange('rejected'), wheelSpin()];
    expect(shouldUnlockWheel(events, deriveLastSpunCheckpoint(events))).toBe(false);
  });

  it('a new rejection after the spin re-unlocks the wheel', () => {
    const events = [
      statusChange('rejected', undefined, undefined, 'job-1'),
      wheelSpin(),
      statusChange('rejected', undefined, undefined, 'job-2'),
    ];
    expect(shouldUnlockWheel(events, deriveLastSpunCheckpoint(events))).toBe(true);
  });
});

describe('lastWonTreatLabel', () => {
  it('is null when never spun', () => {
    expect(lastWonTreatLabel([statusChange('applied')])).toBeNull();
  });

  it('returns the most recent spin\'s treat', () => {
    const events = [wheelSpin('Get boba'), statusChange('applied'), wheelSpin('Take a walk')];
    expect(lastWonTreatLabel(events)).toBe('Take a walk');
  });

  it('is null for a spin recorded without a treat', () => {
    expect(lastWonTreatLabel([wheelSpin()])).toBeNull();
  });
});

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

describe('pickWeightedTreat', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const LOOT: LootTableEntry[] = [
    { id: 'boba', label: 'Get boba', tier: 'common', weight: 40 },
    { id: 'episode', label: 'Watch an episode', tier: 'common', weight: 35 },
    { id: 'afternoon', label: 'Take the afternoon off', tier: 'rare', weight: 15 },
    { id: 'daytrip', label: 'Plan a day trip', tier: 'epic', weight: 6 },
    { id: 'splurge', label: 'Treat yourself to something nice', tier: 'epic', weight: 4 },
  ];

  it('returns null for an empty table', () => {
    expect(pickWeightedTreat([])).toBeNull();
  });

  it('returns null when all weights sum to <= 0', () => {
    expect(pickWeightedTreat([{ id: 'a', label: 'A', tier: 'common', weight: 0 }])).toBeNull();
  });

  it('returns the only entry when there is exactly one', () => {
    const entries: LootTableEntry[] = [{ id: 'boba', label: 'Get boba', tier: 'common', weight: 1 }];
    expect(pickWeightedTreat(entries)).toEqual(entries[0]);
  });

  it('picks deterministically based on Math.random, respecting weight order', () => {
    // total weight = 100. r = 0.5 * 100 = 50, which lands past 'boba' (40)
    // into 'episode' (40 + 35 = 75 >= 50).
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(pickWeightedTreat(LOOT)?.id).toBe('episode');
  });

  it('picks the first entry when Math.random returns 0', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickWeightedTreat(LOOT)?.id).toBe('boba');
  });

  it('picks the last entry when Math.random returns just under 1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9999999);
    expect(pickWeightedTreat(LOOT)?.id).toBe('splurge');
  });

  it('only ever returns an entry from the input table', () => {
    for (let i = 0; i < 20; i++) {
      const picked = pickWeightedTreat(LOOT);
      expect(LOOT.map((e) => e.id)).toContain(picked?.id);
    }
  });

  it('sanity-checks distribution roughly matches weight over many trials', () => {
    // Heavier-weighted entries should come up meaningfully more often than
    // lighter ones over a large sample — not an exact statistical test,
    // just a guard against an inverted or broken weighting algorithm.
    const counts: Record<string, number> = {};
    const trials = 5000;
    for (let i = 0; i < trials; i++) {
      const picked = pickWeightedTreat(LOOT);
      if (picked) counts[picked.id] = (counts[picked.id] ?? 0) + 1;
    }
    // 'boba' (weight 40) should come up far more often than 'splurge' (weight 4).
    expect(counts.boba).toBeGreaterThan(counts.splurge * 3);
    // Every entry should show up at least once in 5000 trials.
    for (const entry of LOOT) {
      expect(counts[entry.id]).toBeGreaterThan(0);
    }
  });
});

describe('applicationsUntilNextMilestone', () => {
  it('is 5 with no events', () => {
    expect(applicationsUntilNextMilestone([], 0)).toBe(5);
  });

  it('is 5 right after a spin, before any new applications', () => {
    const events = [statusChange('applied')];
    expect(applicationsUntilNextMilestone(events, events.length)).toBe(5);
  });

  it('counts down as distinct entries reach applied since the last spin', () => {
    const events = Array.from({ length: 3 }, (_, i) => statusChange('applied', undefined, undefined, `job-${i}`));
    expect(applicationsUntilNextMilestone(events, 0)).toBe(2);
  });

  it('does not count applications that happened before the last spin checkpoint', () => {
    const events = [
      statusChange('applied', undefined, undefined, 'job-0'),
      statusChange('applied', undefined, undefined, 'job-1'),
      statusChange('applied', undefined, undefined, 'job-2'),
    ];
    // Spun after the first two — only job-2 counts toward the new countdown.
    expect(applicationsUntilNextMilestone(events, 2)).toBe(4);
  });

  it('wraps back to 5 once a multiple of 5 is crossed', () => {
    const events = Array.from({ length: 5 }, (_, i) => statusChange('applied', undefined, undefined, `job-${i}`));
    expect(applicationsUntilNextMilestone(events, 0)).toBe(5);
  });

  it('does not count repeated toggles on the same entry (farming guard)', () => {
    const events = [
      statusChange('applied', undefined, 'saved', 'job-1'),
      statusChange('interviewing', undefined, 'applied', 'job-1'),
      statusChange('applied', undefined, 'interviewing', 'job-1'),
    ];
    expect(applicationsUntilNextMilestone(events, 1)).toBe(5);
  });

  it('clamps an out-of-range lastSpunAtEventCount instead of throwing', () => {
    const events = [statusChange('applied')];
    expect(() => applicationsUntilNextMilestone(events, 999)).not.toThrow();
    expect(() => applicationsUntilNextMilestone(events, -5)).not.toThrow();
  });
});
