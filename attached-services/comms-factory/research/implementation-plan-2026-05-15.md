# Implementation plan — voice pipeline hardening + fact-grounder

**Date:** 2026-05-15
**Owner:** comms-factory voice subsystem
**Status:** Drafted, ready for execution by either Claude (new session) or Codex.
**Source of truth:** `research/state-audit-2026-05-15.md` (state) + Codex 7 findings (review) + operator's research-loop addition (extension).

This plan converts the audit + review into an executable sequence. Every task names files, function signatures, tests, and acceptance criteria. Steps are ordered by dependency. Each phase is independently shippable.

---

## Overview

Five phases. Phase 1 is the largest and blocks production use of the rewrite loop. Phases 2–5 are smaller and can run in parallel with each other once Phase 1's `VerifiedFact` type is checked in.

| Phase | Title | Blocks production? | Est. effort | Depends on |
|---|---|---|---|---|
| 1 | Fact-grounder layer (internal + external research) | YES — gates rewrite loop | 6–8h | none |
| 2 | Hybrid validation (regex + LLM composition) | YES — required for release-card path | 1h | none (parallel to 1) |
| 3 | Structured `detected_drive` field | NO — diagnostic improvement | 45m | none (parallel to 1) |
| 4 | Beat-scope classification option | NO — fixes over-restriction in `auditBeatsLLM` | 30m | none (parallel to 1) |
| 5 | De-Infinex the release-card generator | NO — portability hygiene | 45m | Phase 4 helpful but not blocking |

After Phase 1+2 land: comms-factory can be trusted for marketing-copy rewrites in production.

---

## Phase 1 — Fact-grounder layer

The architectural answer to Codex #1 (entity preservation) + Codex #2 (validator fact context) + operator's #8 (active research). Steals Nigel's tool-orchestrated research pattern; adds internal code/registry sources alongside the external web/X sources.

**Design:** A new Sonnet agent (`groundFacts`) runs BEFORE the intent extractor. Sonnet has multiple research tools and returns a structured `VerifiedFact[]`. Both the generator and the validator receive these as immutable constraints / fact context. A deterministic post-check verifies every preserved entity appears (or is explicitly accounted for) in the rewritten output.

### 1a. `VerifiedFact` type + result envelope

**File:** `src/fact-grounder-llm.ts` (NEW)

```typescript
export type FactCategory =
  | "partner"           // "perps powered by Hyperliquid"
  | "capability"        // "supports up to 50x leverage"
  | "number"            // "20+ chains"
  | "chain"             // "Ethereum, Solana, Base..."
  | "product"           // "Patron Pass"
  | "url"               // "infinex.xyz/perps"
  | "date"              // "shipped 2026-04-15"
  | "ticker";           // "BTC, ETH, SOL"

export type FactSource =
  | "platform-code"     // grep'd from ~/Sites/infinex-xyz/platform
  | "platform-docs"     // markdown in platform repo
  | "partner-registry"  // maintained file in this repo
  | "infinex-page"      // fetched from infinex.xyz
  | "web-search"        // generic web search
  | "operator-input";   // explicitly supplied by caller

export interface VerifiedFact {
  category: FactCategory;
  claim: string;                  // human-readable claim ("max perp leverage")
  value: string;                  // the verified value ("50")
  source: FactSource;
  source_ref: string;             // file:line or URL
  confidence: number;             // 0..1
  verified_at: string;            // ISO date when this was grounded
}

export interface FactGroundingResult {
  facts: VerifiedFact[];
  unverifiable: { claim: string; reason: string }[];
  model: string;
  ground_turns: number;           // how many tool-loops Sonnet ran
}
```

**Acceptance:** Types exported, used in 1b–1h.

### 1b. Local fact source: platform code introspection

**File:** `src/fact-grounder/sources/platform-code.ts` (NEW)

Functions:
- `grepPlatform(pattern: string, opts?: { path?: string; maxResults?: number }): Promise<{ file: string; line: number; preview: string }[]>` — wraps `rg` (ripgrep) against `~/Sites/infinex-xyz/platform`. Default path is the whole platform; opts.path narrows.
- `readPlatformFile(relativePath: string, opts?: { startLine?: number; endLine?: number }): Promise<string>` — read with optional line range.
- `PLATFORM_ROOT: string` — env-driven, defaults to `~/Sites/infinex-xyz/platform`. Fails loud if unset and directory doesn't exist.

**Note:** Don't use the JS `fs` module to walk the whole tree — call `rg` via `node:child_process`. Faster and respects `.gitignore`.

**Acceptance:** Unit test asserts `grepPlatform('maxLeverage', { path: 'apps/perps-app/src' })` returns at least the `?? 50` line at `app/[[...params]]/page.tsx`.

### 1c. Local fact source: partner / feature registry

**File:** `src/fact-grounder/sources/partner-registry.ts` (NEW)
**Data:** `config/partner-registry.json` (NEW)

The registry is the operator-maintained catalog of "feature → provider" mappings. Sonnet reads it when the source copy mentions a feature without naming its provider.

```typescript
export interface PartnerRegistryEntry {
  feature: string;                // "perps_trading"
  provider: string;               // "Hyperliquid"
  provider_handle?: string;       // "@HyperliquidX"
  evidence: { source_ref: string; verified_at: string };
}

export const PARTNER_REGISTRY: PartnerRegistryEntry[] = [
  // Loaded from config/partner-registry.json
];

export function lookupFeature(feature: string): PartnerRegistryEntry | null;
```

**Seed data for `config/partner-registry.json`** (must include at minimum, citing platform-code source refs):
- `perps_trading` → Hyperliquid (cite `apps/perps-app/src/app/api/og/lib/hyperliquid.ts`)
- `prediction_markets` → Polymarket (cite `apps/prediction-markets-app/...` — TBD path)
- `passkey_custody` → Turnkey (cite `packages/wallet-security/...`)
- Any others discovered during 1b initial recon.

**Acceptance:** Registry loads, `lookupFeature('perps_trading')` returns the Hyperliquid entry, schema validated on load.

### 1d. External fact source: infinex.xyz fetch

**File:** `src/fact-grounder/sources/infinex-pages.ts` (NEW)

```typescript
export async function fetchInfinexPage(path: string): Promise<{ url: string; text: string; fetched_at: string }>;
```

Simple HTTP fetch + HTML → text conversion. Cache to `~/.cache/comms-factory/infinex-pages/{path-hash}.json` with a 24h TTL — re-fetching infinex.xyz on every grounder run is wasteful.

**Acceptance:** `fetchInfinexPage('/')` returns the homepage text, cache file written.

### 1e. External fact source: projectjin → Grok + X API (mirrors Nigel)

**File:** `src/fact-grounder/sources/projectjin-research.ts` (NEW)

Mirror Nigel exactly. Nigel's voice validator routes all external research through `projectjin` CLI as a subprocess, which delegates to **Grok (X's model) for web summarisation** and **X API v2 for raw tweet search**. Same auth, same stack, same proven tool shape. Reusing this gives us:

- Already-working API keys (no new auth surface).
- Two-tier research pattern (Grok summary first, raw X follow-up) Nigel proved reliable.
- Citations + raw records normalized in `(summary, citations, raw_records)` tuples.

Recon source: `agents/nigel/bot/voice/nigel_voice_validator.py:436–482`, `agents/nigel/bot/voice/market_research.py:68–127`.

Two tools to expose to the grounder Sonnet call (Nigel-portable):

```typescript
// Tool 1: external web search via Grok
export interface WebSearchToolInput {
  context: string;   // ≤ 500 chars, why this search is being run
  query: string;     // free text
}
export interface WebSearchToolOutput {
  summary: string;        // Grok-summarized prose
  citations: string[];    // source URLs
}

// Tool 2: X / Twitter recent posts
export interface RecentPostsToolInput {
  context: string;          // ≤ 500 chars
  query: string;            // X API search syntax — supports from:user, exact quotes
  hoursBack?: number;       // 1..168, default 24
  maxResults?: number;      // 10..100, default 10
  sortOrder?: "recency" | "relevancy";
}
export interface RecentPostsToolOutput {
  posts: Array<{
    author: string;
    text: string;          // truncated to 280 chars
    createdAt: string;     // ISO date
    url: string;
  }>;
}
```

Implementation is a thin subprocess wrapper:

```typescript
export async function runProjectjinTool(
  tool: "infinex_web_search" | "infinex_search_recent_posts",
  input: object,
  opts?: { profile?: string; timeoutMs?: number }
): Promise<unknown>;
```

Shells out to `projectjin [--profile X] --agent --json tool call <tool> --input <json>` and parses stdout. Mirror Nigel's 60s timeout default.

**Auth:** `PROJECTJIN_BIN` or `PROJECTJIN_CLI` env var (path to binary) + optional `PROJECTJIN_PROFILE`. Same envs Nigel uses.

**Acceptance:** A grounder run that calls `infinex_web_search({ context: "verify perps venue", query: "Infinex perps powered by Hyperliquid" })` returns a Grok summary with citations. Test against a fixture (don't require live projectjin in CI).

### 1f. Sonnet grounder orchestrator

**File:** `src/fact-grounder-llm.ts`

```typescript
export interface FactGroundingOptions {
  surface?: string;                 // e.g. "homepage feature card for perps"
  job?: string;                     // e.g. "feature_description"
  model?: string;                   // defaults to claude-sonnet-4-6
  max_turns?: number;               // default 6 (mirrors Nigel)
  operator_facts?: VerifiedFact[];  // explicit facts the operator supplies
  client?: AnthropicMessagesClient;
}

export async function groundFacts(
  sourceCopy: string,
  opts: FactGroundingOptions = {},
): Promise<FactGroundingResult>;
```

Sonnet is given the source copy + surface context + the following tools (all defined in `buildFactGrounderTools`). Split: INTERNAL tools are new to comms-factory (Nigel doesn't have them). EXTERNAL tools mirror Nigel's voice-validator exactly.

| Tool | Layer | Purpose | Backed by |
|---|---|---|---|
| `grep_platform_code` | INTERNAL · code | search platform repo for symbols/strings | `sources/platform-code.ts:grepPlatform` |
| `read_platform_file` | INTERNAL · code | read a specific platform file | `sources/platform-code.ts:readPlatformFile` |
| `lookup_partner` | INTERNAL · registry | resolve feature → provider | `sources/partner-registry.ts:lookupFeature` |
| `fetch_infinex_page` | INTERNAL · web (own product) | fetch a page from infinex.xyz | `sources/infinex-pages.ts:fetchInfinexPage` |
| `infinex_web_search` | EXTERNAL · web · Nigel-portable | Grok-summarised web search via projectjin | `sources/projectjin-research.ts:runProjectjinTool` |
| `infinex_search_recent_posts` | EXTERNAL · X · Nigel-portable | raw X tweet search via projectjin | `sources/projectjin-research.ts:runProjectjinTool` |
| `record_fact` | SINK | emit a `VerifiedFact` | parser collects into result |
| `mark_unverifiable` | SINK | record an unresolved claim | parser collects into result |
| `done_grounding` | TERMINATOR | end the loop, return facts | parser terminates loop |

**Heuristic the system prompt should encode (Nigel's two-tier pattern, generalised):**
- Internal sources first (cheaper, more authoritative for our own product facts).
- External `infinex_web_search` second when internal sources don't resolve.
- `infinex_search_recent_posts` last, only when web summary is inconclusive or the claim is about a named person's own statements.

**System prompt structure:**
- Job framing: "You are the fact-grounder for comms-factory. The generator will write replacement copy from intent and the facts you return. Be thorough — any fact you miss may be hallucinated downstream."
- List of available tools.
- Heuristics: "Always ground numeric capabilities to platform code. Always ground partner names to the registry. Web search only when local sources don't resolve a claim."
- Stopping condition: "Call `done_grounding` when every potentially-verifiable claim in the source copy is either recorded or marked unverifiable."
- Output: through `record_fact` / `mark_unverifiable` calls, then `done_grounding`.

**Tool-loop mechanics (mirror Nigel `validator.py:531–587` exactly):**
- Max 6 tool loops (`_DEFAULT_MAX_TOOL_LOOPS = 6`).
- 60s timeout per tool call.
- Each turn: call Sonnet with tools + current messages.
- Extract `done_grounding` first — if present, terminate loop, return recorded facts.
- Otherwise extract research-tool calls and execute **in parallel** via `Promise.all` (Nigel uses `asyncio.gather`).
- Thread tool results back as a single `{role: "user", content: [tool_results...]}` turn.
- If neither `done_grounding` nor research tools called in a turn → bail with `truncated: true` (Sonnet emitted bare text, malformed).
- On max-loop exhaustion → return what's recorded with `truncated: true`.

**Acceptance:** Test with a mocked client confirms Sonnet receives all 7 tools, recorded facts are parsed into `FactGroundingResult.facts`, and the loop terminates on `done_grounding`.

### 1g. Integration into the rewrite loop

**File:** `src/copy-rewrite-llm.ts` (MODIFY)

1. **New step before extractor:** orchestrator calls `groundFacts(currentText, { surface, job })` first.
2. **Threaded into extractor:** extractor's user message includes the grounded facts as `available_facts` so the intent it emits doesn't accidentally drop them. **Extractor must NOT echo facts verbatim** — operator's anti-poisoning concern. Facts are passed as a separate field, intent stays abstract.
3. **Threaded into generator:** `CopyGenerationInput` gains a required `verified_facts: VerifiedFact[]` field. Generator's system prompt: "The following facts are immutable. Do not invent. Do not omit. If a fact does not fit, choose a different tempo or return `cannot_satisfy`."
4. **Threaded into validator:** `auditTextLLM` is called with `fact_context: stringify(verified_facts)` and `deployed_facts: facts.map(f => `${f.claim}: ${f.value}`)`. Validator fails if regenerated text contradicts any verified fact.

### 1h. Deterministic post-check

**File:** `src/copy-rewrite-llm.ts` (MODIFY)

After the validator passes, run a deterministic check:

```typescript
function checkEntityPresence(
  text: string,
  facts: VerifiedFact[],
): { missing: VerifiedFact[]; contradicted: { fact: VerifiedFact; found: string }[] };
```

- For each `category === "partner" | "chain" | "ticker"` fact: assert `text.toLowerCase().includes(fact.value.toLowerCase())` OR the generator marked it as `intentionally_omitted` in its output.
- For each `category === "number"` fact: extract numbers from `text` and assert they match the verified value (within a token-window heuristic — "50x" close to the word "leverage").
- If anything is missing or contradicted, fail the rewrite attempt with structured feedback for retry.

**Acceptance:** Unit test where the generator returns text omitting a verified partner triggers `missing` and forces a retry.

### 1i. Tests

**File:** `src/__tests__/fact-grounder-llm.test.ts` (NEW)

Must cover:
- All 7 tools' schemas + parsers.
- `grepPlatform` against a fixture directory (don't require live platform repo for tests).
- `lookupFeature` round-trip.
- `groundFacts` with mocked client — happy path, tool-loop with multiple turns, max-turns truncation, `mark_unverifiable` recorded correctly.
- Entity-presence post-check: missing entity, contradicted number, intentional omission.

**File:** `src/__tests__/copy-rewrite-llm.test.ts` (MODIFY — extend existing 20 tests)
- New test: grounder is called before extractor.
- New test: extractor never receives shipped text — but DOES receive `verified_facts`.
- New test: generator's payload includes `verified_facts` as immutable constraints.
- New test: validator receives `fact_context` derived from `verified_facts`.
- New test: missing entity triggers retry with feedback.

**Acceptance:** All tests pass. Existing 86 tests still pass. New test count: 86 + ~15 = ~101 base + 5 modified rewrite-loop tests.

---

## Phase 2 — Hybrid validation (Codex #3 + #6)

Compose deterministic regex with LLM. Regex is the hard gate (catches generic slop, listicle, em-dash spam); LLM judges character fit on what survives.

### 2a. `auditTextHybrid()` in validator.ts

**File:** `src/validator.ts` (MODIFY)

```typescript
export async function auditTextHybrid(
  text: string,
  opts: { voice?: CharacterSpec; beats?: BeatSequence; card?: ReleaseCard; verified_facts?: VerifiedFact[]; client?: AnthropicMessagesClient },
): Promise<{
  passed: boolean;
  deterministic: ValidationResult;       // existing validate() output
  llm?: LLMVoiceAuditVerdict;            // only run if deterministic passes
  reason?: string;                       // why it failed (regex rule name OR LLM verdict)
}>;
```

Order: deterministic first. If regex fails, short-circuit and return — don't pay for an LLM call. If regex passes, call `auditTextLLM` and return the composed verdict.

### 2b. Wire into orchestrator

**File:** `src/orchestrator.ts` (MODIFY)

Add an async variant:

```typescript
export async function orchestrateLLM(
  card: ReleaseCard,
  candidates: Candidate[],
  channels: Channel[],
  opts: { voice: CharacterSpec; beats: BeatSequence; verified_facts?: VerifiedFact[] },
): Promise<OrchestrateResult>;
```

Same shape as `orchestrate()` but uses `auditTextHybrid()` per candidate.

### 2c. CLI default

**File:** `src/cli.ts` (MODIFY)

Add `--validator=deterministic|llm|hybrid` flag (default: `hybrid`). Plumb through to `orchestrateLLM`. Deterministic stays the default for tests / fast iteration; production paths default to hybrid.

### 2d. Tests

**File:** `src/__tests__/validator.test.ts` (MODIFY)
- New test: `auditTextHybrid` short-circuits on regex failure (no LLM call).
- New test: `auditTextHybrid` calls LLM when regex passes.

**File:** `src/__tests__/orchestrator.test.ts` (MODIFY)
- New test: `orchestrateLLM` happy path.

**Acceptance:** All tests pass. CLI `generate --validator=hybrid` produces orchestrator output with both regex and LLM verdicts in the JSON.

---

## Phase 3 — Structured `detected_drive` field (Codex #5)

### 3a. Schema change

**File:** `src/validator-llm.ts` (MODIFY at lines ~113 and ~205)

Add to `independentClassificationSchema` (both `buildLLMAuditTools` and `buildLLMCopySetAuditTools`):

```typescript
detected_drive: {
  type: "string",
  enum: ["doing", "spell", "passion", "vision", "doing-passion", "spell-vision", "unknown"],
  description: "Which Mirodan drive does the prose actually carry? If off-spec for the voice (e.g. Passion for an Infinex line), the validator should already be failing on voice grounds — this field surfaces the drive structurally so callers can query it without parsing rationale prose.",
},
```

Add `detected_drive` to `required` array.

### 3b. Type + parser

**File:** `src/validator-llm.ts` (MODIFY)

Extend `LLMIndependentClassification`:
```typescript
export type DetectedDrive = "doing" | "spell" | "passion" | "vision" | "doing-passion" | "spell-vision" | "unknown";

export interface LLMIndependentClassification {
  tempo: TempoName | "unknown";
  motifs: WorkingAction[];
  detected_drive: DetectedDrive;     // NEW
  confidence: number;
  rationale: string;
}
```

Update `parseIndependentClassification` to parse + default to `"unknown"`.

### 3c. Tests

Add 2 tests:
- Schema includes `detected_drive` as required.
- Parser handles missing field gracefully (defaults to `"unknown"`).

### 3d. HTML diff update

**File:** `scripts/build-soft-vs-hardened-html.ts` (MODIFY)
- Add a "drive" column to sections 1 and 2.
- Re-render the HTML.

**Acceptance:** Re-running the homepage audit produces JSON where each row has `independent_classification.detected_drive: "passion" | "spell-vision" | ...`. HTML diff shows drive as a column.

---

## Phase 4 — Beat-scope option (Codex #4)

### 4a. New option

**File:** `src/validator-llm.ts` (MODIFY)

```typescript
export type ClassificationScope = "primary" | "beat";

export interface LLMVoiceAuditOptions extends LLMValidationContext {
  // ... existing fields ...
  classification_scope?: ClassificationScope;  // default "primary"
}
```

### 4b. Schema selection by scope

In `buildLLMAuditTools`, branch on scope: if `"primary"`, enum is `main_tempi + "unknown"` (current hardened behavior). If `"beat"`, enum is `main_tempi + beat_only_tempi + "unknown"`.

### 4c. Wire `auditBeatsLLM` to pass `"beat"`

**File:** `src/validator-llm.ts` (MODIFY at line ~521)

`auditBeatsLLM` should always pass `classification_scope: "beat"` to `auditTextLLM`, since by definition it's auditing a beat within a multi-beat post.

### 4d. Tests

- Primary scope rejects beat-only tempi (existing test).
- Beat scope accepts beat-only tempi.
- `auditBeatsLLM` uses beat scope.

**Acceptance:** A multi-beat post that declares a beat as `self-contained` can validate cleanly. Standalone copy still hardened.

---

## Phase 5 — De-Infinex the release-card generator (Codex #7)

### 5a. Add structural traits to voice spec

**File:** `src/voice/types.ts` (MODIFY)

```typescript
export interface CharacterSpec {
  // ... existing fields ...
  structural_traits?: string[];  // human-readable, character-derived structural rules
                                 // e.g. ["No listicle openers — character is wise-old-guard, not BuzzFeed.",
                                 //       "No antagonism toward named competitors — Stable + Penetrating, not brawler."]
}
```

### 5b. Move Infinex-specific lines from generator.ts to voice/infinex.ts

**File:** `src/voice/infinex.ts` (MODIFY)

Add `structural_traits` array with the two strings currently hardcoded in `generator.ts:166-170`.

**File:** `src/generator.ts` (MODIFY at lines 165–170)

Replace the hardcoded "wise-old-guard" / "Stable + Penetrating" rationale with:

```typescript
parts.push("# Hard rules (validator will reject violations)");
parts.push("Reason from the character placement above. Do NOT apply a hardcoded ban list of words.");
if (voice.structural_traits && voice.structural_traits.length > 0) {
  parts.push("");
  parts.push("Structural constraints (character-derived):");
  for (const trait of voice.structural_traits) {
    parts.push(`- ${trait}`);
  }
}
```

Now the generator is voice-portable.

### 5c. Tests

**File:** `src/__tests__/generator.test.ts` (MODIFY)
- New test: generator with a custom `CharacterSpec` and no `structural_traits` produces a prompt without the Infinex-specific lines.
- New test: with `structural_traits: ['Foo bar']` produces a prompt containing `"- Foo bar"`.

**Acceptance:** Other voice specs (Cream, ProjectJin, Nigel) don't accidentally inherit Infinex's structural rules.

---

## Execution sequence

```
┌──────────────────────────┐
│  Phase 1: Fact-grounder  │  6–8h  (largest, gates production rewrites)
│  (1a–1i)                 │
└────────────┬─────────────┘
             │
             ├─ Phase 2: Hybrid validation        1h    (parallel after 1a, or independent)
             ├─ Phase 3: detected_drive field     45m   (independent)
             ├─ Phase 4: Beat-scope option       30m   (independent)
             └─ Phase 5: De-Infinex generator    45m   (independent)
```

A reasonable execution order:

1. **Day 1, morning:** Phase 1a (types) + Phase 3 (drive field) + Phase 4 (beat scope). All small, all unblocks downstream.
2. **Day 1, afternoon:** Phase 1b–1d (local fact sources) + Phase 5 (de-Infinex generator) in parallel.
3. **Day 2, morning:** Phase 1e–1f (external + orchestrator).
4. **Day 2, afternoon:** Phase 1g–1i (integration + post-check + tests) + Phase 2 (hybrid).
5. **Day 2, evening:** Full re-run of all three artifacts (homepage audit, existing-copy, rewrite). Update the HTML diff. Confirm Phase 1's fact-grounder catches the 40x/Polymarket bugs.

---

## Acceptance criteria for the whole plan

End-state checklist:

- [ ] `pnpm typecheck` clean, `pnpm test` passes (target: ~125 tests).
- [ ] Running `rewriteCopyLoop` on H15 ("Trade perps in-app with up to 40x leverage") produces output with `"50x"` (the verified platform value) AND a `VerifiedFact` ledger showing `source: "platform-code", source_ref: "apps/perps-app/src/app/[[...params]]/page.tsx:73"`.
- [ ] Running the rewrite loop on H17 (Polymarket partner credit) preserves "Polymarket" because the partner registry contains `prediction_markets → Polymarket`.
- [ ] `auditTextHybrid` returns deterministic-fail for `"Get the next-gen, game-changing trading experience"` without making an LLM call.
- [ ] The HTML diff has a `drive` column showing `passion` for H01 (Change the way you crypto), `spell-vision` for H02 (Unified portfolio), etc.
- [ ] `auditBeatsLLM` validates a multi-beat post where one beat is declared `self-contained` (regression fix).
- [ ] Switching `INFINEX_VOICE` to `CREAM_VOICE` in `generate()` produces a prompt with no Infinex-specific lines.
- [ ] Per-feature partner registry covers at minimum: perps_trading (Hyperliquid), prediction_markets (Polymarket), passkey_custody (Turnkey), swap_routing (DEX aggregator — TBD), yield (TBD).

---

## Risks

| Risk | Mitigation |
|---|---|
| `projectjin` not installed or `PROJECTJIN_BIN` unset | Fail loud at grounder init with `"projectjin CLI required for external research — see agents/nigel/.env for setup pattern, or pass operator_facts to skip external sources"`. INTERNAL-only grounding still works without it. |
| Platform repo isn't checked out where expected | `PLATFORM_ROOT` env-driven; fail loud on missing dir with a helpful message. |
| Sonnet grounder over-fetches (too many tool calls per surface) | Cap max_turns at 6, log turn count, alert if average > 4 across a run. |
| Cost: 3 → 4 LLM calls per surface (Sonnet ground + Sonnet extract + Opus generate + Sonnet validate) | Acceptable for marketing surfaces (10s of strings × 4 calls = $0.50–$2/run). Cache grounder results per source string with 24h TTL — most homepage strings don't change daily. |
| Registry rot — partner mappings get stale | Cite `verified_at` in every registry entry; build a `pnpm check-registry-staleness` script that flags entries > 30 days old. (Out of scope for this plan; capture as followup.) |
| Generator legitimately needs to invent — e.g. write new feature copy where no fact exists yet | Generator can return `cannot_satisfy: { missing_facts: ["max_leverage_for_new_market"] }` instead of `replacement_text`. Orchestrator surfaces this for operator decision. |
| H08 / H13 still fail under hardened validator even with facts | These are character-structural fails (Spell-Vision can't natively talk about rewards / can't enumerate without Wringing buildup), not fact bugs. Out of scope for Phase 1. Document as known limitation. |

---

## What this plan does NOT cover (explicit out-of-scope)

- Surface-tempo policy (Irradiant-in-deposit-flow problem). Captured separately in `state-audit-2026-05-15.md` §⚠️ #2. Build after Phase 1+2 if/when product UI work resumes.
- Remotion compositions for `data-card-wry`, `launch-tier`, `split`. Blocked on brand-factory.
- Channel routing (Phase 3 from the old SESSION_HANDOVER). Independent track.
- Ship-gate preview HTML. Independent track.
- Anthropic-native classifier upgrade (replacing the deterministic anchor classifier in `validator.ts` with another Sonnet call). Not needed — the hybrid composition handles it.

---

## How to execute this plan

If you're Claude in a new session:
1. Read `research/state-audit-2026-05-15.md` and this doc end-to-end.
2. Pick a phase (recommend starting with Phase 3 — smallest, fastest unblock).
3. For each numbered sub-step, read the file, make the change, run tests after each commit-worthy chunk.
4. Re-run `scripts/build-soft-vs-hardened-html.ts` after each phase if it touches validator behavior.
5. When Phase 1 lands, regenerate all three research artifacts with the fact-grounder live.

If you're Codex:
1. Phase 1 is the architectural change. Review the grounder design (1a–1f) BEFORE implementing — confirm the tool-set is the right shape, the cache strategy is sound, the partner-registry schema is durable.
2. Phases 2–5 are surgical. Implement in any order.
3. Push back if the deterministic post-check in 1h is too strict — better to false-fail-and-retry than to ship unverifiable claims.

---

## Open questions for the operator

1. **Partner registry scope:** should this live in `comms-factory` (close to the validator) or in `brand-factory` (close to the brand spec)? Argument for brand-factory: brand-spec changes when partners change. Argument for comms-factory: fact-checking is a comms-pipeline concern.
2. **External research stack confirmed:** projectjin → Grok + X API (mirrors Nigel). Recon-resolved — no longer an open question. Tavily / Anthropic native web_search would be a SECOND path only if projectjin proves unreliable.
3. **Operator-supplied facts:** should the rewrite-loop CLI accept `--facts='{"perps_max_leverage":"50"}'` to allow ad-hoc fact overrides? Useful for testing.
4. **Cache TTL for `fetchInfinexPage` and grounder results:** 24h reasonable? 1h? Per-call no-cache for live debugging?
5. **`infinex_search_recent_posts` value-add:** Nigel uses it heavily because his domain is trader sentiment. For comms-factory's fact-grounding (verify capabilities + partners), the X tool is probably secondary — internal code + Grok web summary should cover ~90% of facts. Include it for completeness but expect it to fire rarely. Confirm or down-scope.
