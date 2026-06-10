# Narrative reconciliation — handover docs vs. git history

**Run:** 2026-05-25
**Scope:** every `HANDOVER-*.md` at repo root + `harness/HANDOFF-SPEC.md` + `PLAN-holistic-generator.md`, reconciled against `git log` through HEAD `bacb67d`.
**Method:** narrative-only. No code verification. Commit messages and `--stat` output treated as ground truth for "what landed."

---

## 0. Author note — single committer

Every commit on `main` is authored by `opaque-infinex <opaque@core.infinex.xyz>`. No commits carry a `Co-Authored-By: Codex` trailer or alternative committer identity. **Codex's work was rebased/folded into operator commits**, not surfaced as separate author. The "Codex landed X" claims in handovers can only be validated by commit content + timing, not by author field.

The dirty working tree (M `src/card.ts`, `src/generator.ts`, `src/voice/infinex.ts`, `src/voice/types.ts`, `src/__tests__/generator.test.ts`, +874 LOC in generator.ts uncommitted) shows the most consequential recent work — Phase 0/1/2 of the holistic-generator redesign claimed "shipped and tested" by the 05-22 phase-2-complete handover — is **uncommitted**.

---

## 1. Chronological handover inventory

| File | Date | Anchor commit at time of writing | Claim summary |
|---|---|---|---|
| `SESSION_HANDOVER.md` | 2026-05-13 | `~ab775cd` | Voice specs (4 brands), Remotion renderer, validator-llm landed. Calls out perps-app dev server "still running PID 93462" and design brief zip at `/tmp/`. Working tree dirty. |
| `HANDOVER-2026-05-18-laban-audit.md` | 2026-05-18 | uncommitted (most of session) | Laban audit, Phantom vs Infinex 380+480 samples, classifier v2, 3-shell viz handed to designer, PRODUCT-MAP.md, drive-mapping.md rewrite. Blocked on Claude Code Design returning viz. |
| `HANDOVER-2026-05-20-session.md` | 2026-05-19→20 | uncommitted | Harness Phase 1 + 2 + 3 "complete", design pass done, DB initialized, runnable at :3210. Banker-trailblazer image locked. Bundle vs production generator test (40% vs 69%). |
| `HANDOVER-2026-05-22-voice-pipeline-and-mirodan-tts.md` | 2026-05-22 AM | uncommitted (pre-Phase-2) | Diagnosis of generator missing actor table-work. Proposes Phase 0-5 redesign. Bridge.xyz example. Mirodan TTS gold Chapter I. |
| `HANDOVER-2026-05-22-phase-2-complete.md` | 2026-05-22 PM | uncommitted (post-Phase-2) | "Phase 0, 0.5, 1, and 2 SHIPPED AND TESTED. 170 tests passing. Bridge card produces 6/6 dissolved-wall posts." Phase 3+ next. |

---

## 2. Timeline table

| Date | Handover claim | Actual commit | Verdict |
|---|---|---|---|
| 2026-05-12 | Initial scaffold | `3331b92` Initial commit | CONFIRMED |
| 2026-05-13 | Voice pipeline baseline + 4 voice specs + Remotion + receipts + eval | `f6a80e7…ab775cd` (12 commits) | CONFIRMED — all 13 May commits land in one ~30min burst |
| 2026-05-13→17 | `SESSION_HANDOVER` lists Codex-review fixes + render improvements | (no commits between 05-13 and 05-18) | NO-EVIDENCE — 5-day gap in git. Either work was uncommitted or done elsewhere. |
| 2026-05-18 AM | "Fact-grounder + Phase 1 work" (per 05-18 handover §0) | `d45b667` "Add Sonnet voice validator with hybrid composition path" + `0d7d8d0` "Add fact-grounder layer with intent-stripped rewrite loop" (single morning, +11.7k LOC) | CONFIRMED-IN-HISTORY but the file is `src/fact-grounder-llm.ts`, NOT `src/grounder.ts`. PLAN and 05-22 handover both refer to `src/grounder.ts` — that file does not exist. **DIVERGED (naming).** |
| 2026-05-18 PM | Laban audit, viz iterations, classifier v2, PRODUCT-MAP, drive-mapping rewrite | `61bda25` + `603bcc9` (drive column to HTML only) | DIVERGED — handover lists ~30 new scripts/research files; only the soft-vs-hardened HTML diff and SESSION_HANDOVER are committed. `scripts/classify-corpus.ts`, `scripts/render-laban-3shell.py`, all phantom/infinex corpora and classifications, `PRODUCT-MAP.md`, `drive-mapping.md` rewrite, viz files — **all untracked** as of HEAD. |
| 2026-05-19→20 | Harness Phase 1+2+3 complete, DB initialized, runnable at :3210, 17 Server Actions wired, design pass done | No commits between `603bcc9` (05-18) and `9c10cec` (05-22) | **NO-EVIDENCE for 4 DAYS.** The entire harness — described as "fully functional Next.js 15 app backed by SQLite" — is uncommitted on this date. |
| 2026-05-22 AM | Voice-pipeline + Mirodan TTS handover written; PLAN-holistic-generator.md authored | Uncommitted | NO-EVIDENCE (PLAN file is still untracked at HEAD) |
| 2026-05-22 11:40:11 | (implicit prerequisite of Phase 2) Reusable research tools | `9c10cec` "Extract reusable research tools" (+`src/research-tools.ts`, refactors fact-grounder-llm, adds `rendered-page.ts` source) | CONFIRMED but unannounced — handovers don't mention this extraction |
| 2026-05-22 11:40:23 | (not in any handover) "Add active validator and history guards" | `5cf1a92` (+`src/validator-active.ts` 326 LOC, +`src/history-guards.ts` 230 LOC, +156-LOC test file, +82-LOC test file, +60 LOC to orchestrator) | **DIVERGED — major undocumented work.** Neither the morning Mirodan-TTS handover, the PM phase-2-complete handover, nor PLAN-holistic-generator mention `validator-active` or `history-guards`. This is the agentic LLM auditor (research-tool-using) the PLAN flagged as future Phase 3 work — apparently landed under a different name. |
| 2026-05-22 11:40:52 | Harness Phase 1+2+3 already complete per 05-20 handover | `22367ae` "Wire active audit state into harness" — **FIRST commit adding `harness/` tree** (44 files, +7,362 LOC, including the HANDOFF-SPEC.md, schema, all 5 actions files, all 11 components, all 7 lib files) | **DIVERGED — major timing lie.** The 05-20 handover claimed harness was "fully functional" and "DB initialized." Git shows the harness was first committed 2 days LATER, on 05-22. Either it was uncommitted-but-working for those 2 days, or the 05-20 handover overstated. |
| 2026-05-22 12:28 | (none — handover written before this) | `bacb67d` "Strengthen grounder mechanics discovery" (+`src/fact-grounder/sources/public-page.ts` 194 LOC, +30 LOC tests, +35 LOC to fact-grounder-llm) | NO-EVIDENCE in handovers — postdates the phase-2-complete writeup |

---

## 3. Per-claim verdicts

### Claims from `HANDOVER-2026-05-22-phase-2-complete.md` (most recent)

| Claim | Verdict |
|---|---|
| "Phase 0, 0.5, 1, 2 shipped and tested" (super_objective, card inner-work fields, two-call generator, 170 tests passing) | **DIVERGED — uncommitted.** `git diff --stat HEAD` shows +874 LOC unstaged in `src/generator.ts`, +39 in `card.ts`, +37 in `voice/infinex.ts`, +46 in `voice/types.ts`, +115 in generator.test.ts. The work exists in the working tree, but the "shipped" framing is false against `main`. |
| "Bridge card produces 6/6 dissolved-wall posts" | NO-EVIDENCE-IN-HISTORY — `research/bridge-card-rerun-2026-05-22.md` exists as untracked file but no commit captures the test result. |
| "Phase 3 audit layer NOT done — pick 3a or 3b" | **DIVERGED — 3a-equivalent already shipped.** Commit `5cf1a92` adds `src/validator-active.ts` (326 LOC), `src/history-guards.ts`, full test coverage, orchestrator integration. This is structurally Phase 3a (LLM-judged active auditor wired into the pipeline) — landed 11 minutes before the harness commit on 05-22. The handover (written same evening) treats Phase 3 as still pending. |
| "Phase 4 — extend `src/grounder.ts`" | DIVERGED naming — file is `src/fact-grounder-llm.ts`. Commit `bacb67d` (12:28 same day) added `public-page.ts` source and "Strengthen grounder mechanics discovery" — already extending the grounder. |
| "Phase 5 harness UI surfaces full chain" | NO-EVIDENCE — harness only just landed at HEAD~3; no inner-work UI commits visible. |

### Claims from `HANDOVER-2026-05-20-session.md`

| Claim | Verdict |
|---|---|
| Harness Phase 1+2+3 complete, runnable | **DIVERGED.** First harness commit is `22367ae` on 2026-05-22, two days after this handover. Either the work sat uncommitted for 48h or the handover was aspirational. |
| 3-shell viz integrated at `research/laban-viz/` | DIVERGED — `research/laban-viz/` is untracked. |
| `src/voice/infinex.ts` character image locked to banker-trailblazer | Working-tree-only — `src/voice/infinex.ts` is modified but uncommitted. |
| `research/infinex-character-sheet.md`, `research/infinex-character-bundle.md` | DIVERGED — both untracked. |
| `cards/trezor-2026-05-19.json` test card | DIVERGED — `cards/` directory entirely untracked. |

### Claims from `HANDOVER-2026-05-18-laban-audit.md`

| Claim | Verdict |
|---|---|
| `scripts/classify-corpus.ts` v2 rewritten with full taxonomy | DIVERGED — `scripts/` directory entirely untracked at HEAD. |
| `skills/laban-voice-for-ai-agents/references/drive-mapping.md` rewritten with 24-cell table | Working-tree-only — file modified per `git status`, never committed. |
| `PRODUCT-MAP.md` at repo root | DIVERGED — untracked. |
| 9 surfaces classified (860 samples) | DIVERGED — all `research/{phantom,infinex}-classifications-*.json` untracked. |
| `~/Downloads/3shell-viz-bundle.zip` produced for designer | Out-of-tree — not auditable from git. |

### Claims from `harness/HANDOFF-SPEC.md` (Codex contract)

| Claim | Verdict |
|---|---|
| Schema at `harness/lib/schema.sql` with tables `cards, facts, fact_edits, release_cards, …, agreement_snapshots` | CONFIRMED — landed verbatim in `22367ae` (241 LOC). |
| 17 Server Actions across `app/actions/{research,card,generate,ship,agreement}.ts` | CONFIRMED — all 5 files present in `22367ae` totalling 1,142 LOC. |
| Mode A/B/C diff capture in `lib/diff.ts` | CONFIRMED — `lib/diff.ts` 184 LOC in same commit. |
| Mode C uses LLM v2 classifier | DIVERGED — `lib/classifier-wrapper.ts` is 35 LOC and per the 05-20 handover §M wraps the deterministic `auditBeats`, not the LLM v2. Spec deviation documented in `harness/SPEC-QUESTIONS.md`. |

---

## 4. Untracked / unstaged tree summary

`git status` shows **45 untracked items** and **7 modified files**. The untracked tree contains the entirety of:

- All session research artifacts from 05-18 (corpora, classifications, viz, character sheet, character bundle, dogfood files)
- All session research artifacts from 05-22 (bridge rerun, gripe-mapping, character bundle, Mirodan actor process, hyperliquid bug, nick-adream experiment)
- All Phase 2 scaffolding files (PLAN-holistic-generator.md, PRODUCT-MAP.md, PRODUCT-MAP-ADDENDUM.md)
- `cards/` directory (all release cards)
- `scripts/` directory (all build/classify/aggregate scripts)
- All four `HANDOVER-2026-05-*.md` files

The modified-but-uncommitted set includes the load-bearing Phase 2 code: `src/generator.ts` (+874 LOC), `src/card.ts` (+39), `src/voice/{infinex,types}.ts`, `src/__tests__/generator.test.ts` (+115), `CLAUDE.md`, `skills/laban-voice-for-ai-agents/references/drive-mapping.md`.

---

## 5. The 3 biggest divergences

### Divergence 1 — Phase 2 holistic generator is uncommitted, despite being declared "shipped and tested"

The 05-22-PM handover says Phase 0/0.5/1/2 are "**shipped and tested**" with 170 passing tests and a 6/6 Bridge-card rerun. Reality: `git status` shows `src/generator.ts` modified with +874 LOC unstaged, plus matching uncommitted changes in `card.ts`, `voice/infinex.ts`, `voice/types.ts`, and the generator test. The new `InnerWork` / `BeatPlan` types, `generateInnerWork()`, `draftFromInnerWork()`, the super_objective wiring — all present in the working tree, none committed to `main`. Last commit touching `src/generator.ts` was `0d7d8d0` (2026-05-18). **What "shipped" means in the handover is "exists in operator's working tree on this machine."**

### Divergence 2 — `src/validator-active.ts` and `src/history-guards.ts` are an undocumented Phase 3a landing

Commit `5cf1a92` (2026-05-22 11:40:23) added 794 LOC across `src/validator-active.ts` (326), `src/history-guards.ts` (230), and tests. This is structurally the agentic LLM auditor with research-tool calling — exactly what PLAN-holistic-generator §"Phase 3 — Audit layer" describes. Neither handover written that same day mentions it. The phase-2-complete handover (written the same evening) explicitly says "Phase 3 — Audit layer (RECOMMENDED NEXT)" as if it doesn't exist. The companion `HANDOVER-2026-05-22-active-validator-history.html` (226 LOC, also added in `22367ae`) appears to be the documentation for this work but is HTML, untracked-as-current-narrative, and not referenced by either Markdown handover.

### Divergence 3 — The harness has been "complete and runnable" in three different handovers, but only landed in git on 2026-05-22

- 2026-05-19 (per 05-20 handover): "Phase 1 + 2 + 3 complete… DB initialized… runs at `http://localhost:3210/`."
- 2026-05-22 AM (per voice-pipeline handover): harness/HANDOFF-SPEC referenced as if existing.
- 2026-05-22 PM (per phase-2-complete handover): "harness DB" referenced for Phase 3a destination.

First `harness/` commit is `22367ae` at 2026-05-22 11:40:52. All 44 files of the harness — including `HANDOFF-SPEC.md` (the Codex contract supposedly written days earlier), `pnpm-lock.yaml`, all 11 components, the schema, the actions — land as a single big-bang commit. The harness was either operating uncommitted for 3+ days, or it was reconstructed/refined locally and squashed in just before the active-validator work needed somewhere to write audit state.

---

## 6. Notable file-naming drift

The PLAN and Phase-2-complete handover both reference `src/grounder.ts` ("already exists; fact-grounds with platform-code / partner-registry / infinex-page / projectjin tools"). The actual file is `src/fact-grounder-llm.ts`. The fact-grounder also has companions the docs don't mention: `src/copy-rewrite-llm.ts` (757 LOC, added same day) and `src/fact-grounder/sources/public-page.ts` (194 LOC, added 05-22 PM). The docs underspecify what the grounder layer actually is.

---

## 7. Honest assessment

The handover docs are **forward-looking specifications dressed as status reports.** They describe the operator's state-of-mind at writing time (which includes uncommitted-but-working code as "shipped") rather than the state of `main`. The actual git arc since 05-18:

1. 05-18: fact-grounder + Sonnet voice validator land cleanly (`d45b667`, `0d7d8d0`).
2. 05-18→05-22: **a 4-day silent commit gap** during which the harness, all research artifacts, the Laban viz, the classifier v2, and the Phase 2 generator are written but never committed.
3. 05-22 morning: research tools extracted (`9c10cec`).
4. 05-22 11:40: active validator with research-tool-calling lands (`5cf1a92`) — this is functionally Phase 3a.
5. 05-22 11:40+30s: harness big-bang commit (`22367ae`) wires the audit state into the UI layer.
6. 05-22 12:28: grounder mechanics extended (`bacb67d`) — likely the start of Phase 4 work.

The Phase-2 generator work that the most recent handover declares "shipped" is **the most consequential undocumented divergence in the tree.** It is operator-local. A `git stash` away from being lost.
