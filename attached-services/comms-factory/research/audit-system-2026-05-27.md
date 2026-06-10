# Actor/Director system audit — 2026-05-27 (Pass 1, code/architecture lens)

Card under review: `01KS6QJNEGFYP6X048V8Y900DM` (Bridge.xyz virtual accounts release).
Run artifact: `research/actor-run-review-01KS6QJNEGFYP6X048V8Y900DM.html`.

## 1. Headline verdict

The pipeline shape is roughly right and the Actor/Director split is real, but the implementation is muddled at three load-bearing seams: (a) only 1 of 5 actor performances per channel survives into the harness DB and UI, so the operator can't see or pick from the rejected pool the system literally produces; (b) the Director is a single LLM call that asserts a tempo + drive + legality verdict + factual + publication audit in one JSON, which is structurally indistinguishable from "one model writes AND audits its own output" that CLAUDE.md says is the failure mode; (c) the harness still wires the legacy two-call path as default and only flips to Actor/Director under an env var, so the runtime "what is the pipeline" question depends on `HARNESS_GENERATOR_ARCH`. This is close, but it is not commercial-ready and it is not clean. Ship it as a research harness; do not ship it as a Slack bot.

## 2. Call graph — "run generator" for card 01KS6QJNEGFYP6X048V8Y900DM

Trigger: GenerateControls button → server action `runGenerator()`.

1. **`harness/components/GenerateControls.tsx`** posts to `runGenerator(card_id, channels, opts)`.
2. **`harness/app/actions/generate.ts:53` `runGenerator`** loads card, default-fills channels from `expectedChannelsForCard`, then branches on `process.env.HARNESS_GENERATOR_ARCH`. If `=== 'actor'` it dispatches to `runActorGenerator`. Otherwise it dispatches per-channel `generateForChannel` (legacy two-call + LLM "active validator" path). **Default is NOT actor.**
3. **`generate.ts:536` `runActorGenerator`** loads release card, builds voice via `voiceSpecFor`, parses `HARNESS_ACTOR_WARMUP` (defaults `scene_rehearsal`), allocates a runId, ensures `actor_run_events` table exists, then calls `orchestrateActorDirectorWithRetries(releaseCard, channels, …)` with `onEvent` sink that writes one row per event into `actor_run_events`.
4. **`src/actor-orchestrator.ts:83` `orchestrateActorDirectorWithRetries`** runs the attempt loop (`maxAttempts=3`). For each attempt:
   1. Calls `generateActorAttempt(card, opts)` (`src/actor-director.ts:228`) — single Anthropic Opus call with system = `buildActorMemoryPack(voice).system_prompt` (~6KB of source-indexed Mirodan vocab + Infinex placement) and one user message = `buildActorAssignmentMessage(card, channels, n, warmupMode)` (`src/actor-director.ts:300`). Asks for warm-up + table_work + `n` performances per channel + `selected_performances`. Response parsed by `parseActorOutput` into a JSON tree.
   2. `actorOutputToCandidates(output, channels, "anthropic")` (`src/actor-director.ts:569`) — **THIS IS THE FIRST LOSS POINT**. For each channel it picks `performances[selectedOption-1]` and returns one `Candidate`. The other 4 options per channel die here. They survive only inside `actor.output.performances` / `actor.raw_response`, which is written to the `actor_attempts` row as a dump, never rendered to the operator as candidate cards.
   3. For each surviving (1-per-channel) candidate: `validateCandidate(candidate, card, voice)` (`src/actor-orchestrator.ts:242`). This calls `validate(candidate.text, …)` from `src/validator.ts` (regex slop + off-spec drive + claim tripwires + beat audit), and then `validateActorMovement(candidate)` (`src/actor-orchestrator.ts:265`) which enforces movement_score / movement_receipt / Working Action / preparation-hierarchy receipts.
   4. If the script validator passes, the candidate is sent to `auditCandidateWithDirector` (`src/actor-director.ts:265`). This is a single Anthropic Sonnet call with system = `buildDirectorMemoryPack(voice).system_prompt` and user = `buildDirectorUserMessage(opts)`. The Director returns one JSON blob: `passed`, `primary_tempo`, `primary_confidence`, `tempo_basis`, `motion_evidence`, `working_actions`, `drive_read`, `placement_read`, `infinex_fit`, `factual_issues`, `publication_gate_issues`, `voice_issues`, `notes_for_actor`. Parsed by `parseDirectorAudit`.
   5. `pickFirstPassingByChannel` (`actor-orchestrator.ts:366`) — picks the per-channel candidate where `script.passed && director.passed && director.infinex_fit.legal`. If any channel missed, `summarizeDirectorNotes` concatenates the director's failure prose into a string blob and the next attempt starts with that string blob appended as a `user` message to the actor transcript via `buildDirectorNotesMessage`.
5. **`generate.ts:588` `persistActorDirectorResult`** writes one `actor_attempts` row per attempt (with prompts, transcript, table_work, warmup), then one `candidates` row per channel (the selected favorite), then one `director_audits` row per audited candidate. Returns the inserted candidates grouped by channel.
6. **`harness/app/cards/[id]/page.tsx`** re-renders, showing AttemptPanel → CandidateCard per persisted candidate. The 4 unselected performances per channel are invisible in this UI.

## 3. Findings — ordered by severity

### BLOCKER-1 — The rejected pool is invisible to the harness

**What:** `actorOutputToCandidates` (`src/actor-director.ts:569-606`) returns exactly one `Candidate` per channel — the actor's self-selected favorite via `selected_performances[channel].selected_option`. The other 4 options sit in `output.performances[channel]` and are persisted only inside `actor_attempts.actor_response_json` as raw JSON. `CandidateCard.tsx` is never asked to render them.

**Where:** `src/actor-director.ts:577-583`, then `harness/app/actions/generate.ts:640-712` (persist), then `harness/app/cards/[id]/page.tsx` (display).

**Why it's wrong:** The whole point of generating N performances is the operator audits the *pool*. If the actor self-selects (an LLM picking its own favorite from its own output) and only that one survives to the Director and to the harness, the validator is calibrating against the actor's taste, not the actor's range. CLAUDE.md's pipeline contract says "filter → rank → shape to channel" and "rejected pool" is a named output of the orchestrator. The current pipeline returns one Pick per channel and silently destroys the rejected pool. Operator agreement metrics measured on the selected option only are not measuring the system — they're measuring the actor's selection heuristic.

**What to do:** Persist all N performances per channel as `candidates` rows (with `selected_by_actor: boolean` flag), run the Director against all of them (or at least all script-passing ones), and surface all of them in the harness UI grouped by actor-selected vs actor-rejected. This is a one-day rewrite: change `actorOutputToCandidates` to return the whole array, propagate through orchestrator, persist all, render all. Director cost goes 5x per attempt; that's fine — that's what overnight is for.

### BLOCKER-2 — Director conflates draft-validity, publication-gating, and voice-fit into one verdict

**What:** The Director returns a single `passed: boolean` that the orchestrator collapses with `passed && infinex_fit.legal` (`actor-orchestrator.ts:372-374`). The Director's JSON does separate `factual_issues`, `publication_gate_issues`, and `voice_issues` (good!), and the system prompt in `actor-memory.ts:319-320` does say "Keep copy validity separate from publication readiness… code/live-state confirmation belongs in `publication_gate_issues`, not in `factual_issues`." But the orchestrator's gate doesn't honor that split — `passed` is the global verdict, and any rejection collapses into "failed for this channel" and feeds the actor a feedback loop that mixes voice notes, publication notes, and factual notes into one prose blob (`summarizeDirectorNotes`, `actor-orchestrator.ts:380-414`).

Evidence from the run: attempt 2 web — Director marked `infinex_fit.legal=true`, `primary_tempo=commanding` (a primary allowed tempo), no Passion drift, no factual error in what was stated — and STILL rejected the candidate with `passed: false` because of a voice nitpick about needing a second Vision sentence + a factual-timing concern ("if code isn't in platform, change to 'will live'"). That second concern is textbook `publication_gate_issues`. The first concern is the "Spell → Vision needs a visible Vision second sentence" failure mode CLAUDE.md and `actor-memory.ts:319` explicitly warn against ("Do not prescribe `add a second sentence` as a movement rule"). The Director did it anyway.

**Where:** `src/actor-orchestrator.ts:372-374` (gate logic), `src/actor-director.ts:471-533` (Director user prompt), `actor-memory.ts:302-326` (Director method block).

**Why it's wrong:** A draft is a draft. A draft can be a valid Spell-resting one-liner that needs a follow-on at publication time without that being a failure of the draft. The current code says "draft fails if anything in the audit isn't perfect." So the retry loop optimizes for "the line that survives all three gates simultaneously" rather than "the line that is a valid draft and lets the operator decide publication readiness." This is why the run exhausted 3 attempts on a fundamentally-good first draft.

**What to do:** Three separate verdicts on the Director response: `draft_valid` (no factual contradiction with the release card, no off-character drive, regex clean), `voice_fit` (legal placement, allowed tempo, no Passion surface), `publication_ready` (ship-state confirmed, all code grep matches, no "will live" risk). The orchestrator's retry loop should only retry on `draft_valid === false`. Voice-fit failures should be surfaced to the operator as advisory, not auto-retry. Publication readiness is the human ship gate, not a generator retry signal.

### BLOCKER-3 — Director is one LLM call doing both classification AND legality verdict

**What:** `auditCandidateWithDirector` is one Sonnet call that returns tempo classification + drive read + placement read + legality verdict + voice issues + factual issues + publication issues + notes for actor, all in one JSON.

**Where:** `src/actor-director.ts:265-282` (call site), `src/actor-director.ts:471-533` (prompt), `src/actor-director.ts:636-678` (parse).

**Why it's wrong:** This is the failure mode the validator/generator split was designed to prevent. Classification (Mirodan factor analysis → tempo) is a forensic task. Legality (is this tempo on the Infinex palette? does the drive read = Vision?) is a brand rule lookup. The current design has the same model do both in one pass, which means the legality verdict gets to influence the motion-evidence reasoning. A clean implementation would: (a) classify motion evidence + tempo + drive read deterministically or via a separate forensic call; (b) check legality against the locked `voice.main_tempi` / `voice.off_spec_drives` table in code; (c) emit `voice_issues` only as advisory text from a third pass if needed.

**What to do:** Split into two: `classifyCandidate(text, voice)` returns `{primary_tempo, primary_confidence, motion_evidence, working_actions, drive_read, placement_read}`. Then a deterministic `judgeFit(classification, voice)` returns `{legal: boolean, reason: string, allowed_palette: TempoName[]}` based on table lookup, not LLM judgment. Notes for actor become a third optional call only when fit is illegal. The "passes" flag goes away — it was lying about what it was measuring.

### HIGH-4 — Brand-specific logic has leaked into the validator AND the Director system prompt

**What:** CLAUDE.md says brand-agnostic slop lives in `src/validator.ts`; brand-specific rules live in the generator prompt. Today:
- `rejectVisualSlop` (`validator.ts:170-177`) lists "glassmorphism", "vaporwave", "purple gradient", "futuristic ui" — most of those are visual-vocabulary aesthetic policing, not brand-agnostic copy slop. The comment block explicitly admits these "fight the Spell-Vision drive (Stable + Flow + Penetrating)" — that's a brand-specific rule by self-confession.
- `rejectOffSpecDrive` reads from `voice.off_spec_regexes` which is loaded from `INFINEX_VOICE` by default. The validator IS brand-aware.
- The Director system prompt (`actor-memory.ts:343-368`) hardcodes Infinex placement, drive axis, allowed tempi, off-spec drive, character image, super-objective. The Director will not work for any other brand without re-templating this entire block.

**Where:** `src/validator.ts:170-189`, `src/actor-memory.ts:343-368`.

**Why it's wrong:** Two of the three pieces (`rejectOffSpecDrive` voice-coupling and the Director's Infinex placement block) are arguably fine if you accept that the validator is now voice-parameterized — which is a defensible re-architecture but is not what CLAUDE.md says. The third (`rejectVisualSlop`) is just brand-specific copy taste smuggled into the validator under a "visual" label. Move it to the Infinex generator prompt or the Director's voice rules; do not hardcode "no purple gradient" as a copy-slop rule that any brand would inherit.

**What to do:** Either accept that the validator is now per-voice and update CLAUDE.md to say so, OR strip voice-aware logic out of validator.ts and push it into a separate `src/voice-fit.ts` module that the orchestrator calls explicitly. The current half-state is the worst of both worlds.

### HIGH-5 — Em-dash zero-tolerance regex breaks own actor output

**What:** `rejectAIslop` (`validator.ts:120-138`) sets `EM_DASH_MAX_PER_WINDOW = 0` ("Zero-tolerance per operator 2026-05-25"). Many attempt-2 actor candidates in the run use em-dashes inside the table_work and physical_score fields, and Option 2 in attempt 3 web (`"Your Infinex account is one place — for the money you held at a bank and the money you held on-chain."`) uses one. The actor prompt does NOT tell the actor "no em-dashes." It's a hidden trap.

**Where:** `src/validator.ts:120-138`. Actor assignment message (`actor-director.ts:300-397`) has no em-dash prohibition.

**Why it's wrong:** Constraint asymmetry between generator and validator is exactly the "fight the prompt with the regex" anti-pattern. Either the actor knows the rule (then enforce it in the prompt) or the validator stops being absolutist about it. Zero em-dashes is also probably the wrong rule for Infinex specifically — em-dash density is the AI-slop signal, not em-dash presence. The Karpathy/banker-grammar register the locked character explicitly cites uses em-dashes correctly.

**What to do:** Either move to a density rule (e.g., > 2 em-dashes per 280 chars triggers, matching the original comment), and tell the actor that rule in the prompt; or keep zero-tolerance but bake "no em-dashes" into the actor assignment. Do not enforce silently.

### HIGH-6 — "Tempo leak" in actor candidates is forbidden, but the harness regex auditor still operates on declared tempos

**What:** `validateActorMovement` (`actor-orchestrator.ts:265-273`) fails any candidate whose `declared_beats[].tempo` is set: "Actor must score objective verbs and Working Actions only." Good — that matches the Mirodan-correct doctrine that tempo is emergent from Deciding, not assigned. But: `auditBeats` in `src/validator.ts:590` and `CandidateCard.tsx:103-247` both still expect a `declared_tempo` on each beat to render the per-beat audit pill. The actor-path candidates have `declared_beats` with `working_action` but no `tempo`, so `beat_audit_json` is `[]` and the per-beat pill row in CandidateCard goes silent. Worse, `BeatAudit` interface in CandidateCard still declares `declared_tempo: string` as non-optional.

**Where:** `src/actor-orchestrator.ts:265-273`, `src/validator.ts:590-638`, `harness/components/CandidateCard.tsx:14-22, 230-247`.

**Why it's wrong:** Two layers of the pipeline disagree about whether candidates declare tempo. Actor side: emphatically NO. Validator side: silently ignored when missing. UI side: hardcoded to expect it. The result is the beat-audit UI is dead for actor candidates and the operator can't see beat-level classification at all in actor mode.

**What to do:** Either (a) the Director's per-beat classification gets persisted and rendered as the per-beat pill (proper fix — independent classifier reads what the actor performed), or (b) the deterministic `auditBeats` is fed the actor's declared `working_action` per beat and emits a working-action audit instead of a tempo audit. Current state is silently broken UI.

### HIGH-7 — Actor selection step is an LLM picking its own favorite

**What:** Actor prompt instructs the model to write 5 options AND emit `selected_performances[channel].selected_option` (`actor-director.ts:391`). The orchestrator then takes the actor's pick verbatim as "the candidate for this channel." Director sees only that pick.

**Where:** `src/actor-director.ts:391-393`, `src/actor-director.ts:578-583`.

**Why it's wrong:** This is "one model writes AND audits its own output" sneaking back in through "writes AND selects." If the actor's selection heuristic is off (and in the Bridge run, every actor selection got rejected on first read by the Director), the system can never escape it — the Director never sees option 1, 3, 4, 5 to judge whether the actor picked the right one.

**What to do:** Two options. (1) Drop `selected_performances` from the actor entirely; send all N to the Director, let the Director compare and pick. (2) Keep it but ALWAYS send all options to the Director audit and persist all to harness, treating actor selection as a hint not a gate (relates to BLOCKER-1 fix).

### MEDIUM-8 — Actor memory is mostly a static prompt builder, not a memory loop

**What:** `actor-memory.ts` builds a fixed system prompt from voice + a hardcoded `MIRODAN_24_TEMPI` table + filesystem source index. There is no learning across runs, no "what did the actor remember from yesterday's rejected candidates," no operator-feedback ingestion into the prompt. The Director feedback DOES come back through `buildDirectorNotesMessage`, but that's transcript continuation, not memory.

**Where:** `src/actor-memory.ts` (whole file), `actor-director.ts:284-298` (transcript carry-forward).

**Why it's wrong (qualified):** It's stub-shaped relative to its name. "Memory pack" suggests a stateful actor that gets smarter over a session or across sessions. What's actually there is a static system prompt + version hash + filesystem index for traceability. That's fine for now — but the name is doing rhetorical work the implementation doesn't earn.

**What to do:** Rename to `buildActorSystemPrompt` / `buildDirectorSystemPrompt` and `ActorPromptPack` / `DirectorPromptPack`. Or, if a real memory loop is intended (ingest operator feedback + prior session retries into the prompt), wire it. Don't ship the word "memory" attached to a static prompt.

### MEDIUM-9 — Source index reads files at every actor/director call

**What:** `buildMirodanSourceIndex` (`actor-memory.ts:118-140`) statSyncs and reads all source files on every call. `evidenceAnchor` (`actor-memory.ts:380-394`) re-reads source files to scan for pattern matches on every prompt build.

**Where:** `actor-memory.ts:118-140, 380-394`.

**Why it's wrong:** Each generator+director run does 3+ system-prompt builds × 6 file reads × line-by-line pattern scans. The system prompts are also re-built per attempt despite being voice-stable. This is wasteful but not load-bearing; just bad hygiene that will bite at higher attempt counts.

**What to do:** Memoize per voice. Source index changes only on file content change (which the sha256 already detects).

### MEDIUM-10 — The harness has TWO active validator pathways depending on env

**What:** `runGenerator` (`generate.ts:65-79`) branches on `HARNESS_GENERATOR_ARCH==='actor'` to dispatch to actor/director vs legacy two-call. The legacy path uses `orchestrateActiveWithRetries` (LLM "active validator") OR `orchestrateWithRetries` (regex-only) depending on `HARNESS_ACTIVE_VALIDATOR`. So there are effectively three pipelines in tree (regex-only legacy, LLM-validator legacy, actor/director), with the runtime choice driven by env. The CandidateCard UI tries to render all three shapes — its `interface ActiveAudit` / `interface DirectorAudit` / `interface HistoryGuardAudit` are all checked and laid out as independent sections, with copy like "Director did not run for this candidate. Legacy candidates use regex and optional LLM auditor only."

**Where:** `harness/app/actions/generate.ts:65-79`, `harness/components/CandidateCard.tsx:282-605`.

**Why it's wrong (qualified):** It's the harness, not production, and operator likely uses one path at a time. But the UI is now three-pipelines-coexisting-as-overlays and the operator's mental model of "what is the system" cannot survive that. CLAUDE.md memory `feedback-pipeline-vocabulary.md` literally says "do not surface Stage A/B or active-validator in chat" — the UI does the equivalent of surfacing them.

**What to do:** Pick one. The audit goal is operator agreement on Actor/Director, so commit to Actor/Director as the only path. Mark legacy as deprecated. Strip the dead UI sections. If you need to A/B legacy vs actor for the audit, do it via separate runs not coexisting in the same card view.

### LOW-11 — Actor warm-up has three modes with no clear cadence policy

**What:** `parseActorWarmupMode` accepts `none | daily_pages | scene_rehearsal`. Default is `scene_rehearsal` (per `actor-director.ts:235`) but the actual run for Bridge used `daily_pages` (visible in the artifact HTML, attempt 1 page_1_given_circumstances etc.). Operator sets via `HARNESS_ACTOR_WARMUP` env var. No documentation of when which is preferred.

**Where:** `src/actor-director.ts:76, 235, 696-699`, `harness/app/actions/generate.ts:554`.

**Why it's wrong:** The warm-up is a meaningful prompt-shape choice (first-person scene rehearsal vs daily-pages prose) and the operator has no UI surface to choose. Env var only.

**What to do:** Move warmup_mode into harness UI as part of GenerateControls, default scene_rehearsal, persist per-attempt (already in `actor_attempts.actor_response_json` but not surfaced).

### LOW-12 — Per-channel candidate count `n=5` is hardcoded with no UI surface

**What:** `runActorGenerator` defaults `n = opts.n ?? 5`. GenerateControls has no UI for it. Operator can't easily say "5 options for web, 3 for in-product."

**Where:** `generate.ts:555`, `actor-director.ts:234`.

**What to do:** Surface in GenerateControls if it matters; otherwise constant in code is fine.

## 4. Architectural gaps — implied by CLAUDE.md, not yet built

- **Per-channel rejected pool** (CLAUDE.md pipeline contract: orchestrator emits "per-channel `Pick`s + rejected pool"). Today: rejected pool is discarded by `actorOutputToCandidates`. See BLOCKER-1.
- **Renderer stub gate** (CLAUDE.md says "renderer is a TODO stub in `cli.ts`"). True today; not a flaw, just a status note.
- **Ship gate as a separate human-approval surface** — current "approve" / "edit" / "retry" / "reject" buttons in CandidateCard ARE the ship gate, but the human approval is conflated with the candidate-decision capture for agreement metrics. The two should be separate: candidate-decision = agreement training signal; ship approval = human go/no-go on the final pick. Today they're the same call.
- **Per-rule visibility into the rejected pool**: even when a candidate IS persisted as rejected, the per-rule failure pill row exists but there is no across-candidates view of "which validator rule fires most often across this run." Operator can't calibrate rule strictness without that.
- **Director audit independence guarantee**: The Director prompt says "Do not ask for or rely on the Actor's table work." But the same Anthropic account, same session window, no transcript separation, no model-id difference required — the only thing preventing leakage is a sentence in the prompt. A truly blind reader would be a separate model class or a separate process with explicit context isolation. Today it's prompt-level only.
- **Operator feedback loop into the actor**: `OperatorFeedbackForm` (visible in CandidateCard:444-449 and AttemptPanel:109-114) lets the operator leave text feedback on a director_audit or actor_attempt. There's no code path that feeds that feedback back into the next actor attempt — it's purely an audit-log artifact. CLAUDE.md memory says the harness goal is "≥80% operator agreement before autonomous use," but without the feedback loop closing, agreement can be measured but can't be improved.

## 5. Ranked recommendations

### MUST FIX before another serious run

1. **Persist all N actor performances per channel** (BLOCKER-1). One-day rewrite of `actorOutputToCandidates` + `persistActorDirectorResult` + AttemptPanel. Director should audit all script-passing options or at minimum top-3 by actor preference. Operator must be able to see the rejected pool.
2. **Split Director verdict into draft_valid / voice_fit / publication_ready** (BLOCKER-2). The retry loop should only retry on draft_valid failures. Voice-fit and publication issues are advisory. This is what unblocked attempt 2 web from being accepted as a fine draft.
3. **Decommission the Director's `passed: boolean` field** (BLOCKER-3 + BLOCKER-2 together). Replace with structured outputs the orchestrator can compose. Move legality lookup to deterministic code, not LLM judgment.
4. **Tell the actor about the em-dash zero-tolerance rule** (HIGH-5). Or relax to density. Stop the silent rejection.
5. **Fix beat-audit UI for actor candidates** (HIGH-6). Either render Director's per-beat motion evidence as the pill row, or render working-action audits instead of tempo audits. Current UI is silently broken.
6. **Pick one pipeline for the harness UI** (MEDIUM-10). Either commit to actor/director or run A/B in separate views. The three-pipelines-coexisting overlay is confusing.

### LATER architecture

7. **Real Director blindness** — separate process, ideally separate model class, explicit context isolation.
8. **Operator feedback closes the loop** — `OperatorFeedbackForm` rows need to be ingested into the next actor attempt's system prompt or warm-up.
9. **Actor memory becomes actual memory** (MEDIUM-8) — across-session retention of which framings worked and which the Director rejected; or rename to honestly say "prompt builder."
10. **Per-rule rejection histogram** — operator can't calibrate validator strictness without seeing which rules fire across the whole run pool.
11. **Cache source-index reads** (MEDIUM-9) — memoize per voice.
12. **Move warmup_mode and n into the harness UI** (LOW-11, LOW-12) — not blocking but operator-quality-of-life.

## Side notes (not findings; pass-2 territory if they matter)

- The Director on attempt 2 web rejected a candidate it classified as `commanding` (primary palette) with `infinex_fit.legal=true`, `drive_read=spell`. Reason given: "stops at resting Spell. For the Infinex axis (Spell → Vision) to be readable as a beat, a second sentence must carry the Vision extravert." This contradicts the Director memory's own instruction at `actor-memory.ts:319` ("Do not prescribe `add a second sentence` as a movement rule"). Pass-2 should decide if this is a prompt drift, a model interpretation issue, or a real Mirodan claim. From a code lens: the prompt instruction is in there, the model ignored it. Code is fine; prompt-following is not. Pass-2's call on whether the model was Mirodan-correct.
- The Director classified attempt 3 x as `certain` (Awake outer) and called the placement illegal because "Infinex requires Weight in the baseline (Stable = Weight + Space). This prose carries no Weight pole." Plausible read; can't tell from code lens whether `certain` was actually present. Pass-2.
- Pass-2 will see: a perfectly viable first-attempt x candidate ("Send a wire to your Infinex account. It arrives. / Send a SEPA transfer. It arrives. / The sentence that used to require a bank now describes a wallet.") got rejected as `self-contained` (`Light + Direct`). Whether that's a fair forensic read or the Director just overcorrecting on parallel-repetition pattern is a copy/canon call.
