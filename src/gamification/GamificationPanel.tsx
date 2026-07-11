import { useEffect, useState, type CSSProperties } from 'react';
import { getEvents, getTreats } from '../lib/storage';
import { computeXp } from './xp';
import { levelForXp } from './levels';
import { computeBadges, type Badge } from './badges';
import { pickTreat, shouldUnlockWheel } from './wheel';
import { getLastSpunAtEventCount, setLastSpunAtEventCount } from './wheelState';
import type { AppEvent } from '../lib/types';

const XP_PER_LEVEL = 100;

interface GamificationState {
  loading: boolean;
  events: AppEvent[];
  treats: string[];
  xp: number;
  level: number;
  levelLabel: string;
  badges: Badge[];
  wheelUnlocked: boolean;
}

const INITIAL_STATE: GamificationState = {
  loading: true,
  events: [],
  treats: [],
  xp: 0,
  level: 1,
  levelLabel: 'Level 1 Job Seeker',
  badges: [],
  wheelUnlocked: false,
};

/**
 * Self-contained gamification display: fetches its own data (events,
 * treats, spin checkpoint) so any page can drop in <GamificationPanel />
 * with no props. Renders an XP bar, level label, unlocked/locked badges,
 * and a "Quest Reward" wheel button gated by shouldUnlockWheel().
 */
export function GamificationPanel() {
  const [state, setState] = useState<GamificationState>(INITIAL_STATE);
  const [spinning, setSpinning] = useState(false);
  const [lastTreat, setLastTreat] = useState<string | null>(null);

  async function refresh() {
    const [events, treats, lastSpunAtEventCount] = await Promise.all([
      getEvents(),
      getTreats(),
      getLastSpunAtEventCount(),
    ]);
    const xp = computeXp(events);
    const { level, label } = levelForXp(xp);
    setState({
      loading: false,
      events,
      treats,
      xp,
      level,
      levelLabel: label,
      badges: computeBadges(events),
      wheelUnlocked: shouldUnlockWheel(events, lastSpunAtEventCount),
    });
  }

  useEffect(() => {
    refresh();

    // Keep the panel live if events/treats change elsewhere (e.g. a
    // capture or status update happens in another extension page while
    // this one is open).
    function onStorageChanged(changes: { [key: string]: chrome.storage.StorageChange }) {
      if (changes.appEvents || changes.treats) {
        refresh();
      }
    }
    chrome.storage.local.onChanged?.addListener(onStorageChanged);
    return () => chrome.storage.local.onChanged?.removeListener(onStorageChanged);
  }, []);

  async function handleSpin() {
    if (!state.wheelUnlocked || spinning || state.treats.length === 0) return;
    setSpinning(true);
    setLastTreat(null);
    // Small delay so the spin reads as an actual action, not an instant swap.
    await new Promise((resolve) => setTimeout(resolve, 700));
    const treat = pickTreat(state.treats);
    setLastTreat(treat);
    setSpinning(false);
    await setLastSpunAtEventCount(state.events.length);
    setState((prev) => ({ ...prev, wheelUnlocked: false }));
  }

  if (state.loading) {
    return <div style={styles.panel}>Loading quest log…</div>;
  }

  const xpIntoLevel = state.xp % XP_PER_LEVEL;
  const xpProgressPct = Math.min(100, (xpIntoLevel / XP_PER_LEVEL) * 100);

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.questBadgeIcon}>⚔️</span>
        <div>
          <div style={styles.levelLabel}>{state.levelLabel}</div>
          <div style={styles.xpText}>
            {xpIntoLevel} / {XP_PER_LEVEL} XP toward Level {state.level + 1}
            <span style={styles.totalXp}> · {state.xp} XP total</span>
          </div>
        </div>
      </div>

      <div style={styles.xpBarTrack} aria-label="XP progress">
        <div style={{ ...styles.xpBarFill, width: `${xpProgressPct}%` }} />
      </div>

      <div style={styles.sectionTitle}>Badges</div>
      <ul style={styles.badgeList}>
        {state.badges.map((badge) => (
          <li
            key={badge.id}
            style={badge.unlocked ? styles.badgeUnlocked : styles.badgeLocked}
            title={badge.description}
          >
            <span style={{ marginRight: 6 }}>{badge.unlocked ? '🏅' : '🔒'}</span>
            {badge.label}
          </li>
        ))}
      </ul>

      <div style={styles.sectionTitle}>Quest Reward</div>
      <div style={styles.wheelBox}>
        <button
          type="button"
          onClick={handleSpin}
          disabled={!state.wheelUnlocked || spinning || state.treats.length === 0}
          style={{
            ...styles.spinButton,
            ...(state.wheelUnlocked && !spinning ? styles.spinButtonActive : styles.spinButtonDisabled),
          }}
        >
          {spinning ? 'Spinning…' : state.wheelUnlocked ? '🎡 Spin for a Reward' : '🎡 Wheel Locked'}
        </button>
        <p style={styles.wheelHint}>
          {state.treats.length === 0
            ? 'Add some treats in Settings to enable the wheel.'
            : state.wheelUnlocked
              ? 'A milestone unlocked a spin — claim it!'
              : 'Unlocks every 5 applications, every rejection, and every level-up.'}
        </p>
        {lastTreat && (
          <div style={styles.treatResult}>
            You earned: <strong>{lastTreat}</strong>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  panel: {
    fontFamily: 'system-ui, sans-serif',
    maxWidth: 480,
    padding: 20,
    borderRadius: 12,
    border: '1px solid #e5e0f7',
    background: 'linear-gradient(180deg, #faf9ff 0%, #ffffff 100%)',
    color: '#1f1a3d',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  questBadgeIcon: {
    fontSize: 28,
  },
  levelLabel: {
    fontSize: 18,
    fontWeight: 700,
    color: '#4b2fb3',
  },
  xpText: {
    fontSize: 12,
    color: '#666',
  },
  totalXp: {
    color: '#999',
  },
  xpBarTrack: {
    height: 10,
    borderRadius: 6,
    background: '#ece8fb',
    overflow: 'hidden',
    marginBottom: 20,
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 6,
    background: 'linear-gradient(90deg, #7c5cff, #b98cff)',
    transition: 'width 300ms ease',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#8a7fc4',
    marginBottom: 8,
    marginTop: 16,
  },
  badgeList: {
    listStyle: 'none',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    padding: 0,
    margin: 0,
  },
  badgeUnlocked: {
    fontSize: 12,
    padding: '6px 10px',
    borderRadius: 999,
    background: '#efe9ff',
    border: '1px solid #c9b8ff',
    color: '#4b2fb3',
    fontWeight: 600,
  },
  badgeLocked: {
    fontSize: 12,
    padding: '6px 10px',
    borderRadius: 999,
    background: '#f2f2f2',
    border: '1px solid #e0e0e0',
    color: '#999',
  },
  wheelBox: {
    padding: 14,
    borderRadius: 10,
    background: '#fbfaff',
    border: '1px dashed #d3c6ff',
    textAlign: 'center' as const,
  },
  spinButton: {
    fontSize: 14,
    fontWeight: 700,
    padding: '10px 18px',
    borderRadius: 999,
    border: 'none',
    cursor: 'pointer',
  },
  spinButtonActive: {
    background: 'linear-gradient(90deg, #7c5cff, #b98cff)',
    color: '#fff',
  },
  spinButtonDisabled: {
    background: '#e5e0f7',
    color: '#a89fd1',
    cursor: 'not-allowed',
  },
  wheelHint: {
    fontSize: 11,
    color: '#8a7fc4',
    marginTop: 8,
    marginBottom: 0,
  },
  treatResult: {
    marginTop: 10,
    fontSize: 13,
    color: '#4b2fb3',
  },
};
