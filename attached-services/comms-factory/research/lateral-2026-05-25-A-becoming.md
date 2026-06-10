# Lateral: what comms-factory is actually becoming

Date: 2026-05-25 · written from CODE + RESEARCH only (no CLAUDE.md, no HANDOVERs).

---

## 1. What is this, really?

Strip the "release-event → social-post pipeline" packaging away and the artifact underneath is a **mechanical theatre-of-character compiler for language models**. The Zod schema in `src/card.ts` requires `through_action`, `obstacle`, `lining`, `reader_prior`, `not_the_point` — those aren't comms fields, those are Stanislavski/Mirodan table-work fields. The generator is a two-stage actor: Stage A does table-work (commits a thesis, transitive verbs per beat, a hidden Lining), Stage B drafts only after the table-work is locked. The validator is Yat Malmgren's preparation hierarchy (`pressing → punching`, `wringing → slashing`) enforced as regex over paragraph order. Four voices (Infinex, Cream, ProjectJin, Nigel) share a `CharacterSpec` keyed off Inner Attitude × Stress × Aspect × Drive — 24 cells, 8 Working Actions, deterministically derived. This is a *character-as-runnable-spec* system that happens to render crypto launch posts as its first downstream surface.

## 2. What is it becoming?

The breadcrumbs do not point at a comms tool. They point at a **portable character-execution engine** with comms-factory as Application Surface #1.

- `src/voice/{infinex,cream,projectjin,nigel}.ts` — four voices coexist. Only Infinex is the supposed product. Nigel is a trading agent. ProjectJin is a separate brand. The pipeline is voice-agnostic first, comms-specific second. `cli.ts` takes `--voice=...` as a first-class arg.
- `skills/laban-voice-for-ai-agents/` is methodology *packaged for export* — a 500-line interview-to-spec workflow with a sample-generator script that runs against any brand, shipped as a zipped distributable. That's a product.
- `scripts/classify-corpus.ts` (v2) is the *inverse* — takes a stranger's corpus and outputs their placement. Run against Phantom (4 surfaces, 379 samples), ProjectJin, Nigel, Cream, and `@0xopaque` (the operator's own account). That's a benchmark instrument.
- `src/fact-grounder-llm.ts` is a Sonnet research agent with platform-code grep, partner-registry, page-fetch, and projectjin tool layers — its own product slice.
- `src/copy-rewrite-llm.ts` is a three-subagent loop (intent → blind-generate → blind-validate) that ingests shipped UI strings and proves the character spec is strong enough to *regenerate* them without seeing the originals. A self-audit harness for the spec.
- The harness (`harness/`) captures operator decisions, fact-edit diffs, and rolling-window `AgreementSnapshot`s — **RLHF-grade training-signal capture**, built to retire itself once each stage hits ≥80% operator agreement.

Trajectory: converging on a **brand-as-deployable-character SDK + training-signal flywheel**. Comms-factory is the visible execution surface; the deeper move is "give us a brand, get back a runnable CharacterSpec + a validator + a corpus classifier that grades any future copy against locked placement, plus a captured-disagreement dataset for fine-tuning." The MCP server and Slack bot mentioned in tests are the actual product packaging.

## 3. What surprised me

- **Mirodan literalism.** `research/mirodan-actor-process.md` cites Vol 2 pages 263-575 with line-numbered references. The `lining` field on every Tempo is documented to Mirodan §7.1, pp. 554-555. The system isn't *inspired by* dramaturgy — it's a *port* of dramaturgy with passage citations as inline comments.
- **The classifier runs against the operator's own X account.** `research/0xopaque-*` — they scraped their own 100 posts and ran them through the same instrument they ran against Phantom. The framework is being used as a mirror, not a marketing tool.
- **Test names betray paranoia about LLM rationalization.** "short-circuits deterministic failures before spending on active validation" · "generator system prompt does NOT contain the words 'current_text'" · "short-circuits on regex failure WITHOUT making an LLM call". The architecture is *defensive* against the LLM judging its own output, and the tests explicitly enforce that the generator can't see the originals it's supposed to regenerate from intent. Way more rigor than "ship a tweet" requires.
- **The wave-1 / wave-1.5 visual recon.** `research/wave-1/` has 6 brand teardowns. `research/wave-1.5-tweets/` has 5 accounts scraped via X API with `.SUSPECT` files flagging Grok hallucinations. `research/visual-vocabulary.md` derives "data-hero × two-register" as Infinex's empty competitive quadrant from this corpus. GTM-level competitive cartography sitting in a comms repo.
- **The harness is built to die.** `AgreementSnapshot` with rolling windows, FactEdits with before/after field diffs. Memory note: "production surfaces are the Slack bot + MCP server; harness is audit fallback only."
- **`history-guards.ts` exists.** Checks the last 12 X posts for repeated openers, phrase budgets, three-identical-tempi-in-a-row. The validator is extending into *temporal* drift — modeling "the brand over time," not just "the post in isolation."
- **The 4-voice set includes a trading agent.** Nigel is a Polymarket bot, not a comms surface, and its voice-spec lives in `src/voice/` next to Infinex. The pipeline doesn't distinguish "brand voices" from "agent voices" — same `CharacterSpec`, same validator.

## 4. The forward-looking move I would build next

**A `voice-from-corpus` one-shot operator.** Given a public X handle (or a directory of markdown samples), the system should:

1. Scrape / load the corpus (`research/X_API_RECIPE.md` has the recipe).
2. Classify it with the v2 corpus classifier.
3. Backward-derive the `CharacterSpec` (Inner + Stress + Aspect + Drive + cadence over main tempi) — the math is already in `SKILL.md` §"Backward derivation."
4. Emit a populated `src/voice/<slug>.ts` with main_tempi, cadence, off-spec regexes, structural_traits — derived, not interview-elicited.
5. Run the `copy-rewrite-llm.ts` self-audit to score whether the derived spec can re-derive the corpus from intent. Existing self-audit becomes the *acceptance test* for the auto-derived placement.

That single command turns SKILL.md's 90-minute interview into a 5-minute corpus ingestion. The interview becomes the *escape hatch* for when no corpus exists. The phantom-vs-infinex-gap analysis becomes a product feature ("here's how your voice maps next to your three nearest competitors"). All the parts already exist as scripts — `classify-corpus.ts`, `analyze-laban-coherence.py`, the X scraper, the derivation logic — they just don't compose end-to-end yet. The operator is one wrapper-script away from a "drop in a Twitter handle, get a runnable voice in 5 minutes" demo. That demo is the SDK pitch.

## 5. What they're sitting on that's bigger than the framing

**The Mirodan instrumentation.** `scripts/classify-corpus.ts` v2 with the canonical 24-cell drive-mapping table is the most valuable artifact here, currently labeled as internal infrastructure. What it actually is: **a deterministic, reproducible, cross-brand-comparable measurement system for prose voice**. Every other "voice grading" tool in the LLM ecosystem is vibes-grading by a fresh subagent prompt. This isn't. It encodes a 1997 PhD's character taxonomy as machine-readable enums, runs Sonnet against prose to *read* observed tempi, then mechanically derives placement via a fixed table — same instrument, same numbers, every time. That's *radiocarbon dating for brand voice*.

The phantom-vs-infinex-gap analysis is the proof: Phantom app reads 26% Doing, Phantom tweets read 49% Passion/Time, Phantom marketing reads 47% Penetrating. Numbers attached to prose, comparable across brands and over time. *That* is the underlying product; the Slack-bot-for-shipping-tweets is one downstream consumer.

Adjacent uses, no new code required:

- **Drift detection.** Re-classify a brand's corpus monthly; flag axis-drift > N%. Pitch: "we tell you when your tweets start sounding like a different person."
- **Founder-bleed audit.** Classify the founder's personal account, classify the brand account, surface overlap. The Phantom-vs-Infinex doc already does this.
- **Voice diligence for funds.** Auto-classify a founder's X and the startup's pitch; flag mismatches before money moves.
- **AI-slop forensics.** Run LLM-generated copy through the classifier. Low confidence + flat axis distribution is the slop signature.
- **Cross-model longitudinal.** Same instrument across GPT-3 / Claude-3 / Claude-4 outputs — a record of *which models produce which voice signatures*.

The operator's framing — "comms-factory is the execution surface for Infinex" — under-prices the instrument. The execution surface is the demo. The instrument is the company.
