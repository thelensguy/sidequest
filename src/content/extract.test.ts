import { describe, expect, it } from 'vitest';
import { safeExtract } from './extract';

/**
 * Minimal hand-rolled fake Document — no jsdom dependency, matching the
 * pattern in src/capture/adapters/linkedin.test.ts. These fakes only need
 * to satisfy whichever adapter getAdapterForUrl() actually dispatches to
 * for the given URL.
 */
function fakeGenericDoc(title: string, href: string): Document {
  return { title, location: { href } } as unknown as Document;
}

describe('safeExtract', () => {
  it('returns the extracted job for a normal page (falls through to the generic adapter)', () => {
    const doc = fakeGenericDoc('Backend Engineer at Acme', 'https://example.com/jobs/1');
    expect(safeExtract('https://example.com/jobs/1', doc)).toEqual({
      role: 'Backend Engineer',
      company: 'Acme',
      url: 'https://example.com/jobs/1',
    });
  });

  it('returns null instead of throwing when the matched adapter breaks on an unexpected DOM shape', () => {
    // A doc with no querySelector implementation — linkedin.ts's extract()
    // calls doc.querySelector and will throw a TypeError on this input.
    const brokenDoc = {
      title: 'Something',
      location: { href: 'https://www.linkedin.com/jobs/view/1/' },
    } as unknown as Document;

    expect(safeExtract('https://www.linkedin.com/jobs/view/1/', brokenDoc)).toBeNull();
  });

  it('returns null (not a throw) when the page has no usable title or url', () => {
    const doc = fakeGenericDoc('', '');
    expect(safeExtract('not-a-real-url', doc)).toBeNull();
  });
});
