import { useEffect, useRef, useState } from 'react';
import { STATUS_ORDER, type ApplicationStatus, type JobEntry } from '../lib/types';
import { appendEvent, deleteJobEntry, getEvents, updateJobEntry } from '../lib/storage';
import { computeXp } from '../gamification/xp';
import { isStaleEntry, daysSince } from './staleness';
import { EditableField } from './EditableField';
import { linkHost, validateJobUrl } from '../lib/urlValidation';
import { formatMetaDateRange } from '../lib/dateUtils';
import { ExternalLinkIcon, XIcon } from '../components/icons';
import { STATUS_ICON, STATUS_TAG_LABEL } from './statusMeta';

interface JobRowProps {
  entry: JobEntry;
  onChanged: () => void;
}

export function JobRow({ entry, onChanged }: JobRowProps) {
  const stale = isStaleEntry(entry);
  const StatusIcon = STATUS_ICON[entry.status];

  // Part 1 (Juice): floating "+N XP" ticker. `tickerKey` forces a fresh
  // DOM node (and therefore a restarted CSS animation) each time a new
  // ticker fires, since firing the same status twice in a row wouldn't
  // otherwise remount the element.
  const [ticker, setTicker] = useState<{ key: number; amount: number } | null>(null);

  // Inline replacements for window.confirm/alert — native dialogs get
  // silently suppressed by Chrome when the page isn't the active tab
  // (observed in this extension's own error log), which would make delete
  // and URL-validation feedback vanish without a trace.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const confirmTimeoutRef = useRef<number | null>(null);
  const urlErrorTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current !== null) window.clearTimeout(confirmTimeoutRef.current);
      if (urlErrorTimeoutRef.current !== null) window.clearTimeout(urlErrorTimeoutRef.current);
    };
  }, []);

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
    const appended = await appendEvent({
      type: 'status_change',
      jobEntryId: entry.id,
      timestamp: now,
      metadata: { fromStatus, toStatus },
    });

    // The post-write log is exactly the pre-write log plus the event just
    // appended — no need for a second full storage read.
    const xpAfter = computeXp([...eventsBefore, appended]);
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
        setUrlError('Link must be a valid http(s) URL, or left blank.');
        if (urlErrorTimeoutRef.current !== null) window.clearTimeout(urlErrorTimeoutRef.current);
        urlErrorTimeoutRef.current = window.setTimeout(() => setUrlError(null), 4000);
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
    // Two-stage inline confirm: first click arms, second click (within 3s)
    // deletes. The armed state auto-resets so a stray click can't leave a
    // live delete button waiting indefinitely.
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      if (confirmTimeoutRef.current !== null) window.clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = window.setTimeout(() => setConfirmingDelete(false), 3000);
      return;
    }
    if (confirmTimeoutRef.current !== null) window.clearTimeout(confirmTimeoutRef.current);
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
        {urlError && (
          <span className="form-error" role="alert">
            {urlError}
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
          className={`quest-delete${confirmingDelete ? ' confirming' : ''}`}
          onClick={handleDelete}
          aria-label={
            confirmingDelete
              ? `Click again to permanently delete ${entry.role || 'entry'} at ${entry.company || 'unknown company'}`
              : `Delete ${entry.role || 'entry'} at ${entry.company || 'unknown company'}`
          }
          title={confirmingDelete ? 'Click again to confirm delete' : 'Delete'}
        >
          <XIcon />
        </button>
      </div>
    </div>
  );
}
