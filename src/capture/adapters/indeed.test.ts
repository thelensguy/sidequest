import { describe, expect, it } from 'vitest';
import { extract, matches } from './indeed';

function fakeDoc(href: string): Document {
  // extract() only touches doc.location.href and doc.querySelector; a
  // selector-less fake is enough for the URL-canonicalization tests.
  return { location: { href }, querySelector: () => null } as unknown as Document;
}

describe('indeed adapter matches()', () => {
  it('matches indeed.com hostnames', () => {
    expect(matches('https://www.indeed.com/viewjob?jk=abc123')).toBe(true);
  });

  it('does not match other sites', () => {
    expect(matches('https://www.linkedin.com/jobs/view/123/')).toBe(false);
  });
});

describe('indeed adapter extract() URL canonicalization', () => {
  it('canonicalizes a search-results URL via its vjk param', () => {
    const result = extract(
      fakeDoc('https://www.indeed.com/jobs?q=frontend&l=Los+Angeles&vjk=abc123def456&from=search')
    );
    expect(result?.url).toBe('https://www.indeed.com/viewjob?jk=abc123def456');
  });

  it('canonicalizes a /viewjob URL via its jk param, dropping tracking params', () => {
    const result = extract(fakeDoc('https://www.indeed.com/viewjob?jk=abc123&tk=tracking&from=serp'));
    expect(result?.url).toBe('https://www.indeed.com/viewjob?jk=abc123');
  });

  it('keeps the raw URL when no job key param is present', () => {
    const result = extract(fakeDoc('https://www.indeed.com/companies/acme'));
    expect(result?.url).toBe('https://www.indeed.com/companies/acme');
  });
});
