# Comms release: first-class multi-channel formats

**Date:** 2026-06-10
**Status:** Draft for review (revised after adversarial review — 24 findings raised, 12 confirmed, all applied)
**Scope:** `overlays/comms-factory/` (Python) **plus one allowlist-only change** to the
comms-factory API route (`attached-services/comms-factory/services/api/routes/generate.ts`).
No base-repo (Centaur `services/`) changes.

## Goal

The comms-factory generator library supports 7 formats (`x`, `x-thread`, `web`,
`carousel`, `modal`, `in-product`, `blog` — `attached-services/comms-factory/src/generator.ts:110`),
but the `comms_release` workflow treats X as the implicit universe: channel selection is
an undocumented `for x, blog:` regex buried in the brief, unknown names pass through
unvalidated, and a multi-channel generation collapses to a **single** shipped string.
Additionally — found in review — the deployed `/generate` **route** gates generation to
only 3 of the 7 library channels, so 4 formats are unreachable regardless of what the
workflow sends.

This change makes all 7 formats first-class in the release flow:

1. Expand the `/generate` route allowlist to the full `Channel` union (one-line TS
   change + route test).
2. Python-side channel registry + validation with friendly errors.
3. Visible channel selection (echo what's generating).
4. Per-channel review at the candidate gate: per-channel Director picks, per-channel
   edit buttons, per-channel publication holds.
5. Per-channel ship output: `final_by_channel` replaces `final_copy` (**no backward
   compat** — `final_copy` has no consumers outside this workflow and its tests).

**Out of scope (deferred):** actual delivery/auto-posting; an interactive Slack
multi-select channel picker gate; structured editing of `x-thread`/`carousel`/`web`
payloads; `comms_audit` changes (its `surface` is free-form on the TS side).

## Verified mechanics this design is built on

These were read from the code, not assumed:

- **The deployed `/generate` route accepts only `x`, `web`, `in-product` today** and
  400s anything else with `unsupported_channels`
  (`attached-services/comms-factory/services/api/routes/generate.ts:8,84-88`). It also
  aliases `tweet`→`x` (line 83) and, when `channels` is omitted, defaults to
  `card.audience` (line 81) — the workflow always sends `channels` explicitly, so the
  card default is not load-bearing here. `CHANNEL_GENERATION_PROFILES`
  (`generator.ts`) covers all 7 union members, so the route allowlist is the **only**
  service-side barrier; lifting it is the one TS change in scope.
- **Director picks are per-channel and FLAT.** The live `/generate` route imports
  `orchestrateActorDirectorWithRetries` (`routes/generate.ts:1`) and returns
  `picks: result.picks` — `Candidate[]`, at most one per channel, with **top-level**
  `id`, `text`, `channel` (no nested `candidate` key)
  (`src/actor-orchestrator.ts:124,131`). The nested `Pick { channel, candidate }` in
  `src/orchestrator.ts:38-42` is a different orchestration path the HTTP route does
  not use — do not consume that shape. Existing Python already reads picks flat
  (`comms_release.py` `picks[0].get("id")` / `.get("text")`), as do the test fixtures.
- **Events are first-write-wins per correlation.** `send_workflow_event` inserts with
  `ON CONFLICT (event_type, correlation_id) DO NOTHING`
  (`services/api/api/workflow_engine.py:2777-2779`), and `wait_for_event` matches
  without consuming (`workflow_engine.py:478-520`). One correlation id can carry
  exactly one logical gate action, ever. Multi-round interaction therefore requires a
  fresh correlation per round — the existing retry path already does this by bumping
  `gate_version` to 2.
- **`target_id` without `per_item` is payload, not correlation.**
  `interactionCorrelationId` only appends `target_id` when `per_item` is set
  (`services/slackbot/src/slack/interactivity.ts`), and `compactRefFromValue` accepts
  `target_id` independently. A `per_item` ref **without** `target_id` is rejected. So:
  buttons that share one round's correlation but identify a channel carry
  `target_id=<channel>` with **no** `per_item` flag.
- **Refs must carry authority metadata.** The base slackbot 400-rejects any ref with
  neither `requester_user_id` nor `approver_user_ids`
  (`interactivity.ts` `missing_interaction_authority`); `compact_ref` only emits them
  from the `Gate`'s requester/approver fields. A `Gate` constructed without them
  produces buttons that silently die — every round's gate must be
  `Gate(ctx.run_id, "candidate", round_n, inp.user_id, approver_user_ids)`.
- **`target_id` grammar fits channel names.** `IDENT_RE = /^[A-Za-z0-9_.:-]{1,128}$/`
  — hyphens in `x-thread` / `in-product` are legal.
- **The edit modal is generic and blank.** `buildGateModalView`
  (`interactivity.ts:332-356`) renders a single multiline `plain_text_input`,
  `max_length: 2500`, **no pre-fill**. The ref's optional `label` field sets the modal
  title (`label.slice(0,24)`) and input label (`label.slice(0,150)`); the overlay's
  `compact_ref` doesn't emit `label` today but the base already parses it. `edit_*`
  and `retry` actions auto-open the modal (`EDIT_ACTION_RE`).
- **The ref rides in the button `value`, not `action_id`.** The slackbot parses the
  compact ref from `value` (`compactRefFromValue`); `action_id` is only
  prefix-guarded. Duplicate action_ids across separate actions blocks in one message
  are proven in production by the facts gate (per-fact blocks all reuse
  `comms:approve_fact` etc.). Per-channel Edit buttons therefore live in **per-channel
  actions blocks** (facts-gate layout), never several in one block.
- **Open modals are immune to message re-renders.** The round ref is frozen into the
  modal's `private_metadata` at open time (`interactivity.ts:340`), and
  `view_submission` always returns 200 (modal closes green) regardless of whether the
  dispatched event was consumed or dropped (`interactivity.ts:192-194`). A stale
  modal's submission is silently lost — see the gate design and Limitations.
- **Button value budget:** compact refs are capped at 1900 bytes (`MAX_REF_BYTES`);
  adding `label` + `target_id` stays far under.

## Design

### 0. `/generate` route allowlist (`attached-services/comms-factory/services/api/routes/generate.ts`)

Expand the route's channel allowlist to the full library union, preserving the
`tweet`→`x` alias:

```ts
const CHANNELS = new Set<Channel>(["x", "x-thread", "web", "carousel", "modal", "in-product", "blog"]);
```

Plus a route test asserting each union member round-trips through `POST /generate`
without `unsupported_channels`. Nothing else in the route changes — the generation
profiles for all 7 channels already exist in the library.

### 1. Channel registry (`workflows/comms_shared.py`)

One Python source of truth, mirroring the TS `Channel` union:

```python
# Mirrors the TS Channel union (generator.ts:110) AND the /generate route allowlist
# (services/api/routes/generate.ts:8) — the route is the contract; if a channel is
# added there, add it here (and vice versa).
GENERATED_CHANNELS = ("x", "x-thread", "web", "carousel", "modal", "in-product", "blog")
# Enumerated in the card audience (card.ts:22) but NOT generated — planning/human-
# adaptation touchpoints only.
PLANNING_ONLY_CHANNELS = ("telegram", "email", "press", "internal")
DEFAULT_CHANNELS = ("x",)
# Aliases the service accepts (routes/generate.ts:83). Applied in normalize_channels
# so briefs that work today keep working.
CHANNEL_ALIASES = {"tweet": "x"}
# Channels whose candidates are structured payloads (thread tweets, carousel slides,
# web card fields). Free-text modal edits cannot round-trip these; they are
# pick-or-retry at the candidate gate this phase.
STRUCTURED_CHANNELS = ("x-thread", "carousel", "web")

def normalize_channels(raw: Iterable[str]) -> tuple[list[str], list[str], list[str]]:
    """(generated, planning_only, unknown) — lower-cased, alias-mapped, deduped,
    order-preserving."""
```

`tools/comms_factory/client.py` cannot import workflow modules (separate plugin
loaders), so its `channels or ["x"]` default stays as a literal — but gains a comment
pointing at `GENERATED_CHANNELS` and `routes/generate.ts:8`, and its docstring
documents the valid set. The `audit(surface="tweet")` default likewise gets a
documenting comment (the TS `/audit` accepts free-form surfaces; no behavior change).

### 2. Channel resolution & validation (`workflows/comms_release.py`)

At the top of `handler`, replacing `channels = inp.channels or _parse_channels(brief) or ["x"]`:

- Resolve: `inp.channels or _parse_channels(brief) or list(DEFAULT_CHANNELS)`, then
  `normalize_channels` (which applies `CHANNEL_ALIASES`, so `for tweet:` briefs keep
  working and arrive as `x`).
- **Unknown names block before any tool call** with a teaching message:
  > *Comms release blocked: unknown format(s): `tiktok`. Valid formats: x, x-thread,
  > web, carousel, modal, in-product, blog.*
  Return `{"status": "blocked", "stage": "channels", "error": "unknown_channels",
  "unknown_channels": [...]}`.
- **Planning-only names are dropped with a note**, not an error:
  > *Note: `email`, `press` are planning-only touchpoints — not auto-generated; they
  > remain on the release card for human adaptation.*
  If dropping them leaves nothing, fall back to `DEFAULT_CHANNELS` and say so.
- **Echo the selection** before grounding: *"Generating for: x, blog, carousel"*. The
  grounding message merges into this (one Slack message: selection + "Grounding comms
  facts…").

`_parse_channels` keeps its `for a, b, c:` syntax (now validated downstream), and the
echo makes the implicit default visible — an operator who never knew about channels
sees `Generating for: x` and a hint line listing the other formats.

### 3. Per-channel candidate gate (round-based)

Replaces the single-shot candidate gate + bolt-on retry gate with one loop. Each
**round** is a fresh `Gate(ctx.run_id, "candidate", round_n, inp.user_id,
approver_user_ids)` — `gate_version` is the round counter (the existing retry already
shipped version 2; this generalizes it). The requester/approver args are mandatory:
omit them and the base slackbot rejects every click with
`missing_interaction_authority` and the buttons silently die.

**State:** `final_by_channel: dict[str, dict]` seeded from the Director's per-channel
picks: for each requested channel, the first pick whose top-level `channel` matches —
seeding `text = pick.get("text")`, `candidate_id = pick.get("id")`, no nested
`.candidate` digging (picks are flat; see verified mechanics). Fallback: first
candidate of that channel. A channel with no candidates in any round is recorded as
**missing**. Each entry: `{"text": str, "candidate_id": str | None, "edited": bool}`.

**Render per round** (one gate message, updated in place after round 1):

- One section per channel: `*blog*  ⭐ Director's pick` (star only when the pick is
  the Director's, not an operator edit), the verdict line (`_verdict_line`), any
  Director issues, and the current copy **chunked across as many section blocks as
  needed** (~2900 chars per block on a line boundary; Slack's hard cap is 3000 — a
  max-length 3600-char blog needs two blocks), so the full copy of any channel is
  always readable in the gate.
- A channel with no candidates renders as `*carousel* — ⚠️ no candidates generated`
  and is excluded from ship.
- Per-channel actions: each **plain-text** channel (`x`, `modal`, `in-product`,
  `blog`) gets its own one-button actions block —
  `("Edit <channel>", "edit_candidate", None, <channel>)` with ref
  `label=f"r{round_n} · Edit {channel}"` (round-stamped so a stale open modal is
  self-identifying; the round number survives the modal title's 24-char truncation).
  Structured channels get no edit button (pick-or-retry). Requires adding optional
  `label` pass-through to the overlay's `compact_ref`/`button`/`actions_block`
  helpers (base already parses it). Per-channel buttons live in separate actions
  blocks (facts-gate layout precedent).
- Global actions block:
  - `("Mark ready", "approve", "primary")`
  - `("Retry", "retry", None)` — only while `attempts < 2` (parity with today's
    one-retry budget; a *failed* retry does not consume the budget, see step 5).
  - `("Abandon", "abandon", "danger")`
- After each consumed round, the re-render includes an audit line:
  *"Round N consumed: `<action>` by @user. Any round-N edit modal submitted after
  this was NOT applied — re-open Edit to re-apply."*

**Loop** (bounded, `for round_n in range(1, 31)` mirroring the facts gate's bound):

1. Wait `wait_for_gate_action(ctx, f"wait_candidate_gate_r{round_n}", gate,
   {"approve", "edit_candidate", "retry", "abandon"})` — gate-level correlation, so
   the first click of the round wins. The re-render replaces *buttons* with
   next-round refs (except on the final exit, which renders terminal state); an
   already-open edit modal, however, keeps its round-N ref frozen in
   `private_metadata` — its later submission hits the consumed correlation, is
   dropped by `ON CONFLICT DO NOTHING` without waking the run, and the base slackbot
   closes the modal as success. The round-stamped labels and audit line mitigate.
2. `approve` → mark the gate message terminal (buttons removed; footer: *"Candidate
   gate completed."* — same `_mark_gate` semantics as today's
   `comms_release.py:388-390`), exit loop, ship. If every requested channel is
   missing/empty, mark terminal with footer *"No shippable channels."* instead and
   return the `no_shippable_channels` blocked result (§4).
3. `abandon` → mark terminal, return abandoned (payload includes `final_by_channel`,
   see §4).
4. `edit_candidate` → channel = `ref.target_id`; warn in the gate message if it's
   unknown/structured/missing (defensive — shouldn't happen via the buttons). If
   `extract_modal_value` returns empty (Slack's required-input check passes
   whitespace-only; the base slackbot trims it away), treat the edit as a **no-op**:
   keep the channel's existing entry and add a warning line — *"Edit for <channel>
   was empty — previous copy kept."* Do **not** follow the facts gate's
   `missing_edit_value` precedent (`GateValidationError`) here: inside this loop that
   path returns `rejected` and discards all accumulated edits; empty input is
   operator-recoverable and must never terminate the run. Otherwise
   `final_by_channel[channel] = {"text": modal_value, "candidate_id": None,
   "edited": True}`. In all cases re-render and continue.
5. `retry` → modal value is feedback; re-call `generate` (step name
   `f"generate_candidates_r{round_n}"` — round-scoped, NOT a fixed
   `generate_candidates_attempt_2`: a failed retry doesn't consume the budget, so a
   later retry must be a fresh durable step rather than replaying the cached failed
   checkpoint; one action per round guarantees uniqueness. The initial generation
   keeps its existing `generate_candidates_attempt_1` name. Envelope `gate_version`
   = round) for **all** requested channels. **If the retry call fails** (`_generation_result_error`
   truthy — transient 5xx, missing payload), the run does NOT terminate: append the
   failure summary to the gate message (*"Retry failed: <error> — keeping previous
   copy"*), leave `candidates` and `final_by_channel` unchanged, do not consume the
   retry budget (no new copy arrived; the round cap bounds repeated failures), and
   continue. **If the retry succeeds**, rebuild candidates and re-seed
   `final_by_channel` from the new picks — operator edits made before the retry are
   discarded (the retry asked for new copy; the render makes this visible) — except
   that a channel yielding zero new candidates **retains its previous entry**,
   annotated *"(kept from previous round — retry produced no <channel> candidates)"*;
   "missing" is reserved for channels that have never had a candidate in any round.
   Re-render, continue.
6. Re-render rule for steps 4/5: if round `n+1` is within the loop bound, render
   next-round buttons; on the final round, render the terminal state (buttons
   removed, footer: *"Candidate gate limit reached (30 rounds)."*) — never render
   buttons for a round nothing will wait on.
7. Loop exhaustion → the final iteration already rendered the terminal state; return
   the `candidate_gate_limit` blocked result (§4).

**Invariant:** every loop exit (approve, abandon, `no_shippable_channels`,
`candidate_gate_limit`, `GateValidationError`) leaves the gate message in a terminal
buttonless state naming the outcome — a rendered actions block must always have a
`wait_for_gate_action` that will consume its correlation.

`GateValidationError` handling is unchanged (mark gate, return rejected) — it is
raised only by `validate_gate_event` (wrong run/stage/version/action/user), never for
empty or malformed modal values inside the loop.

**Concurrency note:** gates carry `approver_user_ids`, so concurrent multi-operator
editing is a supported configuration. One action per round serializes them; raced
clicks lose to first-write-wins and stale modal submissions are dropped (see
Limitations). Per-channel `per_item` correlations would remove cross-channel edit
collisions within a round but require a multi-correlation wait design in the engine —
deferred.

### 4. Ship: per-channel output

- Ship message — **not** posted via `_post_simple` (single 2900-char `markdown_block`
  would silently ellipsize a multi-channel ship). Built as a block list: one header
  line, then per channel a `*<channel>*` section (with `(edited)` marker where
  applicable) followed by the copy chunked across as many section blocks as needed,
  then that channel's publication holds (`_publication_holds`, resolved via the
  channel's chosen candidate). Missing channels get a `⚠️ <channel>: no candidates
  generated` line. A trailing context block notes that the canonical untruncated copy
  lives in the workflow result's `final_by_channel`.

  ```
  *Ready to ship in Slack (no external posting performed)*

  *x*
  <copy>

  *blog* (edited)
  <copy…>
  <…copy>

  ⚠️ carousel: no candidates generated
  ```

- Return value (workflow result):

  ```python
  {
      "status": "ready_to_ship",
      "channels": channels,                      # requested
      "final_by_channel": final_by_channel,      # {channel: {text, candidate_id, edited}}
      "missing_channels": [...],                 # requested but never had a candidate
      "facts": approved_facts,
      "card": card,
      "candidates": candidates,
      "no_external_posting": True,
  }
  ```

- `final_copy` and the `missing_final_copy` path are **removed**. The blocked
  equivalent: if *every* requested channel is missing/empty at approve time, return
  `{"status": "blocked", "stage": "candidate", "error": "no_shippable_channels", ...}`.
- **Every terminal payload returned from inside the candidate loop**
  (`candidate_gate_limit`, `no_shippable_channels`, abandoned/rejected at the
  candidate gate) includes the current `final_by_channel`, `missing_channels`,
  `channels`, `facts`, `card`, and `candidates` — operator edits are always present
  in the durable workflow result.
- `_director_pick_text`, `_candidate_for_text`, `_first_candidate_text` are replaced
  by per-channel equivalents (`_seed_final_by_channel`, `_candidate_by_id`).

### 5. Tests

TS route (`attached-services/comms-factory`):

- Each `GENERATED_CHANNELS` member is accepted by `POST /generate` (no
  `unsupported_channels`); `tweet` still aliases to `x`.

Python (`tests/test_comms_workflows.py`, client tests):

- `normalize_channels`: case/dupe/order, alias mapping (`tweet`→`x`), unknown split,
  planning-only split.
- `compact_ref` label pass-through: a ref built with `label="r1 · Edit blog"` emits
  the label key; a ref without `label` omits it — mirroring the existing per-field
  ref tests (`tests/test_comms_workflows.py:67-101`), since the base modal silently
  falls back to "Edit" if the field is dropped.
- Round-gate button refs carry `requester_user_id`/`approver_user_ids` (guards the
  base slackbot's `missing_interaction_authority` rejection — silent dead buttons).
- Workflow: unknown channel blocks at `stage="channels"` before any tool call;
  planning-only-only brief falls back to default with note; multi-channel happy path
  ships `final_by_channel` with all channels — **the generate fixture mirrors the
  real route response shape** (top-level `candidates` plus flat `picks` with
  top-level `id`/`text`/`channel`), not the legacy `orchestrator.ts` `Pick` type;
  `Edit blog` round updates only blog and `Mark ready` ships the edit; empty edit
  submission is a no-op that keeps previous copy; structured channel renders without
  an edit button; successful retry re-seeds picks and discards prior edits, except
  channels with zero new candidates retain previous entries; failed retry keeps all
  state and does not consume the retry budget; channel with no candidates lands in
  `missing_channels`; all-channels-missing blocks with `no_shippable_channels`;
  round-loop exhaustion blocks with `candidate_gate_limit`; exhaustion,
  `no_shippable_channels`, and abandon results all carry
  `final_by_channel`/`missing_channels`; every exit path leaves the gate message
  terminal with no actions block.
- Existing tests asserting `final_copy` / `missing_final_copy` are updated to the new
  result shape.
- Client: `generate()` with no channels still posts `["x"]`.

## Limitations (accepted this phase)

- **Modal edits cap at 2500 chars** (base Slack input) and the modal is not
  pre-filled, so editing means rewriting, not read-modify-paste; for long blog copy
  use Retry-with-feedback. Gate and ship messages chunk copy across multiple section
  blocks so full text is always visible in Slack; `final_by_channel` in the workflow
  result is the canonical untruncated copy.
- **Structured channels are pick-or-retry** — no free-text editing of thread/carousel/
  web payloads until a structured editor exists (delivery phase).
- **One action per round; stale modal submissions are silently dropped with success
  feedback.** A modal opened against round N stays valid-looking after the round
  advances (re-renders cannot reach open modals); submitting it closes the modal
  green while the edit is discarded (base `view_submission` behavior, not fixable
  from the overlay). Mitigated by round-stamped modal labels and the per-round audit
  line in the re-render.
- **An operator edit invalidates the TS-side audit** for that channel — the shipped
  text is operator-owned; the ship message marks it `(edited)` and omits the
  Director star.

## Risks

- **The route allowlist change exposes 4 previously unreachable channels** to any
  caller of the comms-factory service. The service still requires an approved
  ReleaseCard with deployed facts, and the workflow's human gates are unchanged; no
  auto-posting exists for any channel.
- **Round-versioned gates reuse `gate_version` semantics** — envelopes sent to the TS
  service during retry carry the round number, same as today's retry carrying 2. The
  TS service treats it as an opaque idempotency component.
- **Drift between `GENERATED_CHANNELS` and the route allowlist** — mitigated by
  pointed comments on both sides (the route, not the library union, is the contract)
  and the route round-trip test; a hard sync (shared JSON, codegen) is deliberately
  YAGNI'd.
- **Blast radius**: overlay Python + one TS route constant + tests; the base
  slackbot, Centaur API, and generation library are untouched.
