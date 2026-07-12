import type { ChangeEvent } from 'react';
import type { ExtractedJob } from '../capture/adapters';
import type { FieldStatuses } from './fieldStatus';
import { CheckCircleIcon, XCircleIcon } from '../components/icons';

type ReviewPhase = 'open' | 'saving' | 'saved' | 'error';

interface ReviewPanelProps {
  phase: ReviewPhase;
  draft: ExtractedJob;
  statuses: FieldStatuses;
  errorMessage?: string;
  onChange: (field: keyof ExtractedJob, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

const FIELD_ORDER: Array<keyof ExtractedJob> = ['role', 'company', 'url'];

const FIELD_LABELS: Record<keyof ExtractedJob, string> = {
  role: 'Role',
  company: 'Company',
  url: 'Job URL',
};

/**
 * The in-page "audit before save" review step. Always shows editable
 * fields (pre-filled from extraction when available, blank when not) plus
 * an explicit per-field indicator of whether that value was auto-extracted
 * or came back empty — so a failed/partial extraction is visibly flagged
 * rather than silently presenting an incomplete draft as if it were
 * trustworthy. Save is disabled until every field has real content;
 * Cancel always works, discarding the draft without writing anything.
 */
export function ReviewPanel({
  phase,
  draft,
  statuses,
  errorMessage,
  onChange,
  onSave,
  onCancel,
}: ReviewPanelProps) {
  if (phase === 'saved') {
    return (
      <div className="sq-panel" role="dialog" aria-label="SideQuest capture saved">
        <p className="sq-saved-message">
          <CheckCircleIcon />
          Saved to SideQuest.
        </p>
      </div>
    );
  }

  const isSaving = phase === 'saving';
  const canSave =
    !isSaving && draft.company.trim() !== '' && draft.role.trim() !== '' && draft.url.trim() !== '';

  return (
    <div className="sq-panel" role="dialog" aria-label="Review job posting details">
      <p className="sq-panel-title">Save this posting</p>

      {FIELD_ORDER.map((field) => (
        <label className="sq-field" key={field}>
          <span className="sq-field-label">
            {FIELD_LABELS[field]}
            <span className={`sq-status sq-status--${statuses[field]}`}>
              {statuses[field] === 'extracted' ? '[AUTO-FILLED]' : '[NOT FOUND]'}
            </span>
          </span>
          <input
            className="sq-input"
            value={draft[field]}
            disabled={isSaving}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(field, event.target.value)}
          />
        </label>
      ))}

      {phase === 'error' && errorMessage && (
        <p className="sq-error">
          <XCircleIcon />
          {errorMessage}
        </p>
      )}

      <div className="sq-actions">
        <button type="button" className="sq-btn sq-btn--primary" onClick={onSave} disabled={!canSave}>
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          className="sq-btn sq-btn--secondary"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
