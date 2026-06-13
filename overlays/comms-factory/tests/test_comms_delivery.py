from __future__ import annotations

from pathlib import Path
import sys

import pytest  # noqa: F401  (needed for pytest.mark.asyncio in Task 12)

OVERLAY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(OVERLAY_ROOT / "workflows"))
sys.path.insert(0, str(OVERLAY_ROOT))

from comms_delivery import (  # noqa: E402  (after the sys.path bootstrap)
    _revise_result_error,
    delivery_gate_blocks,
    deliverable_groups,
    deliveries_made,
    destination_groups,
    empty_deliveries,
    fenced_diff_blocks,
    tweets_for_channel,
)
from comms_release import _parse_reviewer_emails  # noqa: E402
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
DISPLAY_URL = "https://display.dev/d/abc123"
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


def _review(action: str, wait_n: int) -> dict:
    return _event(stage="blog_review", gate_version=wait_n, action=action)


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
    wait_log: list | None = None,
    blog_review_events: list[dict] | None = None,
    reviewer_emails: list[str] | None = None,
    brief: str | None = None,
    timeline: list | None = None,
):
    """Drive comms_release.handler end-to-end (facts/card/candidate approve)
    into the blog review loop + delivery gate. Monkeypatches BOTH comms_release
    and comms_delivery module attributes. Returns (result, posts, updates,
    calls) where calls is the ordered [(step_name, method, args)] tool-call
    log. wait_log (if given) records (step_name, gate_version, allowed) per
    comms_delivery wait — the fresh-gate-version invariant. timeline (if
    given) records ("post"|"update"|"call", name) in true execution order so
    render-before-tool-call ordering is assertable."""
    import comms_delivery
    import comms_release

    overrides = overrides or {}
    posts: list[dict] = []
    updates: list[dict] = []
    calls: list[tuple[str, str, dict]] = []

    async def fake_call_comms_tool(_ctx, name, method, args):
        calls.append((name, method, dict(args)))
        if timeline is not None:
            timeline.append(("call", name))
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
        if method == "display_publish":
            return {
                "ok": True,
                "short_id": "abc123",
                "url": DISPLAY_URL,
                "version": int(args.get("base_version") or 0) + 1,
            }
        if method == "display_comments":
            return {"ok": True, "comments": []}
        if method == "display_revise":
            return {
                "ok": True,
                "markdown": "REVISED",
                "director_audit": {"verdict": "pass"},
                "stale_anchors": [],
            }
        if method == "display_resolve":
            return {"ok": True}
        if method == "display_unpublish":
            return {"ok": True}
        raise AssertionError(method)

    async def fake_post_gate_message(_ctx, **kwargs):
        posts.append(kwargs)
        if timeline is not None:
            timeline.append(("post", kwargs["name"]))
        return {"channel": "C123", "ts": kwargs["name"]}

    async def fake_update_gate_message(_ctx, **kwargs):
        updates.append(kwargs)
        if timeline is not None:
            timeline.append(("update", kwargs["name"]))
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
    review_events = iter(blog_review_events or [])

    async def fake_wait_for_fact_action(*_args, **_kwargs):
        return next(fact_events)

    async def fake_release_wait(*_args, **_kwargs):
        return next(release_events)

    async def fake_delivery_wait(_ctx, name, gate, allowed):
        if wait_log is not None:
            wait_log.append((name, gate.gate_version, set(allowed)))
        if gate.stage == "blog_review":
            return next(review_events)
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
            brief=brief or f"for {', '.join(channels)}: launch Fact A",
            user_id="U123",
            delivery={"platform": "slack"},
            reviewer_emails=list(reviewer_emails or []),
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
    wait_log: list = []
    result, posts, updates, calls = await _run_delivery(
        monkeypatch,
        channels=["x", "x-thread", "blog"],
        delivery_events=[
            _deliver("preview_pr", 1),
            _deliver("create_pr", 2),
            _deliver("finish", 3),
        ],
        caps={"platform_pr": True, "typefully": True, "display": False},
        wait_log=wait_log,
    )

    assert result["status"] == "ready_to_ship"
    # Fresh-gate invariant (first-write-wins durable events): each round waits
    # on a distinct, strictly-increasing (step_name, gate_version) pair.
    assert [(name, version) for name, version, _ in wait_log] == [
        ("wait_delivery_gate_r1", 1),
        ("wait_delivery_gate_r2", 2),
        ("wait_delivery_gate_r3", 3),
    ]
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


@pytest.mark.asyncio
async def test_delivery_typefully_mixed_failure_is_visible(monkeypatch):
    """One draft created, one failed: the failure must be VISIBLE — in the
    audit line and in the created-state render — not silently filtered out.
    State still flips to created (one succeeded; existing semantics)."""

    def typefully_override(_name, args):
        if args["channel"] == "x":
            return {"ok": True, "share_url": "https://typefully.com/t/x"}
        return {"ok": False, "error": "typefully_429"}

    result, _posts, updates, _calls = await _run_delivery(
        monkeypatch,
        channels=["x", "x-thread"],
        delivery_events=[_deliver("typefully", 1), _deliver("finish", 2)],
        caps={"platform_pr": False, "typefully": True, "display": False},
        overrides={"typefully_draft": typefully_override},
    )

    assert result["status"] == "ready_to_ship"
    # State flipped to created → round 2 has no retry button; the render lists
    # BOTH the created URL and the failed entry with its error.
    round_2 = [u for u in updates if u.get("name") == "render_delivery_gate_r2"]
    assert len(round_2) == 1
    flat = str(round_2[0]["blocks"])
    assert "https://typefully.com/t/x" in flat
    assert "x-thread: FAILED (typefully_429)" in flat
    assert '"action":"typefully"' not in flat.replace("'", '"')
    # The audit line names the failed channel + error.
    assert "Typefully failed for x-thread: typefully_429" in flat
    assert result["deliveries"]["typefully"] == [
        {"channel": "x", "status": "created", "url": "https://typefully.com/t/x"},
        {
            "channel": "x-thread",
            "status": "failed",
            "url": None,
            "error": "typefully_429",
        },
    ]
    assert result["no_external_posting"] is False


# --- blog draft-review loop on display.dev (run_blog_review_loop spliced
# between the capabilities probe and the ship section) ---


def test_revise_result_error_envelope_semantics():
    assert _revise_result_error("nope") == "invalid_tool_response"
    assert _revise_result_error({"ok": False, "error": "boom"}) == "boom"
    assert _revise_result_error({"ok": False}) == "tool_call_failed"
    assert _revise_result_error({"ok": True, "error": "warn"}) == "warn"
    assert (
        _revise_result_error({"ok": True, "markdown": "  "})
        == "revise_response_missing_markdown"
    )
    assert _revise_result_error({"ok": True, "markdown": "text"}) == ""


def test_parse_reviewer_emails():
    # No reviewers line at all.
    assert _parse_reviewer_emails("for blog: perps launch") == []
    # Line present but no well-formed email on it.
    assert _parse_reviewer_emails("reviewers: nobody, at-all") == []
    # Malformed dropped, case-insensitive dedupe, first-seen order kept.
    assert _parse_reviewer_emails(
        "for blog: perps launch. reviewers: a@x.com, B@x.com, notanemail, A@X.COM"
    ) == ["a@x.com", "B@x.com"]
    # Multi-line briefs: only the reviewers line is parsed (not later lines),
    # and 'reviewer:' singular matches case-insensitively.
    assert _parse_reviewer_emails(
        "launch brief\nReviewer: c@z.dev d@z.dev\nother@line.com ignored"
    ) == ["c@z.dev", "d@z.dev"]


@pytest.mark.asyncio
async def test_blog_review_skipped_without_capability_or_reviewers(monkeypatch):
    # caps.display False → no publish even with reviewers present.
    result, _posts, _updates, calls = await _run_delivery(
        monkeypatch,
        channels=["blog"],
        delivery_events=[_deliver("finish", 1)],
        caps={"platform_pr": True, "typefully": False, "display": False},
        reviewer_emails=["a@x.com"],
    )
    assert result["status"] == "ready_to_ship"
    assert "display_publish" not in [m for _, m, _ in calls]
    assert result["deliveries"]["blog_review"] == {
        "status": "skipped",
        "url": None,
        "version": None,
    }

    # caps.display True but NO reviewers (input empty, brief has no line) →
    # loop skipped; the delivery gate still proceeds normally.
    result, _posts, _updates, calls = await _run_delivery(
        monkeypatch,
        channels=["blog"],
        delivery_events=[_deliver("finish", 1)],
        caps={"platform_pr": True, "typefully": False, "display": True},
    )
    assert result["status"] == "ready_to_ship"
    assert "display_publish" not in [m for _, m, _ in calls]
    assert result["deliveries"]["blog_review"]["status"] == "skipped"


@pytest.mark.asyncio
async def test_blog_review_publish_and_clean_approve(monkeypatch):
    result, posts, _updates, calls = await _run_delivery(
        monkeypatch,
        channels=["blog"],
        delivery_events=[_deliver("finish", 1)],
        blog_review_events=[_review("approve", 1)],
        caps={"platform_pr": True, "typefully": False, "display": True},
        reviewer_emails=["a@x.com"],
    )

    assert result["status"] == "ready_to_ship"
    publishes = [c for c in calls if c[1] == "display_publish"]
    assert len(publishes) == 1
    assert publishes[0][2]["visibility"] == "private"
    assert publishes[0][2]["share"] == ["a@x.com"]
    # A posted message carries the artifact URL for reviewers.
    assert DISPLAY_URL in str(posts)
    assert result["deliveries"]["blog_review"] == {
        "status": "approved",
        "url": DISPLAY_URL,
        "version": 1,
    }
    # Artifact retained as the review record — never unpublished on approve.
    assert "display_unpublish" not in [m for _, m, _ in calls]
    # Flow continues into the delivery gate.
    assert "render_delivery_gate_r1" in [p.get("name") for p in posts]


@pytest.mark.asyncio
async def test_blog_review_pull_and_revise_round(monkeypatch):
    comments_responses = iter(
        [
            # r1 pull: one open comment.
            [{"id": "c1", "body": "fix intro", "text_quote": "intro"}],
            # r2 pull: c1 already resolved in r1 (must NOT be re-fed) + a NEW
            # comment left on a stale page view (created_on_version 1 < current
            # version 2) — still fed: there is NO created_on_version filtering.
            [
                {"id": "c1", "body": "fix intro", "text_quote": "intro"},
                {
                    "id": "c2",
                    "body": "tighten ending",
                    "text_quote": "ending",
                    "created_on_version": 1,
                },
            ],
            # r3 approve check: everything resolved → clean approve.
            [
                {"id": "c1", "body": "fix intro", "text_quote": "intro"},
                {"id": "c2", "body": "tighten ending", "text_quote": "ending"},
            ],
        ]
    )
    revise_responses = iter(
        [
            {
                "ok": True,
                "markdown": "REVISED-1",
                "director_audit": {"verdict": "pass"},
                "stale_anchors": [],
            },
            {
                "ok": True,
                "markdown": "REVISED",
                "director_audit": {"verdict": "pass", "tempo": "calm"},
                "stale_anchors": ["c1-anchor"],
            },
        ]
    )
    wait_log: list = []
    result, _posts, updates, calls = await _run_delivery(
        monkeypatch,
        channels=["blog"],
        delivery_events=[
            _deliver("preview_pr", 1),
            _deliver("create_pr", 2),
            _deliver("finish", 3),
        ],
        blog_review_events=[
            _review("pull_revise", 1),
            _review("pull_revise", 2),
            _review("approve", 3),
        ],
        caps={"platform_pr": True, "typefully": False, "display": True},
        reviewer_emails=["a@x.com"],
        wait_log=wait_log,
        overrides={
            "display_comments": lambda _n, _a: {
                "ok": True,
                "comments": next(comments_responses),
            },
            "display_revise": lambda _n, _a: next(revise_responses),
        },
    )

    assert result["status"] == "ready_to_ship"
    # Round 2's revise was fed ONLY the new comment (c1 not re-fed; c2 fed
    # despite its stale created_on_version).
    revises = [c for c in calls if c[1] == "display_revise"]
    assert len(revises) == 2
    assert revises[1][2]["comments"] == [
        {"text_quote": "ending", "body": "tighten ending"}
    ]
    # Republish carries short_id + base_version (1 then 2).
    publishes = [c for c in calls if c[1] == "display_publish"]
    assert len(publishes) == 3
    assert "base_version" not in publishes[0][2]
    assert publishes[1][2]["short_id"] == "abc123"
    assert publishes[1][2]["base_version"] == 1
    assert publishes[2][2]["base_version"] == 2
    # display_resolve for the fed id only AFTER its republish succeeded.
    indexed = list(enumerate(calls))
    republish_1 = next(i for i, c in indexed if c[0] == "display_publish_r2")
    resolve_c1 = next(i for i, c in indexed if c[1] == "display_resolve")
    assert calls[resolve_c1][2] == {"root_comment_id": "c1"}
    assert resolve_c1 > republish_1
    assert [c[2]["root_comment_id"] for c in calls if c[1] == "display_resolve"] == [
        "c1",
        "c2",
    ]
    # Re-render mentions the director audit; the stale-anchor note is its own block.
    flat_updates = str(updates)
    assert "Director audit:" in flat_updates
    round_3 = next(u for u in updates if u.get("name") == "render_blog_review_r3")
    stale_blocks = [
        b for b in round_3["blocks"] if "reference spans that were rewritten" in str(b)
    ]
    assert len(stale_blocks) == 1
    # The revised text replaced the blog entry and flowed into the emit args.
    assert result["final_by_channel"]["blog"]["text"] == "REVISED"
    assert result["final_by_channel"]["blog"]["edited"] is True
    emits = [c for c in calls if c[1] == "emit_platform_pr"]
    for emit in emits:
        assert emit[2]["final_by_channel"]["blog"]["text"] == "REVISED"
    assert result["deliveries"]["blog_review"] == {
        "status": "approved",
        "url": DISPLAY_URL,
        "version": 3,
    }
    # Fresh-gate invariant across BOTH loops: blog_review waits then deliver
    # waits, each strictly increasing.
    assert [(name, version) for name, version, _ in wait_log] == [
        ("wait_blog_review_r1", 1),
        ("wait_blog_review_r2", 2),
        ("wait_blog_review_r3", 3),
        ("wait_delivery_gate_r1", 1),
        ("wait_delivery_gate_r2", 2),
        ("wait_delivery_gate_r3", 3),
    ]


@pytest.mark.asyncio
async def test_blog_review_failed_revise_does_not_consume_budget(monkeypatch):
    """10 failed revisions then a successful one: if failures consumed the
    MAX_BLOG_REVIEW_ROUNDS budget the 11th round would exit 'exhausted'
    before the success. They don't (spec: failed revision 'does not consume
    the round') — but each wait still used a fresh gate_version."""
    revise_calls = {"n": 0}

    def revise_override(_name, _args):
        revise_calls["n"] += 1
        if revise_calls["n"] <= 10:
            return {"ok": False, "error": "boom"}
        return {
            "ok": True,
            "markdown": "REVISED",
            "director_audit": {"verdict": "pass"},
            "stale_anchors": [],
        }

    comment_state = {"resolved": False}

    def comments_override(_name, _args):
        if comment_state["resolved"]:
            return {"ok": True, "comments": []}
        return {
            "ok": True,
            "comments": [{"id": "c1", "body": "fix it", "text_quote": "span"}],
        }

    def resolve_override(_name, _args):
        comment_state["resolved"] = True
        return {"ok": True}

    result, _posts, updates, calls = await _run_delivery(
        monkeypatch,
        channels=["blog"],
        delivery_events=[_deliver("finish", 1)],
        blog_review_events=[_review("pull_revise", n) for n in range(1, 12)]
        + [_review("approve", 12)],
        caps={"platform_pr": True, "typefully": False, "display": True},
        reviewer_emails=["a@x.com"],
        overrides={
            "display_revise": revise_override,
            "display_comments": comments_override,
            "display_resolve": resolve_override,
        },
    )

    assert result["status"] == "ready_to_ship"
    assert len([c for c in calls if c[1] == "display_revise"]) == 11
    # Version stayed 1 through every failure: the one republish based off v1.
    publishes = [c for c in calls if c[1] == "display_publish"]
    assert len(publishes) == 2
    assert publishes[1][2]["base_version"] == 1
    # A post-failure render said the revision failed and kept the version.
    assert "Revision failed: boom — keeping v1." in str(updates)
    assert result["deliveries"]["blog_review"] == {
        "status": "approved",
        "url": DISPLAY_URL,
        "version": 2,
    }


@pytest.mark.asyncio
async def test_blog_review_approve_with_open_comments_requires_confirm(monkeypatch):
    wait_log: list = []
    result, _posts, updates, calls = await _run_delivery(
        monkeypatch,
        channels=["blog"],
        delivery_events=[_deliver("finish", 1)],
        blog_review_events=[_review("approve", 1), _review("approve_anyway", 2)],
        caps={"platform_pr": True, "typefully": False, "display": True},
        reviewer_emails=["a@x.com"],
        wait_log=wait_log,
        overrides={
            "display_comments": lambda _n, _a: {
                "ok": True,
                "comments": [{"id": "c9", "body": "wait", "text_quote": "span"}],
            }
        },
    )

    assert result["status"] == "ready_to_ship"
    # The confirm round's allowed actions include approve_anyway (and the
    # render warns + offers the button).
    review_waits = [w for w in wait_log if w[0].startswith("wait_blog_review")]
    assert [(name, version) for name, version, _ in review_waits] == [
        ("wait_blog_review_r1", 1),
        ("wait_blog_review_r2", 2),
    ]
    assert "approve_anyway" in review_waits[1][2]
    assert "approve_anyway" not in review_waits[0][2]
    round_2 = next(u for u in updates if u.get("name") == "render_blog_review_r2")
    flat = str(round_2["blocks"]).replace("'", '"')
    assert "open comment(s) not yet addressed" in flat
    assert '"action":"approve_anyway"' in flat
    assert result["deliveries"]["blog_review"] == {
        "status": "approved",
        "url": DISPLAY_URL,
        "version": 1,
    }
    assert "display_unpublish" not in [m for _, m, _ in calls]


@pytest.mark.asyncio
async def test_blog_review_abandon_unpublishes_and_delivery_gate_still_runs(
    monkeypatch,
):
    result, posts, _updates, calls = await _run_delivery(
        monkeypatch,
        channels=["blog"],
        delivery_events=[_deliver("finish", 1)],
        blog_review_events=[_review("abandon", 1)],
        caps={"platform_pr": True, "typefully": False, "display": True},
        reviewer_emails=["a@x.com"],
    )

    assert result["status"] == "ready_to_ship"
    assert "display_unpublish" in [m for _, m, _ in calls]
    # Review-abandon != release-abandon: the approved copy survives and the
    # delivery gate still offers the PR.
    assert result["deliveries"]["blog_review"] == {
        "status": "abandoned",
        "url": None,
        "version": 1,
    }
    assert result["final_by_channel"]["blog"]["text"] == "blog approved copy"
    assert "render_delivery_gate_r1" in [p.get("name") for p in posts]


@pytest.mark.asyncio
async def test_blog_review_wait_cap_exhaustion_maps_to_abandoned(monkeypatch):
    # 30 pull_revise rounds that find no new comments: no budget consumed,
    # but every round burns a wait — the hard cap trips.
    result, _posts, updates, calls = await _run_delivery(
        monkeypatch,
        channels=["blog"],
        delivery_events=[_deliver("finish", 1)],
        blog_review_events=[_review("pull_revise", n) for n in range(1, 31)],
        caps={"platform_pr": True, "typefully": False, "display": True},
        reviewer_emails=["a@x.com"],
    )

    assert result["status"] == "ready_to_ship"
    assert len([c for c in calls if c[1] == "display_comments"]) == 30
    assert "display_unpublish" in [m for _, m, _ in calls]
    # Spec status enum stays approved|abandoned|skipped — exhaustion is
    # "abandoned" plus a distinct reason, never a widened enum.
    assert result["deliveries"]["blog_review"] == {
        "status": "abandoned",
        "url": None,
        "version": 1,
        "exhaustion_reason": "max_waits_reached",
    }
    terminal = [u for u in updates if u.get("name") == "render_blog_review_terminal"]
    assert len(terminal) == 1
    assert '"type": "actions"' not in str(terminal[0]["blocks"]).replace("'", '"')
    # Delivery gate still runs after review exhaustion.
    assert any(u.get("name") == "render_delivery_gate_terminal" for u in updates)


@pytest.mark.asyncio
async def test_blog_review_failed_republish_discards_revision(monkeypatch):
    comments_responses = iter(
        [
            [{"id": "c1", "body": "fix intro", "text_quote": "intro"}],
            [],  # approve-path check: exit clean
        ]
    )
    publish_calls = {"n": 0}

    def publish_override(_name, args):
        publish_calls["n"] += 1
        if publish_calls["n"] == 1:
            return {"ok": True, "short_id": "abc123", "url": DISPLAY_URL, "version": 1}
        return {"ok": False, "error": "version_conflict"}

    result, _posts, updates, calls = await _run_delivery(
        monkeypatch,
        channels=["blog"],
        delivery_events=[
            _deliver("preview_pr", 1),
            _deliver("create_pr", 2),
            _deliver("finish", 3),
        ],
        blog_review_events=[_review("pull_revise", 1), _review("approve", 2)],
        caps={"platform_pr": True, "typefully": False, "display": True},
        reviewer_emails=["a@x.com"],
        overrides={
            "display_publish": publish_override,
            "display_comments": lambda _n, _a: {
                "ok": True,
                "comments": next(comments_responses),
            },
            "display_revise": lambda _n, _a: {
                "ok": True,
                "markdown": "REVISED-DISCARDED",
                "director_audit": {"verdict": "pass"},
                "stale_anchors": [],
            },
        },
    )

    assert result["status"] == "ready_to_ship"
    # Republish failed → the revision is discarded: no resolve, version
    # unchanged, the later approve ships the ORIGINAL text.
    assert "display_resolve" not in [m for _, m, _ in calls]
    assert "revision discarded" in str(updates)
    assert result["deliveries"]["blog_review"] == {
        "status": "approved",
        "url": DISPLAY_URL,
        "version": 1,
    }
    assert result["final_by_channel"]["blog"]["text"] == "blog approved copy"
    assert result["final_by_channel"]["blog"].get("edited") is not True
    emits = [c for c in calls if c[1] == "emit_platform_pr"]
    for emit in emits:
        assert emit[2]["final_by_channel"]["blog"]["text"] == "blog approved copy"
    assert "REVISED-DISCARDED" not in str(emits)


@pytest.mark.asyncio
async def test_blog_review_processing_renders_and_abandon_after_revision(monkeypatch):
    comments_responses = iter(
        [
            [{"id": "c1", "body": "fix intro", "text_quote": "intro"}],  # r1 pull
            [{"id": "c2", "body": "more", "text_quote": "span"}],  # r2 approve check
        ]
    )
    timeline: list = []
    result, _posts, updates, calls = await _run_delivery(
        monkeypatch,
        channels=["blog"],
        delivery_events=[_deliver("finish", 1)],
        blog_review_events=[
            _review("pull_revise", 1),
            _review("approve", 2),
            _review("abandon", 3),
        ],
        caps={"platform_pr": True, "typefully": False, "display": True},
        reviewer_emails=["a@x.com"],
        timeline=timeline,
        overrides={
            "display_comments": lambda _n, _a: {
                "ok": True,
                "comments": next(comments_responses),
            },
        },
    )

    assert result["status"] == "ready_to_ship"
    # The ⏳ processing render lands BEFORE the slow tool calls it announces.
    assert timeline.index(
        ("update", "render_blog_review_revising_r1")
    ) < timeline.index(("call", "display_comments_r1"))
    assert timeline.index(("call", "display_comments_r1")) < timeline.index(
        ("call", "display_revise_r1")
    )
    assert timeline.index(
        ("update", "render_blog_review_checking_r2")
    ) < timeline.index(("call", "display_comments_approve_r2"))
    # Processing renders are buttonless and show the spinner.
    for name in ("render_blog_review_revising_r1", "render_blog_review_checking_r2"):
        render = next(u for u in updates if u.get("name") == name)
        flat = str(render["blocks"]).replace("'", '"')
        assert '"type": "actions"' not in flat
        assert "⏳" in flat
    # Abandon AFTER a successful revision: the revision is persisted in the
    # result and the terminal render warns the PR uses the pre-review text.
    assert "display_unpublish" in [m for _, m, _ in calls]
    assert result["deliveries"]["blog_review"] == {
        "status": "abandoned",
        "url": None,
        "version": 2,
        "discarded_revision": "REVISED",
    }
    terminal = next(
        u for u in updates if u.get("name") == "render_blog_review_terminal"
    )
    assert "PRE-review text" in str(terminal["text"])


@pytest.mark.asyncio
async def test_blog_review_reviewers_parsed_from_brief_and_input_override(monkeypatch):
    # Brief-parsed: malformed dropped, case-insensitive dedupe, order kept.
    result, _posts, _updates, calls = await _run_delivery(
        monkeypatch,
        channels=["blog"],
        delivery_events=[_deliver("finish", 1)],
        blog_review_events=[_review("approve", 1)],
        caps={"platform_pr": True, "typefully": False, "display": True},
        brief="for blog: perps launch. reviewers: a@x.com, B@x.com, notanemail, a@x.com",
    )
    assert result["status"] == "ready_to_ship"
    publish = next(c for c in calls if c[1] == "display_publish")
    assert publish[2]["share"] == ["a@x.com", "B@x.com"]

    # Explicit reviewer_emails input overrides the brief's line.
    result, _posts, _updates, calls = await _run_delivery(
        monkeypatch,
        channels=["blog"],
        delivery_events=[_deliver("finish", 1)],
        blog_review_events=[_review("approve", 1)],
        caps={"platform_pr": True, "typefully": False, "display": True},
        reviewer_emails=["z@y.com"],
        brief="for blog: perps launch. reviewers: a@x.com",
    )
    publish = next(c for c in calls if c[1] == "display_publish")
    assert publish[2]["share"] == ["z@y.com"]
