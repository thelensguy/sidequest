import { ShieldIcon, XIcon } from '../components/icons';

interface BubbleProps {
  isOpen: boolean;
  onClick: () => void;
}

/**
 * The floating action bubble — small, fixed to a viewport corner (see
 * `.sq-root` / host positioning in index.tsx), unobtrusive until hovered.
 * Toggling behavior (open vs close) lives in ContentApp; this component is
 * purely presentational. Uses the same ShieldIcon brand mark as the
 * dashboard's `.brand-mark` and the popup's header (not a generic
 * bookmark/save glyph) plus a hover label, so it reads as SideQuest at a
 * glance instead of "some save extension."
 */
export function Bubble({ isOpen, onClick }: BubbleProps) {
  return (
    <button
      type="button"
      className={`sq-bubble${isOpen ? ' sq-bubble--open' : ''}`}
      onClick={onClick}
      aria-label={isOpen ? 'Close SideQuest capture panel' : 'Save this posting with SideQuest'}
      aria-expanded={isOpen}
      data-tip={isOpen ? undefined : 'SideQuest'}
    >
      {isOpen ? <XIcon /> : <ShieldIcon />}
    </button>
  );
}
