# Building SideQuest: what it actually looks like to build with a team of AI agents

I'm a frontend developer between roles, which means my job right now *is* the job search — and the job search is tedious in a specific way: find a posting, copy the company/role/link into a spreadsheet, apply, remember to check back later, repeat until you lose track of half of it. So I built [SideQuest](https://github.com/thelensguy/sidequest), a Chrome extension that captures job postings with one click, tracks them on a dashboard, and layers XP/levels/badges/a reward wheel on top so a rejection still counts as progress instead of a dead end.

That's the app. What I actually want to write about is how I built it — because "I used AI to build a project" undersells what actually happened, and I think the *how* is more interesting than the demo.

## It wasn't one long prompt — it was a small team

Once the data model and storage layer were nailed down (the one piece everything else depends on), I split the rest of the build — capture, dashboard, gamification — into three parallel workstreams, each in its own git worktree, each handled by a separate agent session with no visibility into the others' work. Same idea as splitting a sprint across three engineers: shared contract up front, then independent work that merges back together. It worked — the merge was a clean octopus merge with zero real conflicts, because the shared contract held.

## The review step is where it actually got good

Here's the part I'd tell another developer to steal: before anything merged, it went through an *adversarial* review — a fresh agent, with no attachment to the code and no context beyond "find what's wrong with this," briefed specifically to try to break it. Not a rubber-stamp pass. That review caught real bugs before they shipped:

- A title-parsing bug in the generic capture adapter that silently dropped company names on multi-separator titles ("Senior Engineer - Backend - Acme Corp" would've lost "Acme Corp" entirely).
- A duplicate-save race in the popup — a fast double-click could fire the save handler twice before React's state update landed, because a `disabled` prop check isn't synchronous.
- A timezone bug that displayed every "date added" a day early.

None of those show up in a quick demo. All of them would've shipped to a real user if the only check was "does it look right when I click through it once."

The same adversarial pattern showed up in the design work, too — I had two separate agents review three competing dashboard mockups, one briefed on visual craft, one on usability. They *disagreed* on the ranking, and that disagreement was itself useful signal: it told me exactly where the visual-polish direction and the actually-usable direction were pulling apart, instead of getting one confident-sounding opinion that hid the tradeoff.

## The part that doesn't automate away: verifying the work

The single biggest mistake to avoid here is trusting a subagent's self-report. "Tests pass" isn't the same as tests actually passing — so the rule I stuck to was re-running `tsc`, the build, and the test suite myself after every merge, and spot-checking the most complex new files directly rather than skimming a summary. When a LinkedIn extraction adapter quietly broke because it guessed at CSS class names that turned out to be build-hashed and site-specific, the fix wasn't "ask the AI to try again" — it was pulling real markup from a live page and matching against something structurally durable (an `href` pattern) instead of a guess. That's not a prompting problem. It's an engineering problem, and it needed the same skepticism I'd apply to a pull request from a human I'd never met.

## What this actually is

Directing a handful of agents through a build like this feels less like autocomplete and more like being a tech lead: write the contract, split the work, review it like you mean it, and verify before you trust it. The code SideQuest ended up with — a shared event log that XP/levels/badges all derive from instead of separate counters that could drift, a capture pipeline with real fallback behavior instead of silent failures — is the kind of thing that comes out of that process, not out of a single prompt.

Repo's here if you want to look under the hood: [github.com/thelensguy/sidequest](https://github.com/thelensguy/sidequest)
