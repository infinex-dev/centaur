# Harness / Actor-Director pipeline — diagnosis + fix list (2026-06-05)

Source run: `01KT8T3ZCX27C5AXY3X5F697C9` (bridge.xyz launch, 7 channels × n=5 = 35 candidates).

## The 31 minutes
- **Actor:** 1 attempt, ~3.2 min, produced all 35 candidates in one pass.
- **Director:** 35 audits (7 channels × 5), run **serially**, ~1 min each (claude-sonnet-4-6) = **~35 min. This is the entire cost.**
- Waste: carousel's 5 candidates all failed the regex gate, but were **still Director-audited serially** (~5 min spent auditing already-dead copy).

## Why carousel got 0 passes and never retried (core architectural bug)
- A pick requires **BOTH** `script_validation.passed` **AND** `director passed` (`actor-orchestrator.ts:646`). Regex is a **hard gate in front of the Director.**
- Carousel: all 5 failed regex (`unsupported-claim: numeric claim "1".."4"` — the card ordinals). One candidate (`01KTAPH151FQY4AYRVS31FTBAT`) **passed the Director (director_passed=1)** but could not be picked because regex failed first.
- Retry **only** fires via the grounder fact-request back-edge (`actor-orchestrator.ts:446`). A plain script-validation failure triggers **no** regeneration.
- The grounder was **not wired into the harness run** (`opts.grounder` undefined) → back-edge fully dark. Director emitted KYC fact-requests; they were collected and ignored (0 `fact_requests_*` events).
- Net: picks = 6, channels = 7, early-exit condition (`:431`) false, no retry path → carousel silently missing.

## Gate map (what the UI labels mean)
- **DET / "rejects"** = regex validator → `candidates.validation_passed`
- **JUDG / "director" / "judge"** = LLM Director → `director_audits.passed` (`copy_voice_passed && factual_passed && infinex_fit.legal`)
- Pick = both pass. The carousel "director fail = numeric claim" is the **UI echoing the regex reason into the director cell** — the Director didn't fail on numbers.

---

## Fix list (prioritized)

### P0 — correctness
1. **Validator numeric false-positive.** Exempt carousel/structural ordinals from `unsupported-claim`; carry carousel numbering as structure, not body text. `src/validator.ts` (+ carousel emit). → unblocks carousel, stops false rejects. **(add positive+negative tests — repo rule)**
2. **Retry on zero-pass channel.** If a channel ends with 0 picks, re-run the Actor with the failure reasons as targeted feedback ("all carousel candidates failed rule X; use only deployed_facts") — not only via the grounder. `src/actor-orchestrator.ts:~431,~646`. → no silently-missing channels.
3. **Wire the grounder into the harness path.** `harness/app/actions/generate.ts` omits `opts.grounder`, so the back-edge is dark in the UI run. Pass `buildFactRequestGrounder({ groundFacts })` like `run-actor-director-card.ts:63` does. → the actor→grounder loop actually runs where you review.

### P1 — performance (~35 min → ~5 min)
4. **Parallelize Director audits** with a concurrency cap (Promise.all / pool). `src/actor-orchestrator.ts:~349`.
5. **Skip Director audit for regex-failed candidates** — don't spend ~1 min each auditing dead copy.
6. Optional: drop default `n` 5 → 3 (still gives a choice set; 30% fewer calls).

### P1 — review-UI visibility (can't trust what you can't see)
7. **Show the failed candidate TEXT** inline in the Failures view. `harness/app/cards/[id]/page.tsx:154-172` + `components/design/PackageTabs.tsx:273`.
8. **Director-fail hover** → real `voice_issues / factual_issues / publication_gate_issues`. `components/design/atoms.tsx:50` (Gate gets a `title`). **[quick win]**
9. **Expandable "+N more tweets/cards."** `components/design/SurfacePreview.tsx:100,243` (useState + onClick). **[quick win]**
10. **Stop the Director cell echoing the regex reason.** When regex pre-fails, show "Director not run — blocked upstream," not the regex text.
11. **Show the Actor's DECLARED beats per surface** (`table_work.channel_beat_plans`, `types.ts:146`) — currently only the (empty) audited beats render, so beats look absent though the Actor planned them. `page.tsx:176`.
12. **"superseded" tooltip** = "passed all gates but wasn't the chosen pick for this surface." `page.tsx:156`.

---

## The honest verdict (original session thesis)
The **Actor produces copy worth shipping.** The **surrounding machinery is degraded**: serial-slow Director, a validator false-positive that silently kills a channel, no retry on it, a regex hard-gate that blocks Director-approved copy, the grounder back-edge unwired in the UI path, and a review surface that hides reasons/text/beats. So today the pipeline **cannot run unattended** — the operator caught the EUR error, the "specify" error, and the dropped carousel that the machine would have shipped or silently lost. Every gap above is fixable; this list is the path to a pipeline you can actually trust off the leash.
