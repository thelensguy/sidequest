import type { ApplicationStatus, JobEntry } from '../lib/types';
import { appendEvent, updateJobEntry } from '../lib/storage';
import { generateId } from './id';
import { isStale, daysSince } from './staleness';
import { EditableField } from './EditableField';

const STATUS_OPTIONS: ApplicationStatus[] = [
  'saved',
  'applied',
  'interviewing',
  'rejected',
  'offer',
];

interface JobRowProps {
  entry: JobEntry;
  onChanged: () => void;
}

export function JobRow({ entry, onChanged }: JobRowProps) {
  const stale = isStale(entry.lastUpdated);

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const toStatus = e.target.value as ApplicationStatus;
    const fromStatus = entry.status;
    if (toStatus === fromStatus) return;

    const now = new Date().toISOString();
    await updateJobEntry(entry.id, { status: toStatus, lastUpdated: now });
    await appendEvent({
      id: generateId(),
      type: 'status_change',
      jobEntryId: entry.id,
      timestamp: now,
      metadata: { fromStatus, toStatus },
    });
    onChanged();
  }

  async function handleFieldSave(field: 'company' | 'role' | 'url', next: string) {
    await updateJobEntry(entry.id, {
      [field]: next,
      lastUpdated: new Date().toISOString(),
    });
    onChanged();
  }

  return (
    <tr className={stale ? 'is-stale' : undefined}>
      <td>
        <EditableField value={entry.company} onSave={(v) => handleFieldSave('company', v)} />
      </td>
      <td>
        <EditableField value={entry.role} onSave={(v) => handleFieldSave('role', v)} />
      </td>
      <td>
        <EditableField
          value={entry.url}
          onSave={(v) => handleFieldSave('url', v)}
          renderDisplay={(v) =>
            v ? (
              <a
                className="job-link"
                href={v}
                target="_blank"
                rel="noreferrer noopener"
                onClick={(e) => e.stopPropagation()}
              >
                {v}
              </a>
            ) : (
              '—'
            )
          }
        />
      </td>
      <td>
        <select
          className="status-select"
          data-status={entry.status}
          value={entry.status}
          onChange={handleStatusChange}
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status[0].toUpperCase() + status.slice(1)}
            </option>
          ))}
        </select>
        {stale && (
          <span className="stale-badge" title={`No update in ${daysSince(entry.lastUpdated)} days`}>
            Stale · {daysSince(entry.lastUpdated)}d
          </span>
        )}
      </td>
      <td className="date-cell">{new Date(entry.dateAdded).toLocaleDateString()}</td>
      <td className="date-cell">{new Date(entry.lastUpdated).toLocaleDateString()}</td>
    </tr>
  );
}
