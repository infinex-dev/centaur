# Mirodan competence eval — completion report

**Wave 1B deliverable.** Open-book competence battery that proves whether a
given prompt context teaches the Mirodan / Laban character framework well
enough for mechanical reasoning, not just mood pattern-match.

## Files

- `eval/mirodan-competence/questions.ts` — typed question bank.
- `eval/mirodan-competence/grader.ts` — mechanical grader (5 kinds: exact, one_of, regex, all_of, structured) plus aggregator. Includes negation guard on structured-verdict keys.
- `eval/mirodan-competence/runner.ts` — Anthropic SDK runner. Accepts an arbitrary system-prompt prefix per permutation, runs all questions, writes JSON.
- `eval/mirodan-competence/self-test.ts` — standalone runnable self-test; synthesizes ideal responses from each question's answer key and confirms 100% pass.
- `eval/mirodan-competence/self-test.test.ts` — vitest wrapper so `pnpm test` also covers it.
- `eval/mirodan-competence/README.md` — how to run, what each category tests, headline metric definition, permutation slots for Wave 1C/1D.
- `eval/mirodan-competence/COMPLETION.md` — this file.

## Question count & distribution

**30 questions total**, distributed:

| Category | Q's |
|---|---|
| laban_vs_mirodan | 5 |
| baseline_legality | 6 |
| motor_pair_prep | 5 |
| tempo_perception | 4 |
| drive_derivation | 5 |
| classify_this_line | 5 |

By discriminator: **27 mirodan_specific · 3 laban_only**. The laban-only
questions are sanity floors — any model that fails those is failing on
baseline movement vocabulary, not Mirodan synthesis. The headline metric is
the mirodan_specific pass rate; that's the cell that tells us whether a
prompt teaches the framework or just supplies the mood.

## Self-test result

```
Mirodan competence eval — SELF-TEST
────────────────────────────────────────────────────────
Total questions: 30
Passed:          30
Pass rate:       100.0%

By category:
  laban_vs_mirodan         5/5  (100.0%)
  baseline_legality        6/6  (100.0%)
  motor_pair_prep          5/5  (100.0%)
  tempo_perception         4/4  (100.0%)
  drive_derivation         5/5  (100.0%)
  classify_this_line       5/5  (100.0%)

By discriminator:
  mirodan_specific         27/27  (100.0%)
  laban_only               3/3  (100.0%)
```

The self-test feeds the grader synthesized ideal responses (one_of: first
canonical token; regex: hand-crafted prose hitting at least one pattern;
all_of: one per group; structured: `key: value` lines using the matchers
declared per question). All 30 pass.

Vitest spec (`self-test.test.ts`) passes 4/4 assertions including a negative-
control test that confirms garbage responses pass 0/30 and an invariant test
on question count + category coverage.

Negative-control verified at build time:
- Garbage response ("I do not know. The sky is blue."): **0/30 passed.**
- Vaguely-on-topic flavored junk: **2/30 passed**, both on `motor_pair_prep`
  questions where the junk's single-word vocabulary happened to coincide
  with the correct one_of token. This is correct one_of behavior.

## Headline metric (definition)

Per question: `{pass, category, discriminator}`. Aggregated:

- `pass_rate × category` (5 numbers — useful for diagnosing WHICH part of
  the framework a permutation under-teaches).
- `pass_rate × discriminator` (2 numbers).
- `headline_mirodan_specific_pass_rate` — the cell to watch in Wave 2.

A prompt that supplies mood but not mechanics will pass classify_this_line on
vibe and fail baseline_legality + drive_derivation. A prompt that supplies
mechanics but no Infinex specifics will pass baseline_legality and motor-
pair_prep but fail the Infinex-specific Drive-derivation cluster (dd-01
through dd-05) and Infinex-specific classify_this_line questions.

## Punts / open items

- **Did not run any LLM call.** Per brief: build + self-test only; live runs
  are Wave 2 (permutation rig agent in Wave 1C/1D, eval runs in Wave 2).
- **Did not install `node_modules` in the worktree.** The standalone self-
  test runs cleanly via the main repo's `node_modules/.bin/tsx`; `pnpm test`
  works from the main repo's checkout. Per-worktree install is a one-time
  `pnpm install` before live runs.
- **`tempo_perception` only has 4 questions** (brief said ~4). This is fine;
  the category is conceptually tight: tempo is derived, not assigned;
  motor verbs are input, tempo is output; actor commits to verb, audience
  perceives tempo; bare-`tempo:`-JSON is the diagnostic slop signature.
- **No `lining` cell yet** — Lining is the sixth piece of the unit and the
  current battery names it (in lvm-01) but doesn't probe its mechanics. If
  Wave 2 shows the Mirodan-specific pass rate is high for everything EXCEPT
  Lining-sensitive copy, add a Lining-derivation category in v2 of this
  battery.
- **Five permutations not yet stitched together as system-prompt files.**
  That's Wave 1C/1D's deliverable; the runner accepts arbitrary system-
  prompt content from `--system-prompt-file=<path>`.
