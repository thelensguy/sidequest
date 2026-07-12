import { describe, expect, it } from 'vitest';
import { getFieldStatuses } from './fieldStatus';

describe('getFieldStatuses', () => {
  it('marks every field extracted when the job has non-empty values', () => {
    expect(
      getFieldStatuses({ company: 'Acme', role: 'Engineer', url: 'https://acme.com/jobs/1' })
    ).toEqual({ company: 'extracted', role: 'extracted', url: 'extracted' });
  });

  it('marks a whitespace-only field as empty, not extracted', () => {
    const statuses = getFieldStatuses({
      company: '   ',
      role: 'Engineer',
      url: 'https://acme.com/jobs/1',
    });
    expect(statuses.company).toBe('empty');
    expect(statuses.role).toBe('extracted');
  });

  it('marks every field empty when extraction returned null', () => {
    expect(getFieldStatuses(null)).toEqual({ company: 'empty', role: 'empty', url: 'empty' });
  });

  it('marks only the missing field(s) empty on a partial extraction', () => {
    expect(getFieldStatuses({ company: '', role: 'Engineer', url: '' })).toEqual({
      company: 'empty',
      role: 'extracted',
      url: 'empty',
    });
  });
});
