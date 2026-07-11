import { useState, type CSSProperties, type FormEvent } from 'react';
import { type ActiveTabInfo, captureFromTab, getActiveTab, isCompleteJob } from '../capture/capture';
import type { ExtractedJob } from '../capture/adapters';
import { addJobEntry, appendEvent } from '../lib/storage';
import type { JobEntry, JobEntrySource } from '../lib/types';

type ViewState =
  | { phase: 'idle' }
  | { phase: 'capturing' }
  | { phase: 'saved'; entry: JobEntry }
  | { phase: 'manual'; tab: ActiveTabInfo }
  | { phase: 'error'; message: string };

const EMPTY_DRAFT: ExtractedJob = { company: '', role: '', url: '' };

/**
 * Shared save path for both the automatic (adapter-matched) capture and
 * the manual-entry fallback: build a JobEntry, persist it, and log a
 * `capture` AppEvent against it. Per spec, the manual-entry path uses
 * this exact same call shape — only `source` differs ('manual' vs. the
 * matched adapter's source) — rather than a distinct `manual_add` event
 * type.
 */
async function saveEntry(fields: ExtractedJob, source: JobEntrySource): Promise<JobEntry> {
  const now = new Date().toISOString();
  const entry: JobEntry = {
    id: crypto.randomUUID(),
    company: fields.company.trim(),
    role: fields.role.trim(),
    url: fields.url.trim(),
    status: 'saved',
    dateAdded: now,
    lastUpdated: now,
    source,
  };
  await addJobEntry(entry);
  await appendEvent({
    id: crypto.randomUUID(),
    type: 'capture',
    jobEntryId: entry.id,
    timestamp: now,
  });
  return entry;
}

export function Popup() {
  const [state, setState] = useState<ViewState>({ phase: 'idle' });
  const [draft, setDraft] = useState<ExtractedJob>(EMPTY_DRAFT);

  async function handleCapture() {
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
        const entry = await saveEntry(job, source);
        setState({ phase: 'saved', entry });
        return;
      }

      // Incomplete or failed extraction — prefill whatever we did get
      // (or the tab's own title/url as a last resort) and let the user
      // fill in the rest by hand.
      setDraft(fallbackDraft);
      setState({ phase: 'manual', tab });
    } catch (err) {
      setState({
        phase: 'error',
        message: err instanceof Error ? err.message : 'Something went wrong capturing this page.',
      });
    }
  }

  async function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.company.trim() || !draft.role.trim() || !draft.url.trim()) {
      return;
    }
    try {
      const entry = await saveEntry(draft, 'manual');
      setState({ phase: 'saved', entry });
    } catch (err) {
      setState({
        phase: 'error',
        message: err instanceof Error ? err.message : 'Something went wrong saving this entry.',
      });
    }
  }

  function handleReset() {
    setDraft(EMPTY_DRAFT);
    setState({ phase: 'idle' });
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>SideQuest</h1>

      {state.phase !== 'manual' && (
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
        <p style={styles.success}>
          Saved &ldquo;{state.entry.role}&rdquo; at {state.entry.company || '(unknown company)'}.
        </p>
      )}

      {state.phase === 'error' && <p style={styles.error}>{state.message}</p>}

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
              onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
              required
            />
          </label>

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

      {state.phase === 'saved' && (
        <button type="button" style={styles.secondaryButton} onClick={handleReset}>
          Capture another
        </button>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { padding: 16, fontFamily: 'system-ui, sans-serif' },
  heading: { fontSize: 16, margin: '0 0 12px' },
  primaryButton: {
    width: '100%',
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
    background: '#2563eb',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  secondaryButton: {
    width: '100%',
    padding: '8px 12px',
    fontSize: 13,
    color: '#333',
    background: '#f1f1f1',
    border: '1px solid #ddd',
    borderRadius: 6,
    cursor: 'pointer',
    marginTop: 8,
  },
  success: { fontSize: 12, color: '#166534', marginTop: 10 },
  error: { fontSize: 12, color: '#b91c1c', marginTop: 10 },
  helperText: { fontSize: 12, color: '#666', margin: '0 0 8px' },
  form: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 12, color: '#333', display: 'flex', flexDirection: 'column', gap: 4 },
  input: { fontSize: 13, padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4 },
  formActions: { display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 },
};
