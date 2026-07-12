import { describe, expect, it } from 'vitest';
import { extract } from './linkedin';

/**
 * A minimal hand-rolled fake DOM — no jsdom dependency needed. Supports
 * just enough of the real DOM API (querySelector with `a[href*="..."]` /
 * bare `a`, parentElement, textContent) for linkedin.ts's extract() to
 * run against it. Structure mirrors the real LinkedIn markup captured
 * from a live search-results-with-side-panel page: a title <a> linking
 * to /jobs/view/<id>, and a company <a> as a sibling-ish descendant under
 * a shared ancestor.
 */
class FakeNode {
  tagName: string;
  href?: string;
  textContent: string;
  parentElement: FakeNode | null = null;
  children: FakeNode[] = [];

  constructor(tagName: string, opts: { href?: string; text?: string } = {}) {
    this.tagName = tagName;
    this.href = opts.href;
    this.textContent = opts.text ?? '';
  }

  appendChild(child: FakeNode): FakeNode {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  querySelector(selector: string): FakeNode | null {
    const hrefMatch = selector.match(/^a\[href\*="([^"]+)"\]$/);
    const substr = hrefMatch ? hrefMatch[1] : null;
    const queue = [...this.children];
    while (queue.length) {
      const node = queue.shift()!;
      if (node.tagName === 'A' && (!substr || node.href?.includes(substr))) {
        return node;
      }
      queue.push(...node.children);
    }
    return null;
  }
}

function fakeDoc(root: FakeNode, href: string): Document {
  return Object.assign(root, { location: { href } }) as unknown as Document;
}

describe('linkedin adapter extract()', () => {
  it('extracts role/company via href-pattern matching on a search-results/side-panel page', () => {
    const root = new FakeNode('div');
    const rolePara = root.appendChild(new FakeNode('p'));
    rolePara.appendChild(
      new FakeNode('A', {
        href: 'https://www.linkedin.com/jobs/view/4412912836/?trackingId=jYzW9%2FNdgC6lAJoqCXFtqQ%3D%3D',
        text: 'Software Development Engineer',
      })
    );
    const companyPara = root.appendChild(new FakeNode('p'));
    companyPara.appendChild(
      new FakeNode('A', {
        href: 'https://www.linkedin.com/company/jiffy/life/',
        text: 'Jiffy.com',
      })
    );

    const doc = fakeDoc(
      root,
      'https://www.linkedin.com/jobs/search-results/?currentJobId=4412912836&keywords=engineer'
    );

    expect(extract(doc)).toEqual({
      role: 'Software Development Engineer',
      company: 'Jiffy.com',
      url: 'https://www.linkedin.com/jobs/view/4412912836/',
    });
  });

  it('does not grab an unrelated /company/ link from elsewhere on the page', () => {
    const root = new FakeNode('div');
    const otherListing = root.appendChild(new FakeNode('div'));
    otherListing.appendChild(
      new FakeNode('A', { href: 'https://www.linkedin.com/company/some-other-company/', text: 'Wrong Co' })
    );
    const card = root.appendChild(new FakeNode('div'));
    const rolePara = card.appendChild(new FakeNode('p'));
    rolePara.appendChild(
      new FakeNode('A', { href: 'https://www.linkedin.com/jobs/view/999/', text: 'Backend Engineer' })
    );
    const companyPara = card.appendChild(new FakeNode('p'));
    companyPara.appendChild(
      new FakeNode('A', { href: 'https://www.linkedin.com/company/right-co/', text: 'Right Co' })
    );

    const doc = fakeDoc(root, 'https://www.linkedin.com/jobs/search-results/?currentJobId=999');
    expect(extract(doc)?.company).toBe('Right Co');
  });

  it('falls back to the currentJobId query param when no title link is present', () => {
    const root = new FakeNode('div');
    const doc = fakeDoc(root, 'https://www.linkedin.com/jobs/search-results/?currentJobId=555');

    const result = extract(doc);
    expect(result?.url).toBe('https://www.linkedin.com/jobs/view/555/');
    expect(result?.role).toBe('');
    expect(result?.company).toBe('');
  });

  it('builds a clean permalink from the page path on a standalone /jobs/view/ page', () => {
    const root = new FakeNode('div');
    const doc = fakeDoc(root, 'https://www.linkedin.com/jobs/view/777/');

    expect(extract(doc)?.url).toBe('https://www.linkedin.com/jobs/view/777/');
  });
});
