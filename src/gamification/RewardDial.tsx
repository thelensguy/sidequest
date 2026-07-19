import { useEffect, useRef, useState } from 'react';
import type { LootTableEntry } from '../lib/types';
import { pickWeightedTreat } from './wheel';

const SPIN_DURATION_MS = 3400;

/** Segment-boundary tick marks around the dial face, radius 20 to 28 from center (32, 32). */
function segmentLines(segments: number): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  return Array.from({ length: segments }, (_, i) => {
    const angle = (i / segments) * 2 * Math.PI;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const round = (n: number) => Math.round(n * 10) / 10;
    return {
      x1: round(32 + 20 * sin),
      y1: round(32 - 20 * cos),
      x2: round(32 + 28 * sin),
      y2: round(32 - 28 * cos),
    };
  });
}

interface RewardDialProps {
  unlocked: boolean;
  /** Countdown to the next every-5-applications milestone (1-5), from wheel.ts's applicationsUntilNextMilestone(). */
  applicationsUntilNext: number;
  lootTable: LootTableEntry[];
  /** Treat recorded by the last wheel_spin event, so a past win survives page reloads. */
  persistedTreatLabel: string | null;
  /** Called once a spin finishes revealing its result — the parent records the spin (and its treat) in the event log. */
  onSpun: (treat: LootTableEntry | null) => void;
}

/**
 * The Reward Dial: an SVG dial face with a fixed pin, spun via a direct
 * CSS `transform: rotate(...)` on the face element (accumulated across
 * spins, like a real mechanical dial that keeps turning the same
 * direction rather than resetting to 0). Ported from the mockup's plain-
 * JS spin mechanics 1:1 — see scheduleTicks()/fireTick() below for the
 * "haptic" pin snap and dial-reveal for the winning-treat pulse.
 */
export function RewardDial({
  unlocked,
  applicationsUntilNext,
  lootTable,
  persistedTreatLabel,
  onSpun,
}: RewardDialProps) {
  const dialFaceRef = useRef<SVGSVGElement>(null);
  const dialPinRef = useRef<HTMLDivElement>(null);
  const currentRotationRef = useRef(0);
  const tickTimeoutsRef = useRef<number[]>([]);

  const [spinning, setSpinning] = useState(false);
  const [lastTreatLabel, setLastTreatLabel] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);

  // One segment per treat, so the dial visually matches the actual odds
  // space (min 2 — a zero/one-treat dial still needs a drawable face).
  const segments = Math.max(2, lootTable.length);
  const segmentAngle = 360 / segments;

  useEffect(() => {
    return () => {
      tickTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  function fireTick(deg: number) {
    const pin = dialPinRef.current;
    if (!pin) return;
    pin.style.setProperty('--tick-deg', `${deg}deg`);
    pin.classList.remove('tick');
    void pin.offsetWidth; // restart animation
    pin.classList.add('tick');
  }

  // Ticks fire each time a segment boundary passes the fixed pin, spaced by
  // the same easing curve driving the visual spin: fast/dense at the start,
  // spreading out and fading in amplitude as the dial settles — simulates a
  // mechanical dial losing momentum against friction.
  function scheduleTicks(durationMs: number, totalRotationDeg: number) {
    tickTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    tickTimeoutsRef.current = [];

    const totalTicks = Math.floor(totalRotationDeg / segmentAngle);
    for (let i = 1; i <= totalTicks; i++) {
      const progress = i / totalTicks;
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out timing
      const fireAt = eased * durationMs;
      const idx = i;
      const timeoutId = window.setTimeout(() => {
        const amplitude = Math.max(0.4, 1 - idx / totalTicks) * 2; // fades out
        fireTick(idx % 2 === 0 ? amplitude : -amplitude);
      }, fireAt);
      tickTimeoutsRef.current.push(timeoutId);
    }
  }

  function handleSpin() {
    if (spinning || !unlocked) return;
    setSpinning(true);
    setReveal(false);

    const landingSegment = Math.floor(Math.random() * segments);
    const extraSpins = 5 + Math.floor(Math.random() * 3); // 5-7 full rotations
    const jitter = (Math.random() - 0.5) * (segmentAngle * 0.3);
    const totalRotation = extraSpins * 360 + landingSegment * segmentAngle + jitter;

    currentRotationRef.current += totalRotation;
    if (dialFaceRef.current) {
      dialFaceRef.current.style.transform = `rotate(${currentRotationRef.current}deg)`;
    }

    scheduleTicks(SPIN_DURATION_MS, totalRotation);

    window.setTimeout(() => {
      setSpinning(false);
      const picked = pickWeightedTreat(lootTable); // Part D: reads the admin-configured loot table
      setLastTreatLabel(picked ? picked.label : null);
      setReveal(true);
      onSpun(picked);
    }, SPIN_DURATION_MS + 60);
  }

  let hintText: string;
  let hintClass = '';
  if (lootTable.length === 0) {
    // Parent already refuses to unlock with an empty table — this explains why.
    hintText = 'Add treats in Settings to enable spins';
  } else if (unlocked) {
    hintText = 'Reward ready — click to spin';
    hintClass = 'ready';
  } else {
    const remaining = Math.max(1, applicationsUntilNext);
    hintText = `${remaining} more application${remaining === 1 ? '' : 's'} to next spin (or any rejection)`;
    hintClass = remaining <= 1 ? 'near-unlock' : '';
  }

  // Local state covers the just-spun reveal; the persisted label (from the
  // event log) covers everything after a reload.
  const shownTreatLabel = lastTreatLabel ?? persistedTreatLabel;

  return (
    <div className="hud-dial">
      <div
        className={`dial-outer${unlocked ? '' : ' locked'}`}
        onClick={handleSpin}
        role="button"
        tabIndex={unlocked ? 0 : -1}
        aria-disabled={!unlocked}
        aria-label={unlocked ? 'Spin the reward dial' : 'Reward dial locked'}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleSpin();
        }}
      >
        <div className="dial-pin" ref={dialPinRef} />
        <svg className="dial-face" ref={dialFaceRef} viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="31" fill="var(--bg)" stroke="var(--border)" strokeWidth={1} />
          <g stroke="var(--border-subtle)" strokeWidth={1}>
            {segmentLines(segments).map((line, i) => (
              <line key={i} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
            ))}
          </g>
          <g
            className="dial-center-icon"
            stroke="currentColor"
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            transform="translate(24,24) scale(0.7)"
          >
            <path d="M20 12v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V12" />
            <rect x="2" y="7" width="20" height="5" />
            <line x1="12" y1="22" x2="12" y2="7" />
            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
          </g>
        </svg>
      </div>
      <div className="dial-info">
        <div className="dial-title">Reward Dial</div>
        <div className={`dial-treat${reveal ? ' reveal' : ''}`} onAnimationEnd={() => setReveal(false)}>
          {spinning ? 'Spinning…' : shownTreatLabel ? `Won: ${shownTreatLabel}` : 'No reward claimed yet'}
        </div>
        <div className={`dial-hint${hintClass ? ` ${hintClass}` : ''}`}>{hintText}</div>
      </div>
    </div>
  );
}
