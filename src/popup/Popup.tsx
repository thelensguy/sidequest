import { useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { type ActiveTabInfo, captureFromTab, getActiveTab, isCompleteJob } from '../capture/capture';
import type { ExtractedJob } from '../capture/adapters';
import { addJobEntry, appendEvent, getJobEntries } from '../lib/storage';
import type { AppEventType, JobEntry, JobEntrySource } from '../lib/types';
import { validateJobUrl } from '../lib/urlValidation';
import { CheckCircleIcon, ExternalLinkIcon, ShieldIcon, XCircleIcon } from '../components/icons';

type ViewState =
  | { phase: 'idle' }
  | { phase: 'capturing' }
  | { phase: 'saved'; entry: JobEntry }
  | { phase: 'duplicate'; entry: JobEntry }
  | { phase: 'manual'; tab: ActiveTabInfo }
  | { phase: 'error'; message: string };

const EMPTY_DRAFT: ExtractedJob = { company: '', role: '', url: '' };

/**
 * The already-tracked entry matching this URL, if any. Exact-match on the
 * stored URL — adapters canonicalize LinkedIn/Indeed links at capture
 * time, so re-capturing the same posting produces the same string. Blank
 * URLs never match (two lost links aren't the same job).
 */
function findDuplicate(entries: JobEntry[], url: string): JobEntry | undefined {
  return url ? entries.find((entry) => entry.url === url) : undefined;
}

/**
 * Shared save path for both the automatic (adapter-matched) capture and
 * the manual-entry fallback: build a JobEntry, persist it, and log an
 * AppEvent against it. `source` on the JobEntry is 'manual' for both a
 * dashboard backfill and a capture that fell through to the inline form,
 * so `eventType` is what preserves that distinction on the event log:
 * 'capture' when the popup's adapter pipeline produced the entry,
 * 'manual_add' when the user typed it in by hand (matching the semantic
 * the dashboard's own "Add entry" form already uses for manual_add).
 */
async function saveEntry(
  fields: ExtractedJob,
  source: JobEntrySource,
  eventType: AppEventType
): Promise<JobEntry> {
  const now = new Date().toISOString();
  const entry = await addJobEntry({
    company: fields.company.trim(),
    role: fields.role.trim(),
    url: fields.url.trim(),
    status: 'saved',
    dateAdded: now,
    lastUpdated: now,
    source,
  });
  await appendEvent({
    type: eventType,
    jobEntryId: entry.id,
    timestamp: now,
  });
  return entry;
}

export function Popup() {
  const [state, setState] = useState<ViewState>({ phase: 'idle' });
  const [draft, setDraft] = useState<ExtractedJob>(EMPTY_DRAFT);
  const [manualUrlError, setManualUrlError] = useState<string | null>(null);

  // Synchronous re-entry guard for both save paths. A `disabled` prop on
  // the button (or checking `state.phase` inside the handler) isn't
  // enough on its own: React batches/defers setState, so a fast
  // double-click can fire the handler twice before the first
  // `setState({ phase: 'capturing' })` actually commits and re-renders
  // the disabled button. A ref updates immediately, in the same tick, so
  // it catches that race that state-based checks miss.
  const isSavingRef = useRef(false);

  async function handleCapture() {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setState({ phase: 'capturing' });
    try {
      const tab = await getActiveTab();
      const { job, source } = await captureFromTab(tab);

      // Read fallback fields off `job` before the isCompleteJob() check
      // below — TypeScript's control-flow narrowing on this version of
      // the compiler collapses `job` to `never` in code that follows a
      // custom type-guard's negative branch, so these reads have to
      // happen ahead of that check rather than inside an `else`.
      const fallbackDraft: ExtractedJob = {
        company: job?.company ?? '',
        role: job?.role || tab.title,
        url: job?.url || tab.url,
      };

      if (isCompleteJob(job)) {
        // Same http(s)-only rule as every other save path (manual form,
        // dashboard add/import/edit) — a captured `url` comes straight
        // off third-party page DOM and is later rendered as a live
        // clickable href in JobRow, so it needs the same validation an
        // adapter can't guarantee on its own (e.g. the generic fallback
        // just echoes `doc.location.href`).
        const safeUrl = validateJobUrl(job.url);
        if (safeUrl !== null) {
          const existing = findDuplicate(await getJobEntries(), safeUrl);
          if (existing) {
            // Already tracked — show which entry, don't save it twice.
            setState({ phase: 'duplicate', entry: existing });
            return;
          }
          const entry = await saveEntry({ ...job, url: safeUrl }, source, 'capture');
          setState({ phase: 'saved', entry });
          // Stay locked: the primary button is hidden once phase is
          // 'saved'/'duplicate', and handleReset() clears the guard when
          // the user moves on via "Capture another".
          return;
        }
      }

      // Incomplete or failed extraction — prefill whatever we did get
      // (or the tab's own title/url as a last resort) and let the user
      // fill in the rest by hand. Release the guard: the primary button
      // is hidden while phase is 'manual' anyway, but the manual form's
      // own submit uses this same ref.
      setDraft(fallbackDraft);
      setState({ phase: 'manual', tab });
      isSavingRef.current = false;
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      // chrome.scripting can't run on browser-internal pages (chrome://,
      // the Web Store, PDFs) and throws messages like "Cannot access a
      // chrome:// URL" — surface something a user can act on instead.
      const message = /cannot access|cannot be scripted|chrome:\/\/|extensions gallery/i.test(raw)
        ? "Chrome doesn't let extensions read this page. Open a job posting in a normal tab, or add the entry from the dashboard."
        : raw || 'Something went wrong capturing this page.';
      setState({ phase: 'error', message });
      isSavingRef.current = false;
    }
  }

  async function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSavingRef.current) return;
    if (!draft.company.trim() || !draft.role.trim() || !draft.url.trim()) {
      return;
    }

    // Same http(s)-only rule as the dashboard's add/import/edit paths —
    // this field is free text the user (or a URL pasted from elsewhere)
    // fills in, and it's later rendered as a live clickable href in
    // JobRow, so a `javascript:...` value can't be allowed through here.
    const safeUrl = validateJobUrl(draft.url);
    if (safeUrl === null) {
      setManualUrlError('Link must be a valid http(s) URL.');
      return;
    }
    const existing = findDuplicate(await getJobEntries(), safeUrl);
    if (existing) {
      setManualUrlError(
        `Already in your tracker — "${existing.role}" at ${existing.company || 'unknown company'}.`
      );
      return;
    }
    setManualUrlError(null);

    isSavingRef.current = true;
    try {
      const entry = await saveEntry({ ...draft, url: safeUrl }, 'manual', 'manual_add');
      setState({ phase: 'saved', entry });
    } catch (err) {
      setState({
        phase: 'error',
        message: err instanceof Error ? err.message : 'Something went wrong saving this entry.',
      });
      isSavingRef.current = false;
    }
  }

  function handleReset() {
    isSavingRef.current = false;
    setDraft(EMPTY_DRAFT);
    setManualUrlError(null);
    setState({ phase: 'idle' });
  }

  function openDashboard() {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') });
  }

  return (
    <div style={styles.container}>
      <div style={styles.brand}>
        <span style={styles.brandMark}>
          <ShieldIcon />
        </span>
        <div>
          <h1 style={styles.heading}>SideQuest</h1>
          <p style={styles.eyebrow}>Capture</p>
        </div>
        <button
          type="button"
          style={styles.dashboardButton}
          title="Open dashboard"
          aria-label="Open dashboard"
          onClick={openDashboard}
        >
          <ExternalLinkIcon />
        </button>
      </div>

      {state.phase !== 'manual' && state.phase !== 'saved' && state.phase !== 'duplicate' && (
        <button
          type="button"
          onClick={handleCapture}
          disabled={state.phase === 'capturing'}
          style={styles.primaryButton}
        >
          {state.phase === 'capturing' ? 'Saving…' : 'Save this posting'}
        </button>
      )}

      {state.phase === 'saved' && (
        <p style={styles.success} role="status">
          <CheckCircleIcon style={styles.statusIcon} />
          Saved &ldquo;{state.entry.role}&rdquo; at {state.entry.company || '(unknown company)'}.
        </p>
      )}

      {state.phase === 'duplicate' && (
        <p style={styles.success} role="status">
          <CheckCircleIcon style={styles.statusIcon} />
          Already in your tracker &mdash; &ldquo;{state.entry.role}&rdquo; at{' '}
          {state.entry.company || '(unknown company)'}.
        </p>
      )}

      {state.phase === 'error' && (
        <p style={styles.error} role="alert">
          <XCircleIcon style={styles.statusIcon} />
          {state.message}
        </p>
      )}

      {state.phase === 'manual' && (
        <form onSubmit={handleManualSubmit} style={styles.form}>
          <p style={styles.helperText}>
            Couldn&apos;t automatically read all the details on this page. Fill in the rest:
          </p>

          <label style={styles.label}>
            Company
            <input
              style={styles.input}
              value={draft.company}
              onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value }))}
              required
            />
          </label>

          <label style={styles.label}>
            Role
            <input
              style={styles.input}
              value={draft.role}
              onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
              required
            />
          </label>

          <label style={styles.label}>
            URL
            <input
              style={styles.input}
              value={draft.url}
              onChange={(e) => {
                setDraft((d) => ({ ...d, url: e.target.value }));
                setManualUrlError(null);
              }}
              required
            />
          </label>
          {manualUrlError && (
            <p style={styles.error} role="alert">
              <XCircleIcon style={styles.statusIcon} />
              {manualUrlError}
            </p>
          )}

          <div style={styles.formActions}>
            <button type="submit" style={styles.primaryButton}>
              Save
            </button>
            <button type="button" style={styles.secondaryButton} onClick={handleReset}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {(state.phase === 'saved' || state.phase === 'duplicate') && (
        <button type="button" style={styles.secondaryButton} onClick={handleReset}>
          Capture another
        </button>
      )}
    </div>
  );
}

/**
 * Premium HUD tokens, hand-copied from dashboard.css's :root block (this
 * bundle is a separate CRXJS entry point with no shared stylesheet, so the
 * popup can't just `var(--accent)` off a global — the hex values have to
 * live here too). Keep these in sync if the dashboard palette changes.
 */
const theme = {
  bg: '#0a0a0b',
  surface: '#121212',
  surfaceRaised: '#161616',
  border: '#1f2937',
  text: '#ededef',
  text2: '#9ba1ac',
  text3: '#7c8695',
  accent: '#818cf8',
  accentHover: '#9aa3f9',
  offer: '#4fbe8b',
  rejected: '#e17b76',
  mono: "ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, Consolas, monospace",
  sans: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif",
};

const styles: Record<string, CSSProperties> = {
  container: {
    padding: 16,
    fontFamily: theme.sans,
    background: theme.bg,
    color: theme.text,
  },
  brand: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 },
  brandMark: {
    width: 26,
    height: 26,
    borderRadius: 6,
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.accent,
    fontSize: 14,
    flexShrink: 0,
  },
  dashboardButton: {
    width: 26,
    height: 26,
    borderRadius: 6,
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.text3,
    fontSize: 14,
    cursor: 'pointer',
    marginLeft: 'auto',
    flexShrink: 0,
  },
  heading: { fontSize: 14, fontWeight: 600, margin: 0, letterSpacing: '-0.01em' },
  eyebrow: {
    fontFamily: theme.mono,
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: theme.text3,
    margin: '2px 0 0',
  },
  primaryButton: {
    width: '100%',
    padding: '9px 12px',
    fontSize: 12.5,
    fontWeight: 600,
    fontFamily: theme.sans,
    color: theme.bg,
    background: theme.accent,
    border: `1px solid ${theme.accent}`,
    borderRadius: 7,
    cursor: 'pointer',
  },
  secondaryButton: {
    width: '100%',
    padding: '9px 12px',
    fontSize: 12.5,
    fontWeight: 600,
    fontFamily: theme.sans,
    color: theme.text,
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 7,
    cursor: 'pointer',
    marginTop: 8,
  },
  success: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    fontSize: 12,
    color: theme.offer,
    marginTop: 10,
    lineHeight: 1.5,
  },
  error: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    fontSize: 12,
    color: theme.rejected,
    marginTop: 10,
    lineHeight: 1.5,
  },
  statusIcon: { flexShrink: 0, marginTop: 2, fontSize: 13 },
  helperText: { fontSize: 12, color: theme.text3, margin: '0 0 8px' },
  form: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 },
  label: {
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: theme.text3,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  input: {
    fontSize: 13,
    fontFamily: theme.sans,
    padding: '7px 9px',
    background: theme.bg,
    border: `1px solid ${theme.border}`,
    borderRadius: 6,
    color: theme.text,
  },
  formActions: { display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 },
};
