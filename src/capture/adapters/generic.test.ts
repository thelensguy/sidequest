import { describe, expect, it } from 'vitest';
import { extract } from './generic';

function fakeDoc(title: string, href: string): Document {
  // extract() only ever touches doc.title and doc.location.href, so a
  // minimal object literal is enough — no jsdom required.
  return { title, location: { href } } as unknown as Document;
}

describe('generic adapter extract()', () => {
  it('splits a simple "Role at Company" title', () => {
    expect(extract(fakeDoc('Frontend Engineer at Acme Corp', 'https://example.com/job/1'))).toEqual({
      role: 'Frontend Engineer',
      company: 'Acme Corp',
      url: 'https://example.com/job/1',
    });
  });

  it('splits on the first separator only, keeping the rest of the title as company', () => {
    // Regression test: a naive String.split() on every occurrence of the
    // separator used to destructure only the first two parts and
    // silently drop "Acme Corp", returning "Backend" as the company.
    const result = extract(fakeDoc('Senior Engineer - Backend - Acme Corp', 'https://example.com/job/2'));
    expect(result?.role).toBe('Senior Engineer');
    expect(result?.company).toBe('Backend - Acme Corp');
  });

  it('falls back to the full title as role with a blank company when no separator matches', () => {
    expect(extract(fakeDoc('Careers Page', 'https://example.com/job/3'))).toEqual({
      role: 'Careers Page',
      company: '',
      url: 'https://example.com/job/3',
    });
  });

  it('returns null when the title is blank', () => {
    expect(extract(fakeDoc('', 'https://example.com/job/4'))).toBeNull();
  });
});
