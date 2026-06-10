# Session status — bridge.xyz launch + pipeline work (2026-06-05)

Orientation for your return. Nothing here was shipped, posted, merged, or PR'd — all human-gated.

## 1. The launch copy (bridge.xyz) — READY
- **Changelog keystone (the blog):** `drafts/bridge-launch-changelog-2026-06-05.md` — house format (`category: changelogs`), validator-green, № de-published (internal-only). Drives blog + in-app what's-new popout + mobile CTA. *Placeholders to fill at publish: cover image (see brief), `typefullyUrl`, the `№` filename.*
- **X post + X thread:** `drafts/bridge-launch-FINAL-2026-06-05.md` (your "Great" + "let's bring it" picks).
- **X image brief (designer request):** `drafts/bridge-launch-image-brief-2026-06-05.md`.
- **Roadmap tick (the diff):** in `research/release-surface-map-2026-06-05.html` + `research/platform-surface-map-2026-06-05.md` — `Onramp (bank account) → done`, parent `TradFi & CEX → done`, reorder above credit-card.
- Superseded/dropped: the practical-blog draft, early carousel/thread drafts, the modal (it's an emergency flag).

## 2. Codex packages
- **Package 1 (P0 + perf pipeline fixes)** — ✅ **DONE + INDEPENDENTLY VERIFIED.** Codex implemented all 4 units; I re-ran the suite (247 tests pass, typecheck + harness typecheck clean) and ran an adversarial per-unit review (all `acceptance_met`, 0 blockers, 1 minor + 6 nits). Spec: `research/codex-spec-package1-pipeline-fixes-2026-06-05.md`.
- **Package 2 (one-button PR emission)** — **DESIGN FOR YOUR REVIEW:** `research/design-package2-pr-emission-2026-06-05.md`.
  - **Part A (format fix: actor-template + format-gate)** — Codex-ready spec: `research/codex-spec-package2A-format-fix-2026-06-05.md`. (This closes the gap you spotted: actor was format-blind, validator didn't judge format.)
  - **Part B (emission agent: git-safe → PR)** — parked for your design sign-off + the 5 open decisions in the design doc.
- **Package 3 (6 harness review-UI fixes)** — ✅ spec assembled + Codex-ready: `research/codex-spec-package3-ui-fixes-2026-06-05.md` (6 units; the hardening pass caught a few stale rationales in the draft — bad CSS/em-dash citations, a wrong test command — all flagged inline so Codex isn't misled).

## 3. The scorecard (your secondary goal: "do the tools work?")
`research/scorecard-do-the-tools-work-2026-06-05.md`. Bottom line: the Actor is strong; the grounder fails *silently* (verify the ref), the validator/director/orchestrator/harness gaps are fixed (pkg1) or specced (2/3). Pipeline = strong co-pilot with you on the gate, not unattended autopilot (which matches your ship-gate-is-human lock).

## 4. Reference / reusable
- Platform surface map + release-surface HTML (where each surface ships).
- Changelog template + earmarked cohort: `research/changelog-template-2026-06-05.md`.
- 5 new memories saved (super-objective-never-named, grounder-blind-spots, actor-format-blind, surface-map, verify-implementer-output).

## Awaiting YOUR decision on return
1. **Approve the package-2 design** (esp. Part B emission agent) + the 5 open decisions.
2. **Fire pkg2-Part-A + pkg3 to Codex** — specs ready (I may have already done pkg3 + Part-A by the time you read this; see my latest message).
3. **The actual launch** (all human-gated): open the changelog+roadmap PR, post the X thread via Typefully, flip the `enableBridgeBankDeposits` flag.
