import { describe, expect, it } from 'vitest';
import { extract } from './ziprecruiter';

/**
 * A minimal hand-rolled fake DOM — no jsdom dependency, same approach as
 * linkedin.test.ts. Supports just enough of querySelector/querySelectorAll
 * (bare tag names, comma-separated tag lists like "h1, h2, h3",
 * `[attr="value"]`, `tag[attr*="substr"]`) plus `parentElement` (for the
 * ancestor walk) and a settable `offsetParent` (for the dialog-visibility
 * check) for ziprecruiter.ts's extract() to run against it.
 */
class FakeNode {
  tagName: string;
  attrs: Record<string, string>;
  textContent: string;
  children: FakeNode[] = [];
  parentElement: FakeNode | null = null;
  // Real DOM: offsetParent is null for display:none elements/ancestors.
  // Defaults visible; tests set this to null to simulate a hidden dialog.
  offsetParent: FakeNode | null = {} as FakeNode;

  constructor(tagName: string, attrs: Record<string, string> = {}, text = '') {
    this.tagName = tagName.toUpperCase();
    this.attrs = attrs;
    this.textContent = text;
  }

  appendChild(child: FakeNode): FakeNode {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  querySelector(selector: string): FakeNode | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): FakeNode[] {
    const parts = selector.split(',').map((s) => s.trim());
    const matches: FakeNode[] = [];
    const queue = [...this.children];
    while (queue.length) {
      const node = queue.shift()!;
      if (parts.some((part) => matchesSelector(node, part))) matches.push(node);
      queue.push(...node.children);
    }
    return matches;
  }
}

function matchesSelector(node: FakeNode, selector: string): boolean {
  const attrMatch = selector.match(/^([a-zA-Z0-9]*)\[([a-zA-Z-]+)(\*)?="([^"]*)"\]$/);
  if (attrMatch) {
    const [, tag, attr, substrOp, value] = attrMatch;
    if (tag && node.tagName !== tag.toUpperCase()) return false;
    const actual = node.attrs[attr];
    if (actual === undefined) return false;
    return substrOp ? actual.includes(value) : actual === value;
  }
  return node.tagName === selector.toUpperCase();
}

function fakeDoc(root: FakeNode, href: string): Document {
  return Object.assign(root, { location: { href } }) as unknown as Document;
}

/** A block of `count` throwaway h2 headings, standing in for a list of other job cards. */
function otherJobCards(count: number): FakeNode {
  const wrapper = new FakeNode('div');
  for (let i = 0; i < count; i++) {
    wrapper.appendChild(new FakeNode('h2', {}, `Other Job ${i}`));
  }
  return wrapper;
}

describe('ziprecruiter adapter extract() — jobseeker/home dialog-overlay layout', () => {
  it('extracts role/company scoped inside the open [role="dialog"] panel', () => {
    const root = new FakeNode('div');

    // A background job card, sitting outside the dialog, with the exact
    // same tag shape as the real panel's contents.
    const otherCard = root.appendChild(new FakeNode('div'));
    otherCard.appendChild(new FakeNode('h2', {}, 'SDET (Software Dev Engineer in Test)'));
    otherCard.appendChild(new FakeNode('a', { href: '/co/DataAnnotation/Jobs?uuid=abc' }, 'DataAnnotation'));

    const panel = root.appendChild(new FakeNode('div', { role: 'dialog' }));
    panel.appendChild(new FakeNode('h2', {}, 'Mobile Application Developer - Flutter Developer'));
    panel.appendChild(new FakeNode('a', { href: '/co/Soch-Inc/Jobs?uuid=xyz' }, 'Soch Inc'));

    const doc = fakeDoc(
      root,
      'https://www.ziprecruiter.com/jobseeker/home?jk=eyJsaXN0aW5nS2V5IjoiZUkzbUhkTTBxIn0%3D'
    );

    expect(extract(doc)).toEqual({
      role: 'Mobile Application Developer - Flutter Developer',
      company: 'Soch Inc',
      url: 'https://www.ziprecruiter.com/jobseeker/home?jk=eyJsaXN0aW5nS2V5IjoiZUkzbUhkTTBxIn0%3D',
    });
  });

  it('skips a hidden, unrelated role="dialog" (e.g. a settings popover) and picks the visible job dialog', () => {
    // Regression test for a real bug: a settings/account dialog using the
    // same role="dialog", sitting earlier in the DOM than the job panel,
    // got grabbed by a bare querySelector('[role="dialog"]') and returned
    // "Settings" as the extracted role.
    const root = new FakeNode('div');

    const settingsDialog = root.appendChild(new FakeNode('div', { role: 'dialog' }));
    settingsDialog.offsetParent = null; // closed/hidden
    settingsDialog.appendChild(new FakeNode('h2', {}, 'Settings'));

    const jobDialog = root.appendChild(new FakeNode('div', { role: 'dialog' }));
    jobDialog.appendChild(new FakeNode('h2', {}, 'SDET (Software Dev Engineer in Test) - AI Trainer'));
    jobDialog.appendChild(new FakeNode('a', { href: '/co/DataAnnotation/Jobs?uuid=abc' }, 'DataAnnotation'));

    const doc = fakeDoc(root, 'https://www.ziprecruiter.com/jobseeker/home?jk=abc');

    expect(extract(doc)).toEqual({
      role: 'SDET (Software Dev Engineer in Test) - AI Trainer',
      company: 'DataAnnotation',
      url: 'https://www.ziprecruiter.com/jobseeker/home?jk=abc',
    });
  });

  it('skips a visible role="dialog" that has no company link (not a job posting)', () => {
    const root = new FakeNode('div');
    const settingsDialog = root.appendChild(new FakeNode('div', { role: 'dialog' }));
    settingsDialog.appendChild(new FakeNode('h2', {}, 'Settings'));
    // visible, has a heading, but no /co/ link — shouldn't be mistaken for a job panel

    const doc = fakeDoc(root, 'https://www.ziprecruiter.com/jobseeker/home');

    expect(extract(doc)).toBeNull();
  });
});

describe('ziprecruiter adapter extract() — two-pane search-results layout', () => {
  it('extracts role/company from the detail pane via the "Job description" ancestor walk', () => {
    // Mirrors the real structure captured from a live jobs-search page: the
    // detail pane (title + company link + "Job description" section) sits
    // beside a sibling job list carrying many more headings — the ancestor
    // walk has to stop at the pane boundary before that jump, or it'd grab
    // whichever card comes first in the sibling list instead.
    const root = new FakeNode('div');
    const twoPaneWrapper = root.appendChild(new FakeNode('div'));

    const detailPane = twoPaneWrapper.appendChild(new FakeNode('div'));
    detailPane.appendChild(new FakeNode('h2', {}, 'Staff Software Engineer'));
    detailPane.appendChild(new FakeNode('a', { href: '/co/Acme-Corp' }, 'Acme Corp'));
    detailPane.appendChild(new FakeNode('h2', {}, 'Job description'));
    detailPane.appendChild(new FakeNode('h3', {}, 'Qualifications'));

    twoPaneWrapper.appendChild(otherJobCards(20));

    const doc = fakeDoc(root, 'https://www.ziprecruiter.com/jobs-search?search=software+developer&lk=abc');

    expect(extract(doc)).toEqual({
      role: 'Staff Software Engineer',
      company: 'Acme Corp',
      url: 'https://www.ziprecruiter.com/jobs-search?search=software+developer&lk=abc',
    });
  });

  it('does not grab the results-count <h1> when no job is selected in the detail pane', () => {
    // Regression test for a real bug: with no "Job description" heading
    // present (nothing selected, or the page structure doesn't match),
    // this used to fall back to the first <h1> on the page — which is the
    // "957 Software developer jobs in United States" results-count
    // heading, not a job title.
    const root = new FakeNode('div');
    root.appendChild(new FakeNode('h1', {}, '957 Software developer jobs in United States'));
    root.appendChild(otherJobCards(10));

    const doc = fakeDoc(root, 'https://www.ziprecruiter.com/jobs-search?search=software+developer');

    expect(extract(doc)).toBeNull();
  });
});

describe('ziprecruiter adapter extract() — shared', () => {
  it('does not grab a background job card\'s title/company when nothing is open or selected', () => {
    const root = new FakeNode('div');
    const card = root.appendChild(new FakeNode('div'));
    card.appendChild(new FakeNode('h2', {}, 'Some Listing'));
    card.appendChild(new FakeNode('a', { href: '/co/Some-Co/Jobs' }, 'Some Co'));

    const doc = fakeDoc(root, 'https://www.ziprecruiter.com/jobseeker/home');

    expect(extract(doc)).toBeNull();
  });
});
