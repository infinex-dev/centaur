# Audit — `src/` ground truth (2026-05-25)

**Method:** read every file in `src/` and `src/__tests__/`; ran `pnpm test` and `pnpm tsc --noEmit`. No reliance on `CLAUDE.md`, `HANDOVER-*.md`, or `PLAN-*.md`.

**Headline numbers:**
- `src/` modules: 16 top-level `.ts` files + 7 voice files + 6 fact-grounder source files + 3 remotion files = **32 source files**
- `src/__tests__/`: 10 test files, **170 tests, all passing** (605ms total).
- `pnpm tsc --noEmit`: **exit 0** (clean).
- **BUILT:** 14 modules. **PARTIAL:** 4. **STUB:** 2 (`cli ship`, ranking model in orchestrator). **MISSING:** 3 of 4 Remotion compositions; `--full-page` artefact at repo root (not source).

---

## Status table

| Path | Status | Notes |
|---|---|---|
| `src/card.ts` | **BUILT** | Zod discriminated union over 4 `kind`s; inner-work fields (through_action / obstacle / lining / reader_prior / not_the_point) all present and optional |
| `src/generator.ts` | **BUILT** | Two-call (Stage A InnerWork → Stage B drafting) is default; legacy single-call path retained |
| `src/validator.ts` | **BUILT** | 8 regex rules + claim contract + unsupported-claim audit + blind-tempo classifier + prep-hierarchy + hybrid composition with LLM judge |
| `src/validator-llm.ts` | **BUILT** | Sonnet judge w/ `audit_pass` / `audit_fail` tool-use, independent_classification, beat-level audit |
| `src/validator-active.ts` | **BUILT** | Nigel-style multi-turn active validator with research tools (this is the "active audit" surface) |
| `src/orchestrator.ts` | **BUILT** | Three orchestrate flavours (deterministic / hybrid / active) + retry wrappers; one TODO line (ranking-model — first-passes-wins for now) |
| `src/history-guards.ts` | **BUILT** | Repeated-opener / phrase-budget / tempo-cadence / rare-tempo / announcement-frame / protagonist guards |
| `src/fact-grounder-llm.ts` | **BUILT** | Sonnet grounder loop w/ 9 tools (grep_platform, read_platform_file, lookup_partner, fetch_infinex_page, fetch_public_page, fetch_rendered_page, fetch_json_api, infinex_web_search, infinex_search_recent_posts) + `record_fact` / `mark_unverifiable` / `done_grounding` terminators |
| `src/research-tools.ts` | **BUILT** | Tools extracted into reusable module; shared by grounder + active validator |
| `src/fact-grounder/sources/platform-code.ts` | **BUILT** | grep via `/usr/bin/grep` against `PLATFORM_ROOT`; defaults `~/Sites/infinex-xyz/platform` |
| `src/fact-grounder/sources/partner-registry.ts` | **BUILT** | Reads `config/partner-registry.json` (exists on disk) |
| `src/fact-grounder/sources/infinex-pages.ts` | **BUILT** | HTML fetch of infinex.xyz pages |
| `src/fact-grounder/sources/public-page.ts` | **BUILT** | Generic public-URL fetch w/ allowlist (apidocs.bridge.xyz, docs.stripe.com) |
| `src/fact-grounder/sources/rendered-page.ts` | **BUILT** | Agent-browser headless render (clickAfterLoad, waitForText) |
| `src/fact-grounder/sources/projectjin-research.ts` | **BUILT** | Spawns `projectjin` CLI; throws `ProjectjinUnavailableError` when bin absent — graceful skip |
| `src/copy-rewrite-llm.ts` | **BUILT** | 3-subagent loop (intent → in-character regen → blind audit) for spec-strength testing |
| `src/eval.ts` | **BUILT** | `runVoiceEvalCase` driver for retry orchestrator + receipt writing |
| `src/receipts.ts` | **BUILT** | `VoiceValidationReceipt` schema v1 + writer |
| `src/cli.ts` | **PARTIAL** | `validate`, `generate`, `generate --retry`, `tempi`, `demo`, `render` all wired end-to-end; **`ship` is the only stub** (`cmdShip` exits 64 with "TODO — pipeline not yet wired"). No `audit` subcommand. |
| `src/brand-stub.ts` | **PARTIAL** (deliberate stub) | Brand tokens for infinex/cream/projectjin/nigel hard-coded; the docstring explicitly names this as the bridge until brand-factory ships |
| `src/voice/infinex.ts` | **BUILT** | All locked fields: 5 main tempi (commanding, practical, sombre, irradiant, sociable), Drive Spell+Vision, Stable+Flow-bound+Penetrating, super_objective ("to take responsibility for the tech, so the user only has to want"), 3 super_objective_examples, historical_lore (Craterun/Yaprun/terrorists scar), validation_criterion, banker-trailblazer image in structural_traits |
| `src/voice/types.ts` | **BUILT** | Full Laban-Mirodan type system: 8 working actions, 24 tempi by inner attitude, CharacterSpec with optional super_objective + historical_lore + validation_criterion |
| `src/voice/laban.ts` | **BUILT** | Framework constants: AVAILABLE_STRESSES, OUTER_PROJECTIONS, prep-hierarchy checker |
| `src/voice/cream.ts` | **BUILT** | Second voice — used in generator portability tests |
| `src/voice/projectjin.ts` | **BUILT** | Third voice |
| `src/voice/nigel.ts` | **BUILT** | Fourth voice |
| `src/voice/nick-b.ts`, `src/voice/nick-d.ts` | **BUILT** | Two additional voices (recent — file timestamps 2026-05-22) |
| `src/remotion/render.ts` | **PARTIAL** | Programmatic Remotion renderer wired; `data-card-official` composition only; throws on `data-card-wry` / `launch-tier` / `split` |
| `src/remotion/Root.tsx` | **PARTIAL** | Registers only `data-card-official` composition |
| `src/remotion/data-card-official/Composition.tsx` | **BUILT** | Exists |
| `src/remotion/data-card-wry/` | **MISSING** | Not on disk |
| `src/remotion/launch-tier/` | **MISSING** | Not on disk |
| `src/remotion/split/` | **MISSING** | Not on disk |

---

## Per-file specifics

### `src/card.ts` (135 lines)

Zod discriminated union over `kind`: **`data-card-official`** (metric + value + unit? + delta?), **`data-card-wry`** (metric + value + joke_angle), **`launch-tier`** (headline + subhead? + tier_reason), **`split`** (from + to + split_semantics).

Base schema carries `deployed_facts: string[].min(1)` plus **all 5 inner-work fields optional**: `through_action`, `obstacle`, `lining`, `reader_prior`, `not_the_point`. These exist on the schema — they are not just prompt strings. (Surprise #1: the inner-work fields are first-class schema fields, not just operator convention.)

### `src/generator.ts` (1083 lines)

**Two-call pattern is default and shipped.** `generate(card, opts)` routes through `generateInnerWork()` (Stage A, line 634) then `draftFromInnerWork()` (Stage B, line 680). Legacy single-call path retained behind `opts.legacySingleCall` or `opts.beats` (forcing a beat plan routes through legacy for fixture compatibility).

- `generateInnerWork()` line 634 — Stage A. System prompt = `buildSystemPrompt(voice)`; user prompt = `buildInnerWorkUserPrompt()` line 716. Calls Anthropic in live mode, returns `stubInnerWork()` line 909 otherwise.
- `draftFromInnerWork()` line 680 — Stage B. Same system prompt; user prompt = `buildDraftFromInnerWorkUserPrompt()` line 953. Hard rules: respect `not_the_point` as refusal not preference; leak lining never name it; channel-max enforced pre-validation.
- `BeatPlan` interface line 79 — beats carry `tempo`, `verb` (transitive: "to reveal" / "to land"), `micro_objective`, `obstacle_local`, optional `shadow_move` (Lining-leak).
- Live mode: `claude-opus-4-7` default model, real `Anthropic.messages.create` calls. Stub mode: deterministic from voice `example_lines` + `vocab_anchor`, includes one intentional slop fixture (`stub-slop`) when n>1 to exercise the validator path.
- `generateForChannels()` line 202 — computes shared `InnerWork` ONCE per card, fans Stage B across channels.

### `src/validator.ts` (757 lines)

Layered: regex rules → claim contract → blind-tempo classifier → prep-hierarchy → hybrid LLM composition.

| Rule (export name) | Test coverage (positive + negative) |
|---|---|
| `rejectCliches` | 9 tests (line 32–60) — game-changer, unlock, seamless, paradigm, leverage-as-verb; `leverage ratio` + `leveraged long` allowed |
| `rejectListicleVoice` | 7 tests — "N reasons", "why X matters", "the only X you'll ever need", "top N", "N things"; passes `three improvements`, `JUST IN:`, `$11.9T` |
| `rejectAntagonism` | 6 tests — coinbase/binance/kraken/bybit/okx/kucoin paired with pejoratives, "unlike Coinbase", metamask/phantom/rainbow/rabby clunky; passes neutral mentions |
| `rejectAIslop` | 8 tests — innovative, cutting-edge, users will appreciate, thrilled to, stay tuned, em-dash density > 2/280 chars; passes 1 em-dash, clean tweet |
| `rejectKainBaggage` | 6 tests — degen army, synthetic everything, the spartan council; passes neutral copy |
| `rejectClaimedPalettes` | 6 tests — #2E5CFF, #1BE3C2, #AB9FF2, #6E54FF (case-insensitive); passes other hexes |
| `rejectVisualSlop` | 12 tests — glass/neu/claymorphism, holographic/iridescent/purple gradient, hype-driven, futuristic UI, vaporwave; passes "purple wallet", "subtle gradient" |
| `rejectOffSpecDrive` | covered indirectly via `validate()` composite — voice-specific (regex set lives on `CharacterSpec.off_spec_regexes`) |

Each rule is exported individually. The `RULES` array (line 681) is the static-rule registry; `off-spec-drive` is special-cased inside `validate()` because it's voice-dependent.

Additional functions:
- `auditClaimContract()` line 195 — validates `deployed_facts_used` / `not_said` receipts against `card.deployed_facts`
- `auditUnsupportedClaims()` line 272 — catches URLs, numeric tokens, and assertive-claim sentences not backed by `deployed_facts`
- `auditPrepHierarchy()` line 411 — Mirodan §1.7 motor-pair check; only Sus→Q tempi contribute
- `classifyTempoBlind()` line 463 — deterministic blind classifier scoring against `main_tempi` only (reserve tempi → `unknown`)
- `auditBeats()` line 540 — per-beat declared-vs-classified comparison
- `auditBeatsLLM()` line 591 — delegates to validator-llm
- `auditTextHybrid()` line 626 — regex-first then Sonnet judge, short-circuits on regex fail

### `src/validator-active.ts` (326 lines)

**This is the active-validator surface that the handover docs reference.** Nigel-style multi-turn loop with research tools (default 6 turns, configurable via `COMMS_ACTIVE_VALIDATOR_MAX_TOOL_TURNS`). Composes deterministic regex first → if pass, hands off to Sonnet with `buildResearchTools()` + `buildLLMAuditTools()` tool sets. Emits a structured `ActiveValidatorTraceEvent` stream.

Key contract (line 220): **"If research proves the candidate true but the fact is not in card.deployed_facts, fail with voice/factual rule `card_missing_fact`; do not pass it."** Card is the allowance boundary.

### `src/orchestrator.ts` (388 lines)

Three orchestration flavours plus retry wrappers:
- `orchestrate()` line 243 — deterministic validator only
- `orchestrateLLM()` line 133 — uses `auditTextHybrid` (regex + LLM judge)
- `orchestrateActive()` line 180 — uses `auditTextActive` + `runHistoryGuards`
- `orchestrateWithRetries()` line 298 — feedback loop (`MAX_ATTEMPTS=3`)
- `orchestrateActiveWithRetries()` line 323 — active variant of retry loop

Channel max enforced post-validate: `x=280`, `web=140`, `in-product=80`. One real TODO at line 290: ranking model — for now first-passes-wins.

### `src/cli.ts` (419 lines)

Subcommands: `generate`, `validate`, `tempi`, `demo`, `render`, `ship`, `help`.

- `validate` — wired with `--validator=deterministic|llm|hybrid` (default deterministic), `--beats=`, `--voice=infinex|cream|projectjin|nigel`, `--surface`, `--job`, `--fact-context`
- `generate` — wired, supports `--retry` (full retry orchestrator), prints JSON
- `tempi` — wired
- `demo` — wired (Hyperliquid spot card baked in, line 300)
- `render` — wired end-to-end; loads `./remotion/render.js`, picks first validation-passing candidate (falls back to first overall if all fail), extracts lead beat, renders mp4 + poster; supports `--out=` and `--bg=` (Surprise #2)
- `ship` — **only true stub**. Line 404: `console.error("ship: TODO — pipeline not yet wired"); return 64;`

No `audit` subcommand exists.

### `src/voice/infinex.ts` (405 lines)

All five locked fields present and populated:
- `super_objective` (line 341): `"to take responsibility for the tech, so the user only has to want"`
- `super_objective_examples` (line 342): 3 entries (Swidge, Spot Hyperliquid, passkey-portable accounts)
- `historical_lore` (line 348): Craterun / Yaprun / "terrorists" scar
- `validation_criterion` (line 350): "one real user discovers the product without team-shilling or incentives…"
- `structural_traits` (line 336): banker-trailblazer image + no-listicle + no-antagonism — three entries
- Five main tempi locked: `commanding`, `practical`, `sombre`, `irradiant`, `sociable`
- Beat-only tempi: `self-contained`, `receptive`, `overpowering`, `diffused`, `egocentric`, `altruistic`, `unsociable`
- Cadence: irradiant 45% · commanding 22% · sombre 18% · sociable 10% · practical 5%
- Drive lock: `spell` primary + `vision` secondary; `off_spec_drives: ["passion"]`; `off_spec_regexes` carries time-pressure / urgency-theater patterns

Other voices in `src/voice/`: `cream.ts`, `projectjin.ts`, `nigel.ts`, `nick-b.ts`, `nick-d.ts` (nick-b/d added 2026-05-22).

### `src/__tests__/`

10 test files, 170 tests, 605ms runtime. Per-file pass counts:
- validator.test.ts — 70
- fact-grounder-llm.test.ts — 37
- copy-rewrite-llm.test.ts — 20
- validator-llm.test.ts — 14
- generator.test.ts — 11 (Surprise #3: dedicated "two-call generator (Phase 2)" describe block — 6 tests confirming Stage A → Stage B routing)
- orchestrator.test.ts — 5
- validator-active.test.ts — 4
- history-guards.test.ts — 4
- eval.test.ts — 3
- receipts.test.ts — 2

---

## Phase markers / handover-vs-code drift

Searched for `Phase 2/3/4/5`, `holistic`, `propose inner-work`, "grounder proposes" in code:
- **Phase 2 = two-call generator** is LANDED and DEFAULT (`generator.ts:67`, generator.test.ts:107 describe block). No "Phase 2 pending" markers in code.
- **No Phase 3 / Phase 4 / Phase 5 markers in code at all.**
- Active validator (Nigel-style multi-turn research) is also landed (`validator-active.ts`, with its own test file), wired into orchestrator, with trace events.
- History guards are landed and wired into `orchestrateActive`.
- `nick-b.ts` / `nick-d.ts` voices added 2026-05-22 — likely the next voice slots.

The handover docs that reference "Phase 3" as pending appear to be stale; the work they describe (active validator + history guards + research-tool extraction + grounder mechanics) is all on disk and tested.

---

## Three concrete surprises (handover-vs-reality contradictions)

1. **Card inner-work fields are first-class Zod schema fields, not just prompt convention.** `card.ts` exposes `through_action`, `obstacle`, `lining`, `reader_prior`, `not_the_point` as optional schema fields on every release card kind. Operator and generator can use these without any new schema work. Handover docs treat these as "still to add."

2. **The renderer is actually wired and the `render` CLI subcommand runs end-to-end** — CLAUDE.md says "Renderer is a `TODO` stub in `cli.ts`" and "Don't render before brand-locked." But `src/cli.ts:cmdRender` (line 348–402) generates captions, picks a validation-passing candidate, extracts the lead beat, and calls `./remotion/render.js:render()` which bundles + renders mp4 + still poster for `data-card-official`. `brand-stub.ts` provides tokens for all four brands (infinex, cream, projectjin, nigel). Only the other 3 card kinds (data-card-wry, launch-tier, split) actually throw. **The renderer is live for one composition; the brand-stub IS the contract bridge.** Handover docs claim this is all unbuilt.

3. **Phase 2 (two-call generator) is the DEFAULT path, not opt-in.** Every `generate()` call without explicit `beats` or `innerWork` routes through Stage A → Stage B. CLAUDE.md and recent handover docs talk about this as in-flight; code says it shipped with full test coverage. Conversely, the ONLY remaining stubs in `src/` are: (a) `cmdShip` in cli.ts, (b) the ranking-model TODO in `orchestrate()`, (c) 3 of 4 Remotion compositions, and (d) `brand-stub.ts` (deliberate, awaiting brand-factory).

Final pipeline staging: card → generator (Phase 2) → validator (3 flavours: det/hybrid/active) → orchestrator (3 flavours) → renderer (1/4 kinds wired) → ship gate (still TODO). Everything except ship gate + 3 Remotion kinds is BUILT and tested.
