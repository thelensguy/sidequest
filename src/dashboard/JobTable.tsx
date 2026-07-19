import { useMemo, useState } from 'react';
import { STATUS_ORDER, type ApplicationStatus, type JobEntry } from '../lib/types';
import { linkHost } from '../lib/urlValidation';
import { JobRow } from './JobRow';
import { SearchIcon, SwordIcon } from '../components/icons';
import { StatusFilterDropdown } from './StatusFilterDropdown';

interface JobTableProps {
  entries: JobEntry[];
  onChanged: () => void;
}

type SortOrder = 'newest' | 'updated' | 'stalest' | 'company';

const SORT_LABELS: Record<SortOrder, string> = {
  newest: 'Newest first',
  updated: 'Recently updated',
  stalest: 'Stalest first',
  company: 'Company A–Z',
};

// Timestamps are always toISOString() output (UTC, fixed-width), so plain
// string comparison sorts identically to parsing into Dates — without two
// Date allocations per comparison.
const COMPARATORS: Record<SortOrder, (a: JobEntry, b: JobEntry) => number> = {
  newest: (a, b) => b.dateAdded.localeCompare(a.dateAdded),
  updated: (a, b) => b.lastUpdated.localeCompare(a.lastUpdated),
  stalest: (a, b) => a.lastUpdated.localeCompare(b.lastUpdated),
  company: (a, b) => a.company.localeCompare(b.company),
};

/**
 * Rows rendered before the "Show more" button appears. The JSON import
 * cap permits up to 20,000 entries, which would be an unusable DOM if
 * rendered unconditionally; normal usage (hundreds) never sees the button.
 */
const PAGE_SIZE = 100;

/** Scrolls to and focuses the "Add entry" form's first field. */
function focusAddEntryForm() {
  const el = document.getElementById('add-company');
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  (el as HTMLInputElement | null)?.focus();
}

export function JobTable({ entries, onChanged }: JobTableProps) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<ApplicationStatus>>(
    () => new Set(STATUS_ORDER)
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [renderLimit, setRenderLimit] = useState(PAGE_SIZE);

  const sorted = useMemo(
    () => [...entries].sort(COMPARATORS[sortOrder]),
    [entries, sortOrder]
  );

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sorted.filter((entry) => {
      const matchesQuery =
        !normalizedQuery ||
        entry.company.toLowerCase().includes(normalizedQuery) ||
        entry.role.toLowerCase().includes(normalizedQuery) ||
        linkHost(entry.url).toLowerCase().includes(normalizedQuery);
      const matchesStatus = statusFilter.has(entry.status);
      return matchesQuery && matchesStatus;
    });
  }, [sorted, query, statusFilter]);

  const rendered = visible.slice(0, renderLimit);
  const remaining = visible.length - rendered.length;

  return (
    <section className="quest-log">
      <div className="quest-log-header">
        <div className="qlh-title">
          <h2>Active Quests</h2>
          <p>
            {visible.length} / {entries.length}
          </p>
        </div>
        <div className="qlh-controls">
          <div className="search-wrap">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search company or role…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search company or role"
            />
          </div>
          <StatusFilterDropdown selected={statusFilter} onChange={setStatusFilter} />
          <select
            className="sort-select"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            aria-label="Sort quests"
          >
            {(Object.keys(SORT_LABELS) as SortOrder[]).map((order) => (
              <option key={order} value={order}>
                {SORT_LABELS[order]}
              </option>
            ))}
          </select>
          <button className="btn-primary" type="button" onClick={focusAddEntryForm}>
            <SwordIcon />
            Log a Quest
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state" style={{ display: 'block' }}>
          No quests yet. Add one below, or paste in a batch to backfill your history.
        </div>
      ) : (
        <>
          <div className="quest-list">
            {rendered.map((entry) => (
              <JobRow key={entry.id} entry={entry} onChanged={onChanged} />
            ))}
          </div>
          {remaining > 0 && (
            <button
              type="button"
              className="show-more-btn"
              onClick={() => setRenderLimit((limit) => limit + PAGE_SIZE)}
            >
              Show {Math.min(PAGE_SIZE, remaining)} more ({remaining} remaining)
            </button>
          )}
          {visible.length === 0 && (
            <div className="empty-state" style={{ display: 'block' }}>
              {statusFilter.size === 0
                ? 'No statuses selected — check a status to see quests.'
                : query.trim()
                  ? 'No quests match your search.'
                  : 'No quests match the current status filter.'}
            </div>
          )}
        </>
      )}
    </section>
  );
}
