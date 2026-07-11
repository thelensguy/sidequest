# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status
Shared foundation is built and verified (loads unpacked in Chrome). The data contract (`src/lib/types.ts`, `src/lib/storage.ts`) and stub popup/dashboard/options pages exist; feature logic (capture, dashboard CRUD, gamification) is being built next, split across parallel branches. See [PRD.md](PRD.md) for full v1 scope.

## Commands
- `npm run build` (or `npx vite build`) — builds to `dist/`. Load `dist/` as an unpacked extension via `chrome://extensions` → Developer mode → Load unpacked.
- `npx vitest` — runs unit tests (used for the pure-function gamification logic in `src/gamification/`).

## Architecture
- Single Chrome extension (Manifest V3), no backend — persistence is entirely `chrome.storage.local`, accessed only through `src/lib/storage.ts`.
- Shared data contract, defined once and not to be redefined elsewhere:
  - `src/lib/types.ts` — `JobEntry` (one tracked application) and `AppEvent` (an append-only log entry: capture/status_change/manual_add/import). XP, levels, and badges are always *derived* from the `AppEvent` log, never stored as separate counters, so they can't drift out of sync with actual history.
  - `src/lib/storage.ts` — all reads/writes go through this (`getJobEntries`/`addJobEntry`/`updateJobEntry`, `getEvents`/`appendEvent`, `getTreats`/`setTreats`).
- Three extension pages, each an independent React entry point built via CRXJS: `src/popup/` (capture UI), `src/dashboard/` (application list + status tracking + gamification display), `src/options/` (reward-wheel treat list). The dashboard is opened at runtime via `chrome.tabs.create` + `chrome.runtime.getURL`, so it's not reachable from any manifest field — it had to be added explicitly to `vite.config.ts`'s `build.rollupOptions.input`, or CRXJS won't bundle it.
- `src/capture/adapters/` — one file per job site (`linkedin.ts`, `indeed.ts`, `generic.ts` fallback), each exporting `{ matches(url), extract(document) }`. Extend by adding a new adapter file, not by branching inside existing ones.
- `src/gamification/` — pure functions only (XP/level/badge/wheel-milestone logic operates on `AppEvent[]` with no `chrome.*` calls), so it's unit-testable in isolation via Vitest.
