/**
 * Fields a site adapter pulls off a job posting page. All three are
 * required for a capture to be considered "complete" — see
 * `isCompleteJob` in `../capture.ts`. Adapters should return an empty
 * string for a field they can't confidently determine (never guess),
 * so the popup can fall back to manual entry for just that field.
 */
export interface ExtractedJob {
  company: string;
  role: string;
  url: string;
}
