import { useMemo, useState } from 'react';
import { STATUS_ORDER, type ApplicationStatus, type JobEntry } from '../lib/types';
import { JobRow } from './JobRow';
import { SearchIcon, SwordIcon } from '../components/icons';
import { StatusFilterDropdown } from './StatusFilterDropdown';

interface JobTableProps {
  entries: JobEntry[];
  onChanged: () => void;
}

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

  // Most recently added first. dateAdded is always toISOString() output
  // (UTC, fixed-width), so plain string comparison sorts identically to
  // parsing into Dates — without two Date allocations per comparison.
  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded)),
    [entries]
  );

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sorted.filter((entry) => {
      const matchesQuery =
        !normalizedQuery ||
        entry.company.toLowerCase().includes(normalizedQuery) ||
        entry.role.toLowerCase().includes(normalizedQuery);
      const matchesStatus = statusFilter.has(entry.status);
      return matchesQuery && matchesStatus;
    });
  }, [sorted, query, statusFilter]);

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
            {visible.map((entry) => (
              <JobRow key={entry.id} entry={entry} onChanged={onChanged} />
            ))}
          </div>
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
