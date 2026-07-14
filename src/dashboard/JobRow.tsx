import { useState } from 'react';
import { STATUS_ORDER, type ApplicationStatus, type JobEntry } from '../lib/types';
import { appendEvent, deleteJobEntry, getEvents, updateJobEntry } from '../lib/storage';
import { computeXp } from '../gamification/xp';
import { isStale, daysSince } from './staleness';
import { EditableField } from './EditableField';
import { validateJobUrl } from '../lib/urlValidation';
import { formatMetaDateRange } from '../lib/dateUtils';
import { ExternalLinkIcon, XIcon } from '../components/icons';
import { STATUS_ICON, STATUS_TAG_LABEL } from './statusMeta';

function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

interface JobRowProps {
  entry: JobEntry;
  onChanged: () => void;
}

export function JobRow({ entry, onChanged }: JobRowProps) {
  const stale = isStale(entry.lastUpdated);
  const StatusIcon = STATUS_ICON[entry.status];

  // Part 1 (Juice): floating "+N XP" ticker. `tickerKey` forces a fresh
  // DOM node (and therefore a restarted CSS animation) each time a new
  // ticker fires, since firing the same status twice in a row wouldn't
  // otherwise remount the element.
  const [ticker, setTicker] = useState<{ key: number; amount: number } | null>(null);

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const toStatus = e.target.value as ApplicationStatus;
    const fromStatus = entry.status;
    if (toStatus === fromStatus) return;

    // Snapshot XP before the write. computeXp() already runs every event
    // through reachedStatusKeys()'s anti-farming dedup (src/gamification/
    // statusMilestones.ts), so comparing before/after totals is a correct,
    // reuse-the-real-rule way to detect whether this particular status
    // change is a genuinely NEW (entry, status) pair — no need to
    // reimplement that dedup logic locally.
    const eventsBefore = await getEvents();
    const xpBefore = computeXp(eventsBefore);

    const now = new Date().toISOString();
    await updateJobEntry(entry.id, { status: toStatus, lastUpdated: now });
    await appendEvent({
      type: 'status_change',
      jobEntryId: entry.id,
      timestamp: now,
      metadata: { fromStatus, toStatus },
    });

    const eventsAfter = await getEvents();
    const xpAfter = computeXp(eventsAfter);
    const delta = xpAfter - xpBefore;
    if (delta > 0) {
      setTicker({ key: Date.now(), amount: delta });
    }

    onChanged();
  }

  async function handleFieldSave(field: 'company' | 'role' | 'url', next: string) {
    let value = next;
    if (field === 'url') {
      const safeUrl = validateJobUrl(next);
      if (safeUrl === null) {
        // Same http(s)-only rule as the add/import paths — refuse to store
        // (and later render as a clickable href) anything else.
        window.alert('Link must be a valid http(s) URL, or left blank.');
        return;
      }
      value = safeUrl;
    }

    await updateJobEntry(entry.id, {
      [field]: value,
      lastUpdated: new Date().toISOString(),
    });
    onChanged();
  }

  async function handleDelete() {
    const label = [entry.role, entry.company].filter(Boolean).join(' at ') || 'this entry';
    if (!window.confirm(`Delete ${label}? This can't be undone.`)) return;
    await deleteJobEntry(entry.id);
    onChanged();
  }

  const meta = [linkHost(entry.url) || entry.source, formatMetaDateRange(entry.dateAdded, entry.lastUpdated)]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="quest-card" data-status={entry.status}>
      <div className="qicon">
        <StatusIcon />
      </div>

      <div className="quest-main">
        <EditableField
          value={entry.company}
          onSave={(v) => handleFieldSave('company', v)}
          renderDisplay={(v) => <span className="quest-company">{v || 'Untitled company'}</span>}
        />
        <EditableField
          value={entry.role}
          onSave={(v) => handleFieldSave('role', v)}
          renderDisplay={(v) => (
            <span className="quest-role" title={v}>
              {v || 'Untitled role'}
            </span>
          )}
        />
        <span className="quest-meta">{meta}</span>
        {stale && (
          <span className="stale-badge" title={`No update in ${daysSince(entry.lastUpdated)} days`}>
            Stale · {daysSince(entry.lastUpdated)}d
          </span>
        )}
      </div>

      <div className="quest-side">
        <div className="status-tag-wrap">
          <StatusIcon />
          <select
            className="status-select"
            value={entry.status}
            onChange={handleStatusChange}
            aria-label={`Status for ${entry.role || 'entry'} at ${entry.company || 'unknown company'}`}
          >
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {STATUS_TAG_LABEL[status]}
              </option>
            ))}
          </select>
          {ticker && (
            <span
              key={ticker.key}
              className="xp-ticker"
              onAnimationEnd={() => setTicker(null)}
            >
              +{ticker.amount} XP
            </span>
          )}
        </div>

        <EditableField
          value={entry.url}
          onSave={(v) => handleFieldSave('url', v)}
          renderDisplay={(v) =>
            v ? (
              <a
                className="quest-link"
                href={v}
                title={v}
                target="_blank"
                rel="noreferrer noopener"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLinkIcon />
              </a>
            ) : (
              <span className="quest-link quest-link--empty" title="Click to add a link">
                <ExternalLinkIcon />
              </span>
            )
          }
        />

        <button
          type="button"
          className="quest-delete"
          onClick={handleDelete}
          aria-label={`Delete ${entry.role || 'entry'} at ${entry.company || 'unknown company'}`}
          title="Delete"
        >
          <XIcon />
        </button>
      </div>
    </div>
  );
}
