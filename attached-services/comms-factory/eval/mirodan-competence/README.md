# Mirodan competence eval — open-book competence battery (Wave 1B)

A machine-gradable battery that tests whether a model with a given prompt
context can MECHANICALLY reason about Mirodan's character framework — not
just pattern-match the mood.

## Why this exists

Closed-book evals on Opus 4.7 / Sonnet 4.6 / Haiku 4.5 showed roughly ~70%
coverage of plain-Laban material but only ~10-15% on Mirodan-specific
synthesis (Working-Actions preparation order, three-baseline rule, Drive
derivation from active/latent factors, Outer Action Attitudes vs baseline
Inner Attitudes). Conclusion: **Mirodan is not latent model knowledge.** It
must be supplied via prompt context.

This battery is the OPEN-book test that lets the permutation-rig agent
measure whether a particular system-prompt context teaches the framework
well enough for mechanical reasoning, rather than merely supplying the mood.

## Question bank

30 questions across 6 categories:

| Category | Q's | What it tests |
|---|---|---|
| **laban_vs_mirodan** | 5 | Does the model distinguish Laban's primitives (Effort/Shape/Space, eight Working Actions, four Motion Factors) from Mirodan's synthesis (six-piece-unit, four Drives, three-baseline rule, Shadow Moves vs Working Actions)? |
| **baseline_legality** | 6 | Only Stable / Near / Adream can be BASELINE Inner Attitudes. Mobile / Awake / Remote are outer-only. Each baseline has legal stress factors (e.g. Stable's legal stresses are Time or Flow — never Space, never Weight). |
| **motor_pair_prep** | 5 | Quick Working Actions require their Sustained partner as inner preparation. Pressing→Punching, Wringing→Slashing, Gliding→Dabbing, Floating→Flicking. The direction is NOT reversible. |
| **tempo_perception** | 4 | Tempo is PERCEIVED by audience, DERIVED from Deciding + Working Action, never consciously chosen. A generator that emits a bare `tempo: Commanding` without specifying motor verbs is doing paint-by-numbers slop. |
| **drive_derivation** | 5 | Drive = the three active Motion Factors, named by the latent fourth. Infinex's locked placement (Stable + Penetrating + Flow-stressed) derives to Spell→Vision (Diagram D). Passion is mechanically disqualified because Penetrating means Space is active, and Passion is the Spaceless Drive. |
| **classify_this_line** | 5 | Given a sample caption: classify motor verbs, register, drive, and on-spec/off-spec verdict for Infinex. Two on-spec lines, three off-spec (Passion-flavored urgency / AI-slop / antagonism). |

Distribution by discriminator: **27 mirodan_specific · 3 laban_only**. The
laban-only questions are sanity floors — a model that fails those is failing
on baseline movement vocabulary, not on Mirodan synthesis.

## Headline metric

The interesting cell is **Mirodan-specific pass rate** — that's what tells us
whether a prompt teaches the framework or just supplies the mood. A model
that scores high on the laban_only subset but low on mirodan_specific is
running on training-data Laban knowledge, not on the supplied context.

Aggregate output (per `aggregate()` in `grader.ts`):

- `total`, `passed`, `pass_rate`
- `by_category[c] → { total, passed, pass_rate }`
- `by_discriminator[d] → { total, passed, pass_rate }`
- `headline_mirodan_specific_pass_rate` (the cell to watch)

## Grader

All matching is mechanical. **No LLM-judge grading.** Five grader kinds:

| Kind | Match |
|---|---|
| `exact` | whole-response equality after lowercase/whitespace normalization, OR token-containment of the canonical answer. |
| `one_of` | response contains at least one of N canonical tokens, word-boundary-aware. |
| `regex` | response matches at least one regex pattern (case-insensitive by default). |
| `all_of` | response contains at least one token from each of N groups (synonym sets). |
| `structured` | for each labeled key, run a one_of or regex matcher against a labeled-window slice of the response (falls back to whole-response). Includes a **negation guard**: matches preceded by "not", "isn't", "rather than", "instead of", etc. are rejected. |

Negative-control sanity (confirmed): garbage responses pass 0/30. Vaguely-on-
topic flavored junk passes 2/30, exclusively on questions where the junk
happened to contain the right single-word answer (correct one_of behavior).

## Files

- `questions.ts` — typed question bank (32 questions, 6 categories).
- `grader.ts` — mechanical grader + aggregator.
- `runner.ts` — Anthropic SDK invoker (CLI, takes optional system-prompt prefix per permutation).
- `self-test.ts` — standalone runnable self-test (synthesizes ideal answers from the answer keys, grades them, asserts 100%).
- `self-test.test.ts` — vitest wrapper for `pnpm test` coverage.
- `README.md` — this file.
- `COMPLETION.md` — build report.

## Run

### Self-test (proves grader + answer keys are in sync)

```bash
# Standalone:
pnpm tsx eval/mirodan-competence/self-test.ts

# Or as part of the project test suite:
pnpm test eval/mirodan-competence
```

### Run the battery against a model (Wave 2, not Wave 1B)

```bash
# With a system-prompt context file (the permutation under test):
pnpm tsx eval/mirodan-competence/runner.ts \
  --system-prompt-file=research/infinex-character-bundle.md \
  --output=eval/mirodan-competence/runs/perm-A.json \
  --label=perm-A-compact-kernel \
  --model=claude-opus-4-7

# Baseline (no context — tests latent model knowledge only):
pnpm tsx eval/mirodan-competence/runner.ts \
  --system-prompt-empty \
  --output=eval/mirodan-competence/runs/baseline.json \
  --label=baseline-no-context \
  --model=claude-opus-4-7
```

The runner writes `{ label, model, system_prompt_path, ran_at, responses[] }`.
The grader is invoked separately on the output JSON — that decoupling lets
Wave 2 re-grade old runs with refined answer keys without re-paying API cost.

## Permutation slots (Wave 1C/1D)

The runner accepts an arbitrary system-prompt string. The five permutations
the program intends to test (each writes a system-prompt context file the
runner is pointed at):

1. **Baseline** — no context (`--system-prompt-empty`).
2. **Compact kernel** — `research/infinex-character-bundle.md` (217 lines).
3. **Full character sheet** — `research/infinex-character-sheet.md` (longer working voice doc).
4. **Locked voice TS** — a markdown render of `src/voice/infinex.ts`.
5. **Stitched** — kernel + canonical Mirodan ch1/ch3 excerpts (motor-pair prep + Drive composition only — the load-bearing mechanical bits).

Choosing which permutation is on-load-bearing is the Wave 1C/1D agent's job;
this battery is the measurement instrument they hand-tune against.

## Anti-patterns this eval is built to catch

- A prompt that supplies the MOOD ("write like Werle, decisions already
  taken, future-pull not urgency") but not the FRAMEWORK MECHANICS will pass
  some classify_this_line questions on vibe alone and fail Drive derivation /
  motor-pair / baseline-legality questions. The split between category 6 and
  categories 2-5 is the diagnostic.
- A prompt that supplies the FRAMEWORK but no Infinex specifics will pass
  baseline_legality and motor_pair_prep but fail the Infinex-specific drive
  derivation (dd-01 through dd-06) and the classify_this_line battery.
- A prompt that's just the full `src/voice/infinex.ts` should pass nearly
  everything; if it doesn't, the spec itself has gaps the permutation-rig
  agent can identify.

## Source of truth

- `src/voice/infinex.ts` — locked Infinex voice spec.
- `research/infinex-character-bundle.md` — compact Mirodan kernel.
- `~/Downloads/nigel-session-2026-04-28/mirodan-ch{1,2,3,4}-*.md` — canonical Mirodan chapters (gold ground truth for the framework itself).
- `scripts/classify-corpus.ts` — `DRIVE_TABLE` (the 24-cell drive table used to derive Drives from inner/aspect/stress).
- Project memories: `mirodan-laban-framework`, `infinex-drive-spell-not-passion`, `infinex-5-tempi-locked`, `methodology-actor-table-work-before-drafting`.
