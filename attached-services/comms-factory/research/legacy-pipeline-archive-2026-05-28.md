# Legacy pipeline archive — planning doc

**Date:** 2026-05-28
**Status:** Planning doc, written before deletion. The deletion itself is a separate PR.
**Architectural decision:** Pipeline 3 (Actor/Director, `src/actor-director.ts` + `src/actor-orchestrator.ts`) becomes the canonical and only pipeline. Pipeline 1 (legacy generator) and Pipeline 2 (legacy + LLM validator) are deleted.

## TL;DR — how to recover anything

```bash
# Recover the entire pre-deletion state
git checkout legacy-pipeline-final

# Recover one specific file from the tagged commit
git show legacy-pipeline-final:src/generator.ts > /tmp/generator.ts

# Revert the deletion PR entirely
git revert <deletion-commit-sha>
```

The git tag `legacy-pipeline-final` is the single anchor for recovery. Everything in this doc is just orientation; the tag is the source of truth.

## Why delete

See `research/pipeline-map-2026-05-28.html` for the full map. The headline:

- Pipeline 1 declares tempo per beat via `TempoBeat[]`, which violates Mirodan canon (tempo is emergent from the verb under inner work, not declared upstream — per `[[methodology-actor-table-work-before-drafting]]`). The whole essayist 3-beat-arc failure mode observed in the v2 A/B/C testing flows from this architectural choice.
- Pipeline 2 is Pipeline 1 with an LLM-based validator bolted on. Same upstream architecture. Same problem.
- Pipeline 3 is verb-centric, tempo-emergent, with a blind LLM Director audit and source-indexed Mirodan canon (ch1-4 + vol2 PDF + combined reference) in both Actor and Director system prompts. Architecturally correct.
- Keeping Pipelines 1 and 2 alongside Pipeline 3 means: maintaining two sets of contamination-cleanup work, two sets of tests, two sets of validator paths, two sets of orchestrators. The CLAUDE.md "Don't add error handling, fallbacks, or validation for scenarios that can't happen" principle applies — once Pipeline 3 is the production path, Pipeline 1+2 are dead weight that drift.

## Files to delete

### Core legacy generator + validators (3,635 lines)
| File | LOC | What it is |
|---|---|---|
| `src/generator.ts` | 1493 | `generate()` legacy single-call + two-call paths, `generateInnerWork()`, `draftFromInnerWork()`, stub generation, beat-prompt builders, system/user prompt construction |
| `src/validator.ts` | 840 | Deterministic regex validator (cliche, listicle, AI-slop, em-dash, off-spec urgency, blind tempo classifier) |
| `src/validator-llm.ts` | 849 | LLM "active validator" — Sonnet call with operator-paraphrase drive descriptors |
| `src/validator-active.ts` | 326 | Active-validator orchestration helpers |
| `src/orchestrator.ts` | 388 | `orchestrate()`, `orchestrateWithRetries()`, `orchestrateActive()`, `orchestrateActiveWithRetries()` — the legacy retry+pick logic. The Pipeline 3 retry orchestrator lives in `src/actor-orchestrator.ts` and is NOT affected. |
| `src/eval.ts` | 109 | Wraps `orchestrateWithRetries` for eval runs |

### Tests (1,283 lines)
| File | LOC | What it tests |
|---|---|---|
| `src/__tests__/generator.test.ts` | 373 | Legacy `generate()` path |
| `src/__tests__/validator.test.ts` | 463 | Regex validator + blind classifier |
| `src/__tests__/validator-active.test.ts` | 156 | LLM validator |
| `src/__tests__/orchestrator.test.ts` | 202 | Legacy orchestrator |
| `src/__tests__/eval.test.ts` | 89 | Eval wrapper |

### Harness legacy branch (~100 lines)
- `harness/app/actions/generate.ts:346-440` — `generateForChannel` + the `orchestrateActiveWithRetries` vs `orchestrateWithRetries` branching. The harness should be reduced to only routing through `orchestrateActorDirectorWithRetries`.

### Total: ~5,000 lines removed.

## Decisions deferred (kept out of the deletion PR)

### 1. `src/copy-rewrite-llm.ts` (763 lines) — keep or delete?
Separate use case: rewriting existing copy in place (e.g. homepage dogfooding) rather than generating from a release card. Not part of the release-card generation pipeline. **Decision: keep as a sibling tool unless explicitly retired.** Reassess separately.

### 2. `src/voice/infinex.ts` `defaultBeatsForKind()` — keep or delete?
Currently called by Pipeline 1's `generate()`. Pipeline 3 (Actor) selects its own beats per channel from the card + voice spec, so `defaultBeatsForKind` is dead code under Pipeline 3. **Decision: delete the function** as part of voice/infinex.ts cleanup; keep the canonical_shorthand + factor_shape + motor data on the tempi.

### 3. `validator.ts` regex rules — keep as Pipeline 3 pre-filter?
Open question. The regex rules catch hard mechanical failures (em-dash density, hardcoded slop tokens like "game-changer") that an LLM Director might rationalize. We can either:
- (a) Delete `validator.ts` entirely. Pipeline 3 Director handles everything via LLM.
- (b) Keep the regex rules (~150 lines extracted from validator.ts) as a deterministic pre-filter inside `orchestrateActorDirectorWithRetries`, fired before the Director audit.

**Decision: held for separate discussion.** Not part of this archive PR.

### 4. `src/cli.ts generate` command
Currently routes through Pipeline 1. Options: rewire to Pipeline 3, or remove the CLI subcommand. **Decision: rewire to Pipeline 3.** Easy lift.

### 5. `eval/permutation-prompts/*` and `eval/run-permutations.ts`
Used for v2 classifier audit work. Independent of the generator pipeline. **Decision: keep.** Mark in directory README that this is classifier-evaluation tooling, not generation pipeline.

## Equivalent functionality — Pipeline 1 → Pipeline 3 mapping

| Pipeline 1 | Pipeline 3 equivalent |
|---|---|
| `generate(card, opts)` | `generateActorAttempt(card, opts)` |
| `BeatSequence` with `TempoBeat[]` | `ActorTableWork.channel_beat_plans` with `ActorBeatPlan` (verb + Working Action, no tempo) |
| `validate(text, opts)` regex audit | `auditCandidateWithDirector(opts)` blind LLM audit |
| `auditTextLLM` active validator | Same — `auditCandidateWithDirector` |
| `orchestrateActiveWithRetries` | `orchestrateActorDirectorWithRetries` |
| `Candidate` type | Same `Candidate` type — Pipeline 3 returns it via `actorOutputToCandidates()` |
| Operator feedback → retry | `director_notes` → retry, with full Actor transcript preserved |
| `stubCandidates()` for offline tests | Pipeline 3 supports injected mock clients via `opts.client`; stub mode is intentionally blocked (see `assertLiveActorDirectorMode`) |

## Functional surface impact

What we lose:

1. **Deterministic regex pre-filter** — see deferred decision #3 above. If we don't keep the rules, we depend entirely on the Director's LLM judgment for slop detection.
2. **Stub mode for cheap tests** — Pipeline 3 doesn't have a stub generator. Tests use injected mock clients. Acceptable; the actor-director tests already do this.
3. **Sonnet-based active validator as a separate audit pass** — replaced by Director audit (also Sonnet by default). Same model, different prompt and schema. The Director's prompt is source-indexed Mirodan canon with two-factor Attitude gate; the active validator's prompt has operator-paraphrase drive descriptors. The Director is a more faithful replacement than just a rename.
4. **The two-call Stage A → Stage B generator** — Pipeline 3 does it all in one Actor call (single Opus invocation returns warmup + table_work + performances + selected_performances per channel).

What we DON'T lose:

- Any historical data (`eval/runs/*`, `research/*`, `cards/*`, etc.)
- The voice spec layer (`src/voice/*.ts`) — both pipelines read it
- The card schema (`src/card.ts`) — both pipelines read it
- All tests that exercise actor-director (`src/__tests__/actor-director.test.ts` + others)
- Anything in git history (tag preserves the commit forever)

## Sequencing

1. **Land the five Pipeline 3 surgical fixes first:**
   - Switch `HARNESS_GENERATOR_ARCH` default to `'actor'` (or remove the gate)
   - Fix `actor-memory.ts:373` channel grammar (drop "Usually 3-4 short paragraphs/beats")
   - Fix `actor-director.ts:429` hardcoded "Infinex character"
   - Apply Variant C to `card.ts:48, :61-62` docstring examples
   - Strip wall anchor from `voice/cream.ts:22, :361`
2. **Re-run v2 A/B/C/D/E against Pipeline 3** to confirm the new pipeline produces materially better captions and the docstring decision still holds.
3. **Tag the pre-deletion commit:**
   ```bash
   git tag -a legacy-pipeline-final -m "Last commit with Pipeline 1 (legacy generator) + Pipeline 2 (legacy + LLM validator). Recovery: git checkout legacy-pipeline-final."
   git push origin legacy-pipeline-final
   ```
4. **Ship the deletion as a separate PR.** Don't bundle with the five fixes — the deletion is the riskier move, and a separate commit makes the diff legible and the revert clean if Pipeline 3 turns out to need a safety net.
5. **Add discoverable comments** to `src/actor-director.ts` header + `harness/README.md`:
   ```ts
   // Pipeline 1 (legacy generator) and Pipeline 2 (legacy + LLM validator) were
   // removed on 2026-XX-XX. See research/legacy-pipeline-archive-2026-05-28.md
   // or `git checkout legacy-pipeline-final` to recover.
   ```

## Recovery cookbook

**Need to look at a deleted file?**
```bash
git show legacy-pipeline-final:src/generator.ts | less
git show legacy-pipeline-final:src/validator.ts | less
```

**Need to copy a specific function back?**
```bash
git show legacy-pipeline-final:src/validator.ts > /tmp/legacy-validator.ts
# Open /tmp/legacy-validator.ts, extract the function, paste into the new location
```

**Need to roll back everything?**
```bash
git revert <deletion-commit-sha>
# Or, for a fresh branch:
git checkout -b restore-legacy legacy-pipeline-final
```

**Need to see what changed in the deletion?**
```bash
git log --diff-filter=D --summary  # all deletion commits
git show <deletion-commit-sha> --stat  # specific deletion diff
```

**Need to confirm the tag is still on remote?**
```bash
git ls-remote --tags origin | grep legacy-pipeline-final
```

If the tag is ever accidentally deleted from the remote, anyone with a local clone has the SHA in their reflog and can re-tag. The tag is overdeterminedly safe.

## Pointers for future operators

If someone reads this doc six months from now and is wondering "wait, where did the regex validator go?" or "is there still a stub generator?":

- The Actor/Director pipeline is in `src/actor-director.ts` (Actor + Director logic) + `src/actor-memory.ts` (system prompts + Mirodan source indexing) + `src/actor-orchestrator.ts` (retry orchestration).
- The Mirodan canon source files are at `~/Downloads/nigel-session-2026-04-28/mirodan-ch{1,2,3,4}-*.md` and the vol2 PDF — these are indexed and hashed at every Actor/Director call.
- If you need to add a deterministic pre-filter (mechanical slop rules) on top of the Director, see deferred decision #3 above. The rules to lift would be in `git show legacy-pipeline-final:src/validator.ts`.
- If you need stub mode (offline tests), see how `src/__tests__/actor-director.test.ts` injects mock clients via `opts.client`. That's the canonical pattern.
- The voice spec at `src/voice/infinex.ts` is Laban-pure (canonical_shorthand + factor_shape + motor only — no brand vocab, no operator paraphrases). See `research/infinex-brand-vocab-archive-2026-05-28.md` for the pre-Laban content that was stripped.

## Why this doc lives in `research/`

It's a planning artifact and a recovery cookbook, not load-bearing code. Per the CLAUDE.md docstring practice in this repo, planning + research lives in `research/` and stays discoverable via the file tree. The git tag is the canonical anchor; this doc is the human-readable orientation.
