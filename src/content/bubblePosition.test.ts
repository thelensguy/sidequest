import { describe, expect, it } from 'vitest';
import { clampVerticalPercent, percentFromClientY } from './bubblePosition';

describe('clampVerticalPercent', () => {
  it('passes through values already inside the 5-95 range', () => {
    expect(clampVerticalPercent(50)).toBe(50);
  });

  it('clamps values below the minimum', () => {
    expect(clampVerticalPercent(-10)).toBe(5);
  });

  it('clamps values above the maximum', () => {
    expect(clampVerticalPercent(150)).toBe(95);
  });
});

describe('percentFromClientY', () => {
  it('converts a mouse Y position into a percentage of viewport height', () => {
    expect(percentFromClientY(400, 800)).toBe(50);
  });

  it('clamps the result so it never reaches the very top or bottom edge', () => {
    expect(percentFromClientY(0, 800)).toBe(5);
    expect(percentFromClientY(800, 800)).toBe(95);
  });

  it('falls back to center rather than dividing by zero on a degenerate viewport height', () => {
    expect(percentFromClientY(100, 0)).toBe(50);
  });
});
