import { useState, type ReactNode } from 'react';

interface EditableFieldProps {
  value: string;
  onSave: (next: string) => void;
  placeholder?: string;
  /** Render the read-only value (e.g. as a link) instead of plain text. */
  renderDisplay?: (value: string) => ReactNode;
}

/**
 * Click-to-edit text field used for inline editing of company/role/url.
 * Commits on blur or Enter, cancels on Escape.
 */
export function EditableField({ value, onSave, placeholder, renderDisplay }: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function startEditing() {
    setDraft(value);
    setIsEditing(true);
  }

  function commit() {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    }
  }

  function cancel() {
    setDraft(value);
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <input
        className="editable-field__input"
        autoFocus
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') cancel();
        }}
      />
    );
  }

  return (
    <span
      className="editable-field"
      onClick={startEditing}
      title="Click to edit"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') startEditing();
      }}
    >
      {renderDisplay ? renderDisplay(value) : value || placeholder}
    </span>
  );
}
