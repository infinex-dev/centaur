# SPEC — Director as a Standalone Brand-Fit Service

**Status:** design, ready for engineering review
**Date:** 2026-06-01
**Owner:** opaque (Infinex)
**Audience:** the engineer who will wire this into the production on-rails pipeline
**Source repo for reference implementation:** `comms-factory` (the Director already exists here as a coupled stage; this spec decouples it)

---

## 0. One line

Take the Director — the LLM that judges whether a piece of copy fits the Infinex voice — out of the generation pipeline and expose it as a standalone service that judges **any** copy from **any** source (human or machine) and returns 🟢/🟡/🔴 + notes.

---

## 1. The invariant this is built on

> **Judging is context-free. Generating is context-bound.**
> A human can vouch for context out of her own head. A machine has to earn it from the grounder.
> So the Director may judge blind — but the moment anyone hits **generate**, the full `grounder → card → generate` pipeline is non-negotiable.

Everything below follows from that line. The "generate" button is not a cheap AI tweak; it is an explicit, expensive act of *re-acquiring the context the machine doesn't have*, because it cannot borrow the human's.

---

## 2. Two products, one judge

| | **Director Service** (ship first) | **Full Pipeline** (behind one button) |
|---|---|---|
| Input | any copy, any source | a release/incident event |
| Context | product-context-**dumb** (placement-rich only) | fully grounded |
| Can generate? | **no** — judges + asks questions | **yes** — the only path allowed to write |
| Cost | one LLM call (or a short Q&A) | grounder + card + generate (expensive) |
| Useful day one? | **yes, with the generator switched off entirely** | needs the generator |

The Director is the shared, stable judge. Generation is one optional upstream feeding it.

---

## 3. Roles

| Role | Context | Job |
|---|---|---|
| **Ibex** (human author) | context-**rich** — knows the build, the design calls, the incentive terms | writes copy, decides how to iterate |
| **Director** ("she") | placement-**rich**, product-context-**dumb** | judge fit; ask to verify; never generate |
| **Actor** (behind *generate*) | must become context-aware via grounder | regenerate, fully grounded |
| **Grounder** | reaches shipped `main` + early PRs/branches | earns context for the machine |
| **Validator** | none (deterministic) | regex-grade front door, runs before the Director |

> "Context-dumb" means the Director knows nothing about the build, the mechanics, this week's design decisions. It is **not** placement-dumb — it always carries the locked Infinex Laban/Mirodan spec. That is its yardstick and it is never allowed to lose it. Do not feed it build context "to help"; that turns the judge back into a generator.

---

## 4. The loop

```
Ibex writes copy  →  "Deposit your Infinex now to receive your incentives."
        │
        ▼
   ┌───────────────────────────────────────────────────┐
   │  VALIDATOR (regex, instant)  →  hard 🔴 on slop     │
   ├───────────────────────────────────────────────────┤
   │  DIRECTOR (placement-rich, context-dumb)            │
   │   ├─ voice/character axis  → blind, needs nothing   │
   │   └─ fact axis             → ASK Ibex to confirm    │
   │                              (never self-grounds)   │
   └───────────────────────────────────────────────────┘
        │
        ├─ 🟢  → human ship gate
        │
        └─ 🟡/🔴 + notes (+ clarifying questions)
              │
              ├─ Ibex rewrites in her head ─────────────────┐ resubmit
              │                                              │
              └─ Ibex clicks GENERATE → hands to ACTOR       │
                    → grounder → card → generate ────────────┘
                      (machine earns context; everything grounded)
```

### Worked example — `"Deposit your Infinex now to receive your incentives."`
Trips both axes at once, which is why it's the canonical test:
- **Voice — context-free 🔴.** "*now* … *receive your incentives*" is urgency + reward-bait = Passion / time-pressure drive, which the Infinex placement explicitly forbids (Spell, not Passion; future-tense and craft-patience are native, FOMO is off-spec). The Director flags this with **zero** context — it doesn't need to know what the incentive is to know the *voice* is wrong.
- **Fact — a question, not a verdict.** "What incentives? On what terms? Is this live?" It can't answer blind, so it **asks Ibex**. Her answers are facts → see §7 capture bridge.

---

## 5. The Director service contract

### 5.1 Input
```ts
interface AuditRequest {
  text: string;                 // the copy to judge
  surface: Surface;             // 'tweet' | 'web' | 'in-product' | 'modal' | 'email' | ...
  voice_id: string;             // e.g. 'infinex' — selects the locked placement
  fact_source?: FactSource;     // optional: a card, or answered clarifying questions
  thread?: AuditTurn[];         // prior Q&A turns, for the ask-human loop
}
```
No Actor receipts. The current Director eats a `Candidate` with `deployed_facts_used`/`not_said`; the service eats raw text + an optional fact source. That decoupling is the main code change (§8).

### 5.2 Two axes
- **Voice/character axis** — always runs, fully blind. Re-derives tempo, motion factors (Stable / Penetrating / Flow-bound), drive (Spell-not-Passion), and placement legality from the prose alone. Needs nothing but the locked spec.
- **Fact/claim axis** — needs a fact source. Three ways to satisfy it, in order of preference:
  1. a `fact_source` card is supplied → check claims against `deployed_facts` (the existing claim-contract logic);
  2. no card → **raise clarifying questions** to the human;
  3. answered questions get captured into a card (§7).

The Director **never calls the grounder.** Self-grounding is the Actor's job, gated behind *generate*. The Director asks the human; the machine grounds. Keep that line hard or the boundary smears.

### 5.3 The light
Headline = the **worse** of the two axes.

| Light | Voice | Fact |
|---|---|---|
| 🔴 **red** | illegal placement, or off-spec drive surfaced (time-pressure / FOMO / panic) | a claim contradicts the fact set (`hard_fail`) |
| 🟡 **amber** | legal but soft — nearby/low-confidence tempo, lining leaked wrong, a `soft_warn` voice issue | an assumption is **unverified** (awaiting a human answer) |
| 🟢 **green** | legal placement, confident tempo, no issues | every claim grounded or confirmed |

This is a presentation layer over signals the Director already computes (`confidence`, `nearest_allowed_read`, `hard_fail`/`soft_warn` severities). Low new logic.

> **Security-comms guardrail:** a voice-🟢 that silently skipped the fact axis is a trap — on a breach email, asserting an unconfirmed detail is the catastrophic failure. Always report both axes explicitly; never let a clean voice read imply "safe to send." And 🟢 is never auto-send: the human ship gate stays, always.

### 5.4 Output
```ts
interface DirectorVerdict {
  light: 'green' | 'amber' | 'red';            // worse of the two axes
  axes: {
    voice: {
      light: 'green' | 'amber' | 'red';
      legal: boolean;
      primary_tempo: TempoName | 'unknown';
      confidence: number;
      motion_evidence: MotionFactors;          // Weight/Space/Time/Flow poles read from prose
      drive_read: string;                      // spell | passion | vision | ...
      nearest_allowed_read?: string;           // if not legal, the closest legal read
      issues: VoiceIssue[];                    // { line, rule, fix }
    };
    fact: {
      light: 'green' | 'amber' | 'red';
      status: 'grounded' | 'needs_confirmation' | 'violated';
      claims: ClaimCheck[];                    // { claim, supported_by | unverified | contradicts }
    };
  };
  notes: string[];                             // human-readable "why", crisp enough to act on fast
  questions: ClarifyingQuestion[];             // ask-human loop; empty when none
  regenerate_notes: string[];                  // structured notes if handed to the Actor (≡ existing notes_for_actor)
  provenance: { model: string; prompt_hash: string; placement_version: string };
}

interface ClarifyingQuestion {
  id: string;
  question: string;
  assumption_being_tested: string;
  answer?: string;                             // filled by the human; round-trips in AuditRequest.thread
}
```

### 5.5 The ask-human loop
The Director already supports multi-turn tool use in the active-validator pattern (`src/validator-active.ts:85-208`, up to 6 tool-turns calling research tools). Reuse that shape, but swap the research tools for a single `ask_human` tool whose answers come from Ibex instead of an API. Verdict is withheld (light = 🟡 `needs_confirmation`) until questions are answered or explicitly waived.

---

## 6. The full pipeline (behind *generate*)

When Ibex clicks **generate**, the service does **not** tweak — it hands off to the Actor, which runs the whole context-acquisition chain:

```
grounder  →  card  →  generate  →  (back into Director for the verdict)
```

- **grounder** — earns context. In production service mode it keeps the comms-factory reasoning loop but executes repo/web/browser/search work through Centaur's native tool plane (`POST /tools/{tool}/{method}`, with a token scoped to a research tool bundle). Local branch discovery, platform checkout reads, ProjectJin, and browser binaries are explicit dev fallback only.
- **card** — structures the grounded facts into `deployed_facts` (and folds in any captured Q&A facts, §7).
- **generate** — the Actor produces candidates, fully grounded.
- The output re-enters the Director like any other copy. Same judge, same light.

`regenerate_notes` from the failing verdict feed the Actor — this is the existing `notes_for_actor` retry mechanism, just triggered by a human click instead of an auto-loop.

### `/ground` service contract

Production callers should use the versioned capability-aware request shape:

```json
{
  "schema_version": "comms_factory.ground_from_capabilities.v1",
  "mode": "ground_from_capabilities",
  "brief": "Launch Fact A",
  "job_id": "job_123",
  "workflow_run_id": "wf_123",
  "thread_key": "slack:C123:456",
  "requester_user_id": "U123",
  "stage": "ground",
  "gate_version": "pr1",
  "capability_plane": {
    "base_url": "http://api:8000",
    "auth": { "type": "bearer_env", "env": "CENTAUR_TOKEN" }
  }
}
```

The response includes `facts`, `deployed_facts`, `unverifiable`, `evidence`, and
`progress`. Centaur typed errors are model-visible as `UNAVAILABLE:` / `ERROR:`
tool results and never become claim-supporting evidence. If capability config is
missing, `/ground` blocks unless the request supplies sufficient `operator_facts`.

### Residual gap + mitigation
The grounder sees what's *committed somewhere*; Ibex can see what's only *intended* (not yet in any branch). For that sliver, the Q&A-to-card capture (§7) is the bridge: it turns Ibex's head-context into explicit facts before generation, so *click-generate* starts from her context instead of from zero. Without it, generating on truly-uncommitted features yields confidently-grounded-but-incomplete copy — the dangerous case for high-stakes comms.

---

## 7. Q&A-to-card capture bridge  *(locked in)*

When the Director interrogates Ibex on the fact axis, her answers are exactly the facts a machine-generate would otherwise have to cold-ground for. **Capture them into a card at answer time.**

```
Director asks  →  Ibex answers  →  answers persisted as a (draft) ReleaseCard.deployed_facts
                                       │
                                       └─ if Ibex later clicks generate,
                                          the Actor starts from this card (her context), not zero
```

This makes the ask-human loop dual-purpose: verification **and** context acquisition. It is the single mechanism that closes the unshipped-context gap.

---

## 8. Reuse vs new (map for the engineer)

### Reuse — already exists in `comms-factory`
| Thing | Where | Note |
|---|---|---|
| The Director judge | `src/actor-director.ts:285` `auditCandidateWithDirector` | already **blind** — sees prose + card only, never the Actor's table-work |
| Verdict signals | `src/actor-director.ts:189-233` `DirectorAuditResult` | has `copy_voice_passed`, `factual_passed`, `infinex_fit.legal`, `primary_tempo`, `confidence`, `motion_evidence`, `drive_read`, `nearest_allowed_read`, `notes_for_actor` — the 🟢🟡🔴 inputs |
| Director system prompt | `src/actor-memory.ts:176` `buildDirectorMemoryPack`, method block `:302-368`, placement `:345` | placement-rich, product-context-dumb already |
| Regex front door | `src/validator.ts` | brand-agnostic slop, claim contract, em-dash, palettes — runs first, instant 🔴 |
| Claim-contract logic | `src/validator.ts:191-276` | the fact-axis check when a card is present |
| Multi-turn tool loop | `src/validator-active.ts:85-208` | template for the ask-human loop (swap research tools → `ask_human`) |
| Grounder (PR/branch-aware) | `src/fact-grounder-llm.ts`, `src/research-tools.ts`, `src/fact-grounder/sources/*` | the *generate* path's context engine |
| Card schema | `src/card.ts` | `ReleaseCard`, `deployed_facts` — the fact-source + capture target |
| Locked voice spec | `src/voice/infinex.ts` | the yardstick; `mirodan_kernel` :264, `drive_table` :265 |

### New — what the engineer builds
1. **`auditCopy(req: AuditRequest): DirectorVerdict`** — thin entrypoint wrapping the existing Director: accept raw text + optional fact source instead of a `Candidate`; make the fact axis optional/question-driven.
2. **The 🟢🟡🔴 rollup** — map existing signals to the light (§5.3). Pure function, testable in isolation.
3. **`ask_human` tool + thread round-trip** — the verification loop (§5.5).
4. **Q&A-to-card capture** — persist answers as draft `deployed_facts` (§7).
5. **New surfaces** — `modal`, `email` channel grammars (length/register/shape). Placement is constant; surface only affects grammar, not the Laban read. (`tweet`/`web`/`in-product` already exist.)
6. **Transport** — runtime-agnostic; see §10.

---

## 9. Surfaces
Existing: `tweet` (X, ≤280), `web` (≤140), `in-product` (≤80). New: `modal`, `email`. Email is the highest-stakes (security incidents) and the one where the fact axis matters most. A surface entry is just a grammar (length + register + shape) — the judge underneath is unchanged.

---

## 10. Handoff to the on-rails production pipeline

Keep the core **runtime-agnostic**: `auditCopy()` and `generate()` are pure-ish functions behind a thin transport, so they drop into whatever orchestration the engineer chooses. Likely integration points, none load-bearing on the design:

- **HTTP / RPC** — `POST /audit` → `DirectorVerdict`; `POST /generate` → grounded candidates.
- **MCP** — `/audit`, `/generate`, `/validate` tools (the standalone `/audit` is the highest-value tool: it judges hand-written copy, not just generated).
- **Slack** — paste copy in a channel → bot replies 🟢🟡🔴 + notes + questions; this is the natural first production surface and matches the "Slack bot as fast lane" plan.
- **Queue/worker** — *generate* is expensive and async; *audit* is sync and cheap. Split them.

The repo's `src/cli.ts` is the reference for how a non-harness caller drives the stages today.

---

## 11. Phasing

- **Phase 1 — Director Service (MVP, no Actor).** `auditCopy` + 🟢🟡🔴 + regex front door + ask-human loop. Useful day one with generation switched off entirely. Surfaces: start with `tweet` + `modal` + `email`.
- **Phase 2 — Capture bridge.** Q&A-to-card. Makes Phase 3 viable on unshipped features.
- **Phase 3 — Generate button.** Wire `grounder → card → generate` behind the explicit click, re-entering the Director. Reuses the existing pipeline + `notes_for_actor`.

---

## 12. Locked decisions
1. Director judges blind; **never self-grounds**. Asks the human on the fact axis.
2. **Anything generated is always grounded** — *generate* always runs the full pipeline; no cheap ungrounded tweak path.
3. Two axes (voice / fact), headline light = worse of the two; both always reported.
4. Q&A answers are captured into a card.
5. Regex validator is the instant front door, before the Director.
6. 🟢 is never auto-send; human ship gate stays.
7. Director is product-context-dumb but placement-rich.

## 13. Open questions for the engineer
- **Light thresholds** — exact confidence cut for amber-vs-green on the voice axis; needs calibration against real copy (start even, observe, tune — `cadence-by-observation`).
- **Question budget** — cap the ask-human turns (active-validator uses 6) and define the waive-and-proceed path.
- **Card persistence for captured Q&A** — draft cards: where do they live, how long, who promotes a draft to a real release card.
- **Surface grammar source** — do `modal`/`email` grammars live in code or in the brand spec (brand-factory)? Consistent with "comms-factory enforces, doesn't decide visual/voice specs."
- **Runtime** — the on-rails orchestration choice is yours; the design assumes only "sync cheap audit, async expensive generate."

---

*Reference walkthrough of the current coupled implementation: `docs/generation-backend-walkthrough.html`. Per-tweet fact-receipt example: `docs/actor-do-not-say-hyperliquid-spot.html`.*
