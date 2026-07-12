import { useRef, useState } from 'react';
import { Bubble } from './Bubble';
import { ReviewPanel } from './ReviewPanel';
import { safeExtract } from './extract';
import { getFieldStatuses, type FieldStatuses } from './fieldStatus';
import { getAdapterForUrl } from '../capture/adapters';
import type { ExtractedJob } from '../capture/adapters';
import { addJobEntry, appendEvent } from '../lib/storage';
import type { JobEntrySource } from '../lib/types';

type PanelState =
  | { phase: 'closed' }
  | {
      phase: 'open' | 'saving' | 'saved' | 'error';
      draft: ExtractedJob;
      statuses: FieldStatuses;
      source: JobEntrySource;
      message?: string;
    };

const EMPTY_DRAFT: ExtractedJob = { company: '', role: '', url: '' };

/** How long the "Saved to SideQuest" confirmation stays up before the panel auto-closes. */
const SAVED_AUTO_CLOSE_MS = 1400;

export function ContentApp() {
  const [state, setState] = useState<PanelState>({ phase: 'closed' });

  // Synchronous re-entry guard, same rationale as Popup.tsx's isSavingRef:
  // React batches/defers setState, so without a ref a fast double-click
  // could fire handleSave twice before the first phase:'saving' update
  // actually commits and disables the button.
  const isSavingRef = useRef(false);

  function handleToggle() {
    if (state.phase !== 'closed') {
      setState({ phase: 'closed' });
      return;
    }

    // Re-run extraction fresh on every open rather than reusing a result
    // cached from when the content script first loaded. LinkedIn and
    // Indeed are both SPAs — the URL/DOM can change without a full page
    // reload, so a cached extraction could be stale, or from an entirely
    // different posting, by the time the user clicks the bubble.
    const url = location.href;
    const adapter = getAdapterForUrl(url);
    const job = safeExtract(url, document);
    setState({
      phase: 'open',
      draft: job ?? EMPTY_DRAFT,
      statuses: getFieldStatuses(job),
      source: adapter.source,
    });
  }

  function handleCancel() {
    isSavingRef.current = false;
    setState({ phase: 'closed' });
  }

  function handleChange(field: keyof ExtractedJob, value: string) {
    setState((prev) => {
      if (prev.phase !== 'open' && prev.phase !== 'error') return prev;
      return { ...prev, phase: 'open', draft: { ...prev.draft, [field]: value } };
    });
  }

  async function handleSave() {
    if (state.phase !== 'open' && state.phase !== 'error') return;
    if (isSavingRef.current) return;

    const trimmed: ExtractedJob = {
      company: state.draft.company.trim(),
      role: state.draft.role.trim(),
      url: state.draft.url.trim(),
    };
    if (!trimmed.company || !trimmed.role || !trimmed.url) return;

    const source = state.source;
    isSavingRef.current = true;
    setState({ phase: 'saving', draft: trimmed, statuses: getFieldStatuses(trimmed), source });

    try {
      const now = new Date().toISOString();
      const entry = await addJobEntry({
        ...trimmed,
        status: 'saved',
        dateAdded: now,
        lastUpdated: now,
        source,
      });
      await appendEvent({ type: 'capture', jobEntryId: entry.id, timestamp: now });

      setState({ phase: 'saved', draft: trimmed, statuses: getFieldStatuses(trimmed), source });
      setTimeout(() => {
        isSavingRef.current = false;
        setState((current) => (current.phase === 'saved' ? { phase: 'closed' } : current));
      }, SAVED_AUTO_CLOSE_MS);
    } catch (err) {
      isSavingRef.current = false;
      setState({
        phase: 'error',
        draft: trimmed,
        statuses: getFieldStatuses(trimmed),
        source,
        message: err instanceof Error ? err.message : 'Could not save this posting.',
      });
    }
  }

  const isOpen = state.phase !== 'closed';

  return (
    <div className="sq-root">
      {isOpen && (
        <ReviewPanel
          phase={state.phase}
          draft={state.draft}
          statuses={state.statuses}
          errorMessage={state.message}
          onChange={handleChange}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
      <Bubble isOpen={isOpen} onClick={handleToggle} />
    </div>
  );
}
