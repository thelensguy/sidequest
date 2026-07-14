import { useCallback, useEffect, useState } from 'react';
import type { JobEntry } from '../lib/types';
import { getJobEntries } from '../lib/storage';
import { useTheme } from '../lib/useTheme';
import { JobTable } from './JobTable';
import { AddEntryForm } from './AddEntryForm';
import { StatsBar } from './StatsBar';
import { GamificationPanel } from '../gamification/GamificationPanel';
import { ShieldIcon, SettingsIcon, SunIcon, MoonIcon } from '../components/icons';
import './dashboard.css';

function openOptionsPage() {
  if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  }
}

export function Dashboard() {
  const [entries, setEntries] = useState<JobEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { theme, toggleTheme } = useTheme();

  const refresh = useCallback(async () => {
    const jobEntries = await getJobEntries();
    setEntries(jobEntries);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();

    // Keep the table live if jobEntries changes elsewhere (e.g. an Options
    // page JSON import or bulk import replaces/adds entries while this tab
    // is already open). Debounced because every local edit in this same tab
    // already triggers its own explicit refresh() (see JobRow/AddEntryForm's
    // onChanged props) — chrome.storage fires onChanged for same-tab writes
    // too, so without debouncing, a single edit double-fetches and a bulk
    // import (one storage write per row) would refetch once per row.
    let debounceId: number | null = null;
    function onStorageChanged(changes: { [key: string]: chrome.storage.StorageChange }) {
      if (!changes.jobEntries) return;
      if (debounceId !== null) window.clearTimeout(debounceId);
      debounceId = window.setTimeout(refresh, 300);
    }
    chrome.storage.local.onChanged?.addListener(onStorageChanged);
    return () => {
      chrome.storage.local.onChanged?.removeListener(onStorageChanged);
      if (debounceId !== null) window.clearTimeout(debounceId);
    };
  }, [refresh]);

  return (
    <div className="wrap">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <ShieldIcon />
          </span>
          <h1>SideQuest</h1>
        </div>
        <div className="topbar-right">
          <div className="eyebrow">Application Tracker</div>
          <button
            className="settings-btn"
            type="button"
            title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            onClick={toggleTheme}
          >
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
          </button>
          <button
            className="settings-btn"
            type="button"
            title="Reward loot table"
            aria-label="Open reward loot table settings"
            onClick={openOptionsPage}
          >
            <SettingsIcon />
          </button>
        </div>
      </header>

      <GamificationPanel />

      <StatsBar entries={entries} />

      {loading ? (
        <div className="empty-state" style={{ display: 'block' }}>
          Loading…
        </div>
      ) : (
        <JobTable entries={entries} onChanged={refresh} />
      )}

      <section className="card">
        <div className="card__header">
          <h2 className="card__title">Add entry</h2>
        </div>
        <div className="card__body">
          <AddEntryForm onAdded={refresh} />
        </div>
      </section>

      <footer className="foot">
        SIDEQUEST v1 — {entries.length} QUEST{entries.length === 1 ? '' : 'S'} TRACKED
      </footer>
    </div>
  );
}
