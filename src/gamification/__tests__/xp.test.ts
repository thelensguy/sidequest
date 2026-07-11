import { describe, expect, it } from 'vitest';
import { computeXp } from '../xp';
import { makeEvent, statusChange } from './testUtils';

describe('computeXp', () => {
  it('returns 0 for no events', () => {
    expect(computeXp([])).toBe(0);
  });

  it('awards +5 for capture events', () => {
    expect(computeXp([makeEvent('capture')])).toBe(5);
  });

  it('awards +5 for manual_add events', () => {
    expect(computeXp([makeEvent('manual_add')])).toBe(5);
  });

  it('awards +5 for import events', () => {
    expect(computeXp([makeEvent('import')])).toBe(5);
  });

  it('awards +10 for status_change to applied', () => {
    expect(computeXp([statusChange('applied')])).toBe(10);
  });

  it('awards +20 for status_change to interviewing', () => {
    expect(computeXp([statusChange('interviewing')])).toBe(20);
  });

  it('awards +15 (resilience XP) for status_change to rejected', () => {
    expect(computeXp([statusChange('rejected')])).toBe(15);
  });

  it('rejection XP is greater than the XP for merely applying', () => {
    const rejectedXp = computeXp([statusChange('rejected')]);
    const appliedXp = computeXp([statusChange('applied')]);
    expect(rejectedXp).toBeGreaterThan(appliedXp);
  });

  it('awards +50 for status_change to offer', () => {
    expect(computeXp([statusChange('offer')])).toBe(50);
  });

  it('awards 0 for status_change to saved (no forward progress)', () => {
    expect(computeXp([statusChange('saved')])).toBe(0);
  });

  it('sums XP across a mixed event history', () => {
    const events = [
      makeEvent('capture'), // +5
      statusChange('applied'), // +10
      statusChange('interviewing'), // +20
      statusChange('rejected'), // +15
      makeEvent('manual_add'), // +5
      statusChange('offer'), // +50
    ];
    expect(computeXp(events)).toBe(5 + 10 + 20 + 15 + 5 + 50);
  });

  it('does not mutate the input array', () => {
    const events = [makeEvent('capture'), statusChange('applied')];
    const copy = [...events];
    computeXp(events);
    expect(events).toEqual(copy);
  });
});
