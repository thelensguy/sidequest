import type { JobEntrySource } from '../../lib/types';
import * as generic from './generic';
import * as indeed from './indeed';
import * as linkedin from './linkedin';
import type { ExtractedJob } from './types';

export type { ExtractedJob } from './types';

export interface Adapter {
  source: JobEntrySource;
  matches(url: string): boolean;
  extract(doc?: Document): ExtractedJob | null;
}

// Order matters: more specific site adapters first, generic.ts last as the
// catch-all (its matches() always returns true). To support a new site,
// add a new adapter file here — don't branch inside an existing one.
const ADAPTERS: Adapter[] = [linkedin, indeed, generic];

export function getAdapterForUrl(url: string): Adapter {
  return ADAPTERS.find((adapter) => adapter.matches(url)) ?? generic;
}
