# Package 2 — design: corpus → one-button PR emission (agent-native)

**Status: DESIGN FOR REVIEW — not implementation.** 2026-06-05. The format-fix half is Codex-ready; the emission-agent half waits on your sign-off of this design.

## The outcome
You approve a generated launch package in the harness → an agent emits a **review-ready PR** to the Infinex platform: house-format changelog `.md` + roadmap tick + optional feature card, on a fresh stash-safe branch, opened for human approval. Closes two manual gaps: the by-hand reformatting (prose → house changelog) and the by-hand PR.

## Two halves
- **A. Format fix (upstream)** — makes the generated changelog drop-in: the actor fills the house template; a format-compliance gate judges it. *Codex-ready now.*
- **B. Emission agent (agent-native)** — atomic git/file tools + an outcome loop → a PR. *Design review first.*

## Agent-native frame (why this shape)
- **Parity:** every step you could do by hand (write the `.md`, edit `data.ts`, pull, branch, commit, PR) the agent does via tools.
- **Granularity:** atomic tools (`platform_read`/`platform_write`, git fetch/branch/stash/commit/push, `gh pr create`) + an outcome prompt — **not** a hardcoded choreography. Behavior changes by editing the prompt, not refactoring.
- **Composability / emergent:** same tools → a roadmap-only PR, a blog-only PR, a multi-surface PR, all by prompt. You didn't build "roadmap-only mode"; it falls out.
- **Approval-gated:** the PR is human-approved, never auto-merged — extends your locked *ship-gate-is-human / don't-auto-post* to **don't-auto-merge**. Two human gates: you approve the package in the harness; a reviewer approves the PR.

## Part A — Format fix (actor template + format-gate)  [Codex-ready]
**Gap (confirmed):** the blog channel profile is situation-only (`max_chars`+`reader_context`), the actor gets **no template**, and the validator has **no format rule** — so it emits freeform prose I reshape by hand.
**Fix:**
1. Give the blog channel the **house changelog template** as a FORMAT scaffold (frontmatter fields + `### + {% cloud-image %}` + `{% toggle %}` + `### Coming up`), sourced from `research/changelog-template-2026-06-05.md` (the earmarked cohort). The actor *fills* it via table-work — voice still emerges; the template is scaffold, not register.
2. Add a **format-compliance validator rule** (`auditChangelogFormat`): for the blog channel, assert `category: changelogs`, required frontmatter present, body opens with heading + hero cloud-image, has `### Coming up` + roadmap link, valid Markdoc. The "regex judges it" you expected.
- **Files:** actor memory / channel-grammar block (template), `src/validator.ts` (+ `auditChangelogFormat` + `src/__tests__/validator.test.ts` positive/negative).
- **Compatibility:** format ≠ register — does NOT violate "channels = situation, not register." Voice is still table-work-driven.

## Part B — Emission agent (the one-button PR)  [design review]
**Atomic tools:** `platform_read(path)`, `platform_write(path, content)` (scoped to the platform clone); git `fetch`/`branch`/`stash`/`commit`/`push`; `gh pr create` (open only — never merge); `read_package` (the approved changelog `.md` + roadmap diff + feature card from comms-factory).
**Outcome prompt (sketch):** *"Given the approved launch package, open a review-ready PR on the platform that adds the changelog post (house format) at its mapped path, applies the roadmap tick, and any feature card. Pull latest main, branch stash-safe, write the files, commit, push, open a PR titled/bodied from the changelog. Never merge. Report the PR URL."*
**Git-safe flow (your "stash so we're not fucking ourselves"):** `fetch origin`; branch off **latest** `main`; if the clone's working tree is dirty, **stash or use a dedicated worktree** (never clobber local work); write; commit; push; `gh pr create`; return the URL. No force-push, no merge, no touching existing branches.
**Completion signal:** explicit — "PR opened, URL X" (not heuristic).

## Part C — Platform write map (the artifacts)  [from the surface map]
- **Changelog:** `apps/content-app/content/blog/{NN}-{slug}.md` (house format, `category: changelogs`).
- **Roadmap:** `apps/public-website/src/app/(site)/roadmap/data.ts` — the tick diff (child `Onramp (bank account) → done`, parent `TradFi & CEX → done`, reorder above credit-card, per your call).
- **Optional feature card:** `apps/public-website/src/app/(site)/features/data.ts` (`FEATURES_COPY[]`).
- **NOT in the PR:** modal (`emergencyAnnouncement` flag), on-ramp enablement (`enableBridgeBankDeposits` flag), X (Typefully/manual).

## Part D — Harness UI (the button + parity)
- An **"Emit PR"** affordance on an approved package (parity: you approve → agent emits).
- Show the **PR URL + status** back in the harness (no silent action).
- The "tick, tick, tick → submit" you described.

## Agent-native checklist (applied)
- Parity ✓ · atomic tools ✓ · features-as-prompts ✓ · approval-gated ✓ · completion signal explicit ✓
- Shared workspace: the platform clone (agent + you operate the same files) ✓
- CRUD on the emission: open PR ✓; consider amend (push to the same branch) + close-PR for re-runs
- Context injection: the surface-map paths + the changelog template injected into the agent's prompt ✓

## Open decisions (your call on return)
1. **Where the emission agent runs:** a scripted agent inside comms-factory driving the platform clone via atomic git/file tools (recommend), vs a Managed/Codex agent. 
2. **Roadmap-tick mechanics:** agent edits `data.ts` via read + structured edit (recommend, with a test), vs a templated patch.
3. **Branch/PR conventions:** branch name, PR title/body from the changelog, default reviewers.
4. **Format-gate hardness:** hard rule that blocks (recommend for `category: changelogs`) vs soft warn.
5. **First-build scope:** Part A (format fix) first — low-risk, like pkg1 — then Part B after this sign-off.

## Locked-pattern compatibility
- **format ≠ register** → compatible with "channels = situation, not register."
- **ship-gate human** → extended to "don't auto-merge"; the PR is the human gate.
- **don't decide visual specs** → cover image / feature-card art defer to brand-factory (the image brief).

## Build order
1. **Part A** (format fix + format-gate + tests) → Codex now.
2. **Part B** (emission agent + git-safe flow + harness button) → Codex after your design sign-off.
