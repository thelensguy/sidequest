export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'interviewing'
  | 'rejected'
  | 'offer';

export type JobEntrySource = 'linkedin' | 'indeed' | 'ziprecruiter' | 'generic' | 'manual' | 'import';

export interface JobEntry {
  id: string;
  company: string;
  role: string;
  url: string;
  status: ApplicationStatus;
  /** ISO 8601 timestamp */
  dateAdded: string;
  /** ISO 8601 timestamp, bumped on every status/field change */
  lastUpdated: string;
  source: JobEntrySource;
}

export type AppEventType = 'capture' | 'status_change' | 'manual_add' | 'import';

export interface AppEvent {
  id: string;
  type: AppEventType;
  jobEntryId: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  metadata?: {
    fromStatus?: ApplicationStatus;
    toStatus?: ApplicationStatus;
  };
}

/** A single weighted entry in the reward-wheel's custom loot table. */
export interface LootTableEntry {
  id: string;
  label: string;
  tier: 'common' | 'rare' | 'epic';
  weight: number;
}

/** The three sites the in-page capture bubble runs on — see manifest.config.ts's content_scripts matches. */
export type CaptureSite = 'linkedin' | 'indeed' | 'ziprecruiter';

/** Persisted state for the in-page floating capture bubble: where it sits, and where/whether it's hidden. */
export interface BubbleSettings {
  /** Vertical position as a percentage from the top of the viewport, clamped 5-95. Shared across all sites. */
  verticalPercent: number;
  /** Sites where the bubble is hidden until re-enabled from Options. */
  hiddenDomains: CaptureSite[];
  /** Hidden on every site, independent of hiddenDomains. */
  hiddenGlobally: boolean;
}
