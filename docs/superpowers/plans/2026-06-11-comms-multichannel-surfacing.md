# Comms Multi-Channel Surfacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all 7 comms-factory formats first-class in the `comms_release` workflow: channel validation with friendly errors, a round-based per-channel candidate gate with per-channel edit buttons, and per-channel ship output (`final_by_channel` replaces `final_copy`, no backward compat).

**Architecture:** One TS change (expand the `/generate` route allowlist from 3→7 channels) plus overlay-Python changes: a channel registry in `comms_shared.py`, channel resolution/validation in `comms_release.py`, and a rewrite of the single-shot candidate gate into a bounded round loop (`gate_version` = round number — the workflow-engine event table is first-write-wins per correlation, so each interactive round needs a fresh correlation). Everything else (gates, durable steps, Slack rendering) reuses existing machinery.

**Tech Stack:** TypeScript + vitest (`attached-services/comms-factory`, own toolchain — excluded from root ruff); Python 3.11 + pytest via `uv` (overlay workflows); Slack Block Kit via the existing `comms_shared` helpers.

**Spec:** `docs/superpowers/specs/2026-06-10-comms-multichannel-release-design.md` (adversarially reviewed; read it before starting). Key verified mechanics the code must respect:
- Events are first-write-wins per `(event_type, correlation_id)` (`services/api/api/workflow_engine.py` `ON CONFLICT … DO NOTHING`) → one gate action per correlation, ever.
- A compact ref with `per_item` but no `target_id` is **rejected** by the slackbot; `target_id` **without** `per_item` rides along as payload without changing the correlation — that's how edit buttons carry their channel.
- Refs missing both `requester_user_id` and `approver_user_ids` are rejected (`missing_interaction_authority`) → every `Gate(...)` must pass `inp.user_id, approver_user_ids`.
- The base edit modal is blank (no pre-fill), `max_length: 2500`; the ref's `label` field (already parsed by the base slackbot) sets the modal title/input label.
- The live `/generate` route returns **flat** picks: `Candidate[]` with top-level `id`/`text`/`channel` (NOT the nested `Pick {channel, candidate}` from `src/orchestrator.ts` — that module is not the HTTP path).
- Duplicate `action_id`s across *separate* actions blocks in one message are proven in production (facts gate); per-channel Edit buttons therefore each get their own actions block.

**Branch:** create `feat/comms-multichannel-surfacing` off the current branch HEAD before Task 1.

---

## File structure

| File | Responsibility |
|---|---|
| `attached-services/comms-factory/services/api/routes/generate.ts` | MODIFY — allowlist 3→7, export `CHANNELS`/`normalizeChannels` for tests |
| `attached-services/comms-factory/services/api/routes/generate.channels.test.ts` | CREATE — unit tests for the allowlist + alias + errors |
| `overlays/comms-factory/workflows/comms_shared.py` | MODIFY — channel registry + `normalize_channels`; `label` pass-through in `compact_ref`/`button`/`actions_block`; `chunked_markdown_blocks` |
| `overlays/comms-factory/workflows/comms_release.py` | MODIFY — channel resolution; round-based per-channel candidate gate; per-channel ship; delete `final_copy` helpers |
| `overlays/comms-factory/tools/comms_factory/client.py` | MODIFY — comments documenting the X default + pointer to the registry/route |
| `overlays/comms-factory/tests/test_comms_workflows.py` | MODIFY — new unit + workflow tests; update legacy `final_copy` tests |

Run commands used throughout:
- TS: `cd attached-services/comms-factory && pnpm test` (vitest; single file: `pnpm exec vitest run services/api/routes/generate.channels.test.ts`) and `pnpm typecheck`
- Python: from repo root, `uv run pytest overlays/comms-factory/tests/test_comms_workflows.py -v` (single test: append `::test_name`); lint `uv run ruff check overlays/comms-factory && uv run ruff format overlays/comms-factory`

---

### Task 1: Expand the `/generate` route allowlist to the full Channel union

**Files:**
- Modify: `attached-services/comms-factory/services/api/routes/generate.ts:8` (and `:81` for the export)
- Create: `attached-services/comms-factory/services/api/routes/generate.channels.test.ts`

The deployed route currently hard-rejects 4 of the 7 library channels:
```ts
const CHANNELS = new Set(["x", "web", "in-product"]);   // line 8 today
```
`CHANNEL_GENERATION_PROFILES` in `src/generator.ts` already covers all 7, so the allowlist is the only barrier. The `tweet`→`x` alias at `generate.ts:84` must be preserved.

- [ ] **Step 1: Write the failing test**

Create `attached-services/comms-factory/services/api/routes/generate.channels.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ReleaseCard } from "../../../src/card.js";
import { HttpError } from "../http.js";
import { CHANNELS, normalizeChannels } from "./generate.js";

// normalizeChannels only reads card.audience when the value is undefined.
const card = { audience: ["x"] } as unknown as ReleaseCard;

describe("generate route channel allowlist", () => {
  it("accepts every generator-library channel", () => {
    const all = ["x", "x-thread", "web", "carousel", "modal", "in-product", "blog"];
    expect(normalizeChannels(all, card)).toEqual(all);
    for (const channel of all) expect(CHANNELS.has(channel)).toBe(true);
  });

  it("preserves the tweet→x alias", () => {
    expect(normalizeChannels(["tweet"], card)).toEqual(["x"]);
  });

  it("dedupes while preserving order", () => {
    expect(normalizeChannels(["blog", "x", "blog", "tweet"], card)).toEqual(["blog", "x"]);
  });

  it("rejects unknown channels with unsupported_channels", () => {
    try {
      normalizeChannels(["tiktok"], card);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(400);
      expect((err as HttpError).code).toBe("unsupported_channels");
    }
  });

  it("rejects an empty channel list with missing_channels", () => {
    try {
      normalizeChannels([], card);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as HttpError).code).toBe("missing_channels");
    }
  });
});
```

Note: check `HttpError`'s field name for the error code in `services/api/http.ts` before running — if the constructor stores it as something other than `.code` (e.g. `.reason`), adjust the two assertions to match the actual field.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd attached-services/comms-factory && pnpm exec vitest run services/api/routes/generate.channels.test.ts`
Expected: FAIL — `generate.js` has no exported member `CHANNELS` / `normalizeChannels`, and after exporting, the "accepts every channel" case fails on `x-thread`/`carousel`/`modal`/`blog`.

- [ ] **Step 3: Implement**

In `attached-services/comms-factory/services/api/routes/generate.ts`, change line 8:

```ts
// The route-level generation contract. Mirrors the full Channel union
// (src/generator.ts) — CHANNEL_GENERATION_PROFILES covers every member, so the
// allowlist exists only to 400 typos early. Mirrored Python-side as
// GENERATED_CHANNELS in overlays/comms-factory/workflows/comms_shared.py.
export const CHANNELS = new Set<string>([
  "x",
  "x-thread",
  "web",
  "carousel",
  "modal",
  "in-product",
  "blog",
]);
```

and export the normalizer (line 81): change `function normalizeChannels(` to `export function normalizeChannels(`. No other logic changes — the alias and error paths stay as they are.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd attached-services/comms-factory && pnpm exec vitest run services/api/routes/generate.channels.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full TS suite + typecheck**

Run: `cd attached-services/comms-factory && pnpm test && pnpm typecheck`
Expected: all green (the existing suite must not regress — `server.test.ts` exercises the routes).

- [ ] **Step 6: Commit**

```bash
git add attached-services/comms-factory/services/api/routes/generate.ts \
        attached-services/comms-factory/services/api/routes/generate.channels.test.ts
git commit -m "feat(comms-factory): open /generate route to the full 7-channel union"
```

---

### Task 2: Channel registry + `normalize_channels` in `comms_shared.py`

**Files:**
- Modify: `overlays/comms-factory/workflows/comms_shared.py` (add after the `EVENT_TYPE = "comms.action"` constant, line 11)
- Test: `overlays/comms-factory/tests/test_comms_workflows.py`

- [ ] **Step 1: Write the failing tests**

Add to `overlays/comms-factory/tests/test_comms_workflows.py` (top-level, after the existing imports; extend the `from comms_shared import (...)` block with `GENERATED_CHANNELS, PLANNING_ONLY_CHANNELS, STRUCTURED_CHANNELS, normalize_channels`):

```python
def test_normalize_channels_passes_known_channels_in_order():
    generated, planning, unknown = normalize_channels(["Blog", "x", "x-thread"])
    assert generated == ["blog", "x", "x-thread"]
    assert planning == []
    assert unknown == []


def test_normalize_channels_applies_aliases_and_dedupes():
    generated, planning, unknown = normalize_channels(["tweet", "x", "TWEET", "blog"])
    assert generated == ["x", "blog"]
    assert planning == []
    assert unknown == []


def test_normalize_channels_splits_planning_only_and_unknown():
    generated, planning, unknown = normalize_channels(["email", "tiktok", "x", "press"])
    assert generated == ["x"]
    assert planning == ["email", "press"]
    assert unknown == ["tiktok"]


def test_channel_registry_shape():
    assert GENERATED_CHANNELS == (
        "x", "x-thread", "web", "carousel", "modal", "in-product", "blog"
    )
    assert set(STRUCTURED_CHANNELS) <= set(GENERATED_CHANNELS)
    assert set(PLANNING_ONLY_CHANNELS).isdisjoint(GENERATED_CHANNELS)
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest overlays/comms-factory/tests/test_comms_workflows.py -k normalize_channels -v`
Expected: ImportError (`cannot import name 'normalize_channels'`).

- [ ] **Step 3: Implement in `comms_shared.py`** (after line 11)

```python
# Mirrors the TS Channel union (src/generator.ts) AND the /generate route
# allowlist (services/api/routes/generate.ts CHANNELS) — the route is the
# contract; if a channel is added there, add it here (and vice versa).
GENERATED_CHANNELS = ("x", "x-thread", "web", "carousel", "modal", "in-product", "blog")
# Enumerated in the card audience (card.ts Audience) but NOT generated —
# planning / human-adaptation touchpoints only.
PLANNING_ONLY_CHANNELS = ("telegram", "email", "press", "internal")
DEFAULT_CHANNELS = ("x",)
# Aliases the service accepts (routes/generate.ts maps tweet→x). Applied here
# so briefs that work today keep working.
CHANNEL_ALIASES = {"tweet": "x"}
# Channels whose candidates are structured payloads (thread tweets, carousel
# slides, web card fields). Free-text modal edits cannot round-trip these;
# they are pick-or-retry at the candidate gate.
STRUCTURED_CHANNELS = ("x-thread", "carousel", "web")


def normalize_channels(raw: Iterable[str]) -> tuple[list[str], list[str], list[str]]:
    """Split requested channel names into (generated, planning_only, unknown).

    Lower-cases, applies CHANNEL_ALIASES, dedupes, preserves first-seen order.
    """
    generated: list[str] = []
    planning: list[str] = []
    unknown: list[str] = []
    seen: set[str] = set()
    for item in raw:
        name = CHANNEL_ALIASES.get(str(item).strip().lower(), str(item).strip().lower())
        if not name or name in seen:
            continue
        seen.add(name)
        if name in GENERATED_CHANNELS:
            generated.append(name)
        elif name in PLANNING_ONLY_CHANNELS:
            planning.append(name)
        else:
            unknown.append(name)
    return generated, planning, unknown
```

(`Iterable` is already imported in `comms_shared.py` — verify; if not, extend the existing `typing`/`collections.abc` import.)

- [ ] **Step 4: Run to verify pass**

Run: `uv run pytest overlays/comms-factory/tests/test_comms_workflows.py -k "normalize_channels or channel_registry" -v`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add overlays/comms-factory/workflows/comms_shared.py overlays/comms-factory/tests/test_comms_workflows.py
git commit -m "feat(comms-factory): Python channel registry + normalize_channels"
```

---

### Task 3: `label` pass-through in gate refs + chunked markdown rendering

**Files:**
- Modify: `overlays/comms-factory/workflows/comms_shared.py` (`compact_ref` line 52, `button` line 73, `ActionSpec`/`actions_block` lines 92–101, plus a new helper near `markdown_block` line 104)
- Test: `overlays/comms-factory/tests/test_comms_workflows.py`

The base slackbot already parses an optional `label` from the ref (sets the edit-modal title/input label) — the overlay just never sends it. Chunking: `markdown_block` truncates at 2900 chars, but blog copy runs to 3600 — gate and ship renders must chunk across blocks instead of silently ellipsizing.

- [ ] **Step 1: Write the failing tests**

```python
def test_compact_ref_carries_optional_label():
    gate = Gate("run_1", "candidate", 2, "U123")
    ref = compact_ref(gate, "edit_candidate", "blog", label="r2 · Edit blog")
    assert '"label":"r2 · Edit blog"' in ref
    assert '"target_id":"blog"' in ref
    assert '"per_item"' not in ref  # channel rides as payload, not correlation


def test_compact_ref_omits_label_when_absent():
    gate = Gate("run_1", "candidate", 1, "U123")
    assert '"label"' not in compact_ref(gate, "approve")


def test_chunked_markdown_blocks_splits_on_line_boundaries():
    from comms_shared import chunked_markdown_blocks

    text = "\n".join(f"line {i} " + "x" * 80 for i in range(80))  # ~7000 chars
    blocks = chunked_markdown_blocks(text)
    assert len(blocks) >= 3
    for block in blocks:
        assert block["type"] == "section"
        assert len(block["text"]["text"]) <= 2900
        assert not block["text"]["text"].endswith("…")  # no silent truncation
    rejoined = "\n".join(b["text"]["text"] for b in blocks)
    assert rejoined == text
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest overlays/comms-factory/tests/test_comms_workflows.py -k "label or chunked" -v`
Expected: FAIL (`compact_ref() got an unexpected keyword argument 'label'`; ImportError for `chunked_markdown_blocks`).

- [ ] **Step 3: Implement**

In `comms_shared.py`:

`compact_ref` (line 52) — add the keyword and payload entry:

```python
def compact_ref(
    gate: Gate, action: str, target_id: str | None = None, label: str | None = None
) -> str:
```
and after the `if target_id:` block:
```python
    if label:
        payload["label"] = label
```

`button` (line 73) — add `label: str | None = None` keyword, pass through:
```python
        "value": compact_ref(gate, action, target_id, label=label),
```

`ActionSpec`/`actions_block` (lines 92–101) — allow a 5th element:

```python
ActionSpec = (
    tuple[str, str, str | None]
    | tuple[str, str, str | None, str | None]
    | tuple[str, str, str | None, str | None, str | None]
)


def actions_block(gate: Gate, actions: Sequence[ActionSpec]) -> dict[str, Any]:
    elements = []
    for spec in actions:
        text, action, style = spec[:3]
        target_id = spec[3] if len(spec) > 3 else None
        label = spec[4] if len(spec) > 4 else None
        elements.append(
            button(gate, text, action, style=style, target_id=target_id, label=label)
        )
    return {"type": "actions", "elements": elements}
```

New helper after `markdown_block` (line 105):

```python
def chunked_markdown_blocks(text: str, limit: int = 2900) -> list[dict[str, Any]]:
    """Render text as one or more section blocks, splitting on line boundaries.

    Slack hard-caps a section at 3000 chars; ``markdown_block`` truncates at
    2900 with an ellipsis. Long copy (a 3600-char blog) must instead chunk so
    the full text is always readable.
    """
    value = str(text or "")
    if len(value) <= limit:
        return [markdown_block(value)]
    blocks: list[dict[str, Any]] = []
    current: list[str] = []
    size = 0
    for line in value.split("\n"):
        # +1 for the newline that joins it to the previous line in this chunk
        addition = len(line) + (1 if current else 0)
        if current and size + addition > limit:
            blocks.append(markdown_block("\n".join(current)))
            current, size = [line], len(line)
            continue
        if not current and len(line) > limit:
            # single pathological line: hard-split it
            for start in range(0, len(line), limit):
                blocks.append(markdown_block(line[start : start + limit]))
            continue
        current.append(line)
        size += addition
    if current:
        blocks.append(markdown_block("\n".join(current)))
    return blocks
```

- [ ] **Step 4: Run to verify pass**

Run: `uv run pytest overlays/comms-factory/tests/test_comms_workflows.py -k "label or chunked or compact_ref" -v`
Expected: new tests PASS and all pre-existing `compact_ref` tests still PASS (the new kwargs default to `None`).

- [ ] **Step 5: Commit**

```bash
git add overlays/comms-factory/workflows/comms_shared.py overlays/comms-factory/tests/test_comms_workflows.py
git commit -m "feat(comms-factory): gate-ref label pass-through + chunked block rendering"
```

---

### Task 4: Channel resolution, validation, and echo in `comms_release.py`

**Files:**
- Modify: `overlays/comms-factory/workflows/comms_release.py:62` (resolution) and the import block (line 10)
- Test: `overlays/comms-factory/tests/test_comms_workflows.py`

Today: `channels = inp.channels or _parse_channels(brief) or ["x"]` — no validation, silent default.

- [ ] **Step 1: Write the failing tests**

The existing workflow tests monkeypatch `call_comms_tool` / `post_gate_message` etc. (see `test_comms_workflows.py:404-460` for the pattern — reuse its fakes). Add:

```python
@pytest.mark.anyio
async def test_release_blocks_unknown_channels_before_any_tool_call(monkeypatch):
    import comms_release

    calls = []

    async def fake_call_comms_tool(ctx, name, method, args):
        calls.append(method)
        return {"ok": True}

    posted = []

    async def fake_post_gate_message(ctx, **kwargs):
        posted.append(kwargs)
        return {"channel": "C123", "ts": kwargs["name"]}

    monkeypatch.setattr(comms_release, "call_comms_tool", fake_call_comms_tool)
    monkeypatch.setattr(comms_release, "post_gate_message", fake_post_gate_message)

    result = await comms_release.handler(
        comms_release.Input(
            brief="for x, tiktok: launch", user_id="U123", delivery={"platform": "slack"}
        ),
        _ctx(),
    )
    assert result["status"] == "blocked"
    assert result["stage"] == "channels"
    assert result["error"] == "unknown_channels"
    assert result["unknown_channels"] == ["tiktok"]
    assert calls == []  # blocked BEFORE grounding
    assert "tiktok" in posted[-1]["text"]
    assert "x-thread" in posted[-1]["text"]  # teaching message lists valid formats


@pytest.mark.anyio
async def test_release_drops_planning_only_channels_with_note(monkeypatch):
    """`for email, x:` → generates for x only; the echo notes email is planning-only."""
    # Reuse the full happy-path fake set from the existing
    # test_release_workflow_happy_path, with brief="for email, x: launch".
    # Assert the first posted message mentions both "Generating for: x" and "email".


def test_parse_channels_still_extracts_prefix():
    import comms_release

    assert comms_release._parse_channels("for x, blog-thing: launch") == ["x", "blog-thing"]
    assert comms_release._parse_channels("no prefix here") == []
```

(`_ctx()` — the existing tests construct a fake `WorkflowContext`; reuse the same factory/fixture the happy-path test uses, e.g. its `FakeContext`. Copy the exact construction from `test_comms_workflows.py` rather than inventing a new one. If the suite uses a different async marker than `anyio`, match the file's existing marker.)

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest overlays/comms-factory/tests/test_comms_workflows.py -k "unknown_channels or planning_only" -v`
Expected: FAIL — handler currently sends `tiktok` straight to grounding (`calls != []`, no `stage == "channels"` block).

- [ ] **Step 3: Implement**

In `comms_release.py`, extend the `from comms_shared import (...)` block with `DEFAULT_CHANNELS, GENERATED_CHANNELS, normalize_channels` and replace line 62:

```python
    requested = inp.channels or _parse_channels(brief) or list(DEFAULT_CHANNELS)
    channels, planning_only, unknown = normalize_channels(requested)
    if unknown:
        await _post_simple(
            ctx,
            inp.delivery,
            "*Comms release blocked*: unknown format(s): "
            + ", ".join(f"`{name}`" for name in unknown)
            + ".\nValid formats: " + ", ".join(GENERATED_CHANNELS) + ".",
        )
        return {
            "status": "blocked",
            "stage": "channels",
            "error": "unknown_channels",
            "unknown_channels": unknown,
        }
    selection_note = ""
    if planning_only:
        selection_note = (
            "\n_Note: " + ", ".join(f"`{name}`" for name in planning_only)
            + " are planning-only touchpoints — not auto-generated; they stay on the"
            " release card for human adaptation._"
        )
    if not channels:
        channels = list(DEFAULT_CHANNELS)
        selection_note += "\n_Falling back to the default format: x._"
```

and fold the selection echo into the existing grounding message (line 69) — replace `"Grounding comms facts…"` with:

```python
        f"*Generating for:* {', '.join(channels)}{selection_note}\nGrounding comms facts…",
```

- [ ] **Step 4: Run to verify pass**

Run: `uv run pytest overlays/comms-factory/tests/test_comms_workflows.py -v`
Expected: new tests PASS; existing happy-path tests still PASS (briefs like `"generate for x: launch"` resolve to `["x"]` exactly as before).

- [ ] **Step 5: Commit**

```bash
git add overlays/comms-factory/workflows/comms_release.py overlays/comms-factory/tests/test_comms_workflows.py
git commit -m "feat(comms-factory): validate + echo channel selection before grounding"
```

---

### Task 5: Per-channel state seeding + gate rendering helpers (pure functions)

**Files:**
- Modify: `overlays/comms-factory/workflows/comms_release.py` (new helpers near the existing `_picks_from_generation`, line 775; delete `_recommended_candidate` usage later in Task 7)
- Test: `overlays/comms-factory/tests/test_comms_workflows.py`

`final_by_channel: dict[str, dict]` — entry `{"text": str, "candidate_id": str | None, "edited": bool}`. Picks are FLAT candidate dicts (top-level `id`/`text`/`channel`).

- [ ] **Step 1: Write the failing tests**

```python
def test_seed_final_by_channel_prefers_director_pick_and_falls_back():
    import comms_release

    candidates = [
        {"id": "c1", "channel": "x", "text": "x copy 1"},
        {"id": "c2", "channel": "x", "text": "x copy 2"},
        {"id": "b1", "channel": "blog", "text": "blog copy"},
    ]
    picks = [{"id": "c2", "channel": "x", "text": "x copy 2"}]  # flat, like the live route
    state = comms_release._seed_final_by_channel(["x", "blog", "modal"], candidates, picks)
    assert state["x"] == {"text": "x copy 2", "candidate_id": "c2", "edited": False}
    # no blog pick → first blog candidate
    assert state["blog"] == {"text": "blog copy", "candidate_id": "b1", "edited": False}
    # no modal candidates at all → missing (None entry)
    assert state["modal"] is None


def test_candidate_gate_blocks_render_per_channel_with_scoped_buttons():
    import comms_release
    from comms_shared import Gate

    gate = Gate("run_1", "candidate", 3, "U123", ("U999",))
    candidates = [
        {"id": "c1", "channel": "x", "text": "x copy",
         "director_audit": {"publication_gate_passed": True}},
        {"id": "t1", "channel": "x-thread", "text": "tweet1\n\ntweet2"},
    ]
    state = {
        "x": {"text": "x copy", "candidate_id": "c1", "edited": False},
        "x-thread": {"text": "tweet1\n\ntweet2", "candidate_id": "t1", "edited": False},
        "blog": None,
    }
    blocks = comms_release._candidate_gate_blocks(
        gate, ["x", "x-thread", "blog"], state, candidates,
        retry_available=True, audit_line="", terminal=False,
    )
    flat = str(blocks)
    assert "*x*" in flat and "*x-thread*" in flat
    assert "no candidates generated" in flat            # blog missing
    assert '"target_id":"x"' in flat                     # Edit x carries its channel
    assert '"label":"r3 · Edit x"' in flat               # round-stamped modal label
    assert '"target_id":"x-thread"' not in flat          # structured: pick-or-retry only
    assert flat.count('"action":"edit_candidate"') == 1  # only the one editable channel present
    assert '"action":"retry"' in flat and '"action":"approve"' in flat

    terminal_blocks = comms_release._candidate_gate_blocks(
        gate, ["x"], state, candidates,
        retry_available=False, audit_line="done", terminal=True,
    )
    assert '"type": "actions"' not in str(terminal_blocks).replace("'", '"')
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest overlays/comms-factory/tests/test_comms_workflows.py -k "seed_final or gate_blocks" -v`
Expected: AttributeError — helpers don't exist.

- [ ] **Step 3: Implement** (in `comms_release.py`, after `_picks_from_generation`)

```python
EDITABLE_CHANNELS = tuple(c for c in GENERATED_CHANNELS if c not in STRUCTURED_CHANNELS)
MAX_CANDIDATE_ROUNDS = 30


def _seed_final_by_channel(
    channels: list[str],
    candidates: list[dict[str, Any]],
    picks: list[dict[str, Any]],
) -> dict[str, dict[str, Any] | None]:
    """Director pick per channel (flat picks: top-level id/text/channel), else the
    first candidate of that channel, else None (missing)."""
    state: dict[str, dict[str, Any] | None] = {}
    for channel in channels:
        pick = next((p for p in picks if p.get("channel") == channel), None)
        if pick and str(pick.get("text") or "").strip():
            state[channel] = {
                "text": str(pick.get("text")),
                "candidate_id": pick.get("id"),
                "edited": False,
            }
            continue
        candidate = next(
            (c for c in candidates
             if c.get("channel") == channel and str(c.get("text") or "").strip()),
            None,
        )
        state[channel] = (
            {"text": str(candidate.get("text")), "candidate_id": candidate.get("id"),
             "edited": False}
            if candidate
            else None
        )
    return state


def _candidate_by_id(
    candidates: list[dict[str, Any]], candidate_id: Any
) -> dict[str, Any] | None:
    if candidate_id is None:
        return None
    return next((c for c in candidates if c.get("id") == candidate_id), None)


def _candidate_gate_blocks(
    gate: Gate,
    channels: list[str],
    state: dict[str, dict[str, Any] | None],
    candidates: list[dict[str, Any]],
    *,
    retry_available: bool,
    audit_line: str,
    terminal: bool,
) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = [
        markdown_block("*Choose final copy per format.* This only marks copy ready in Slack.")
    ]
    for channel in channels:
        entry = state.get(channel)
        if entry is None:
            blocks.append(markdown_block(f"*{channel}* — ⚠️ no candidates generated"))
            continue
        candidate = _candidate_by_id(candidates, entry.get("candidate_id"))
        header = f"*{channel}*"
        if entry.get("edited"):
            header += " _(edited by operator)_"
        elif candidate is not None:
            header += "  ⭐ Director's pick"
        lines = [header]
        if isinstance((candidate or {}).get("director_audit"), dict) and not entry.get("edited"):
            audit = candidate["director_audit"]
            lines.append(_verdict_line(audit))
            lines.extend(f"⚠️ {issue}" for issue in _collect_issues(audit))
        blocks.append(markdown_block("\n".join(lines)))
        blocks.extend(chunked_markdown_blocks(f">{entry['text']}"))
        if not terminal and channel in EDITABLE_CHANNELS:
            blocks.append(
                actions_block(
                    gate,
                    [(f"Edit {channel}", "edit_candidate", None, channel,
                      f"r{gate.gate_version} · Edit {channel}")],
                )
            )
    if audit_line:
        blocks.append(context_block(audit_line))
    if not terminal:
        global_actions: list[Any] = [("Mark ready", "approve", "primary")]
        if retry_available:
            global_actions.append(("Retry", "retry", None))
        global_actions.append(("Abandon", "abandon", "danger"))
        blocks.append(actions_block(gate, global_actions))
    return blocks
```

Extend the `from comms_shared import (...)` block with `STRUCTURED_CHANNELS, chunked_markdown_blocks` (`GENERATED_CHANNELS`, `context_block`, `markdown_block`, `actions_block` are already imported per earlier tasks/file).

- [ ] **Step 4: Run to verify pass**

Run: `uv run pytest overlays/comms-factory/tests/test_comms_workflows.py -k "seed_final or gate_blocks" -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add overlays/comms-factory/workflows/comms_release.py overlays/comms-factory/tests/test_comms_workflows.py
git commit -m "feat(comms-factory): per-channel candidate state seeding + gate rendering"
```

---

### Task 6: The round-based per-channel candidate gate loop

**Files:**
- Modify: `overlays/comms-factory/workflows/comms_release.py:339-527` (replace the single-shot gate + bolt-on retry gate + ship block entirely)
- Test: `overlays/comms-factory/tests/test_comms_workflows.py`

This is the core change. Replace everything from `candidate_gate = Gate(...)` (line 340) through the `return {...ready_to_ship...}` (line 536) with the loop below. Rules encoded (from the spec): one event per correlation → fresh `gate_version` per round; authority args mandatory; empty modal value = no-op with a warning (never `GateValidationError`); a failed retry keeps state and does NOT consume the retry budget (round-scoped step name `generate_candidates_r{n}`); a successful retry re-seeds but channels with zero new candidates keep their previous entry; every exit leaves a terminal buttonless message; all terminal payloads carry the accumulated state.

- [ ] **Step 1: Write the failing workflow tests**

Model each on the existing happy-path test's fakes (`test_comms_workflows.py:404-460`): a scripted `wait_for_gate_action` returning a sequence of events, `call_comms_tool` returning canned grounding/card/generation payloads. Generation payload shape (mirrors the live route): `{"ok": True, "candidates": [...], "picks": [...]}` with flat picks. Write these tests:

```python
# 1. Multi-channel happy path: channels=["x", "blog"]; first gate event is
#    {"action": "approve"}. Assert result["status"] == "ready_to_ship",
#    result["final_by_channel"]["x"]["text"] and ["blog"]["text"] match the picks,
#    result["missing_channels"] == [], "final_copy" not in result.

# 2. Edit round: events = [edit_candidate(target_id="blog", values={"v": "better blog"}),
#    approve]. Assert final_by_channel["blog"] == {"text": "better blog",
#    "candidate_id": None, "edited": True} and x is untouched.

# 3. Empty edit is a no-op: events = [edit_candidate(target_id="blog", values={}),
#    approve]. Assert blog kept the pick text, edited is False, and the updated gate
#    message text contains "previous copy kept".

# 4. Retry failure keeps state: events = [edit(blog), retry(values={"v": "feedback"}),
#    approve]; the SECOND call_comms_tool("generate") returns {"ok": False,
#    "error": "boom"}. Assert blog edit survives, result is ready_to_ship, and the
#    gate message contains "Retry failed".

# 5. Retry success re-seeds but keeps zero-candidate channels: events =
#    [edit(blog), retry, approve]; second generation returns new x candidates/picks
#    but NO blog entries. Assert x text == new pick text (edit-discard on x N/A),
#    blog kept its previous (edited) entry, and the render notes
#    "kept from previous round".

# 6. Structured channels never render an Edit button (covered by Task 5 unit test;
#    here assert end-to-end that an x-thread-only run's gate message has exactly one
#    actions block — the global one).

# 7. All channels missing → approve returns {"status": "blocked",
#    "stage": "candidate", "error": "no_shippable_channels"} carrying
#    final_by_channel/missing_channels, and the gate message is terminal.

# 8. Abandon: events = [abandon]. Result status "abandoned", payload carries
#    final_by_channel, gate message terminal (no actions block in final update).

# 9. Exhaustion: 30 edit events then nothing. Result {"status": "blocked",
#    "error": "candidate_gate_limit"}, payload carries state, final update has no
#    actions block and mentions "limit".
```

Write all nine as real tests (reuse one parametrizable fake-event driver; each event dict shape: `{"ref": {"run_id": ..., "stage": "candidate", "gate_version": N, "action": ..., "target_id": ...}, "action": ..., "values": {...}, "slack": {"user_id": "U123"}}` — copy the `_event` helper at the top of the test file and extend it for sequences).

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest overlays/comms-factory/tests/test_comms_workflows.py -k "multi_channel or edit_round or empty_edit or retry_failure or retry_success or no_shippable or candidate_gate_limit" -v`
Expected: FAIL (handler still returns `final_copy`, single gate).

- [ ] **Step 3: Implement the loop**

Replace `comms_release.py:339-527` with:

```python
    candidates = candidates_from_generation(generation)
    final_by_channel = _seed_final_by_channel(
        channels, candidates, _picks_from_generation(generation)
    )
    attempts = 1
    audit_line = ""
    gate_message: dict[str, Any] = {}
    outcome = ""
    outcome_error = ""

    def _state_payload() -> dict[str, Any]:
        return {
            "channels": channels,
            "final_by_channel": final_by_channel,
            "missing_channels": [c for c in channels if final_by_channel.get(c) is None],
            "facts": approved_facts,
            "card": card,
            "candidates": candidates,
        }

    async def _render(
        gate: Gate, name: str, *, retry_available: bool, terminal: bool, text: str
    ) -> None:
        nonlocal gate_message
        blocks = _candidate_gate_blocks(
            gate, channels, final_by_channel, candidates,
            retry_available=retry_available, audit_line=audit_line, terminal=terminal,
        )
        if not gate_message:
            gate_message = await post_gate_message(
                ctx, name=name, delivery=inp.delivery, text=text, blocks=blocks,
                metadata={"event_type": "comms_gate",
                          "event_payload": {"run_id": ctx.run_id, "stage": "candidate"}},
            )
        else:
            await update_gate_message(
                ctx, name=name,
                channel=str(gate_message.get("channel") or ""),
                ts=str(gate_message.get("ts") or ""),
                text=text, blocks=blocks,
            )

    for round_n in range(1, MAX_CANDIDATE_ROUNDS + 1):
        gate = Gate(ctx.run_id, "candidate", round_n, inp.user_id, approver_user_ids)
        await _render(
            gate, f"render_candidate_gate_r{round_n}",
            retry_available=attempts < 2, terminal=False,
            text="Choose final comms copy per format.",
        )
        try:
            event = await wait_for_gate_action(
                ctx, f"wait_candidate_gate_r{round_n}", gate,
                {"approve", "edit_candidate", "retry", "abandon"},
            )
        except GateValidationError as exc:
            await _mark_gate(
                ctx, gate_message, f"Candidate gate rejected: {exc.reason}.",
                f"update_candidate_gate_rejected_r{round_n}",
            )
            return {"status": "rejected", "stage": "candidate",
                    "error": exc.reason, **_state_payload()}

        action = extract_action(event)
        slack = event.get("slack") if isinstance(event.get("slack"), dict) else {}
        actor = str(slack.get("user_id") or "")
        audit_line = (
            f"Round {round_n} consumed: `{action}` by <@{actor}>. Any round-{round_n} "
            "edit modal submitted after this was NOT applied — re-open Edit to re-apply."
        )

        if action == "approve":
            if all(final_by_channel.get(c) is None for c in channels):
                outcome, outcome_error = "blocked", "no_shippable_channels"
            else:
                outcome = "approve"
            break
        if action == "abandon":
            outcome = "abandoned"
            break
        if action == "edit_candidate":
            ref = event.get("ref") if isinstance(event.get("ref"), dict) else {}
            channel = str(ref.get("target_id") or "")
            value = extract_modal_value(event)
            if channel not in channels or channel in STRUCTURED_CHANNELS \
                    or final_by_channel.get(channel) is None:
                audit_line += f" (edit for `{channel or '?'}` ignored — not editable)"
            elif not value:
                audit_line += f" Edit for {channel} was empty — previous copy kept."
            else:
                final_by_channel[channel] = {
                    "text": value, "candidate_id": None, "edited": True,
                }
        elif action == "retry":
            feedback = extract_modal_value(event)
            retry_gen = await call_comms_tool(
                ctx, f"generate_candidates_r{round_n}", "generate",
                {
                    "release_card": card, "approved": True,
                    "approved_facts": approved_facts, "approval": approval,
                    "channels": channels, "voice_id": inp.voice_id,
                    "run_id": ctx.run_id, "stage": "generate",
                    "gate_version": round_n, "feedback": feedback,
                    **common_service_envelope(
                        ctx, inp, stage="generate", gate_version=round_n,
                        workflow_name=WORKFLOW_NAME,
                    ),
                },
            )
            retry_error = _generation_result_error(retry_gen)
            if retry_error:
                audit_line += f" Retry failed: {retry_error} — keeping previous copy."
            else:
                attempts = 2
                new_candidates = candidates_from_generation(retry_gen)
                new_state = _seed_final_by_channel(
                    channels, new_candidates, _picks_from_generation(retry_gen)
                )
                for channel in channels:
                    if new_state.get(channel) is None and final_by_channel.get(channel):
                        new_state[channel] = final_by_channel[channel]
                        audit_line += (
                            f" {channel}: kept from previous round — retry produced"
                            f" no {channel} candidates."
                        )
                candidates = new_candidates
                final_by_channel = new_state
    else:
        outcome, outcome_error = "blocked", "candidate_gate_limit"

    terminal_text = {
        "approve": "Candidate gate completed.",
        "abandoned": "Candidate gate abandoned.",
        "blocked": (
            "No shippable channels." if outcome_error == "no_shippable_channels"
            else f"Candidate gate limit reached ({MAX_CANDIDATE_ROUNDS} rounds)."
        ),
    }[outcome]
    terminal_gate = Gate(ctx.run_id, "candidate", 0, inp.user_id, approver_user_ids)
    await _render(
        terminal_gate, "render_candidate_gate_terminal",
        retry_available=False, terminal=True, text=terminal_text,
    )

    if outcome == "abandoned":
        return {"status": "abandoned", "stage": "candidate", **_state_payload()}
    if outcome == "blocked":
        return {"status": "blocked", "stage": "candidate",
                "error": outcome_error, **_state_payload()}

    # ---- ship (per-channel) ----
    ship_blocks: list[dict[str, Any]] = [
        markdown_block("*Ready to ship in Slack (no external posting performed)*")
    ]
    for channel in channels:
        entry = final_by_channel.get(channel)
        if entry is None:
            ship_blocks.append(markdown_block(f"⚠️ {channel}: no candidates generated"))
            continue
        marker = " (edited)" if entry.get("edited") else ""
        ship_blocks.append(markdown_block(f"*{channel}*{marker}"))
        ship_blocks.extend(chunked_markdown_blocks(entry["text"]))
        holds = _publication_holds(_candidate_by_id(candidates, entry.get("candidate_id")))
        if holds and not entry.get("edited"):
            ship_blocks.append(markdown_block(
                "⚠️ *Publication holds (verify before posting):*\n"
                + "\n".join(f"• {hold}" for hold in holds)
            ))
    ship_blocks.append(context_block(
        "Full untruncated copy lives in the workflow result's final_by_channel."
    ))
    await post_gate_message(
        ctx, name="post_ready_to_ship", delivery=inp.delivery,
        text="Ready to ship in Slack (no external posting performed)",
        blocks=ship_blocks,
    )
    return {
        "status": "ready_to_ship",
        **_state_payload(),
        "no_external_posting": True,
    }
```

Notes for the implementer:
- The `attempt`-1 generation call above this block (line 306, step name `generate_candidates_attempt_1`) is unchanged.
- Delete the now-dead helpers: `_director_pick_text`, `_candidate_for_text`, `_first_candidate_text`, `_format_candidates`, `_recommended_candidate` (the seeding replaced it). Keep `_verdict_line`, `_collect_issues`, `_publication_holds`.
- The terminal render uses `gate_version=0` only as a placeholder Gate for block-building; `terminal=True` renders no buttons, so its refs never reach Slack — no correlation is consumed.
- `ruff` line-length is 100 — wrap accordingly.

- [ ] **Step 4: Run to verify pass**

Run: `uv run pytest overlays/comms-factory/tests/test_comms_workflows.py -v`
Expected: the nine new tests PASS. Legacy tests that asserted `final_copy` / `missing_final_copy` / the retry-gate flow now FAIL — fix them in the next step (do not weaken the new behavior to appease them).

- [ ] **Step 5: Update legacy tests to the new contract**

In `test_comms_workflows.py`: anywhere asserting `result["final_copy"]`, assert `result["final_by_channel"][<channel>]["text"]` instead; `test_release_workflow_does_not_ready_to_ship_without_final_copy` (line 808) becomes the `no_shippable_channels` case (empty candidates list from generation → approve → blocked, `error == "no_shippable_channels"`); the old retry-gate test (scripted `retry` then second gate) becomes a round-loop retry (events `[retry, approve]`, second generation succeeding, asserting re-seeded text ships).

Run: `uv run pytest overlays/comms-factory/tests/test_comms_workflows.py -v`
Expected: ALL PASS.

- [ ] **Step 6: Lint + format**

Run: `uv run ruff check overlays/comms-factory && uv run ruff format overlays/comms-factory`
Expected: clean (commit any format diffs).

- [ ] **Step 7: Commit**

```bash
git add overlays/comms-factory/workflows/comms_release.py overlays/comms-factory/tests/test_comms_workflows.py
git commit -m "feat(comms-factory): round-based per-channel candidate gate + final_by_channel ship"
```

---

### Task 7: Document the X-only defaults in the tool client

**Files:**
- Modify: `overlays/comms-factory/tools/comms_factory/client.py:104-129` (generate) and `:29-49` (audit)

The tool plugin loader can't import workflow modules, so the literals stay — but they must be documented and pointed at the registry.

- [ ] **Step 1: Edit `generate`** — add above the `"channels": channels or ["x"]` line (120):

```python
        # Default mirrors DEFAULT_CHANNELS in workflows/comms_shared.py (tool
        # plugins can't import workflow modules). Valid channel names are the
        # /generate route allowlist — attached-services/comms-factory/
        # services/api/routes/generate.ts CHANNELS (x, x-thread, web, carousel,
        # modal, in-product, blog; "tweet" aliases to x).
```

and extend the `generate` docstring's first line to mention the valid set. In `audit`, add above `surface: str = "tweet"`:

```python
        # "tweet" is the historical default surface label; the TS /audit route
        # treats surface as free-form (it shapes prompts, not validation).
```

- [ ] **Step 2: Verify nothing broke**

Run: `uv run pytest overlays/comms-factory/tools/comms_factory/tests/test_comms_factory_client.py -v && uv run ruff check overlays/comms-factory`
Expected: PASS / clean — comments only.

- [ ] **Step 3: Commit**

```bash
git add overlays/comms-factory/tools/comms_factory/client.py
git commit -m "docs(comms-factory): document X-only client defaults + channel contract pointer"
```

---

### Task 8: Full-suite verification + local E2E

**Files:** none (verification only)

- [ ] **Step 1: Full test sweep**

```bash
uv run pytest overlays/comms-factory -v
cd attached-services/comms-factory && pnpm test && pnpm typecheck && cd -
uv run ruff check . && uv run ruff format --check .
```
Expected: everything green.

- [ ] **Step 2: Local stack E2E (CLAUDE.md rule: test E2E before pushing — the deploy box is production)**

Rebuild + redeploy the two changed images on the local k3s stack, then run a real multi-channel release:

```bash
just build-one api            # workflows live in the API image's overlay mount path locally
contrib/scripts/deploy-local.sh   # rebuilds comms-factory image + redeploys (see script for the attached-service flags used previously)
just status                   # all pods Running
```

Then exercise the flow (Slack: `@bot comms release for x, modal, x-thread: <real brief>`; or the API-pod curl path from AGENTS.md). Verify, in order:
1. First message echoes `Generating for: x, modal, x-thread`.
2. `comms release for x, tiktok: …` blocks immediately with the valid-format list (and no grounding ran — check `just logs api` for absence of `ground_facts`).
3. Facts + card gates behave unchanged.
4. The candidate gate shows three sections; `x` and `modal` have Edit buttons, `x-thread` does not.
5. Click `Edit modal`, submit replacement text → message re-renders with the edit, round counter advances, audit line appears.
6. `Mark ready` → ship message lists all three channels; the workflow result (poll `GET /agent/threads/{thread_key}/events` or check workflow_runs) carries `final_by_channel` with your edited modal text and `no_external_posting: true`.
7. Submit a second edit from a stale (pre-re-render) modal if you can race it → confirm it is dropped and the audit line warned about it.

- [ ] **Step 3: Commit any E2E-driven fixes, then hand off**

If E2E surfaced fixes, commit them individually (`fix(comms-factory): …`). Then the branch is ready for PR — do NOT push to main without the user's go-ahead.

---

## Self-review (done at plan-writing time)

- **Spec coverage:** route allowlist (T1) ✓ registry/aliases (T2) ✓ label+chunking mechanics (T3) ✓ resolution/echo/planning-only/unknown (T4) ✓ flat-pick seeding + per-channel render + structured-no-edit + per-channel action blocks (T5) ✓ round loop, empty-edit no-op, failed-retry budget, zero-candidate retention, terminal invariant, state-carrying exits, ship chunking, `final_copy` removal (T6) ✓ client comments (T7) ✓ E2E rule (T8) ✓. The spec's `compact_ref` label-omission test and the authority-args requirement are covered in T3/T5/T6 test assertions.
- **Placeholder scan:** test sketches in T6 Step 1 are enumerated with exact behaviors + the event-shape recipe and an explicit instruction to write all nine as real tests using the file's existing fakes — acceptable because the fakes already exist in the file at the cited lines; all production code is complete.
- **Type consistency:** `final_by_channel: dict[str, dict | None]` (None = missing) is consistent across `_seed_final_by_channel`, `_candidate_gate_blocks`, the loop, `_state_payload`, and ship; `MAX_CANDIDATE_ROUNDS`/`EDITABLE_CHANNELS` defined once (T5) and used in T6; `chunked_markdown_blocks` defined in T3, used in T5/T6.
