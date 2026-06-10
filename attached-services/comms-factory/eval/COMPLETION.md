# Permutation eval — Wave 1 completion

## Files

- `src/generator.ts` — added `PromptPermutation` type ("current" | "kernel" | "placement" | "examples" | "full"), plumbed `permutation` through `GenerateOptions`, `InnerWorkGenerateOptions`, `DraftFromInnerWorkOptions`, `generate()`, `generateForChannels()`, `generateInnerWork()`, `draftFromInnerWork()`. Refactored `buildSystemPrompt` to assemble per-variant, added `buildMirodanKernel()` (12 derivation rules covering Laban/Mirodan basics, baseline rules, Working Actions, prep hierarchy, Subconscious Motif → tempo, 24-cell drive derivation, Infinex Diagram D, Passion off-spec, the 5 tempi, beat-shift semantics) and `buildResolvedFactsBlock(voice)`. Default `"current"` preserves byte-identical behavior; all 174 vitest tests pass.
- `eval/run-permutations.ts` — main rig. CLI + library exports (`runPermutations`).
- `eval/permutation-metrics.ts` — cell metric computation (validator pass, em-dash density per 280, length distribution, placement hit, off-spec drive rate, tempo distribution + entropy + coverage, motor-pair distribution, fact-contract violations).
- `eval/corpus-format.ts` — markdown builder for `scripts/classify-corpus.ts`'s `parseCorpus()` shape (newline → `\n`, pipe → `\|`) and verifier JSON parser.
- `eval/harness-db.ts` — `better-sqlite3` wrapper. Auto-applies the `prompt_variant` column when missing so the rig runs end-to-end before the parallel migration lands.
- `eval/tsconfig.json` — extends root tsconfig with `rootDir: ..` so eval can import from `src/`.
- `eval/README.md` — usage + runtime + output layout.

## Smoke test — 1 card × 5 permutations × n=2

Card: `cards/trezor-2026-05-19.json` (launch-tier). Channel: x. Output: `eval/runs/smoke-2026-05-26/`.

| permutation | n | validator_pass | placement_hit (stable+flow+penetrating+spell) | off_spec_drive (passion) | tempo_coverage | fact_contract |
|---|---|---|---|---|---|---|
| current | 2 | 0/2 | 0/2 | 0/2 | 1/5 (commanding) | 0/2 |
| kernel | 2 | 1/2 | 0/2 | 1/2 | 2/5 (commanding, practical) | 0/2 |
| placement | 2 | 0/2 | 0/2 | 1/2 | 1/5 (commanding+self-contained) | 0/2 |
| examples | 2 | 0/2 | 1/2 | 0/2 | 1/5 (practical+self-contained) | 0/2 |
| full | 2 | 0/2 | 0/2 | 0/2 | 1/5 (commanding+self-contained) | 0/2 |

Pass criteria — all met:
- DB has 10 candidates with `prompt_variant` populated (2 per permutation).
- Verifier output parses cleanly and joins to candidates by id; every candidate has a classification.
- `results.json` + `summary.md` written, shape-correct, non-empty.

The dominant validator failure across cells is `ai-slop: em-dash density 1 in <280 chars` — this is the recently-tightened zero-tolerance em-dash rule (commit `0e3352d`) firing as designed, not a rig bug. Drift signal is genuine: the locked placement is `stable+flow+penetrating+spell→vision` and only the `examples` cell landed there in a sample of 2.

## Punts

- The parallel `prompt_variant` schema migration hasn't landed; `HarnessDb.ensurePromptVariantColumn` adds the column itself idempotently so the rig works today. Drop that helper once the migration ships.
- Cell metrics are point estimates; bootstrap CIs are deferred to Wave 2 (n=2 is too small).
- The 12-rule kernel reads from research bundle + voice spec + classifier system prompt. If Wave 2 reveals the kernel is too dense, split into 6-rule kernel (Laban/baseline/stress only) vs 6-rule kernel (drive derivation only) to isolate which half does the work.
- No paired-permutation diff table yet (which candidates flip between `current` and `kernel`). Wave 2 add.
