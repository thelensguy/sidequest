export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'interviewing'
  | 'rejected'
  | 'offer';

export type JobEntrySource = 'linkedin' | 'indeed' | 'generic' | 'manual' | 'import';

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
