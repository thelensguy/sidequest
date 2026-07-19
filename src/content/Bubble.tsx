import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ShieldIcon, XIcon } from '../components/icons';
import { BubbleHideMenu } from './BubbleHideMenu';

interface BubbleProps {
  isOpen: boolean;
  onClick: () => void;
  onDragStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onHideUntilRestart: () => void;
  onHideDomain: () => void;
  onHideGlobally: () => void;
}

/**
 * The floating action bubble — small, fixed to a viewport corner (see
 * `.sq-root` / host positioning in index.tsx), unobtrusive until hovered.
 * Toggling behavior (open vs close) lives in ContentApp; this component is
 * purely presentational. Uses the same ShieldIcon brand mark as the
 * dashboard's `.brand-mark` and the popup's header (not a generic
 * bookmark/save glyph) plus a hover label, so it reads as SideQuest at a
 * glance instead of "some save extension."
 *
 * Also owns the hide-menu's own open/closed state (not lifted to
 * ContentApp) since nothing outside this component cares whether the menu
 * is showing — only the three hide *actions* it can trigger matter
 * upstream.
 */
export function Bubble({
  isOpen,
  onClick,
  onDragStart,
  onHideUntilRestart,
  onHideDomain,
  onHideGlobally,
}: BubbleProps) {
  const [hideMenuOpen, setHideMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dismissButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!hideMenuOpen) return;

    // event.composedPath() — not event.target — is what actually works for
    // detecting outside clicks from inside a shadow root. A listener on
    // the real document sees event.target retargeted to the shadow host
    // for anything inside our own tree, which would make every click
    // (including on the menu's own items) look indistinguishable from a
    // genuine outside click.
    function handleDocumentClick(event: MouseEvent) {
      const path = event.composedPath();
      const insideMenu = menuRef.current !== null && path.includes(menuRef.current);
      const onDismissButton = dismissButtonRef.current !== null && path.includes(dismissButtonRef.current);
      if (!insideMenu && !onDismissButton) setHideMenuOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setHideMenuOpen(false);
    }

    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [hideMenuOpen]);

  return (
    <div className="sq-bubble-wrap">
      <button
        type="button"
        className={`sq-bubble${isOpen ? ' sq-bubble--open' : ''}`}
        onClick={onClick}
        onPointerDown={isOpen ? undefined : onDragStart}
        aria-label={isOpen ? 'Close SideQuest capture panel' : 'Save this posting with SideQuest'}
        aria-expanded={isOpen}
        data-tip={isOpen ? undefined : 'SideQuest'}
      >
        {isOpen ? <XIcon /> : <ShieldIcon />}
      </button>

      {!isOpen && (
        <button
          type="button"
          ref={dismissButtonRef}
          className="sq-bubble-dismiss"
          aria-label="Hide SideQuest capture button"
          aria-expanded={hideMenuOpen}
          onClick={(event) => {
            event.stopPropagation();
            setHideMenuOpen((open) => !open);
          }}
        >
          <XIcon />
        </button>
      )}

      {hideMenuOpen && (
        <BubbleHideMenu
          menuRef={menuRef}
          onHideUntilRestart={() => {
            setHideMenuOpen(false);
            onHideUntilRestart();
          }}
          onHideDomain={() => {
            setHideMenuOpen(false);
            onHideDomain();
          }}
          onHideGlobally={() => {
            setHideMenuOpen(false);
            onHideGlobally();
          }}
        />
      )}
    </div>
  );
}
