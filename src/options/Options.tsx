import { useEffect, useRef, useState } from 'react';
import {
  getBubbleSettings,
  getLootTable,
  setBubbleHiddenOnDomain,
  setBubbleSettings,
  setLootTable,
} from '../lib/storage';
import type { BubbleSettings, CaptureSite, LootTableEntry } from '../lib/types';
import { PlusIcon, ShieldIcon, XIcon } from '../components/icons';
import '../dashboard/dashboard.css';

type SaveStatus = 'idle' | 'saving' | 'saved';

const CAPTURE_SITE_LABELS: { site: CaptureSite; label: string }[] = [
  { site: 'linkedin', label: 'LinkedIn' },
  { site: 'indeed', label: 'Indeed' },
  { site: 'ziprecruiter', label: 'ZipRecruiter' },
];

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
  const [entries, setEntries] = useState<LootTableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const idCounterRef = useRef(0);
  const statusTimeoutRef = useRef<number | null>(null);

  const [bubbleSettings, setBubbleSettingsState] = useState<BubbleSettings | null>(null);
  const [bubbleStatus, setBubbleStatus] = useState<SaveStatus>('idle');
  const bubbleStatusTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    getLootTable().then((loaded) => {
      setEntries(loaded);
      idCounterRef.current = loaded.length;
      setLoading(false);
    });
    getBubbleSettings().then(setBubbleSettingsState);
    return () => {
      if (statusTimeoutRef.current !== null) window.clearTimeout(statusTimeoutRef.current);
      if (bubbleStatusTimeoutRef.current !== null) window.clearTimeout(bubbleStatusTimeoutRef.current);
    };
  }, []);

  function flashBubbleSaved() {
    setBubbleStatus('saved');
    if (bubbleStatusTimeoutRef.current !== null) window.clearTimeout(bubbleStatusTimeoutRef.current);
    bubbleStatusTimeoutRef.current = window.setTimeout(() => setBubbleStatus('idle'), 1200);
  }

  async function handleToggleGlobal(hiddenGlobally: boolean) {
    setBubbleStatus('saving');
    setBubbleSettingsState(await setBubbleSettings({ hiddenGlobally }));
    flashBubbleSaved();
  }

  async function handleToggleSite(site: CaptureSite, hidden: boolean) {
    setBubbleStatus('saving');
    setBubbleSettingsState(await setBubbleHiddenOnDomain(site, hidden));
    flashBubbleSaved();
  }

  async function persist(next: LootTableEntry[]) {
    setEntries(next);
    setStatus('saving');
    await setLootTable(next);
    setStatus('saved');
    if (statusTimeoutRef.current !== null) window.clearTimeout(statusTimeoutRef.current);
    statusTimeoutRef.current = window.setTimeout(() => setStatus('idle'), 1200);
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
          SideQuest Settings
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

            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10, minHeight: 14 }}>
              {status === 'saving' && 'Saving…'}
              {status === 'saved' && 'Saved.'}
            </div>
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

            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10, minHeight: 14 }}>
              {bubbleStatus === 'saving' && 'Saving…'}
              {bubbleStatus === 'saved' && 'Saved.'}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
