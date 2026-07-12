import type { ExtractedJob } from '../capture/adapters';

export type FieldStatus = 'extracted' | 'empty';

export interface FieldStatuses {
  company: FieldStatus;
  role: FieldStatus;
  url: FieldStatus;
}

/**
 * Classifies each field of an extraction result as 'extracted' (adapter
 * found a real, non-blank value) or 'empty' (adapter came back blank, or
 * extraction failed entirely and `job` is null). The review panel uses
 * this to visibly flag which fields the user should double-check rather
 * than silently leaving a blank input with no explanation — same
 * "don't let bad/missing data through silently" principle as the
 * audit-before-save step itself.
 */
export function getFieldStatuses(job: ExtractedJob | null): FieldStatuses {
  const source = job ?? { company: '', role: '', url: '' };
  return {
    company: source.company.trim() ? 'extracted' : 'empty',
    role: source.role.trim() ? 'extracted' : 'empty',
    url: source.url.trim() ? 'extracted' : 'empty',
  };
}
