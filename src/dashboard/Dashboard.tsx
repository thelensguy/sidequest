import { useCallback, useEffect, useState } from 'react';
import type { JobEntry } from '../lib/types';
import { getJobEntries } from '../lib/storage';
import { JobTable } from './JobTable';
import { AddEntryForm } from './AddEntryForm';
import { BulkImportPanel } from './BulkImportPanel';
import './dashboard.css';

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
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <h1 className="dashboard__title">SideQuest</h1>
          <p className="dashboard__subtitle">
            {entries.length} application{entries.length === 1 ? '' : 's'} tracked
          </p>
        </div>
      </header>

      {/* GamificationPanel goes here — added post-merge */}
      <div className="gamification-slot">Level / XP display goes here</div>

      <section className="card">
        <div className="card__header">
          <h2 className="card__title">Applications</h2>
        </div>
        <div className="card__body" style={{ padding: 0 }}>
          {loading ? (
            <div className="job-row__empty">Loading…</div>
          ) : (
            <JobTable entries={entries} onChanged={refresh} />
          )}
        </div>
      </section>

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
    </div>
  );
}
