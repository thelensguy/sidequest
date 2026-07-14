import { useState } from 'react';
import type { ApplicationStatus } from '../lib/types';
import { createJobEntry } from '../lib/createEntry';
import { todayLocalDateString, localDateOnlyToIso } from '../lib/dateUtils';
import { validateJobUrl } from '../lib/urlValidation';

const STATUS_OPTIONS: ApplicationStatus[] = [
  'saved',
  'applied',
  'interviewing',
  'rejected',
  'offer',
];

interface AddEntryFormProps {
  onAdded: () => void;
}

export function AddEntryForm({ onAdded }: AddEntryFormProps) {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<ApplicationStatus>('saved');
  const [date, setDate] = useState(todayLocalDateString());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!company.trim() || !role.trim()) {
      setError('Company and role are required.');
      return;
    }

    const dateAdded = localDateOnlyToIso(date || todayLocalDateString());
    if (!dateAdded) {
      setError('Date added is invalid.');
      return;
    }

    const safeUrl = validateJobUrl(url);
    if (safeUrl === null) {
      setError('Link must be a valid http(s) URL, or left blank.');
      return;
    }

    setSubmitting(true);
    try {
      await createJobEntry(
        {
          company: company.trim(),
          role: role.trim(),
          url: safeUrl,
          status,
          dateAdded,
        },
        'manual_add'
      );
      setCompany('');
      setRole('');
      setUrl('');
      setStatus('saved');
      setDate(todayLocalDateString());
      onAdded();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <div className="form-field">
        <label htmlFor="add-company">Company</label>
        <input
          id="add-company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Acme Corp"
        />
      </div>
      <div className="form-field">
        <label htmlFor="add-role">Role</label>
        <input
          id="add-role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Frontend Engineer"
        />
      </div>
      <div className="form-field">
        <label htmlFor="add-url">Link</label>
        <input
          id="add-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
        />
      </div>
      <div className="form-field">
        <label htmlFor="add-status">Status</label>
        <select
          id="add-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="add-date">Date added</label>
        <input id="add-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div>
        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? 'Adding…' : 'Add entry'}
        </button>
      </div>
      {error && (
        <div className="form-error" role="alert" style={{ gridColumn: '1 / -1' }}>
          {error}
        </div>
      )}
    </form>
  );
}
