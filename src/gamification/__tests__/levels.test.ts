import { describe, expect, it } from 'vitest';
import { levelForXp } from '../levels';

describe('levelForXp', () => {
  it('is Level 1 at 0 XP', () => {
    expect(levelForXp(0)).toEqual({ level: 1, label: 'Level 1 Job Seeker' });
  });

  it('is Level 1 just under the threshold', () => {
    expect(levelForXp(99)).toEqual({ level: 1, label: 'Level 1 Job Seeker' });
  });

  it('rolls over to Level 2 at exactly 100 XP', () => {
    expect(levelForXp(100)).toEqual({ level: 2, label: 'Level 2 Job Seeker' });
  });

  it('is Level 4 at 300-399 XP', () => {
    expect(levelForXp(300)).toEqual({ level: 4, label: 'Level 4 Adventurer' });
    expect(levelForXp(399)).toEqual({ level: 4, label: 'Level 4 Adventurer' });
  });

  it('clamps negative XP to Level 1', () => {
    expect(levelForXp(-50)).toEqual({ level: 1, label: 'Level 1 Job Seeker' });
  });

  it('advances the flavor title through the level bands', () => {
    expect(levelForXp(0).label).toBe('Level 1 Job Seeker');
    expect(levelForXp(200).label).toBe('Level 3 Adventurer');
    expect(levelForXp(400).label).toBe('Level 5 Quest Veteran');
    expect(levelForXp(600).label).toBe('Level 7 Guild Champion');
    expect(levelForXp(900).label).toBe('Level 10 Legendary Hunter');
  });
});
