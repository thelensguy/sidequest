interface BubbleProps {
  isOpen: boolean;
  onClick: () => void;
}

/**
 * The floating action bubble — small, fixed to a viewport corner (see
 * `.sq-root` / host positioning in index.tsx), unobtrusive until hovered.
 * Toggling behavior (open vs close) lives in ContentApp; this component is
 * purely presentational.
 */
export function Bubble({ isOpen, onClick }: BubbleProps) {
  return (
    <button
      type="button"
      className={`sq-bubble${isOpen ? ' sq-bubble--open' : ''}`}
      onClick={onClick}
      aria-label={isOpen ? 'Close SideQuest capture panel' : 'Save this posting with SideQuest'}
      aria-expanded={isOpen}
      title="SideQuest"
    >
      {isOpen ? <CloseIcon /> : <BookmarkIcon />}
    </button>
  );
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M6 3.5C6 2.67157 6.67157 2 7.5 2H16.5C17.3284 2 18 2.67157 18 3.5V21L12 17L6 21V3.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M6 6L18 18M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
