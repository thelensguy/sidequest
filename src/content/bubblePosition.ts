const MIN_PERCENT = 5;
const MAX_PERCENT = 95;

/** Clamps a vertical percent so the bubble can't be dragged off (or too close to) the top/bottom edge. */
export function clampVerticalPercent(percent: number): number {
  return Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, percent));
}

/** Converts a mouse Y position into a clamped vertical-percent value for the bubble's `top` style. */
export function percentFromClientY(clientY: number, viewportHeight: number): number {
  if (viewportHeight <= 0) return 50;
  return clampVerticalPercent((clientY / viewportHeight) * 100);
}
