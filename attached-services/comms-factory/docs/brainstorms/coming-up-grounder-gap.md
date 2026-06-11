# "Coming up" section is weak — grounder should scan active PRs/branches

**Captured:** 2026-06-10 (operator brain-dump, "just thinking about it")
**Status:** parked / backlog — operator says he can fill it in manually for now

## The gap

The changelog "Coming up" section (the forward-looking teaser at the end of a
launch post) is currently weak/stale. It should be populated from **what's
actually being worked on right now** — other active PRs and branches in the
platform monorepo — not guessed or hand-stale.

Operator's example of what a *good* "Coming up" would surface for the current
launch:
- Synthetics / Infinex synthetic perps
- Lighter spot
- Prediction markets (Infinex Predict) — operator unsure if recently worked; the
  grounder scanning real branch activity would *answer* that, not guess.

## Why this is a grounder job

The grounder already discovers branches/PRs and ranks by freshness×maturity
(see memories: grounder-discovery-subject-not-keyword, methodology-ground-on-
dated-strata). "Coming up" is the natural consumer of that same discovery: the
roadmap-adjacent, in-flight features become the teaser. Today the validator only
checks the "Coming up" section *has a roadmap link* (ROADMAP_LINK_RE in
validator.ts ~315) — it doesn't ensure the items are real/current.

## Possible shape (not designed yet)

- Grounder emits a ranked "in-flight features" list from active branches/PRs
  (exclude prototype dirs; rank by freshness×maturity), distinct from the
  launch-subject grounding.
- "Coming up" generation consumes that list → 2–4 genuinely-imminent items.
- Each maps to a roadmap node (ties into emit-platform-pr ROADMAP_DATA_PATH +
  the roadmap-link validator rule).

## When picking this up

Relates to: the emit roadmap tick path (src/emit-platform-pr.ts), the roadmap-
link validator rule, and the proactive-lane Scout (scout-role-distinct-from-
grounder). Decide whether "Coming up" sourcing is a grounder extension or a
Scout responsibility before building.
