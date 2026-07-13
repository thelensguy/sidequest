import type { RefObject } from 'react';

interface BubbleHideMenuProps {
  menuRef: RefObject<HTMLDivElement | null>;
  onHideUntilRestart: () => void;
  onHideDomain: () => void;
  onHideGlobally: () => void;
}

/** The 3-tier hide menu opened by the bubble's dismiss ("X") button. */
export function BubbleHideMenu({
  menuRef,
  onHideUntilRestart,
  onHideDomain,
  onHideGlobally,
}: BubbleHideMenuProps) {
  return (
    <div className="sq-hide-menu" ref={menuRef} role="menu" aria-label="Hide SideQuest capture button">
      <button type="button" className="sq-hide-menu-item" role="menuitem" onClick={onHideUntilRestart}>
        Hide until next visit
      </button>
      <button type="button" className="sq-hide-menu-item" role="menuitem" onClick={onHideDomain}>
        Hide on this site
      </button>
      <button type="button" className="sq-hide-menu-item" role="menuitem" onClick={onHideGlobally}>
        Hide on all sites
      </button>
    </div>
  );
}
