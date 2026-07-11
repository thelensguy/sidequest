import { useState } from 'react';
import { createJobEntry } from './createEntry';
import { parseBulkImport, type ParseRowError } from './parseImport';

interface BulkImportPanelProps {
  onImported: () => void;
}

export function BulkImportPanel({ onImported }: BulkImportPanelProps) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<ParseRowError[]>([]);
  const [importing, setImporting] = useState(false);
  const [lastImportedCount, setLastImportedCount] = useState<number | null>(null);

  async function handleImport() {
    const { rows, errors: parseErrors } = parseBulkImport(text);
    setErrors(parseErrors);
    setLastImportedCount(null);

    if (rows.length === 0) return;

    setImporting(true);
    try {
      // Sequential to keep each addJobEntry/appendEvent pair consistent
      // against the same read-modify-write storage layer.
      for (const row of rows) {
        await createJobEntry(row, 'import');
      }
      setLastImportedCount(rows.length);
      setText('');
      onImported();
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <p className="import-hint">
        Paste rows copied from a spreadsheet — tab- or comma-separated:{' '}
        <code>company, role, url, status, date</code>. Status and date are optional (defaults to
        "saved" / today).
      </p>
      <textarea
        className="import-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Acme Corp\tFrontend Engineer\thttps://acme.co/jobs/123\tapplied\t2026-06-01'}
      />
      <div className="import-actions">
        <button
          className="btn"
          type="button"
          onClick={handleImport}
          disabled={importing || !text.trim()}
        >
          {importing ? 'Importing…' : 'Import rows'}
        </button>
        {lastImportedCount !== null && (
          <span className="import-summary">Imported {lastImportedCount} row(s).</span>
        )}
      </div>
      {errors.length > 0 && (
        <div className="import-errors">
          {errors.length} row(s) skipped:
          <ul>
            {errors.map((err) => (
              <li key={err.line}>
                Line {err.line}: {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
