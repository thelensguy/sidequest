import { useEffect, useRef, useState } from 'react';
import { STATUS_ORDER, type ApplicationStatus } from '../lib/types';
import { ChevronDownIcon } from '../components/icons';
import { STATUS_QUEST_LABEL } from './statusMeta';

interface StatusFilterDropdownProps {
  selected: Set<ApplicationStatus>;
  onChange: (next: Set<ApplicationStatus>) => void;
}

/** Button label summarizing the current selection. */
function summarize(selected: Set<ApplicationStatus>): string {
  if (selected.size === STATUS_ORDER.length) return 'All statuses';
  if (selected.size === 0) return 'No statuses';
  if (selected.size <= 2) {
    return STATUS_ORDER.filter((s) => selected.has(s))
      .map((s) => STATUS_QUEST_LABEL[s])
      .join(', ');
  }
  return `${selected.size} statuses`;
}

/** Multi-select status filter — checkboxes so any combination of statuses can be shown at once. */
export function StatusFilterDropdown({ selected, onChange }: StatusFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const allSelected = selected.size === STATUS_ORDER.length;

  function toggleAll() {
    onChange(allSelected ? new Set() : new Set(STATUS_ORDER));
  }

  function toggleOne(status: ApplicationStatus) {
    const next = new Set(selected);
    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }
    onChange(next);
  }

  return (
    <div className="status-filter-dropdown" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="status-filter-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Filter by status: ${summarize(selected)}`}
      >
        {summarize(selected)}
        <ChevronDownIcon />
      </button>
      {open && (
        <div className="status-filter-menu">
          <label className="status-filter-option status-filter-option-all">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            All statuses
          </label>
          <div className="status-filter-divider" />
          {STATUS_ORDER.map((status) => (
            <label key={status} className="status-filter-option">
              <input
                type="checkbox"
                checked={selected.has(status)}
                onChange={() => toggleOne(status)}
              />
              {STATUS_QUEST_LABEL[status]}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
