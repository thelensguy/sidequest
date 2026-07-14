import { describe, expect, it } from 'vitest';
import { validateExportData } from './importExport';
import type { AppEvent, JobEntry } from './types';

const validEntry: JobEntry = {
  id: 'a',
  company: 'Acme',
  role: 'Engineer',
  url: 'https://acme.co',
  status: 'applied',
  dateAdded: '2026-01-01T00:00:00.000Z',
  lastUpdated: '2026-01-02T00:00:00.000Z',
  source: 'manual',
};

const validEvent: AppEvent = {
  id: 'e1',
  type: 'manual_add',
  jobEntryId: 'a',
  timestamp: '2026-01-01T00:00:00.000Z',
};

describe('validateExportData', () => {
  it('accepts a well-formed export', () => {
    const result = validateExportData({ jobEntries: [validEntry], appEvents: [validEvent] });
    expect(result).toEqual({ data: { jobEntries: [validEntry], appEvents: [validEvent] } });
  });

  it('accepts empty arrays', () => {
    const result = validateExportData({ jobEntries: [], appEvents: [] });
    expect(result).toEqual({ data: { jobEntries: [], appEvents: [] } });
  });

  it('rejects non-object input', () => {
    const result = validateExportData('not an object');
    expect('error' in result).toBe(true);
  });

  it('rejects null', () => {
    const result = validateExportData(null);
    expect('error' in result).toBe(true);
  });

  it('rejects an object missing jobEntries/appEvents arrays', () => {
    const result = validateExportData({ foo: 'bar' });
    expect('error' in result).toBe(true);
  });

  it('rejects when jobEntries is not an array', () => {
    const result = validateExportData({ jobEntries: 'nope', appEvents: [] });
    expect('error' in result).toBe(true);
  });

  it('rejects a job entry missing required fields', () => {
    const { id, ...missingId } = validEntry;
    void id;
    const result = validateExportData({ jobEntries: [missingId], appEvents: [] });
    expect('error' in result).toBe(true);
  });

  it('rejects a job entry with an invalid status', () => {
    const result = validateExportData({
      jobEntries: [{ ...validEntry, status: 'ghosted' }],
      appEvents: [],
    });
    expect('error' in result).toBe(true);
  });

  it('rejects an event missing required fields', () => {
    const { timestamp, ...missingTimestamp } = validEvent;
    void timestamp;
    const result = validateExportData({ jobEntries: [], appEvents: [missingTimestamp] });
    expect('error' in result).toBe(true);
  });

  it('rejects a job entry with a javascript: URL', () => {
    const result = validateExportData({
      jobEntries: [{ ...validEntry, url: 'javascript:alert(document.domain)' }],
      appEvents: [],
    });
    expect('error' in result).toBe(true);
  });

  it('rejects a job entry with a data: URL', () => {
    const result = validateExportData({
      jobEntries: [{ ...validEntry, url: 'data:text/html,<script>alert(1)</script>' }],
      appEvents: [],
    });
    expect('error' in result).toBe(true);
  });

  it('accepts a job entry with a blank URL', () => {
    const result = validateExportData({
      jobEntries: [{ ...validEntry, url: '' }],
      appEvents: [],
    });
    expect('error' in result).toBe(false);
  });

  it('rejects a job entry with a field over the length cap', () => {
    const result = validateExportData({
      jobEntries: [{ ...validEntry, company: 'x'.repeat(5001) }],
      appEvents: [],
    });
    expect('error' in result).toBe(true);
  });

  it('rejects an export with more job entries than the size cap', () => {
    const tooMany = Array.from({ length: 20_001 }, (_, i) => ({ ...validEntry, id: `id-${i}` }));
    const result = validateExportData({ jobEntries: tooMany, appEvents: [] });
    expect('error' in result).toBe(true);
  });

  it('rejects an export with more events than the size cap', () => {
    const tooMany = Array.from({ length: 20_001 }, (_, i) => ({ ...validEvent, id: `id-${i}` }));
    const result = validateExportData({ jobEntries: [], appEvents: tooMany });
    expect('error' in result).toBe(true);
  });

  it('rejects a job entry with a source outside the known set', () => {
    const result = validateExportData({
      jobEntries: [{ ...validEntry, source: 'made-up-source' }],
      appEvents: [],
    });
    expect('error' in result).toBe(true);
  });

  it('rejects an event with a type outside the known set', () => {
    const result = validateExportData({
      jobEntries: [],
      appEvents: [{ ...validEvent, type: 'ghost_event' }],
    });
    expect('error' in result).toBe(true);
  });
});
