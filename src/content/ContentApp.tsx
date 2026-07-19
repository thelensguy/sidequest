import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Bubble } from './Bubble';
import { ReviewPanel } from './ReviewPanel';
import { safeExtract } from './extract';
import { getFieldStatuses, type FieldStatuses } from './fieldStatus';
import { getAdapterForUrl } from '../capture/adapters';
import type { ExtractedJob } from '../capture/adapters';
import {
  addJobEntry,
  appendEvent,
  getJobEntries,
  hideBubbleUntilRestart,
  setBubbleHiddenOnDomain,
  setBubbleSettings,
} from '../lib/storage';
import type { JobEntrySource } from '../lib/types';
import { getCurrentCaptureSite } from './currentSite';
import { percentFromClientY } from './bubblePosition';
import { validateJobUrl } from '../lib/urlValidation';

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

/** Minimum pointer movement (px) before a pointerdown-drag counts as a drag rather than a click. */
const DRAG_THRESHOLD_PX = 4;

interface ContentAppProps {
  /** The fixed-position host element created in index.tsx — mutated directly during drag for smoothness, no React re-render per pixel moved. */
  host: HTMLElement;
  /** Hidden by BubbleSettings (globally or for this site) at mount time — kept live via storage.onChanged below. */
  initialSettingsHidden: boolean;
  /** "Hide until next visit" was active at mount time — final for this page's lifetime. */
  initialSessionHidden: boolean;
}

export function ContentApp({ host, initialSettingsHidden, initialSessionHidden }: ContentAppProps) {
  const [state, setState] = useState<PanelState>({ phase: 'closed' });
  const [settingsHidden, setSettingsHidden] = useState(initialSettingsHidden);
  const [sessionHidden, setSessionHidden] = useState(initialSessionHidden);

  // Keep visibility (and dock position) in sync with the Options page —
  // toggling the bubble there should take effect on already-open tabs
  // without a reload, in both directions.
  useEffect(() => {
    function onStorageChanged(changes: { [key: string]: chrome.storage.StorageChange }) {
      if (!changes.bubbleSettings) return;
      const next = changes.bubbleSettings.newValue as
        | { hiddenGlobally?: boolean; hiddenDomains?: string[]; verticalPercent?: number }
        | undefined;
      if (!next) return;
      const site = getCurrentCaptureSite();
      setSettingsHidden(
        Boolean(next.hiddenGlobally) || (site !== null && (next.hiddenDomains ?? []).includes(site))
      );
      if (typeof next.verticalPercent === 'number') {
        host.style.top = `${next.verticalPercent}%`;
      }
    }
    chrome.storage.local.onChanged?.addListener(onStorageChanged);
    return () => chrome.storage.local.onChanged?.removeListener(onStorageChanged);
  }, [host]);

  // Synchronous re-entry guard, same rationale as Popup.tsx's isSavingRef:
  // React batches/defers setState, so without a ref a fast double-click
  // could fire handleSave twice before the first phase:'saving' update
  // actually commits and disables the button.
  const isSavingRef = useRef(false);

  // The browser fires a `click` after `mouseup` whenever both land on the
  // same element, regardless of movement in between — so a real drag
  // still triggers handleToggle right after. This flag, set only when a
  // drag actually happened, tells handleToggle to swallow that one click.
  const suppressClickRef = useRef(false);

  function handleToggle() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
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

    // Same http(s)-only rule as every other save path (popup, dashboard
    // add/edit, both import paths) — the URL field here is user-editable,
    // and whatever it holds later renders as a live clickable href in
    // JobRow, so a pasted javascript:/data: URL must be rejected here too.
    const safeUrl = validateJobUrl(trimmed.url);
    if (safeUrl === null) {
      setState({
        phase: 'error',
        draft: trimmed,
        statuses: getFieldStatuses(trimmed),
        source,
        message: 'Job URL must be a valid http(s) link.',
      });
      return;
    }
    trimmed.url = safeUrl;

    // Lock before the first await below, or a fast double-click could get
    // two saves past the duplicate check concurrently.
    isSavingRef.current = true;

    // Exact-URL duplicate check — adapters canonicalize LinkedIn/Indeed
    // links, so re-capturing the same posting produces the same string.
    const existing = (await getJobEntries()).find((entry) => entry.url === trimmed.url);
    if (existing) {
      isSavingRef.current = false;
      setState({
        phase: 'error',
        draft: trimmed,
        statuses: getFieldStatuses(trimmed),
        source,
        message: `Already in your tracker — "${existing.role}" at ${existing.company || 'unknown company'}.`,
      });
      return;
    }
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

  // Pointer events (not mouse events) so the drag works from touch screens
  // and pens too — mousedown/mousemove never fire for a touch drag.
  function handleDragStart(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return; // primary button/contact only
    event.preventDefault();
    const startY = event.clientY;
    let dragging = false;

    function handlePointerMove(moveEvent: PointerEvent) {
      if (!dragging && Math.abs(moveEvent.clientY - startY) < DRAG_THRESHOLD_PX) return;
      if (!dragging) {
        dragging = true;
        document.body.style.cursor = 'grabbing';
      }
      host.style.top = `${percentFromClientY(moveEvent.clientY, window.innerHeight)}%`;
    }

    function stopDragging() {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerCancel);
    }

    function handlePointerUp(upEvent: PointerEvent) {
      stopDragging();
      if (!dragging) return;
      document.body.style.cursor = '';
      suppressClickRef.current = true;
      const percent = percentFromClientY(upEvent.clientY, window.innerHeight);
      host.style.top = `${percent}%`;
      void setBubbleSettings({ verticalPercent: percent });
    }

    function handlePointerCancel() {
      // Browser took the pointer back (e.g. touch turned into a scroll) —
      // abandon the drag without persisting a position.
      stopDragging();
      if (dragging) document.body.style.cursor = '';
    }

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerCancel);
  }

  // All three hide actions take effect immediately for this page view (the
  // local setState hides the bubble right now) in addition to persisting.
  // The settings-scoped ones would also arrive via the storage.onChanged
  // listener above a beat later — the eager local update just avoids that
  // visible lag; the session-scoped one has no listener and is final for
  // this page's lifetime.
  function handleHideUntilRestart() {
    void hideBubbleUntilRestart();
    setSessionHidden(true);
  }

  function handleHideDomain() {
    const site = getCurrentCaptureSite();
    if (site) void setBubbleHiddenOnDomain(site, true);
    setSettingsHidden(true);
  }

  function handleHideGlobally() {
    void setBubbleSettings({ hiddenGlobally: true });
    setSettingsHidden(true);
  }

  if (sessionHidden || settingsHidden) return null;

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
      <Bubble
        isOpen={isOpen}
        onClick={handleToggle}
        onDragStart={handleDragStart}
        onHideUntilRestart={handleHideUntilRestart}
        onHideDomain={handleHideDomain}
        onHideGlobally={handleHideGlobally}
      />
    </div>
  );
}
