# PRD: SideQuest (Job Application Tracker, Gamified)

## What it does
A Chrome extension that captures job postings straight from the page you're viewing (LinkedIn, Indeed, company career sites) into a personal tracker — no more copy-pasting company/role/link into a spreadsheet by hand. A built-in dashboard shows every application, its status, and flags ones that have gone quiet. The whole process is gamified — XP, levels, badges, and a reward "wheel" — to keep job searching from feeling purely demoralizing, including turning rejections into something that still earns you progress.

## Who it's for
Built for me, for my current job search. Written generically (config-driven, no hardcoded personal data) so any job-seeker could install and use it as-is — but v1 ships as a single-user, local-only tool. No accounts, no multi-user support.

## The real task this automates
Right now, tracking a job search means manually re-typing company, role, and link into a spreadsheet every time I apply, then remembering to go back and update status — and losing track of applications that have gone silent. It's also just draining: rejections pile up with nothing to show for the effort. This tool removes the copy-paste step, makes stale applications visible, and reframes the grind as forward progress even when the outcome is a "no."

*(Note: this automates a task from my current job search, not a past employer — flagging that since it changes the interview story from "I automated my old job" to "I automated my own job search," which is arguably the more honest and demoable pitch.)*

## Smallest working version (v1 scope)
One extension, no backend. Two systems that share the same event stream — every capture and status change feeds both the tracker and the game layer, so gamification doesn't add new infrastructure, just rules on top of existing events.

**Core tracker**
- **Capture** — popup button ("Save this posting") on a job listing page. Extracts job title, company, and URL via DOM selectors for common sites (LinkedIn/Indeed); falls back to manual entry if parsing fails.
- **Storage** — `chrome.storage.local`. No server, no database, no auth.
- **Dashboard** — a React-built extension page listing saved applications: company, role, link, status (dropdown: Saved / Applied / Interviewing / Rejected / Offer), date added, and a computed "days since last update" flag for anything untouched too long.

**Gamification layer**
- **XP** — earned for capturing a posting, applying, and updating status. Rejections earn XP too (framed as "resilience XP") so a "no" still moves you forward instead of feeling like wasted effort.
- **Levels** — XP accumulates into a level (e.g. "Level 4 Job Seeker") shown on the dashboard.
- **Badges** — unlocked at milestones: first application, first rejection, 7-day streak, first interview, first offer, etc.
- **Reward wheel** — a spin-the-wheel UI that unlocks at set milestones (e.g. every 5 applications, every rejection, every level-up). Lands on a "treat" from a list you define yourself in a settings page (e.g. "get boba," "watch an episode," "take the afternoon off"). Purely a suggestion generator — no real purchases, no external integrations, no calendar/payment access.

That's the whole core loop: capture → store → track status → earn XP/badges → spin for a reward → surface staleness.

### Explicitly out of scope for v1 (future roadmap)
- Smarter/LLM-based extraction that works on any site, not just known selectors
- Reminders or notifications (email, push)
- Analytics/reporting (response rates, applications per week, channel effectiveness)
- Sync across devices/browsers
- Real multi-user accounts/auth
- Any real-world execution tied to rewards (ordering something, booking something) — the wheel only ever displays a suggestion

## What "done" means
- Extension runs locally, loaded unpacked in Chrome.
- A short screen recording exists showing the full loop: capturing a real job posting from a live site, watching it land in the dashboard, updating its status, earning XP/a badge, and spinning the reward wheel.
- No live deploy or hosted demo required for v1 — this is demoed by walkthrough/recording in interviews, with code available to discuss on request.
