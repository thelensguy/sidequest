import { useEffect, useRef, useState } from 'react';
import {
  getBubbleSettings,
  getEvents,
  getJobEntries,
  getLootTable,
  setBubbleHiddenOnDomain,
  setBubbleSettings,
  setEvents,
  setJobEntries,
  setLootTable,
} from '../lib/storage';
import { validateExportData } from '../lib/importExport';
import type { BubbleSettings, CaptureSite, LootTableEntry } from '../lib/types';
import { todayLocalDateString } from '../lib/dateUtils';
import { useTheme } from '../lib/useTheme';
import { PlusIcon, ShieldIcon, XIcon } from '../components/icons';
import { BulkImportPanel } from './BulkImportPanel';
import '../dashboard/dashboard.css';

type SaveStatus = 'idle' | 'saving' | 'saved';

const CAPTURE_SITE_LABELS: { site: CaptureSite; label: string }[] = [
  { site: 'linkedin', label: 'LinkedIn' },
  { site: 'indeed', label: 'Indeed' },
  { site: 'ziprecruiter', label: 'ZipRecruiter' },
];

/** Shared "saving…/saved." status used by all three sections below — flash() marks 'saved' and auto-clears back to 'idle' after 1.2s. */
function useFlashStatus() {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  function flash() {
    setStatus('saved');
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setStatus('idle'), 1200);
  }

  return { status, setStatus, flash };
}

function StatusLine({
  status,
  savingLabel,
  savedLabel,
}: {
  status: SaveStatus;
  savingLabel: string;
  savedLabel: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10, minHeight: 14 }}
    >
      {status === 'saving' && savingLabel}
      {status === 'saved' && savedLabel}
    </div>
  );
}

/**
 * Part D: Custom Admin Loot Table editor — the reward-wheel's weighted
 * treat list. Ported from the mockup's admin-panel/loot-table markup
 * (src/gamification/RewardDial.tsx reads this same table via
 * pickWeightedTreat() in src/gamification/wheel.ts), reskinned to live on
 * its own page here rather than an inline toggle panel, since this
 * extension's Options page is already its own top-level surface (see
 * manifest.config.ts's options_page) reached from the dashboard's gear
 * icon via chrome.runtime.openOptionsPage().
 */
export function Options() {
  // No toggle control here (that lives on the Dashboard) — this just needs
  // to apply whatever theme is currently set so the page doesn't look
  // wrong/inconsistent when opened, and stay live if it's flipped elsewhere.
  useTheme();

  const [entries, setEntries] = useState<LootTableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const lootStatus = useFlashStatus();
  const idCounterRef = useRef(0);

  const [bubbleSettings, setBubbleSettingsState] = useState<BubbleSettings | null>(null);
  const bubbleStatus = useFlashStatus();

  const dataStatus = useFlashStatus();
  const [dataStatusMessage, setDataStatusMessage] = useState('');
  const [dataError, setDataError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    getLootTable().then((loaded) => {
      setEntries(loaded);
      idCounterRef.current = loaded.length;
      setLoading(false);
    });
    getBubbleSettings().then(setBubbleSettingsState);
  }, []);

  async function handleToggleGlobal(hiddenGlobally: boolean) {
    bubbleStatus.setStatus('saving');
    setBubbleSettingsState(await setBubbleSettings({ hiddenGlobally }));
    bubbleStatus.flash();
  }

  async function handleToggleSite(site: CaptureSite, hidden: boolean) {
    bubbleStatus.setStatus('saving');
    setBubbleSettingsState(await setBubbleHiddenOnDomain(site, hidden));
    bubbleStatus.flash();
  }

  function flashDataStatus(message: string) {
    setDataStatusMessage(message);
    dataStatus.flash();
  }

  async function handleExport() {
    const [jobEntries, appEvents] = await Promise.all([getJobEntries(), getEvents()]);
    const blob = new Blob([JSON.stringify({ jobEntries, appEvents }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sidequest-export-${todayLocalDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flashDataStatus('Exported.');
  }

  function handleImportClick() {
    setDataError(null);
    fileInputRef.current?.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setDataError(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setDataError('That file is not valid JSON.');
      return;
    }

    const result = validateExportData(parsed);
    if ('error' in result) {
      setDataError(result.error);
      return;
    }

    const { jobEntries, appEvents } = result.data;
    const currentEntries = await getJobEntries();
    const confirmed = window.confirm(
      `Replace all ${currentEntries.length} existing entries with ${jobEntries.length} from this file? This can't be undone.`
    );
    if (!confirmed) return;

    dataStatus.setStatus('saving');
    try {
      await Promise.all([setJobEntries(jobEntries), setEvents(appEvents)]);
      flashDataStatus('Imported.');
    } catch {
      dataStatus.setStatus('idle');
      setDataError('Import failed to save — your existing data may be partially overwritten.');
    }
  }

  async function persist(next: LootTableEntry[]) {
    setEntries(next);
    lootStatus.setStatus('saving');
    await setLootTable(next);
    lootStatus.flash();
  }

  function updateField(id: string, updates: Partial<Omit<LootTableEntry, 'id'>>) {
    persist(entries.map((entry) => (entry.id === id ? { ...entry, ...updates } : entry)));
  }

  function handleRemove(id: string) {
    persist(entries.filter((entry) => entry.id !== id));
  }

  function handleAdd() {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    idCounterRef.current += 1;
    persist([
      ...entries,
      { id: `custom-${idCounterRef.current}`, label: trimmed, tier: 'common', weight: 20 },
    ]);
    setNewLabel('');
  }

  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0) || 1;

  return (
    <div className="wrap" style={{ maxWidth: 640 }}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <ShieldIcon />
          </span>
          <h1>SideQuest Settings</h1>
        </div>
        <div className="eyebrow">Reward Loot Table</div>
      </header>

      <section className="admin-panel">
        <div className="admin-header">
          <h2>Reward Loot Table</h2>
        </div>
        <p className="admin-sub">
          Weighted odds — the Reward Dial reads this table directly. Higher weight = more likely.
        </p>

        {loading ? (
          <p style={{ color: 'var(--text-3)', fontSize: 12.5 }}>Loading…</p>
        ) : (
          <>
            <div className="loot-table">
              <div className="loot-row head">
                <div>Treat</div>
                <div>Tier</div>
                <div>Weight</div>
                <div>Odds</div>
                <div></div>
              </div>
              {entries.map((entry) => {
                const pct = Math.round((entry.weight / totalWeight) * 100);
                return (
                  <div className="loot-row" key={entry.id}>
                    <input
                      className="loot-label-input"
                      value={entry.label}
                      onChange={(e) => updateField(entry.id, { label: e.target.value })}
                      aria-label="Treat label"
                    />
                    <select
                      className="tier-select"
                      data-tier={entry.tier}
                      value={entry.tier}
                      onChange={(e) =>
                        updateField(entry.id, { tier: e.target.value as LootTableEntry['tier'] })
                      }
                      aria-label="Rarity tier"
                    >
                      <option value="common">[COMMON]</option>
                      <option value="rare">[RARE]</option>
                      <option value="epic">[EPIC]</option>
                    </select>
                    <input
                      type="number"
                      className="loot-weight-input"
                      min={1}
                      value={entry.weight}
                      onChange={(e) =>
                        updateField(entry.id, { weight: Math.max(1, parseInt(e.target.value, 10) || 1) })
                      }
                      aria-label="Weight"
                    />
                    <div className="loot-pct">{pct}%</div>
                    <button
                      className="loot-remove"
                      type="button"
                      onClick={() => handleRemove(entry.id)}
                      aria-label={`Remove ${entry.label || 'treat'}`}
                    >
                      <XIcon />
                    </button>
                  </div>
                );
              })}
              {entries.length === 0 && (
                <div className="loot-row">
                  <div style={{ color: 'var(--text-3)', fontSize: 12, gridColumn: '1 / -1' }}>
                    No treats yet — add one below so the wheel has something to land on.
                  </div>
                </div>
              )}
            </div>

            <div className="admin-add-row">
              <input
                type="text"
                placeholder="Add a new treat…"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd();
                }}
                aria-label="New treat label"
              />
              <button className="btn-primary" type="button" onClick={handleAdd}>
                <PlusIcon />
                Add
              </button>
            </div>

            <StatusLine status={lootStatus.status} savingLabel="Saving…" savedLabel="Saved." />
          </>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-header">
          <h2>Capture Bubble</h2>
        </div>
        <p className="admin-sub">
          The floating save button that appears on LinkedIn, Indeed, and ZipRecruiter — reverses
          anything hidden from the bubble's own dismiss menu.
        </p>

        {bubbleSettings === null ? (
          <p style={{ color: 'var(--text-3)', fontSize: 12.5 }}>Loading…</p>
        ) : (
          <>
            <div className="toggle-row">
              <span className="toggle-row-label">Show on all sites</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={!bubbleSettings.hiddenGlobally}
                  onChange={(e) => handleToggleGlobal(!e.target.checked)}
                  aria-label="Show capture bubble on all sites"
                />
                <span className="toggle-switch-track" />
              </label>
            </div>

            {CAPTURE_SITE_LABELS.map(({ site, label }) => (
              <div className="toggle-row" key={site}>
                <span className="toggle-row-label">{label}</span>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={!bubbleSettings.hiddenDomains.includes(site)}
                    disabled={bubbleSettings.hiddenGlobally}
                    onChange={(e) => handleToggleSite(site, !e.target.checked)}
                    aria-label={`Show capture bubble on ${label}`}
                  />
                  <span className="toggle-switch-track" />
                </label>
              </div>
            ))}

            <StatusLine status={bubbleStatus.status} savingLabel="Saving…" savedLabel="Saved." />
          </>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-header">
          <h2>Bulk Import</h2>
        </div>
        <p className="admin-sub">
          Paste rows copied from a spreadsheet to backfill your history in one go.
        </p>
        <BulkImportPanel />
      </section>

      <section className="admin-panel">
        <div className="admin-header">
          <h2>Data</h2>
        </div>
        <p className="admin-sub">
          Export your full job-tracker history as a JSON file, or import one to replace what's
          here now.
        </p>

        <div className="import-actions">
          <button className="btn" type="button" onClick={handleExport}>
            Export data
          </button>
          <button className="btn btn--secondary" type="button" onClick={handleImportClick}>
            Import data
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
            aria-label="Import data file"
          />
        </div>

        {dataError && (
          <div className="import-errors" role="alert">
            {dataError}
          </div>
        )}

        <StatusLine status={dataStatus.status} savingLabel="Importing…" savedLabel={dataStatusMessage} />
      </section>
    </div>
  );
}
