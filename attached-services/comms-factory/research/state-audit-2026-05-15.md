# State audit — comms-factory voice pipeline

**Date:** 2026-05-15
**Author:** Claude (this session)
**Purpose:** Hand-over-ready audit of the voice validator + intent-strip rewrite loop, ready for Codex review.

## TL;DR

Two-LLM Nigel-shaped pipeline is wired, decontaminated, and hardened to the 5 main locked tempi. 106/106 tests pass, typecheck clean. Three artifacts produced today (soft homepage + existing-copy audits, hardened versions, intent-strip rewrite loop, HTML diff) demonstrate that the character spec is doing real work — not just keyword matching. Roughly production-ready for **website/marketing copy audit + rewrite**. NOT production-ready for **product UI gating** (surface-policy layer missing) or **release-card render** (brand-factory dependency unmet, 3 of 4 Remotion compositions not built).

## What changed in this session

### Code
- `src/validator-llm.ts`:
  - **Decontaminated** the system prompt — removed the hardcoded "Known Infinex allergens" list (`superpowers`, `seamless`, `change the way you crypto`, etc.), removed `Preferred product UI posture` prescriptions, removed the taste-coded `Infinex product-copy frame`. Validator now reasons purely from character placement + tempo motor vocabulary + off-spec drive activation.
  - **Hardened** the classification schema enum: `availableTempoNames()` now returns `voice.main_tempi` only. Reserve / beat-only tempi (Self-contained, Receptive, Overpowering, Diffused, Egocentric, Altruistic, Unsociable) are no longer valid as primary classifications. Prompt teaches Sonnet to name reserve tempo in rationale and classify as `unknown`.
- `src/validator.ts`:
  - `classifyTempoBlind()` deterministic scorer also restricted to `main_tempi` for parity.
- `src/generator.ts`:
  - Release-card generator's system prompt cleaned of the same `No clichés` / `No AI-slop nouns` / `No em-dash spam` hardcoded list. Kept the structural rules (no listicle openers, no competitor antagonism) as character-derived. Added explicit "Reason from the character, not a ban list" instruction.
- `src/copy-rewrite-llm.ts` (NEW, 648 lines, built by sub-agent):
  - Three-LLM intent-strip rewrite loop. `extractIntent()` (Sonnet) → `generateInCharacter()` (Opus, blind to `current_text`) → `auditTextLLM()` (Sonnet, blind to declared tempo). Orchestrator threads validator feedback into the generator on retry up to 3 attempts. Generator's `selected_tempo` schema enum is `main_tempi` only.
- `src/__tests__/copy-rewrite-llm.test.ts` (NEW, 505 lines): 20 vitest cases covering tool schemas, parsers, orchestrator with mocked clients, retry-on-mismatch, three-attempt exhaustion, `current_text`-blindness assertions, similarity computation.
- `scripts/rewrite-homepage-copy.ts` (NEW): H01–H20 runner with `--ids=` filter and stderr progress prints.
- `scripts/build-soft-vs-hardened-html.ts` (NEW): Markdown → HTML diff visualizer.

### Research artifacts
- `research/infinex-homepage-tempo-fit.llm.cleaned.md` — soft validator on 20 homepage strings (contamination removed, full 12-tempo enum).
- `research/infinex-homepage-tempo-fit.llm.hardened.md` — same, but 5-tempo enum.
- `research/infinex-dogfood-pipeline.llm.cleaned.md` — soft validator on 18 platform/transcript strings (S01–S18).
- `research/infinex-dogfood-pipeline.llm.hardened.md` — hardened version.
- `research/infinex-homepage-rewrite.md` — intent-strip rewrite loop, soft validator.
- `research/infinex-homepage-rewrite.hardened.md` — hardened version.
- `research/soft-vs-hardened.html` — side-by-side diff (rebuild via `pnpm tsx scripts/build-soft-vs-hardened-html.ts > research/soft-vs-hardened.html`).
- `research/infinex-dogfood-audit.md` — Gemini-pass transcript audit (predates today, lightly edited).

## ✅ Solid

| Item | Notes |
|---|---|
| Two-LLM double-blind architecture | Mirrors Nigel: Opus generator + Sonnet validator, distinct prompts, distinct contexts, validator instructed to ignore `declared_tempo` for independent classification. |
| Decontaminated prompts | Validator + release-card generator both reason from character spec, not from operator taste. H14 "One super app" flipped from "explicitly prohibited" → Commanding pass on character grounds. |
| 5-tempo restriction | Cleanly enforced at the schema enum AND the prompt level. Soft → hardened diff in the homepage audit shows the user's intuition validated (10 surfaces flipped from pass → off-rotation Self-contained fail). |
| Test coverage | 106/106 pass. New copy-rewrite-llm tests assert `current_text`-blindness on the generator messages payload, both happy path and retry. |
| Rewrite loop convergence | 18/20 PASS on hardened. Generator independently re-derived character-coherent copy for 18 surfaces without seeing the shipped text. Soft vs hardened produced *different* in-character rewrites for ~12/20 surfaces — character spec is doing real work, not faking by memorization. |
| Reproducibility | All artifacts are produced by checked-in scripts. Re-run command list at the bottom of this doc. |

## ⚠️ Known gaps & risks

| # | Item | Severity | Notes |
|---|---|---|---|
| 1 | **Fact-grounding bug in intent extractor** | HIGH | H17 (`Powered by Polymarket` → regenerated `Powered by Hyperliquid`) and H15 (`40x` → `50x`). The Sonnet extractor strips named entities and numbers it should preserve as hard constraints. Real risk of factual hallucinations in shipped copy. Fix: extractor must emit `preserved_entities: string[]` and the generator must include them as immutable constraints in its system prompt. |
| 2 | **No surface-tempo policy layer** | MEDIUM | Validator judges character coherence; it does not gate marketing-shape copy from product UI surfaces. Today's tests didn't surface this because the homepage IS marketing. For platform UI we'd need either a separate `surface-policy.ts` module mapping surface kinds → allowed tempi, or prescriptive prompt rules (which risk re-introducing taste contamination). |
| 3 | **Validator hardening tuned today, not battle-tested** | MEDIUM | The "off-rotation reserve" classification is correct for the 4 surfaces I checked (H06, H07, H08, H10/11, H15, H16, H17, H18) but could be over-aggressive on legitimate Self-contained-as-beat moments inside multi-beat posts. Beat-audit context (`auditBeatsLLM`) inherits the same restriction. May need a `classification_scope: "primary" | "beat"` parameter so beat-audits can validly classify a beat as Self-contained when the post explicitly declares it. |
| 4 | **Poisoning metric is naive** | LOW | Token Jaccard ≥ 0.6 flagged H05 and H16 as candidates, but both are surface-forced convergence (CTA action verb, partner credit badge), not actual context contamination. Real poisoning would show up as a generator output that reuses *distinctive* shipped wording. Could refine: down-weight named entities + common imperatives. |
| 5 | **Release-card pipeline blocked on brand-factory** | KNOWN | Per `CLAUDE.md`, no real renders until brand-factory ships Infinex at `voiced` status. Today's work is upstream of that gate — it's about voice validation, not rendering. |
| 6 | **3 of 4 Remotion compositions unbuilt** | KNOWN | Only `data-card-official` exists. `data-card-wry`, `launch-tier`, `split` are scaffolded but not implemented. Blocks production release-event-to-mp4. |
| 7 | **CLI's `validate` defaults to deterministic Layer 2** | LOW | `pnpm tsx src/cli.ts validate "..."` runs only regex + deterministic anchor classifier unless `--llm` is passed. Most users will skip the flag. Default should probably be LLM once cost is acceptable. |
| 8 | **No structured `detected_drive` field on verdicts** | LOW | Drive reasoning (Passion vs Spell vs Vision) is in the rationale paragraph, not a structured tool-output field. Visible in HTML but not queryable. Cheap to add: extend the tool schema with `independent_classification.detected_drive`. |
| 9 | **Audit-script-declared tempi were Claude's, not user's** | LOW (process) | `scripts/dogfood-homepage-tempo-fit.ts` has a `declared: { tempo, reasoning }` per surface that I authored. User did NOT sentence-by-sentence declare those. Match/mismatch verdicts are against my judgment, not theirs. Fine for diagnostic, but call out in any review. |

## 📋 Recommended next actions

Ordered by leverage:

1. **Fix the fact-grounding bug** (1–2 hours). Highest production risk. Add `preserved_entities` field to intent extractor output + generator constraint.
2. **Wire the LLM validator into the orchestrator's default path** for non-test runs. Right now the rewrite loop uses it, the dogfood scripts use it, but the orchestrator's `validate()` call in the main release-card pipeline still uses the deterministic layer. ~30 min.
3. **Add a structured `detected_drive` field** to `LLMIndependentClassification`. Re-run the HTML diff with drive as a column. ~45 min.
4. **Hand to Codex** for review of the prompt content + the rewrite-loop architecture. See Codex checklist below.
5. **Surface-tempo policy module** when product UI work resumes — separate concern from character validation, configurable per surface. ~2 hours.
6. **Apply 5–10 of the rewrite-loop's outputs to the actual homepage** as a PR. Take the wins where the regen is clearly sharper (e.g. H01, H02, H04, H19).
7. **Brand-factory hand-off** — when brand-factory ships Infinex at `voiced`, swap `src/brand-stub.ts` for a loader.

## 🔍 Codex review checklist

Specific things for Codex to look at:

1. `src/validator-llm.ts:277-358` — system prompt content. Is the "Off-rotation reserve tempo" instruction strong enough? Does the prompt's "Do NOT apply a hardcoded ban list" line tip Sonnet too far the other way (might it now miss legit allergens)?
2. `src/validator-llm.ts:618-624` — schema enum restriction. Is `voice.main_tempi` correctly threaded through both `buildLLMAuditTools` and `buildLLMCopySetAuditTools`?
3. `src/validator.ts:454-499` — deterministic `classifyTempoBlind()`. Same restriction applied. Tests still pass; was any existing test asserting on beat-only classifications? (Spot check: `src/__tests__/validator.test.ts` line ~XXX for any tempo-name assertions.)
4. `src/copy-rewrite-llm.ts:186-192` — `CopyGenerationInput` type. Confirm no `current_text` field. Trace through to the generator's `messages.create()` payload at line ~348 and confirm no shipped text leaks via the system prompt or user message either.
5. `src/copy-rewrite-llm.ts:167` — `extractIntent()`. **This is the source of the H17 fact bug.** Review the prompt content. Does it instruct Sonnet to preserve named entities (chains, partners, products, numeric capabilities) as constraints? If not, that's the fix surface.
6. `src/generator.ts:165-176` — the cleaned "Hard rules" section. Should `No listicle openers` and `No antagonism toward named competitors` move to `voice/infinex.ts` as character traits, instead of living in the generator prompt?
7. `scripts/dogfood-homepage-tempo-fit.ts` — the `declared` field per surface is *my* judgment, not the user's. If Codex is reviewing diagnostic correctness, the match/mismatch verdicts are against my baseline, not the user's. Note: the `unknown` and `off-spec` verdicts ARE independent of my declared field.
8. `research/soft-vs-hardened.html` + `scripts/build-soft-vs-hardened-html.ts` — rendering quality. The diff is the load-bearing artifact for verifying the hardening did the right thing.

## Test status

```
pnpm typecheck   # clean
pnpm test        # 106 / 106 pass across 7 files
```

Files touched today (excluding research/ artifacts):
- `src/validator-llm.ts` (decontamination + hardening)
- `src/validator.ts` (hardening parity)
- `src/generator.ts` (decontamination)
- `src/copy-rewrite-llm.ts` (NEW)
- `src/__tests__/copy-rewrite-llm.test.ts` (NEW)
- `scripts/rewrite-homepage-copy.ts` (NEW)
- `scripts/build-soft-vs-hardened-html.ts` (NEW)

## Reproduce the artifacts

```bash
export ANTHROPIC_API_KEY=$(grep '^ANTHROPIC_API_KEY=' ~/Sites/infinex-xyz/agents/nigel/.env | cut -d= -f2)

# audits (hardened validator)
pnpm tsx scripts/dogfood-homepage-tempo-fit.ts --llm > research/infinex-homepage-tempo-fit.llm.hardened.md
pnpm tsx scripts/dogfood-existing-copy.ts --llm > research/infinex-dogfood-pipeline.llm.hardened.md

# rewrite loop
pnpm tsx scripts/rewrite-homepage-copy.ts > research/infinex-homepage-rewrite.hardened.md

# soft vs hardened HTML diff
pnpm tsx scripts/build-soft-vs-hardened-html.ts > research/soft-vs-hardened.html
open research/soft-vs-hardened.html
```

## Honest production-readiness rating

| Capability | Readiness | Reason |
|---|---|---|
| Voice audit on website / marketing copy | 8/10 | Working, hardened, character-derived. Drive reasoning solid. Drive isn't a structured field yet. |
| Voice audit on product UI / utility flows | 5/10 | Catches Passion-driven hype well; misses surface-tempo mismatches (Irradiant in a deposit modal would pass). Needs surface-policy layer. |
| Intent-strip rewrite for marketing copy | 7/10 | 18/20 pass rate, character-coherent output. Blocking fact-grounding bug (entities + numbers). |
| Release-card → caption → mp4 pipeline | 3/10 | Blocked on brand-factory `voiced` gate + 3 of 4 Remotion compositions. Not regressed today; just unmoved. |
| Reproducibility / handover | 9/10 | Scripts are checked in, tests pass, HTML diff is regenerable. This audit doc covers state. |
