import { useCallback, useEffect, useState } from 'react';
import type { JobEntry } from '../lib/types';
import { getJobEntries } from '../lib/storage';
import { JobTable } from './JobTable';
import { AddEntryForm } from './AddEntryForm';
import { BulkImportPanel } from './BulkImportPanel';
import { StatsBar } from './StatsBar';
import { GamificationPanel } from '../gamification/GamificationPanel';
import { ShieldIcon, SettingsIcon } from '../components/icons';
import './dashboard.css';

function openOptionsPage() {
  if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  }
}

export function Dashboard() {
  const [entries, setEntries] = useState<JobEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const jobEntries = await getJobEntries();
    setEntries(jobEntries);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="wrap">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <ShieldIcon />
          </span>
          SideQuest
        </div>
        <div className="topbar-right">
          <div className="eyebrow">Application Tracker</div>
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

      <section className="card">
        <div className="card__header">
          <h2 className="card__title">Bulk import</h2>
        </div>
        <div className="card__body">
          <BulkImportPanel onImported={refresh} />
        </div>
      </section>

      <footer className="foot">
        SIDEQUEST v1 — {entries.length} QUEST{entries.length === 1 ? '' : 'S'} TRACKED
      </footer>
    </div>
  );
}
