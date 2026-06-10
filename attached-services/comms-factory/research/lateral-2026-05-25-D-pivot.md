# Lateral pivot — comms-factory, 2026-05-25 (Audit D)

## 1. Surface read

A typed comms pipeline that turns release events into on-character captions and rendered cards for Infinex.

## 2. What it is secretly capable of

Reading only the code, this is not a comms pipeline with theory bolted on — it is a theatre-of-character compiler with a comms artifact attached as the demo. Capabilities the surface framing doesn't name:

- **A canonical 24-cell taxonomy compiler** (`scripts/classify-corpus.ts` v2). Reads arbitrary prose, emits Inner Attitude + Aspect + Stress + Pole + four Drives + Drive Axis + Motor Pair + secondary Outer-Action tempi. Already run against Infinex, Phantom, Cream, ProjectJin, Nigel, *and an actor's portfolio site* (`research/nick-adream-experiment.md`) with no crypto involved. The taxonomy survives the domain shift.
- **A diagonal regeneration loop** (`src/copy-rewrite-llm.ts`): strip arbitrary copy to intent + constraints, regenerate in any declared character placement, blind-classify the regeneration. Used to A/B Diagram B vs Diagram D for the actor's portfolio. The Infinex-ness is incidental.
- **A six-layer diagnostic instrument** named in `research/gripe-to-framework-mapping-2026-05-22.md`: Super-Objective, historical_lore, validation_criterion, structural_traits, per-tempo Lining, off_spec_drives. The operator already proved it catches 20/24 (83%) of dogfood-triage gripes against Infinex HTML / security strings / founder tweets — with the comms pipeline never invoked.
- **A portable-bundle emitter** (`research/infinex-character-bundle.md`): a locked voice character serialised as a single pasteable system prompt. The apparatus emits portable instances of itself.
- **A grounder agent loop** generalised from Nigel — research subagent that consults platform code, partner registries, infinex.xyz, web search, X. A fact-verification micro-product wearing comms drag.
- **A review harness** (`harness/`) with structured diff capture across all four stages, append-only ledger, per-stage operator-agreement metrics. The voice enum is the only thing comms-specific — the schema is a generic agent-soft-judgement training database.
- **Cross-character parity**: five locked voices (Stable, Near, Adream baselines) swap cleanly via `--voice=` on the CLI. The pipeline is voice-agnostic; Infinex is one entry in a registry.

The shape that emerges: a **character-coherence engine**. In: any artifact. Out: structured Mirodan placement + ranked failure modes against a declared character + optional regeneration. Comms-factory is one consumer. The engine is the asset.

## 3. The pivot hiding in plain sight

**Ship the character-coherence engine as the product. Comms-factory is the reference implementation.**

What changes: the protagonist flips from *generated Infinex captions* to *the instrument that scored them*. The unit of value is a verdict on any artifact — caption, landing page, doc, security modal, internal Slack post, founder tweet — expressed in a vocabulary that already survives domain transfer.

What stays: the Zod card schema, validator regex layers, v2 classifier, 24-cell taxonomy, harness's diff-capture, grounder loop, CharacterSpec format. None of it is comms-specific today.

What becomes the protagonist: the **audit CLI / MCP tool** the operator already drafted in the gripe-mapping doc — *"`pnpm tsx src/cli.ts audit <path-to-html>` triages any artifact in 30 seconds."* He named it; he hasn't committed to it as the product.

## 4. If the methodology was the product

Mirodan / Laban / actor-table-work is currently *consumed* by comms-factory. If methodology-as-product were taken seriously:

- Deliverable becomes **voice-as-a-service for any brand or agent**. The laban SKILL.md + inside-out interview + out-of-placement diagnostic + cadence-by-observation + cold-test methodology = a complete operator-facing workflow that produces a locked CharacterSpec in one warm session.
- Infinex's voice file becomes one worked example beside Phantom, Trezor, Berachain, Nick. The character-bundle pattern becomes the export format.
- The 24-cell drive table at `skills/laban-voice-for-ai-agents/references/drive-mapping.md` becomes the public surface, each cell shipped with literary anchors and example characters.
- The methodology compounds across customers — brand teams, AI agent designers, content systems — not across Infinex releases.
- Comms-factory degrades to a demo site proving the placement pipeline ships working captions.

This is the closest thing in the repo to a defensible IP moat: the 24-cell table is novel, the mechanical preparation-hierarchy enforcement is novel, the methodology has documented anti-patterns. But it's a teaching product. Audiences are small, sales cycles long.

## 5. If the audit/diagnostic instrument was the product

This is, on the evidence, where the leverage is highest.

The case is already in `research/gripe-to-framework-mapping-2026-05-22.md` and the diagnostic-instrument memory:
- One instrument, six layers, audits any text or HTML.
- 83% catch rate on operator-flagged dogfood findings — measured, not hypothesised.
- 4 strict misses are pure structural-design gaps (typography, motion vocabulary, illustration system, security template) — the instrument *surfaces* the gap. The miss is the signal.
- The same instrument grades an actor's portfolio site with no Infinex baggage.

If the audit is the product:
- Ship `audit <artifact>` as CLI + MCP. Inputs: HTML URL, markdown, raw text, Notion page, screenshot of UI strings, Slack log. Output: ranked layer-attributed gripes with citations + suggested rewrite via the regeneration loop.
- Customer: any team with a locked brand or character spec who wants continuous brand-coherence. Crypto brands, fintech, AI agent operators, design-system teams, internal-comms at companies with strong CEO voices.
- Defensibility: the taxonomy + captured operator-judgement training data + 24-cell coverage no competitor has.
- Comms-factory becomes the *forward-direction* showcase: "we caught it pre-ship, then re-generated it." Audit + fix is the wedge.

Almost every file in `src/` and `research/` is already shaped like this product; only the framing is comms-oriented.

## 6. If the harness was the product

The schema is already a generic agent-soft-judgement training database. Twelve append-only field-level diff-captured tables; voice enum is the only comms-specific thing.

If harness-as-product: **"train agents to do soft-judgement work via human review; surface when each agent has earned autonomy per-task-class."** Comms is one vertical. The same shape applies to code review approve/edit/reject, customer support drafts, legal redlines, trading-signal vetoes (Nigel), compliance triage, content moderation, translation editing, medical dictation correction — any task where the agent's draft is almost right and the human's intervention is the training signal.

The locked invariants — diff capture, per-stage agreement metrics, threshold-gated autonomy, append-only history — are the generic shape of *graduated agent autonomy*. The instrumentation is more reusable than the voice work.

Against: the harness is currently the *least built* of the three. Phase 1 done, Phase 2 in flight, Phase 3 (persistence + diff + metrics, the actual meat) is Codex's pending lift. The training-harness-not-product memory tells the operator to retire it once thresholds cross. Promoting it requires un-retiring it and committing engineering to multi-vertical generalisation — two builds away minimum.

## 7. The bet

**Pivot 5 — the diagnostic instrument is the product.**

Three reasons, in declining order of confidence:

**(a) The instrument is already shipped, demonstrated, and measured.** 83% catch rate against real operator findings. Cross-domain transfer to a non-crypto artist site, proven. The 24-cell taxonomy has no obvious competitor — there is no public LLM-targeted Mirodan compiler. Pivot 4 (methodology) is a thinner version of the same bet; the instrument is the engine that *runs* the methodology.

**(b) The pivot's cost is near zero.** The audit CLI is one file. The MCP wrapper is a thin shell. Comms-factory doesn't go away — it becomes the showcase proving the instrument's output is operational. The operator already wrote the marketing pitch (the diagnostic-instrument memory) and the validation data (gripe-to-framework-mapping). The lift is sequencing, not invention.

**(c) The harness pivot is right in shape but premature in time.** Generic agent-soft-judgement training is a real product, but it needs Phase 3 to land plus a second non-comms vertical to prove transfer. The instrument is one build away — wire the audit CLI to arbitrary HTML and run it on three external sites this week. If that triple-validates, the instrument is the product and the harness is the second business stacked on top. Betting on the harness first means choosing bigger TAM at the cost of skipping the cheaper proof point that is already 85% built.

The instrument pivot is the rare case where the operator independently derived the full thesis in a research file and has not yet named it as the bet. The data points here; only the framing lags.
