import { useMemo, useState } from 'react';
import type { ApplicationStatus, JobEntry } from '../lib/types';
import { JobRow } from './JobRow';
import { SearchIcon, SwordIcon } from '../components/icons';
import { STATUS_ORDER, STATUS_QUEST_LABEL } from './statusMeta';

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
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');

  // Most recently added first.
  const sorted = useMemo(
    () =>
      [...entries].sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()),
    [entries]
  );

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sorted.filter((entry) => {
      const matchesQuery =
        !normalizedQuery ||
        entry.company.toLowerCase().includes(normalizedQuery) ||
        entry.role.toLowerCase().includes(normalizedQuery);
      const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;
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
          <select
            className="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | 'all')}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {STATUS_QUEST_LABEL[status]}
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
            {visible.map((entry) => (
              <JobRow key={entry.id} entry={entry} onChanged={onChanged} />
            ))}
          </div>
          {visible.length === 0 && (
            <div className="empty-state" style={{ display: 'block' }}>
              No quests match your search.
            </div>
          )}
        </>
      )}
    </section>
  );
}
