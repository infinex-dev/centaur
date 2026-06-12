from __future__ import annotations

from pathlib import Path
import sys

import pytest  # noqa: F401  (needed for pytest.mark.asyncio in Task 12)

OVERLAY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(OVERLAY_ROOT / "workflows"))
sys.path.insert(0, str(OVERLAY_ROOT))

from comms_delivery import (  # noqa: E402  (after the sys.path bootstrap)
    delivery_gate_blocks,
    deliverable_groups,
    deliveries_made,
    destination_groups,
    empty_deliveries,
    fenced_diff_blocks,
    tweets_for_channel,
)
from comms_shared import Gate, GateValidationError  # noqa: E402


def test_destination_groups_splits_by_destination_and_skips_missing():
    final = {
        "blog": {"text": "b"},
        "web": {"text": "w"},
        "x": {"text": "t"},
        "x-thread": None,
        "in-product": {"text": "i"},
        "modal": {"text": "m"},
    }
    groups = destination_groups(list(final.keys()), final)
    assert groups["platform_pr"] == ["blog", "web"]
    assert groups["typefully"] == ["x"]  # x-thread is None -> missing
    assert groups["copy_only"] == ["in-product", "modal"]


def test_deliverable_groups_gate_on_capability():
    groups = {"platform_pr": ["blog"], "typefully": [], "copy_only": []}
    enabled = deliverable_groups(groups, {"platform_pr": False, "typefully": True})
    assert enabled == {"platform_pr": False, "typefully": False}


def test_tweets_for_channel_consumes_structured_array_never_resplits():
    candidates = [
        {"id": "c1", "structured": {"kind": "thread", "tweets": ["t1", "t2", "t3"]}}
    ]
    entry = {"text": "t1\n\nt2 t3 flattened weirdly", "candidate_id": "c1"}
    assert tweets_for_channel(candidates, entry, "x-thread") == ["t1", "t2", "t3"]


def test_tweets_for_channel_falls_back_to_blank_line_split_without_structured():
    assert tweets_for_channel(
        [], {"text": "a\n\nb", "candidate_id": "zz"}, "x-thread"
    ) == ["a", "b"]
    assert tweets_for_channel([], {"text": "solo"}, "x") == ["solo"]


def test_delivery_gate_blocks_states():
    gate = Gate("r1", "deliver", 1, "U1")
    groups = {"platform_pr": ["blog"], "typefully": ["x"], "copy_only": ["modal"]}
    enabled = {"platform_pr": True, "typefully": True}
    final = {"modal": {"text": "EMERGENCY: deposits paused"}}
    idle = str(
        delivery_gate_blocks(
            gate,
            groups,
            enabled,
            {"pr": "idle", "typefully": "idle"},
            empty_deliveries(),
            final_by_channel=final,
        )
    )
    assert (
        "Preview platform PR" in idle
        and "Create Typefully drafts" in idle
        and "Finish" in idle
    )
    assert "Create PR" not in idle  # only after preview
    assert "deliver manually" in idle  # copy_only note
    assert "EMERGENCY: deposits paused" in idle  # copy-only text inlined

    previewed = str(
        delivery_gate_blocks(
            gate,
            groups,
            enabled,
            {"pr": "previewed", "typefully": "idle"},
            empty_deliveries(),
        )
    )
    # typefully still idle -> Create PR announces its draft-creation side effect
    assert "Create Typefully drafts + PR" in previewed and "Cancel PR" in previewed
    assert "typefullyUrl" in previewed  # ordering note rendered

    previewed_after_tf = str(
        delivery_gate_blocks(
            gate,
            groups,
            enabled,
            {"pr": "previewed", "typefully": "created"},
            empty_deliveries(),
        )
    )
    assert "Create PR" in previewed_after_tf
    assert "Create Typefully drafts + PR" not in previewed_after_tf

    failed = str(
        delivery_gate_blocks(
            gate,
            groups,
            enabled,
            {"pr": "create_failed", "typefully": "created"},
            empty_deliveries(),
        )
    )
    assert (
        "creation FAILED" in failed and "Create PR" in failed and "Cancel PR" in failed
    )

    terminal = str(
        delivery_gate_blocks(
            gate,
            groups,
            enabled,
            {"pr": "created", "typefully": "created"},
            empty_deliveries(),
            terminal=True,
        )
    )
    assert "'type': 'actions'" not in terminal  # terminal is buttonless


def test_delivery_gate_blocks_single_group():
    # Finish is always valid: it means "done — accept the current delivery state".
    gate = Gate("r1", "deliver", 1, "U1")
    groups = {"platform_pr": [], "typefully": ["x"], "copy_only": []}
    enabled = {"platform_pr": False, "typefully": True}
    only_tf = str(
        delivery_gate_blocks(
            gate,
            groups,
            enabled,
            {"pr": "idle", "typefully": "idle"},
            empty_deliveries(),
        )
    )
    assert "Create Typefully drafts" in only_tf and "Finish" in only_tf
    assert "Platform PR" not in only_tf


def test_fenced_diff_blocks_every_chunk_is_fenced():
    long_diff = "\n".join(f"+ line {i}" for i in range(400))  # > one 2800-char chunk
    blocks = fenced_diff_blocks(long_diff)
    assert len(blocks) > 1
    for block in blocks:
        text = block["text"]["text"]
        assert text.startswith("```") and text.rstrip("…").rstrip().endswith("```")


def test_deliveries_made_flips_only_on_created():
    d = empty_deliveries()
    assert deliveries_made(d) is False
    d["typefully"] = [{"channel": "x", "status": "failed", "url": None}]
    assert deliveries_made(d) is False
    d["platform_pr"] = {"status": "created", "url": "https://github.com/x/pull/1"}
    assert deliveries_made(d) is True


# --- handler-driven delivery gate tests (run_delivery_gate spliced into the
# comms_release handler; harness pattern from test_comms_workflows.py:441) ---


PR_URL = "https://github.com/infinex/platform/pull/42"
LONG_DIFF = "\n".join(f"+ planned line {i}" for i in range(400))


def _event(
    *,
    run_id: str = "run_test",
    stage: str,
    gate_version: int = 1,
    action: str,
    target_id: str | None = None,
    values: dict | None = None,
) -> dict:
    ref = {
        "run_id": run_id,
        "stage": stage,
        "gate_version": gate_version,
        "action": action,
        "requester_user_id": "U123",
    }
    if target_id:
        ref["target_id"] = target_id
    event = {"action": action, "ref": ref, "slack": {"user_id": "U123"}}
    if values:
        event["values"] = values
    return event


def _deliver(action: str, round_n: int) -> dict:
    return _event(stage="deliver", gate_version=round_n, action=action)


def _generation_for(channels: list[str]) -> dict:
    candidates = []
    for channel in channels:
        cand = {
            "id": f"cand-{channel}",
            "channel": channel,
            "text": f"{channel} approved copy",
        }
        if channel == "x-thread":
            cand["text"] = "tw1\n\ntw2\n\ntw3"
            cand["structured"] = {"kind": "thread", "tweets": ["tw1", "tw2", "tw3"]}
        candidates.append(cand)
    return {"ok": True, "candidates": candidates, "picks": []}


async def _run_delivery(
    monkeypatch,
    *,
    channels: list[str],
    delivery_events: list[dict],
    caps: dict,
    overrides: dict | None = None,
    delivery_wait_error: Exception | None = None,
):
    """Drive comms_release.handler end-to-end (facts/card/candidate approve)
    into the delivery gate. Monkeypatches BOTH comms_release and comms_delivery
    module attributes. Returns (result, posts, updates, calls) where calls is
    the ordered [(step_name, method, args)] tool-call log."""
    import comms_delivery
    import comms_release

    overrides = overrides or {}
    posts: list[dict] = []
    updates: list[dict] = []
    calls: list[tuple[str, str, dict]] = []

    async def fake_call_comms_tool(_ctx, name, method, args):
        calls.append((name, method, dict(args)))
        if method in overrides:
            return overrides[method](name, args)
        if method == "validate":
            return {"ok": True, "passed": True}
        if method == "ground_from_tools":
            return {"ok": True, "facts": [{"claim": "A", "value": "Fact A"}]}
        if method == "build_card":
            return {
                "ok": True,
                "release_card": {"kind": "launch-tier", "title": "Launch Fact A"},
            }
        if method == "generate":
            return _generation_for(channels)
        if method == "capabilities":
            return {"ok": True, "capabilities": caps}
        if method == "emit_platform_pr":
            if args.get("dry_run"):
                return {"ok": True, "planned_diff": LONG_DIFF}
            return {
                "ok": True,
                "pr_url": PR_URL,
                "branch": "comms/run_test-launch",
                "slug": "launch-fact-a",
            }
        if method == "typefully_draft":
            return {
                "ok": True,
                "share_url": f"https://typefully.com/t/{args['channel']}",
            }
        raise AssertionError(method)

    async def fake_post_gate_message(_ctx, **kwargs):
        posts.append(kwargs)
        return {"channel": "C123", "ts": kwargs["name"]}

    async def fake_update_gate_message(_ctx, **kwargs):
        updates.append(kwargs)
        return {"ok": True}

    fact_events = iter(
        [_event(stage="facts", action="approve_fact", target_id="fact_1")]
    )
    release_events = iter(
        [
            _event(stage="card", action="approve"),
            _event(stage="candidate", action="approve"),
        ]
    )
    deliver_events = iter(delivery_events)

    async def fake_wait_for_fact_action(*_args, **_kwargs):
        return next(fact_events)

    async def fake_release_wait(*_args, **_kwargs):
        return next(release_events)

    async def fake_delivery_wait(*_args, **_kwargs):
        if delivery_wait_error is not None:
            raise delivery_wait_error
        return next(deliver_events)

    class Ctx:
        run_id = "run_test"

        async def step(self, _name, fn, **_kwargs):
            return await fn()

    monkeypatch.setattr(comms_release, "call_comms_tool", fake_call_comms_tool)
    monkeypatch.setattr(
        comms_release,
        "tool_plane_ref",
        lambda *_args, **_kwargs: {"idempotency_prefix": "run_test:ground:1"},
    )
    monkeypatch.setattr(comms_release, "post_gate_message", fake_post_gate_message)
    monkeypatch.setattr(comms_release, "update_gate_message", fake_update_gate_message)
    monkeypatch.setattr(comms_release, "wait_for_gate_action", fake_release_wait)
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action_at_correlation", fake_wait_for_fact_action
    )
    monkeypatch.setattr(comms_delivery, "call_comms_tool", fake_call_comms_tool)
    monkeypatch.setattr(comms_delivery, "post_gate_message", fake_post_gate_message)
    monkeypatch.setattr(comms_delivery, "update_gate_message", fake_update_gate_message)
    monkeypatch.setattr(comms_delivery, "wait_for_gate_action", fake_delivery_wait)

    result = await comms_release.handler(
        comms_release.Input(
            brief=f"for {', '.join(channels)}: launch Fact A",
            user_id="U123",
            delivery={"platform": "slack"},
        ),
        Ctx(),
    )
    return result, posts, updates, calls


@pytest.mark.asyncio
async def test_tokens_absent_falls_through_to_ready_to_ship(monkeypatch):
    result, posts, _updates, calls = await _run_delivery(
        monkeypatch,
        channels=["x", "blog"],
        delivery_events=[],
        caps={"platform_pr": False, "typefully": False, "display": False},
    )

    assert result["status"] == "ready_to_ship"
    assert result["no_external_posting"] is True
    assert result["deliveries"] == empty_deliveries()  # copy_only untouched: []
    methods = [method for _, method, _ in calls]
    assert "emit_platform_pr" not in methods
    assert "typefully_draft" not in methods
    assert ("probe_capabilities", "capabilities") in [(n, m) for n, m, _ in calls]
    # The ready-to-ship summary still posts; NO gate message is a delivery gate.
    assert "post_ready_to_ship" in [post.get("name") for post in posts]
    for post in posts:
        payload = (post.get("metadata") or {}).get("event_payload") or {}
        assert payload.get("stage") != "deliver"


@pytest.mark.asyncio
async def test_delivery_preview_create_finish_with_typefully_first_ordering(
    monkeypatch,
):
    result, posts, updates, calls = await _run_delivery(
        monkeypatch,
        channels=["x", "x-thread", "blog"],
        delivery_events=[
            _deliver("preview_pr", 1),
            _deliver("create_pr", 2),
            _deliver("finish", 3),
        ],
        caps={"platform_pr": True, "typefully": True, "display": False},
    )

    assert result["status"] == "ready_to_ship"
    emits = [(i, c) for i, c in enumerate(calls) if c[1] == "emit_platform_pr"]
    assert len(emits) == 2
    assert emits[0][1][2]["dry_run"] is True
    assert emits[1][1][2]["dry_run"] is False

    # ORDERING: Typefully drafts are created BEFORE the real (dry_run=False) emit.
    drafts = [(i, c) for i, c in enumerate(calls) if c[1] == "typefully_draft"]
    assert len(drafts) == 2
    real_emit_index = emits[1][0]
    assert all(index < real_emit_index for index, _ in drafts)
    # The real emit carries the draft's share_url as typefully_url.
    assert emits[1][1][2]["typefully_url"] == "https://typefully.com/t/x"
    # x-thread consumed the structured tweets array (joined via candidate_id).
    thread_call = next(c for _, c in drafts if c[2]["channel"] == "x-thread")
    assert thread_call[2]["tweets"] == ["tw1", "tw2", "tw3"]

    assert result["deliveries"]["platform_pr"] == {"status": "created", "url": PR_URL}
    assert [item["status"] for item in result["deliveries"]["typefully"]] == [
        "created",
        "created",
    ]
    assert result["no_external_posting"] is False

    flat_posts = str(posts)
    assert "/preview/start?branch=" in flat_posts
    assert "changelog popout" in flat_posts

    terminal = [u for u in updates if u.get("name") == "render_delivery_gate_terminal"]
    assert len(terminal) == 1
    assert '"type": "actions"' not in str(terminal[0]["blocks"]).replace("'", '"')


@pytest.mark.asyncio
async def test_delivery_cancel_pr_skips_real_emit(monkeypatch):
    result, _posts, _updates, calls = await _run_delivery(
        monkeypatch,
        channels=["blog"],
        delivery_events=[
            _deliver("preview_pr", 1),
            _deliver("cancel_pr", 2),
            _deliver("finish", 3),
        ],
        caps={"platform_pr": True, "typefully": True, "display": False},
    )

    assert result["status"] == "ready_to_ship"
    emits = [c for c in calls if c[1] == "emit_platform_pr"]
    assert [c[2]["dry_run"] for c in emits] == [True]  # no dry_run=False emit
    assert result["deliveries"]["platform_pr"] == {"status": "skipped", "url": None}
    assert result["no_external_posting"] is True


@pytest.mark.asyncio
async def test_delivery_copy_only_channel_is_never_delivered(monkeypatch):
    result, posts, _updates, calls = await _run_delivery(
        monkeypatch,
        channels=["x", "modal"],
        delivery_events=[_deliver("finish", 1)],
        caps={"platform_pr": False, "typefully": True, "display": False},
    )

    assert result["status"] == "ready_to_ship"
    delivery_calls = [
        c for c in calls if c[1] in ("emit_platform_pr", "typefully_draft")
    ]
    assert "modal" not in str(delivery_calls)  # no tool call references it
    assert result["deliveries"]["copy_only"] == ["modal"]
    gate_renders = [p for p in posts if p.get("name") == "render_delivery_gate_r1"]
    assert len(gate_renders) == 1
    flat = str(gate_renders[0]["blocks"])
    assert "deliver manually" in flat
    assert "modal approved copy" in flat  # copy inlined for manual delivery


@pytest.mark.asyncio
async def test_delivery_preview_short_circuits_on_existing_pr(monkeypatch):
    existing_url = "https://github.com/infinex/platform/pull/7"
    result, _posts, _updates, calls = await _run_delivery(
        monkeypatch,
        channels=["blog"],
        delivery_events=[_deliver("preview_pr", 1), _deliver("finish", 2)],
        caps={"platform_pr": True, "typefully": False, "display": False},
        overrides={
            "emit_platform_pr": lambda _name, _args: {
                "ok": True,
                "existing": True,
                "pr_url": existing_url,
            }
        },
    )

    assert result["status"] == "ready_to_ship"
    emits = [c for c in calls if c[1] == "emit_platform_pr"]
    assert len(emits) == 1  # state jumps to created; no second emit
    assert result["deliveries"]["platform_pr"] == {
        "status": "created",
        "url": existing_url,
    }
    assert result["no_external_posting"] is False


@pytest.mark.asyncio
async def test_delivery_gate_exhaustion_still_returns_ready_to_ship(monkeypatch):
    result, _posts, updates, calls = await _run_delivery(
        monkeypatch,
        channels=["blog"],
        delivery_events=[_deliver("preview_pr", n) for n in range(1, 13)],
        caps={"platform_pr": True, "typefully": False, "display": False},
        overrides={
            "emit_platform_pr": lambda _name, _args: {"ok": False, "error": "boom"}
        },
    )

    assert result["status"] == "ready_to_ship"
    assert result["deliveries"]["platform_pr"] == {"status": "skipped", "url": None}
    assert result["no_external_posting"] is True
    assert len([c for c in calls if c[1] == "emit_platform_pr"]) == 12
    terminal = [u for u in updates if u.get("name") == "render_delivery_gate_terminal"]
    assert len(terminal) == 1
    assert "limit reached" in str(terminal[0]["text"])
    assert '"type": "actions"' not in str(terminal[0]["blocks"]).replace("'", '"')


@pytest.mark.asyncio
async def test_delivery_gate_validation_rejection_exits_with_deliveries(monkeypatch):
    result, _posts, updates, _calls = await _run_delivery(
        monkeypatch,
        channels=["blog"],
        delivery_events=[],
        caps={"platform_pr": True, "typefully": False, "display": False},
        delivery_wait_error=GateValidationError("unauthorized_slack_user"),
    )

    assert result["status"] == "ready_to_ship"
    assert result["deliveries"]["platform_pr"] == {"status": "skipped", "url": None}
    assert result["no_external_posting"] is True
    terminal = [u for u in updates if u.get("name") == "render_delivery_gate_terminal"]
    assert len(terminal) == 1
    assert "rejected" in str(terminal[0]["text"])
    assert '"type": "actions"' not in str(terminal[0]["blocks"]).replace("'", '"')


@pytest.mark.asyncio
async def test_delivery_failed_create_pr_is_retryable(monkeypatch):
    real_attempts = {"count": 0}

    def emit_override(_name, args):
        if args.get("dry_run"):
            return {"ok": True, "planned_diff": "+ one line"}
        real_attempts["count"] += 1
        if real_attempts["count"] == 1:
            return {"ok": False, "error": "github_500"}
        return {
            "ok": True,
            "pr_url": PR_URL,
            "branch": "comms/run_test-launch",
            "slug": "launch-fact-a",
        }

    result, _posts, updates, calls = await _run_delivery(
        monkeypatch,
        channels=["blog"],
        delivery_events=[
            _deliver("preview_pr", 1),
            _deliver("create_pr", 2),
            _deliver("create_pr", 3),
            _deliver("finish", 4),
        ],
        caps={"platform_pr": True, "typefully": False, "display": False},
        overrides={"emit_platform_pr": emit_override},
    )

    assert result["status"] == "ready_to_ship"
    # After the failed create the round-3 render shows the failure AND keeps a
    # Create PR button (state create_failed; create_pr stays in the allowed set).
    round_3 = [u for u in updates if u.get("name") == "render_delivery_gate_r3"]
    assert len(round_3) == 1
    flat = str(round_3[0]["blocks"])
    assert "creation FAILED" in flat
    assert '"action":"create_pr"' in flat
    # The second create_pr succeeded.
    real_emits = [
        c for c in calls if c[1] == "emit_platform_pr" and c[2]["dry_run"] is False
    ]
    assert len(real_emits) == 2
    assert result["deliveries"]["platform_pr"] == {"status": "created", "url": PR_URL}
    assert result["no_external_posting"] is False


@pytest.mark.asyncio
async def test_delivery_all_failed_typefully_is_retryable(monkeypatch):
    def typefully_override(name, args):
        if name.endswith("_r1"):
            return {"ok": False, "error": "typefully_down"}
        return {"ok": True, "share_url": f"https://typefully.com/t/{args['channel']}"}

    result, posts, updates, calls = await _run_delivery(
        monkeypatch,
        channels=["x", "blog"],
        delivery_events=[
            _deliver("typefully", 1),
            _deliver("typefully", 2),
            _deliver("preview_pr", 3),
            _deliver("finish", 4),
        ],
        caps={"platform_pr": True, "typefully": True, "display": False},
        overrides={"typefully_draft": typefully_override},
    )

    assert result["status"] == "ready_to_ship"
    # All drafts failed in round 1 → state stays idle → button re-rendered.
    round_2 = [u for u in updates if u.get("name") == "render_delivery_gate_r2"]
    assert len(round_2) == 1
    assert '"action":"typefully"' in str(round_2[0]["blocks"])
    # The second attempt succeeded.
    assert len([c for c in calls if c[1] == "typefully_draft"]) == 2
    assert result["deliveries"]["typefully"] == [
        {"channel": "x", "status": "created", "url": "https://typefully.com/t/x"}
    ]
    assert result["no_external_posting"] is False
    # Every posted preview block is individually fenced (fenced_diff_blocks).
    preview_posts = [p for p in posts if p.get("name") == "post_pr_preview_r3"]
    assert len(preview_posts) == 1
    blocks = preview_posts[0]["blocks"]
    assert len(blocks) > 1  # LONG_DIFF spans multiple chunks
    for block in blocks:
        text = block["text"]["text"]
        assert text.startswith("```")
        assert text.rstrip("…").rstrip().endswith("```")
