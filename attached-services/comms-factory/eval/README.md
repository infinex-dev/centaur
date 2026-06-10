# eval/ — permutation rig

Measures whether the comms-factory generator needs explicit Mirodan/Laban
context to write on-spec Infinex copy by running five prompt-architecture
permutations and grading every candidate with the v2 verifier.

## Layout

| File | Purpose |
|---|---|
| `run-permutations.ts` | Main entrypoint. Iterates (card × permutation × n), calls `generate()`, writes the cell corpus, spawns the verifier, joins results, writes harness DB rows, computes metrics. |
| `corpus-format.ts` | Build markdown corpora matching `scripts/classify-corpus.ts`'s `parseCorpus()` shape; parse verifier JSON back into typed results. |
| `permutation-metrics.ts` | Compute per-cell metrics: validator pass, placement hit, off-spec drive, register coverage, motor distribution, fact-contract violations, em-dash density, length. Locked Infinex placement is the comparison target. |
| `harness-db.ts` | Thin `better-sqlite3` wrapper. Inserts candidate rows tagged with `prompt_variant`. Auto-adds the column when the parallel migration hasn't landed yet (idempotent). |
| `tsconfig.json` | Extends the root tsconfig with `rootDir: ..` so eval can import from `src/`. |

## Permutations

| Variant | What the generator sees |
|---|---|
| `current` | The full 8-section system prompt (no behavior change) |
| `kernel` | `current` + a 12-rule Mirodan derivation kernel injected after `validation_criterion` |
| `placement` | Character placement header only + `RESOLVED PLACEMENT (use, don't derive)` block |
| `examples` | Tempi `example_lines` only (no feel / lining / opening_shapes / vocab anchor) |
| `full` | Kernel + placement header + RESOLVED PLACEMENT + examples-only loop |

The flag plumbs through `generate()` → `generateInnerWork()` + `draftFromInnerWork()`
→ `buildSystemPrompt(voice, permutation)`. Stub mode ignores the flag (no
prompt is built). See `src/generator.ts:buildSystemPrompt` for the variant
matrix.

## Running the smoke test

```
ANTHROPIC_API_KEY=... \
  pnpm tsx eval/run-permutations.ts \
  --cards=cards/trezor-2026-05-19.json \
  --permutations=current,kernel,placement,examples,full \
  --n=2 \
  --channel=x \
  --output-dir=eval/runs/smoke-$(date +%Y-%m-%d) \
  --harness-db=harness/harness.db
```

Outputs:

- `<output-dir>/results.json` — full per-cell candidate + verifier classification + metrics
- `<output-dir>/summary.md` — markdown table by (card, permutation)
- `<output-dir>/corpora/<card_id>__<permutation>.md` — the markdown fed to the verifier
- `<output-dir>/verifier/<card_id>__<permutation>.json` — raw verifier output
- harness DB rows: every candidate inserted with `prompt_variant` populated

Expected smoke runtime: ~3-5 min (5 generator calls × Stage-A/Stage-B × ~10-20s each, +
5 verifier calls × ~5-10s each). Failure modes: `ANTHROPIC_API_KEY` unset (stub mode
runs but verifier hard-requires the key), missing fixture card, `harness/harness.db`
parent dir missing (auto-created).

Pass `--skip-verifier=true` to short-circuit the classifier subprocess (useful
when iterating on the rig wiring without spending API budget).

## Wave 2 — full eval (not in this PR)

5 cards × 5 permutations × n=30 = 750 candidates. Wall-clock ~3-5h. Same
script, different `--cards` and `--n`. Wave 2 also adds bootstrap CIs over
placement-hit-rate and a paired-permutation diff table in `summary.md`.
