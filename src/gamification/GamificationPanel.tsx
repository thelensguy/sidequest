import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { appendEvent, getEvents, getLootTable, getWheelCadence } from '../lib/storage';
import { computeXp } from './xp';
import { levelForXp } from './levels';
import { computeBadges, type Badge } from './badges';
import { deriveLastSpunCheckpoint, deriveWheelStatus, lastWonTreatLabel } from './wheel';
import { getLegacyLastSpunAtEventCount } from './wheelState';
import { RewardDial } from './RewardDial';
import { ShieldIcon, FileCheckIcon, TargetIcon, ShieldCheckIcon, TrophyIcon, FlameIcon } from '../components/icons';
import type { AppEvent, LootTableEntry } from '../lib/types';

const XP_PER_LEVEL = 100;

const BADGE_ICON: Record<string, typeof ShieldIcon> = {
  'first-application': FileCheckIcon,
  'first-interview': TargetIcon,
  'first-rejection': ShieldCheckIcon,
  'first-offer': TrophyIcon,
  'seven-day-streak': FlameIcon,
};

interface GamificationState {
  loading: boolean;
  events: AppEvent[];
  lootTable: LootTableEntry[];
  xp: number;
  level: number;
  levelLabel: string;
  badges: Badge[];
  wheelUnlocked: boolean;
  applicationsUntilNext: number;
  persistedTreatLabel: string | null;
}

const INITIAL_STATE: GamificationState = {
  loading: true,
  events: [],
  lootTable: [],
  xp: 0,
  level: 1,
  levelLabel: 'Level 1 Job Seeker',
  badges: [],
  wheelUnlocked: false,
  applicationsUntilNext: 5,
  persistedTreatLabel: null,
};

function levelInto(xp: number) {
  const safeXp = Math.max(0, xp);
  return { level: Math.floor(safeXp / XP_PER_LEVEL) + 1, into: safeXp % XP_PER_LEVEL };
}

/** requestAnimationFrame-driven ease-out count-up, matching the mockup's animateCountUp(). */
function animateCountUp(
  from: number,
  to: number,
  duration: number,
  onUpdate: (value: number) => void,
  rafRef: MutableRefObject<number | null>
) {
  if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  const start = performance.now();
  function step(ts: number) {
    const progress = Math.min((ts - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 2);
    onUpdate(Math.round(from + (to - from) * eased));
    rafRef.current = progress < 1 ? requestAnimationFrame(step) : null;
  }
  rafRef.current = requestAnimationFrame(step);
}

/**
 * Self-contained gamification display: fetches its own data (events, loot
 * table, spin checkpoint) so any page can drop in <GamificationPanel />
 * with no props. Renders the HUD strip (level/XP line/badges/Reward Dial),
 * and drives the Juice (Part C) count-up + Goal Gradient animations on top
 * of the underlying XP/level truth from src/gamification/xp.ts + levels.ts.
 */
export function GamificationPanel() {
  const [state, setState] = useState<GamificationState>(INITIAL_STATE);

  // Juice/Goal-Gradient display state — this is what actually renders;
  // it "chases" state.xp/state.level via the animation effect below rather
  // than mirroring them instantly, so an XP change reads as an event.
  const [displayedXp, setDisplayedXp] = useState(0);
  const [displayedLevel, setDisplayedLevel] = useState(1);
  const [xpFillPct, setXpFillPct] = useState(0);
  const [nearGoal, setNearGoal] = useState(false);
  const [xpFlash, setXpFlash] = useState(false);
  const [levelFlash, setLevelFlash] = useState(false);

  const prevXpRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const xpFillRef = useRef<HTMLDivElement>(null);
  const timeoutsRef = useRef<number[]>([]);

  async function refresh() {
    const [events, lootTable, legacyCheckpoint, cadence] = await Promise.all([
      getEvents(),
      getLootTable(),
      getLegacyLastSpunAtEventCount(),
      getWheelCadence(),
    ]);
    // Spins are recorded in the event log itself; the legacy stored counter
    // only matters for installs that last spun before that migration.
    const derived = deriveLastSpunCheckpoint(events);
    const lastSpunAtEventCount = derived > 0 ? derived : legacyCheckpoint;
    const wheel = deriveWheelStatus(events, lastSpunAtEventCount, cadence);
    const xp = computeXp(events);
    const { level, label } = levelForXp(xp);
    setState({
      loading: false,
      events,
      lootTable,
      xp,
      level,
      levelLabel: label,
      badges: computeBadges(events),
      // A milestone can't unlock a spin the dial has nothing to land on.
      wheelUnlocked: wheel.unlocked && lootTable.length > 0,
      applicationsUntilNext: wheel.applicationsUntilNext,
      persistedTreatLabel: lastWonTreatLabel(events),
    });
  }

  useEffect(() => {
    refresh();

    // Keep the panel live if events/loot table change elsewhere (e.g. a
    // capture or status update happens in another extension page while
    // this one is open). Debounced for the same reason Dashboard.tsx's
    // listener is: chrome.storage fires onChanged for same-page writes
    // too, and a bulk import writes appEvents once per row — without the
    // debounce that's a full recompute per imported row.
    let debounceId: number | null = null;
    function onStorageChanged(changes: { [key: string]: chrome.storage.StorageChange }) {
      if (!changes.appEvents && !changes.lootTable && !changes.wheelCadence) return;
      if (debounceId !== null) window.clearTimeout(debounceId);
      debounceId = window.setTimeout(refresh, 300);
    }
    chrome.storage.local.onChanged?.addListener(onStorageChanged);
    return () => {
      chrome.storage.local.onChanged?.removeListener(onStorageChanged);
      if (debounceId !== null) window.clearTimeout(debounceId);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  // Part 2 (Juice) + Part 3 (Goal Gradient): whenever the true XP total
  // changes, animate the HUD toward it instead of snapping. First paint
  // snaps with no animation (nothing to "count up" from on load).
  useEffect(() => {
    if (state.loading) return;
    const xp = state.xp;

    if (prevXpRef.current === null) {
      const info = levelInto(xp);
      setDisplayedXp(info.into);
      setDisplayedLevel(info.level);
      setXpFillPct(info.into);
      setNearGoal(info.into >= 75);
      prevXpRef.current = xp;
      return;
    }

    const before = prevXpRef.current;
    prevXpRef.current = xp;
    if (before === xp) return;

    const beforeInfo = levelInto(before);
    const afterInfo = levelInto(xp);
    const leveledUp = afterInfo.level > beforeInfo.level;

    setXpFlash(true);
    timeoutsRef.current.push(window.setTimeout(() => setXpFlash(false), 500));

    if (!leveledUp) {
      setXpFillPct(afterInfo.into);
      setNearGoal(afterInfo.into >= 75);
      animateCountUp(beforeInfo.into, afterInfo.into, 500, setDisplayedXp, rafRef);
      return;
    }

    // Two-stage level-up animation: race the fill to 100% (snappy,
    // pulsing — it's crossing the goal line), reset instantly with the
    // CSS transition disabled, then count up again inside the new level.
    setXpFillPct(100);
    setNearGoal(true);
    animateCountUp(beforeInfo.into, 100, 350, setDisplayedXp, rafRef);

    const resetTimeout = window.setTimeout(() => {
      const fillEl = xpFillRef.current;
      if (fillEl) {
        fillEl.style.transition = 'none';
        fillEl.style.width = '0%';
        void fillEl.offsetWidth; // force reflow so the reset isn't animated
        fillEl.style.transition = '';
      }
      setNearGoal(false);
      setXpFillPct(0);
      setDisplayedXp(0);
      setDisplayedLevel(afterInfo.level);
      setLevelFlash(true);
      timeoutsRef.current.push(window.setTimeout(() => setLevelFlash(false), 500));

      setXpFillPct(afterInfo.into);
      setNearGoal(afterInfo.into >= 75);
      animateCountUp(0, afterInfo.into, 500, setDisplayedXp, rafRef);
    }, 450);
    timeoutsRef.current.push(resetTimeout);
    // Only the raw XP total should re-trigger this animation sequence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.xp, state.loading]);

  async function handleSpun(treat: LootTableEntry | null) {
    // Recording the spin as an event (rather than persisting an event
    // count) makes the checkpoint self-consistent by construction: the
    // append lands at the end of the log, so everything before it —
    // including anything that happened while the dial was spinning — is
    // inside the new checkpoint automatically.
    await appendEvent({
      type: 'wheel_spin',
      jobEntryId: '',
      timestamp: new Date().toISOString(),
      metadata: treat ? { treatLabel: treat.label } : undefined,
    });
    refresh();
  }

  if (state.loading) {
    return <div className="hud" style={{ padding: 16 }}>Loading quest log…</div>;
  }

  const flavor = state.levelLabel.replace(/^Level \d+ /, '');

  return (
    <section className="hud">
      <div className="hud-level">
        <div className="hud-avatar">
          <ShieldIcon />
        </div>
        <div className="hud-level-text">
          <div className="hud-level-row">
            <span className={`hud-level-num${levelFlash ? ' flash' : ''}`}>
              LVL {String(displayedLevel).padStart(2, '0')}
            </span>
            <span className="hud-level-label">{flavor}</span>
          </div>
          <div className="xp-line-row">
            <div className="xp-line-track">
              <div
                ref={xpFillRef}
                className={`xp-line-fill${nearGoal ? ' near-goal' : ''}`}
                style={{ width: `${xpFillPct}%` }}
              />
            </div>
            <span className="xp-line-label">
              <span className={`xp-current${xpFlash ? ' flash' : ''}`}>{displayedXp}</span> / {XP_PER_LEVEL} XP
            </span>
          </div>
        </div>
      </div>

      <div className="hud-badges">
        {state.badges.map((badge) => {
          const BadgeIcon = BADGE_ICON[badge.id] ?? ShieldIcon;
          return (
            <span
              key={badge.id}
              className={`badge-chip${badge.unlocked ? '' : ' locked'}`}
              data-tip={badge.unlocked ? badge.label : `Locked — ${badge.label}`}
              aria-label={`${badge.label}: ${badge.description}${badge.unlocked ? '' : ' (locked)'}`}
            >
              <BadgeIcon />
            </span>
          );
        })}
      </div>

      <RewardDial
        unlocked={state.wheelUnlocked}
        applicationsUntilNext={state.applicationsUntilNext}
        lootTable={state.lootTable}
        persistedTreatLabel={state.persistedTreatLabel}
        onSpun={handleSpun}
      />
    </section>
  );
}
