# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status
Pre-implementation. This repo currently contains only [PRD.md](PRD.md) — no source code, build tooling, or tests exist yet. There are no commands to run yet; update this file once a package.json / build setup lands.

## What this is
SideQuest — a gamified Chrome extension (Manifest V3) for tracking job applications. Full scope, v1 boundaries, and "done" criteria are defined in [PRD.md](PRD.md); read it before starting implementation work.

## Planned shape (per PRD, not yet built)
- Single Chrome extension, no backend — persistence via `chrome.storage.local`.
- Dashboard UI built in React, bundled as an extension page.
- Capture flow (popup/content script) extracts job postings via DOM selectors on known sites (LinkedIn/Indeed), with manual-entry fallback.
- Gamification (XP, levels, badges, reward wheel) reads/writes the same local event stream as the tracker — no separate service.
