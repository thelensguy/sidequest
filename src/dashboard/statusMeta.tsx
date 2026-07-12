import type { ComponentType } from 'react';
import type { ApplicationStatus } from '../lib/types';
import {
  ArrowUpRightIcon,
  CompassIcon,
  SwordIcon,
  TrophyIcon,
  XCircleIcon,
  type IconProps,
} from '../components/icons';

/**
 * Per-status display metadata shared by JobRow, JobTable, and StatsBar so
 * the icon/bracket-label/quest-flavored-name mapping only lives in one
 * place. Colors are NOT looked up here — they come from the
 * `[data-status="…"]` CSS attribute selectors in dashboard.css (matching
 * the mockup's approach of tinting via a parent attribute rather than
 * inline styles), so a `.qicon`/`.status-select` just needs to sit inside
 * an element carrying `data-status` to pick up the right `--s-*` color.
 */
export const STATUS_ICON: Record<ApplicationStatus, ComponentType<IconProps>> = {
  saved: CompassIcon,
  applied: ArrowUpRightIcon,
  interviewing: SwordIcon,
  rejected: XCircleIcon,
  offer: TrophyIcon,
};

/** Bracketed monospace tag text, exact strings from the mockup's <select> options. */
export const STATUS_TAG_LABEL: Record<ApplicationStatus, string> = {
  saved: '[SCOUTED]',
  applied: '[AWAITING]',
  interviewing: '[IN TRIAL]',
  rejected: '[FAILED]',
  offer: '[VICTORY]',
};

/** Quest-flavored status names, used for the stat tiles + status filter. */
export const STATUS_QUEST_LABEL: Record<ApplicationStatus, string> = {
  saved: 'Scouted',
  applied: 'Awaiting Response',
  interviewing: 'In the Trial',
  rejected: 'Quest Failed',
  offer: 'Victory',
};

/** Short quest-flavored label for stat tiles (mockup: Scouted/Awaiting/In Trial/Failed/Victory). */
export const STATUS_STAT_LABEL: Record<ApplicationStatus, string> = {
  saved: 'Scouted',
  applied: 'Awaiting',
  interviewing: 'In Trial',
  rejected: 'Failed',
  offer: 'Victory',
};

export const STATUS_ORDER: ApplicationStatus[] = [
  'saved',
  'applied',
  'interviewing',
  'rejected',
  'offer',
];
