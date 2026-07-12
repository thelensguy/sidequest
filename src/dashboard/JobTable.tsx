import type { JobEntry } from '../lib/types';
import { JobRow } from './JobRow';

interface JobTableProps {
  entries: JobEntry[];
  onChanged: () => void;
}

export function JobTable({ entries, onChanged }: JobTableProps) {
  if (entries.length === 0) {
    return (
      <div className="job-row__empty">
        No applications yet. Add one below, or paste in a batch to backfill your history.
      </div>
    );
  }

  // Most recently added first.
  const sorted = [...entries].sort(
    (a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
  );

  return (
    <table className="job-table">
      <thead>
        <tr>
          <th>Company</th>
          <th>Role</th>
          <th>Link</th>
          <th>Status</th>
          <th>Date added</th>
          <th>Last updated</th>
          <th aria-label="Actions"></th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((entry) => (
          <JobRow key={entry.id} entry={entry} onChanged={onChanged} />
        ))}
      </tbody>
    </table>
  );
}
