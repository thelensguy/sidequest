import { useState } from 'react';
import { createJobEntry } from '../lib/createEntry';
import { parseBulkImport, type ParseRowError } from '../lib/parseImport';

interface BulkImportPanelProps {
  /** Optional — a Dashboard tab already open elsewhere picks up the new
   *  entries on its own via storage.onChanged, so this is only for a
   *  caller that renders its own list (e.g. the dashboard, if it ever
   *  hosts this panel again) and wants an immediate in-tab refresh. */
  onImported?: () => void;
}

export function BulkImportPanel({ onImported }: BulkImportPanelProps) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<ParseRowError[]>([]);
  const [importing, setImporting] = useState(false);
  const [lastImportedCount, setLastImportedCount] = useState<number | null>(null);
  const [importFailure, setImportFailure] = useState<string | null>(null);

  async function handleImport() {
    const { rows, errors: parseErrors } = parseBulkImport(text);
    setErrors(parseErrors);
    setLastImportedCount(null);
    setImportFailure(null);

    if (rows.length === 0) return;

    setImporting(true);
    let succeeded = 0;
    try {
      // Sequential to keep each addJobEntry/appendEvent pair consistent
      // against the same read-modify-write storage layer.
      for (const row of rows) {
        await createJobEntry(row, 'import');
        succeeded++;
      }
      setLastImportedCount(succeeded);
      setText('');
      onImported?.();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setImportFailure(
        `Import stopped after a storage error: ${succeeded} of ${rows.length} row(s) were saved before it failed (${reason}).`
      );
      if (succeeded > 0) {
        setLastImportedCount(succeeded);
        onImported?.();
      }
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
          <span className="import-summary" role="status">
            Imported {lastImportedCount} row(s).
          </span>
        )}
      </div>
      {errors.length > 0 && (
        <div className="import-errors" role="alert">
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
      {importFailure && (
        <div className="import-errors" role="alert">
          {importFailure}
        </div>
      )}
    </div>
  );
}
