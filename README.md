# SideQuest

A Chrome extension that turns job-search tracking into a game, so the grind of applying feels like progress instead of a black hole.

## What it does

Job searching means the same tedious loop over and over: find a posting, copy the company/role/link into a spreadsheet, apply, and then remember to go back and check on it later. SideQuest removes the copy-paste step and makes the whole thing less demoralizing:

- **One-click capture** — click the extension icon (or a small floating button that follows you around on LinkedIn, Indeed, and ZipRecruiter) to save whatever job posting you're looking at. No retyping company names and links by hand.
- **A real dashboard** — every saved application in one list: company, role, status, and a flag for anything that's gone quiet for too long.
- **XP, levels, and badges** — capturing a job, applying, and updating status all earn XP. Even a rejection earns "resilience XP," so a "no" still counts as forward motion instead of a dead end.
- **A reward wheel** — hit a milestone (every few applications, every level-up) and spin a wheel that lands on a small real-life reward you set for yourself — "get boba," "take the afternoon off," whatever keeps you going. It's just a suggestion generator; nothing gets ordered or booked automatically.

## Who it's for

Job seekers who are tired of tracking applications in a spreadsheet and want something that makes the process a little more bearable. It's a single-user, local-only tool — everything is stored on your own machine, no account, no server, no data leaving your browser.

## How to run it

You'll need [Node.js](https://nodejs.org/) installed.

```bash
git clone https://github.com/thelensguy/sidequest.git
cd sidequest
npm install
npm run build
```

Then load it into Chrome:

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the `dist` folder this project just built.

That's it — you'll see the SideQuest icon in your toolbar. Click it on any job posting to try capturing one, or open the dashboard from there to see the full tracker.

### While developing

- `npm run dev` — runs Vite in watch mode, so changes rebuild automatically (reload the extension in `chrome://extensions` to pick them up).
- `npm run test` — runs the test suite (unit tests for the XP/level/badge logic and the site-specific extraction adapters).

## How it's built

React + TypeScript, bundled with Vite via [CRXJS](https://crxjs.dev/) for Manifest V3. No backend — everything persists to `chrome.storage.local`. Job data is extracted per-site (LinkedIn, Indeed, ZipRecruiter) with a generic fallback for anywhere else, and the gamification logic (XP, levels, badges, the wheel) is written as plain, independently-tested functions that derive everything from a single event log rather than separate counters that could drift out of sync.
