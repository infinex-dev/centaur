# Handoff prompt — rebase comms-factory PR #2 onto director-service-surface

> **⚠️ MOOT (superseded).** comms-factory has been vendored into the centaur repo at
> `attached-services/comms-factory/` from PR#3 head `8c8ec37` (which already contains the
> rebase this doc describes). The deploy no longer clones the external repo. See
> `docs/plans/comms-factory-monorepo-migration.md`. Kept for historical context only.

> Paste everything below the line into a fresh agent session. Best started **in a clean checkout of `infinex-dev/comms-factory`** (NOT the deploy cache at `~/.cache/centaur/comms-factory`, which centaur's `deploy-local.sh` overwrites on every deploy).

---

## Task

In the `infinex-dev/comms-factory` repo, combine two divergent lines of work by **rebasing the Centaur-integration PR stack onto the new-functionality branch**, producing one combined branch/PR that has *both* the latest harness functionality *and* the Centaur service integration. Then update the downstream pin in the centaur repo.

## Context: two branches diverged from `main`

Both branches forked from `main @ 3a01b33` ("Add commit and push guide", Jun 1) and share **zero commits** since. They were developed in parallel:

- **Centaur integration (a stack):**
  - PR #1 `feat/centaur-service-api` @ `21d3358` (base `main`) — 1 commit, "feat: add Centaur service API"
  - PR #2 `feat/capability-plane-grounding` @ `0c7f64a` (base `feat/centaur-service-api`) — adds routing grounding through Centaur native tools
  - Together = **10 commits** (`main..feat/capability-plane-grounding`).
- **New functionality:** `director-service-surface` @ `0bafa81` (Jun 5 17:49) — **30 commits** (`main..director-service-surface`): regenerate-with-notes, blog "view as page" rendering, emit-PR backend, Actor voice-prefix cache, grounder "ground LIVE main by default" + fetchRef fallback, Director gate fixes, structured channels (x-thread/carousel/web), etc.

The deploy currently pins PR #2's head (`0c7f64a`). After this rebase the head SHA changes.

## The 10 Centaur-integration commits to replay (oldest → newest)

```
21d3358 feat: add Centaur service API
8c98f4a feat: route grounding through Centaur capabilities
be16678 feat(tools): add local Centaur native-tools client (U1)
5bd0c3c refactor(grounding): route the executor through native /tools (U2)
81b6ff5 refactor(config): cut grounding env over to CENTAUR_* (U3)
4152dc0 docs: describe Centaur native tools as the research/evidence owner (U4)
8b5ca91 refactor(grounding): drop capability-plane naming + fix native tool args
c1d7eda refactor(grounding): rename /ground contract to tool-plane vocabulary
08a135a refactor(grounding): drop internal capability-plane naming + update tests
0c7f64a fix(docker): bundle config/ and third_party/ into the API image
```

## Conflict surface — known ahead of time

Of PR #2's 27 changed files, **only these 5 overlap** with `director-service-surface` (which touched 264). All are in the grounding/research layer:

```
harness/app/actions/research.ts
package.json
src/fact-grounder-llm.ts
src/__tests__/fact-grounder-llm.test.ts
src/research-tools.ts
```

**The semantic tension to reconcile** (this is why conflicts are expected):
- PR #2 routes grounding **through Centaur native tools** — a `/tools` HTTP client (`src/centaur-tools.ts`), `CENTAUR_*` env config, and the executor calling Centaur instead of grounding locally.
- `director-service-surface` improved the **local grounder** — "ground LIVE main by default irrespective of stale local clone" and "fetchRef falls back to cached `origin/<branch>` when the remote ref is gone."

These two ideas are not a textual merge — someone has to decide how the combined grounder behaves (does grounding go through Centaur, stay local-live-main, or become configurable?).

**Everything else in PR #2 replays cleanly** — it's mostly NEW files `director-service-surface` never touches: `services/api/**` (`server.ts`, `http.ts`, `routes/{validate,audit,ground,build-card,generate}.ts`, `Dockerfile`, `server.test.ts`), `src/centaur-tools.ts`, `src/centaur-research.ts`, their tests, `src/fact-grounder/sources/infinex-pages.ts`, `scripts/ground-once.ts`, `tsconfig.json`, docs, `.env.example`.

## How to do it

1. **Fresh checkout** (don't touch `~/.cache/centaur/comms-factory`):
   `git clone https://github.com/infinex-dev/comms-factory.git` (or use a worktree), `git fetch origin`.
2. **Create the combined branch** off the new functionality and replay the Centaur commits onto it:
   ```
   git switch -c feat/centaur-integration-on-director origin/director-service-surface
   git rebase --onto origin/director-service-surface 3a01b33 origin/feat/capability-plane-grounding
   ```
   (`3a01b33` is the merge-base = `main`; this replays the 10 commits above onto `director-service-surface`.)
   The non-grounding commits should apply clean; expect conflicts on the 5 files above.
3. **STOP at the grounder conflicts and FLAG them — do NOT auto-resolve.** The repo owner explicitly wants to make the grounding-semantics call (Centaur-native vs local-live-main vs configurable). For each of the 5 conflicted files, hand back: what PR #2 changed, what `director-service-surface` changed, and the specific decision needed. Resolve only the *mechanical* parts (e.g. `package.json` dependency union) and clearly mark anything you touched.
4. **Open the combined branch as a new PR** (supersedes PR #2). Decide with the owner whether to keep the PR#1/#2 split or land as one combined PR.

## Verify

- Build the service image: `docker build -f services/api/Dockerfile .` (the `0c7f64a` docker-bundle fix must survive the rebase).
- Run the suites that cover both lines: `services/api/server.test.ts`, the grounder/research tests (`src/__tests__/fact-grounder-llm.test.ts`, `centaur-research`, `centaur-tools`).
- Sanity-check the `/ground` route still behaves per whichever grounding decision was made.

## Downstream (in the centaur repo, after the combined head SHA exists)

The centaur split work lives at `/Users/rambo/.superset/projects/centaur`, branch **`feat/comms-factory-overlay`** (this is comms-factory's *consumer*). After the rebase produces a new head SHA:

1. Update the pin in `contrib/scripts/deploy-local.sh`:
   `COMMS_FACTORY_REF="${COMMS_FACTORY_REF:-<NEW_COMBINED_HEAD_SHA>}"` (currently `0c7f64a56cfa15b30570fbf52847e0342df61df3`).
2. Re-run `just comms-factory-up` from that branch to build + deploy the combined comms-factory and validate it E2E against the centaur stack (mention the bot with `comms generate …` → confirm it reaches the facts gate).

## Why this matters / background

Centaur was just split into two stacked PRs — a generic "external-service connection point" (PR #4) and the comms-factory overlay (PR #5). The overlay calls the comms-factory **service** (the work in comms-factory PR #1/#2). Combining PR #2 with `director-service-surface` gets the deployed comms-factory up to current functionality while keeping the Centaur integration, so the overlay E2E exercises the real, current service.
