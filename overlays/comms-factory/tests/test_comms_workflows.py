from __future__ import annotations

from pathlib import Path
import sys

import pytest

OVERLAY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(OVERLAY_ROOT / "workflows"))
sys.path.insert(0, str(OVERLAY_ROOT))

from comms_shared import (  # noqa: E402
    Gate,
    GENERATED_CHANNELS,
    GateValidationError,
    PLANNING_ONLY_CHANNELS,
    STRUCTURED_CHANNELS,
    apply_fact_review_action,
    approved_fact_payloads,
    card_from_result,
    chunked_markdown_blocks,
    compact_ref,
    fact_review_complete,
    gate_correlation_id,
    normalize_channels,
    normalize_grounded_fact_review,
    render_fact_review_blocks,
    render_release_card_blocks,
    target_gate_correlation_id,
    validate_gate_event,
)


def _event(
    *,
    run_id: str = "run_1",
    stage: str = "facts",
    gate_version: int = 1,
    action: str = "approve",
    user_id: str = "U123",
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
    event = {"action": action, "ref": ref, "slack": {"user_id": user_id}}
    if values:
        event["values"] = values
    return event


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
        "x",
        "x-thread",
        "web",
        "carousel",
        "modal",
        "in-product",
        "blog",
    )
    assert set(STRUCTURED_CHANNELS) <= set(GENERATED_CHANNELS)
    assert set(PLANNING_ONLY_CHANNELS).isdisjoint(GENERATED_CHANNELS)


def test_gate_correlation_id_includes_stage_and_version():
    assert gate_correlation_id("run_1", "facts", 1) == "run_1:facts:1"
    assert gate_correlation_id("run_1", "card", 1) != gate_correlation_id(
        "run_1", "facts", 1
    )
    assert gate_correlation_id("run_1", "facts", 2) != gate_correlation_id(
        "run_1", "facts", 1
    )
    assert target_gate_correlation_id(Gate("run_1", "facts", 1), "fact_1") == (
        "run_1:facts:1:fact_1"
    )


def test_compact_ref_carries_requester_for_early_slackbot_auth():
    ref = compact_ref(Gate("run_1", "candidate", 3, "U123"), "approve", "candidate_1")

    assert '"run_id":"run_1"' in ref
    assert '"gate_version":3' in ref
    assert '"requester_user_id":"U123"' in ref
    assert len(ref) < 300


def test_compact_ref_carries_approvers_when_configured():
    ref = compact_ref(
        Gate("run_1", "candidate", 3, "U123", ("U456",)), "approve", "candidate_1"
    )

    assert '"approver_user_ids":["U456"]' in ref


def test_compact_ref_carries_event_type_for_generic_slackbot_dispatch():
    # The generic base slackbot dispatches whatever event_type the ref names, so
    # the comms gate must carry EVENT_TYPE for the workflow's wait to match.
    ref = compact_ref(Gate("run_1", "candidate", 1, "U123"), "approve", "candidate_1")
    assert '"event_type":"comms.action"' in ref


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
    text = "\n".join(f"line {i} " + "x" * 80 for i in range(80))  # ~7000 chars
    blocks = chunked_markdown_blocks(text)
    assert len(blocks) >= 3
    for block in blocks:
        assert block["type"] == "section"
        assert len(block["text"]["text"]) <= 2900
        assert not block["text"]["text"].endswith("…")  # no silent truncation
    rejoined = "\n".join(b["text"]["text"] for b in blocks)
    assert rejoined == text


def test_chunked_markdown_blocks_hard_splits_pathological_line_mid_text():
    text = "short line\n" + "x" * 5000 + "\ntail line"
    blocks = chunked_markdown_blocks(text)
    for block in blocks:
        assert len(block["text"]["text"]) <= 2900
        assert not block["text"]["text"].endswith("…")
    rejoined = "\n".join(b["text"]["text"] for b in blocks)
    assert rejoined.replace("\n", "") == text.replace("\n", "")


def test_compact_ref_sets_per_item_only_for_per_item_gates():
    # The facts gate is per-item: the base slackbot scopes correlation to
    # target_id only when per_item is set. Non-per-item gates must omit it so
    # their base-correlation waits still match.
    per_item_ref = compact_ref(
        Gate("run_1", "facts", 1, "U123", per_item=True), "approve_fact", "fact_1"
    )
    assert '"per_item":true' in per_item_ref

    base_ref = compact_ref(Gate("run_1", "card", 1, "U123"), "approve", None)
    assert "per_item" not in base_ref


def test_validate_gate_event_accepts_matching_requester():
    gate = Gate("run_1", "facts", 1, "U123")

    result = validate_gate_event(_event(), gate, {"approve"})

    assert result["action"] == "approve"


def test_validate_gate_event_accepts_matching_approver():
    gate = Gate("run_1", "facts", 1, "U123", ("U456",))

    result = validate_gate_event(_event(user_id="U456"), gate, {"approve"})

    assert result["action"] == "approve"


@pytest.mark.parametrize(
    ("event", "reason"),
    [
        (_event(stage="card"), "wrong_stage"),
        (_event(gate_version=2), "wrong_gate_version"),
        (_event(run_id="run_2"), "wrong_run_id"),
        (_event(user_id="U999"), "unauthorized_slack_user"),
        (_event(action="retry"), "unsupported_action"),
    ],
)
def test_validate_gate_event_rejects_stale_or_unauthorized_events(event, reason):
    gate = Gate("run_1", "facts", 1, "U123")

    with pytest.raises(GateValidationError) as exc:
        validate_gate_event(event, gate, {"approve"})

    assert exc.value.reason == reason


def test_tool_plane_ref_uses_env_base_url(monkeypatch):
    from comms_shared import tool_plane_ref

    class Ctx:
        run_id = "run_test"

    monkeypatch.setenv("CENTAUR_BASE_URL", "http://api:8000/")

    ref = tool_plane_ref(Ctx(), stage="ground", gate_version=1)

    # The workflow contributes only the idempotency prefix it uniquely knows; the
    # client (CommsFactoryClient._tool_plane_ref) is the single authority that
    # derives base_url/tools_url/auth from deployment env.
    assert ref == {"idempotency_prefix": "run_test:ground:1"}


def test_tool_plane_ref_returns_none_without_base_url(monkeypatch):
    from comms_shared import tool_plane_ref

    class Ctx:
        run_id = "run_test"

    monkeypatch.delenv("CENTAUR_BASE_URL", raising=False)
    monkeypatch.delenv("AGENT_API_URL", raising=False)

    assert tool_plane_ref(Ctx(), stage="ground") is None


def test_validate_gate_event_rejects_missing_slack_user_when_authority_is_configured():
    gate = Gate("run_1", "facts", 1, "U123")
    event = _event()
    event["slack"] = {}

    with pytest.raises(GateValidationError) as exc:
        validate_gate_event(event, gate, {"approve"})

    assert exc.value.reason == "missing_slack_user"


def test_normalize_grounded_fact_review_preserves_value_and_matches_evidence():
    review = normalize_grounded_fact_review(
        {
            "facts": [
                {
                    "claim": "Infinex supports Arbitrum",
                    "value": "USDC is available on Arbitrum in Infinex.",
                    "source_ref": "https://infinex.xyz/networks/arbitrum",
                    "confidence": 0.91,
                },
                {
                    "claim": "Headline",
                    "value": "The wallet for onchain users",
                    "evidence_ids": ["ev_2"],
                },
            ],
            "evidence": [
                {
                    "id": "ev_1",
                    "url": "https://infinex.xyz/networks/arbitrum",
                    "title": "Infinex Arbitrum",
                    "quote": "Use USDC on Arbitrum with Infinex.",
                },
                {
                    "id": "ev_1",
                    "url": "https://duplicate.example",
                    "quote": "Duplicate ID should be ignored.",
                },
                {"id": "ev_2", "url": "https://example.com", "quote": "Headline quote"},
                {"id": "ev_3", "url": "https://example.com", "quote": "Headline quote"},
            ],
            "unverifiable": [{"claim": "unsupported"}],
        }
    )

    first = review["facts"][0]
    second = review["facts"][1]
    assert first["id"] == "fact_1"
    assert first["claim"] == "Infinex supports Arbitrum"
    assert first["value"] == "USDC is available on Arbitrum in Infinex."
    assert first["evidence"][0]["quote"] == "Use USDC on Arbitrum with Infinex."
    assert second["evidence_ids"] == ["ev_2"]
    assert [item["id"] for item in review["evidence"]] == ["ev_1", "ev_2"]
    assert review["unverifiable"] == [{"claim": "unsupported"}]


def test_render_fact_review_blocks_include_values_sources_quotes_and_target_actions():
    gate = Gate("run_1", "facts", 1, "U123")
    review = normalize_grounded_fact_review(
        {
            "facts": [
                {
                    "claim": "Claim label",
                    "value": "Actual value operators need to approve",
                    "source_ref": "https://example.com/source",
                }
            ],
            "evidence": [
                {
                    "url": "https://example.com/source",
                    "title": "Source title",
                    "quote": "A short supporting quote.",
                }
            ],
            "unverifiable": ["Unsupported claim"],
        }
    )

    blocks = render_fact_review_blocks(gate, review["facts"], review["unverifiable"])
    text = str(blocks)

    assert "Actual value operators need to approve" in text
    assert "https://example.com/source" in text
    assert "A short supporting quote." in text
    assert "Unsupported claim" in text
    assert "Reject discards this fact. Cancel run stops the workflow." in text
    assert "Cancel run" in text
    assert "Abandon" not in text
    assert '"action":"approve_fact"' in text
    assert '"action":"abandon"' in text
    assert '"target_id":"fact_1"' in text


def test_render_fact_review_blocks_allows_fifteen_facts_with_active_fact_actions_only():
    gate = Gate("run_1", "facts", 1, "U123")
    review = normalize_grounded_fact_review(
        {
            "facts": [
                {"claim": f"Fact {idx}", "value": f"Value {idx}"}
                for idx in range(1, 16)
            ]
        }
    )

    blocks = render_fact_review_blocks(gate, review["facts"])
    text = str(blocks)

    assert "Fact 15" in text
    assert "too many" not in text.lower()
    assert text.count('"action":"approve_fact"') == 1
    assert '"target_id":"fact_1"' in text


def test_apply_fact_review_actions_filter_rejected_and_edit_values():
    review = normalize_grounded_fact_review(
        {
            "facts": [
                {"claim": "A", "value": "Original A"},
                {"claim": "B", "value": "Original B"},
            ]
        }
    )
    facts = apply_fact_review_action(
        review["facts"], _event(action="reject_fact", target_id="fact_1")
    )
    facts = apply_fact_review_action(
        facts,
        _event(
            action="edit_fact",
            target_id="fact_2",
            values={"comms_input.value": "Edited B"},
        ),
    )

    assert fact_review_complete(facts)
    approved = approved_fact_payloads(facts)
    assert [fact["id"] for fact in approved] == ["fact_2"]
    assert approved[0]["value"] == "Edited B"
    assert approved[0]["original_value"] == "Original B"


def test_apply_fact_review_action_reclick_approve_is_idempotent():
    review = normalize_grounded_fact_review(
        {"facts": [{"claim": "A", "value": "A value"}]}
    )
    facts = apply_fact_review_action(
        review["facts"], _event(action="approve_fact", target_id="fact_1")
    )

    again = apply_fact_review_action(
        facts, _event(action="approve_fact", target_id="fact_1")
    )

    assert again == facts


def test_render_release_card_blocks_summarizes_card_without_raw_dict_dump():
    gate = Gate("run_1", "card", 1, "U123")
    card = {
        "id": "card_1",
        "title": "Collector Crypt gacha release",
        "headline": "Create 5 X post options for Collector Crypt gacha",
        "audience": ["x"],
        "ship_date": "2026-06-05",
        "kind": "launch-tier",
        "tier_reason": "operator-approved comms release",
        "deployed_facts": [f"Approved fact {idx}" for idx in range(1, 12)],
    }

    blocks = render_release_card_blocks(card, gate)
    text = str(blocks)

    assert "Create 5 X post options for Collector Crypt gacha" in text
    assert "*Audience:*" in text
    assert "*Approved fact contract* — 11 fact(s) included" in text
    assert "Approved fact 10" in text
    assert "+1 more approved fact" in text
    assert "Approve card" in text
    assert "Edit card" in text
    assert "```" not in text
    assert "{'id':" not in text

    approved_blocks = render_release_card_blocks(
        card, complete=True, approved_by="U123"
    )
    approved_text = str(approved_blocks)
    assert "ReleaseCard approved" in approved_text
    assert "Approved by <@U123>" in approved_text
    assert "Approve card" not in approved_text


def test_card_from_result_does_not_fabricate_invalid_release_card_kind():
    assert card_from_result({"ok": True}, "brief", ["Fact A"]) is None
    assert card_from_result(
        {"ok": True, "release_card": {"kind": "launch-tier"}}, "brief", ["Fact A"]
    ) == {"kind": "launch-tier"}


@pytest.mark.asyncio
async def test_release_workflow_never_calls_external_publishing(monkeypatch):
    import comms_release

    calls: list[tuple[str, str]] = []
    posts: list[dict] = []
    updates: list[dict] = []

    async def fake_call_comms_tool(_ctx, _name, method, args):
        assert "LOCAL_DEV_API_KEY" not in str(args)
        assert "aiv2_" not in str(args)
        calls.append(("comms_factory", method))
        if method == "validate":
            return {"ok": True, "passed": True}
        if method == "ground_from_tools":
            assert args["workflow_run_id"] == "run_test"
            assert args["job_id"] == "comms:comms_release:run_test"
            assert args["thread_key"] == "slack:C123:1.2"
            assert args["idempotency_prefix"] == "run_test:ground:1"
            assert "tool_plane" not in args
            return {
                "ok": True,
                "verified_facts": [
                    {"text": "Fact A is live", "evidence_ids": ["ev_1"]}
                ],
                "evidence": [{"id": "ev_1"}],
            }
        if method == "build_card":
            assert args["facts"][0]["value"] == "Fact A is live"
            return {
                "ok": True,
                "release_card": {
                    "kind": "launch-tier",
                    "deployed_facts": ["Fact A is live"],
                },
            }
        if method == "generate":
            assert args["approved"] is True
            assert args["approved_facts"][0]["value"] == "Fact A is live"
            assert args["approval"]["workflow_run_id"] == "run_test"
            return {
                "ok": True,
                "candidates": [{"text": "Fact A is live.", "channel": "x"}],
            }
        raise AssertionError(method)

    async def fake_post_gate_message(_ctx, **kwargs):
        posts.append(kwargs)
        return {"channel": "C123", "ts": kwargs["name"]}

    async def fake_update_gate_message(*_args, **kwargs):
        updates.append(kwargs)
        return {"ok": True}

    events = iter(
        [
            _event(
                run_id="run_test",
                stage="facts",
                action="approve_fact",
                target_id="fact_1",
            ),
            _event(run_id="run_test", stage="card", action="approve"),
            _event(run_id="run_test", stage="candidate", action="approve"),
        ]
    )

    async def fake_wait_for_gate_action(*_args, **_kwargs):
        return next(events)

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
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action", fake_wait_for_gate_action
    )
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action_at_correlation", fake_wait_for_gate_action
    )

    result = await comms_release.handler(
        comms_release.Input(
            brief="generate for x: launch Fact A",
            thread_key="slack:C123:1.2",
            user_id="U123",
            delivery={"platform": "slack", "channel": "C123", "thread_ts": "1.2"},
        ),
        Ctx(),
    )

    assert result["status"] == "ready_to_ship"
    assert result["no_external_posting"] is True
    assert "Building ReleaseCard…" not in [post.get("text") for post in posts]
    card_posts = [post for post in posts if post.get("name") == "post_card_gate"]
    assert len(card_posts) == 1
    assert "Fact A is live" in str(card_posts[0]["blocks"])
    assert "```" not in str(card_posts[0]["blocks"])
    card_updates = [
        update for update in updates if update.get("name") == "update_card_gate"
    ]
    assert "ReleaseCard approved" in str(card_updates[-1]["blocks"])
    assert calls == [
        ("comms_factory", "ground_from_tools"),
        ("comms_factory", "build_card"),
        ("comms_factory", "generate"),
    ]


@pytest.mark.asyncio
async def test_release_workflow_filters_rejected_and_edited_facts(monkeypatch):
    import comms_release

    async def fake_call_comms_tool(_ctx, _name, method, args):
        if method == "validate":
            return {"ok": True, "passed": True}
        if method == "ground_from_tools":
            return {
                "ok": True,
                "facts": [
                    {"claim": "A", "value": "Rejected A"},
                    {
                        "claim": "B",
                        "value": "Original B",
                        "source_ref": "https://b.example",
                    },
                ],
                "evidence": [{"url": "https://b.example", "quote": "B quote"}],
            }
        if method == "build_card":
            assert [fact["id"] for fact in args["facts"]] == ["fact_2"]
            assert args["facts"][0]["value"] == "Edited B"
            assert args["evidence"][0]["quote"] == "B quote"
            return {"ok": True, "release_card": {"kind": "launch-tier"}}
        if method == "generate":
            assert [fact["id"] for fact in args["approved_facts"]] == ["fact_2"]
            assert args["approved_facts"][0]["value"] == "Edited B"
            return {"ok": True, "candidates": [{"text": "Edited B.", "channel": "x"}]}
        raise AssertionError(method)

    async def fake_post_gate_message(_ctx, **kwargs):
        return {"channel": "C123", "ts": kwargs["name"]}

    async def fake_update_gate_message(*_args, **_kwargs):
        return {"ok": True}

    fact_events = iter(
        [
            _event(run_id="run_test", action="reject_fact", target_id="fact_1"),
            _event(
                run_id="run_test",
                action="edit_fact",
                target_id="fact_2",
                values={"comms_input.value": "Edited B"},
            ),
        ]
    )
    gate_events = iter(
        [
            _event(run_id="run_test", stage="card", action="approve"),
            _event(run_id="run_test", stage="candidate", action="approve"),
        ]
    )

    fact_correlations: list[str] = []

    async def fake_wait_for_fact_action(*args, **_kwargs):
        fact_correlations.append(args[4])
        return next(fact_events)

    async def fake_wait_for_gate_action(*_args, **_kwargs):
        return next(gate_events)

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
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action", fake_wait_for_gate_action
    )
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action_at_correlation", fake_wait_for_fact_action
    )

    result = await comms_release.handler(
        comms_release.Input(
            brief="generate for x: launch", user_id="U123", delivery={}
        ),
        Ctx(),
    )

    assert result["status"] == "ready_to_ship"
    assert [fact["id"] for fact in result["facts"]] == ["fact_2"]
    assert result["facts"][0]["value"] == "Edited B"
    assert fact_correlations == ["run_test:facts:1:fact_1", "run_test:facts:1:fact_2"]


@pytest.mark.parametrize(
    ("generation", "expected_error"),
    [
        (
            {
                "error": "Tool call timed out after 120s",
                "tool": "comms_factory",
                "method": "generate",
            },
            "Tool call timed out after 120s",
        ),
        (
            {"ok": False, "error": "comms_factory_http_error", "status_code": 400},
            "comms_factory_http_error",
        ),
    ],
)
@pytest.mark.asyncio
async def test_release_workflow_blocks_generate_errors_before_candidate_gate(
    monkeypatch, generation, expected_error
):
    import comms_release

    calls: list[str] = []
    posts: list[dict] = []

    async def fake_call_comms_tool(_ctx, _name, method, _args):
        calls.append(method)
        if method == "validate":
            return {"ok": True, "passed": True}
        if method == "ground_from_tools":
            return {"ok": True, "facts": [{"claim": "A", "value": "Fact A"}]}
        if method == "build_card":
            return {"ok": True, "release_card": {"kind": "launch-tier"}}
        if method == "generate":
            return generation
        raise AssertionError(method)

    async def fake_post_gate_message(_ctx, **kwargs):
        posts.append(kwargs)
        return {"channel": "C123", "ts": kwargs["name"]}

    async def fake_update_gate_message(*_args, **_kwargs):
        return {"ok": True}

    fact_events = iter(
        [_event(run_id="run_test", action="approve_fact", target_id="fact_1")]
    )
    gate_events = iter([_event(run_id="run_test", stage="card", action="approve")])

    async def fake_wait_for_fact_action(*_args, **_kwargs):
        return next(fact_events)

    async def fake_wait_for_gate_action(*_args, **_kwargs):
        return next(gate_events)

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
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action", fake_wait_for_gate_action
    )
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action_at_correlation", fake_wait_for_fact_action
    )

    result = await comms_release.handler(
        comms_release.Input(
            brief="generate for x: launch", user_id="U123", delivery={}
        ),
        Ctx(),
    )

    assert result["status"] == "blocked"
    assert result["stage"] == "generate"
    assert result["error"] == expected_error
    assert calls == ["ground_from_tools", "build_card", "generate"]
    assert "render_candidate_gate_r1" not in [post.get("name") for post in posts]
    assert all("Ready to ship" not in str(post.get("text")) for post in posts)


@pytest.mark.parametrize(
    ("card_result", "expected_error"),
    [
        ({"ok": False, "error": "build_card_failed"}, "build_card_failed"),
        ({"ok": True}, "release_card_missing"),
        (
            {"ok": True, "release_card": {"kind": "feature"}},
            "invalid_release_card_kind:feature",
        ),
    ],
)
@pytest.mark.asyncio
async def test_release_workflow_blocks_missing_or_failed_build_card_before_generate(
    monkeypatch, card_result, expected_error
):
    import comms_release

    calls: list[str] = []
    posts: list[dict] = []

    async def fake_call_comms_tool(_ctx, _name, method, _args):
        calls.append(method)
        if method == "validate":
            return {"ok": True, "passed": True}
        if method == "ground_from_tools":
            return {"ok": True, "facts": [{"claim": "A", "value": "Fact A"}]}
        if method == "build_card":
            return card_result
        if method == "generate":
            raise AssertionError("generate should not run without a ReleaseCard")
        raise AssertionError(method)

    async def fake_post_gate_message(_ctx, **kwargs):
        posts.append(kwargs)
        return {"channel": "C123", "ts": kwargs["name"]}

    async def fake_update_gate_message(*_args, **_kwargs):
        return {"ok": True}

    fact_events = iter(
        [_event(run_id="run_test", action="approve_fact", target_id="fact_1")]
    )

    async def fake_wait_for_fact_action(*_args, **_kwargs):
        return next(fact_events)

    async def unexpected_gate_wait(*_args, **_kwargs):
        raise AssertionError("card or candidate gates should not wait")

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
    monkeypatch.setattr(comms_release, "wait_for_gate_action", unexpected_gate_wait)
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action_at_correlation", fake_wait_for_fact_action
    )

    result = await comms_release.handler(
        comms_release.Input(
            brief="generate for x: launch", user_id="U123", delivery={}
        ),
        Ctx(),
    )

    assert result["status"] == "blocked"
    assert result["stage"] == "build-card"
    assert result["error"] == expected_error
    assert calls == ["ground_from_tools", "build_card"]
    assert "post_card_gate" not in [post.get("name") for post in posts]
    assert any(
        "Comms release blocked building ReleaseCard" in post["text"] for post in posts
    )


@pytest.mark.asyncio
async def test_release_workflow_blocks_too_many_facts_before_waiting(monkeypatch):
    import comms_release

    async def fake_call_comms_tool(_ctx, _name, method, _args):
        if method == "validate":
            return {"ok": True, "passed": True}
        if method == "ground_from_tools":
            return {
                "ok": True,
                "facts": [
                    {"claim": f"Fact {idx}", "value": f"Value {idx}"}
                    for idx in range(21)
                ],
            }
        raise AssertionError(method)

    async def fake_post_gate_message(_ctx, **kwargs):
        return {"channel": "C123", "ts": kwargs["name"]}

    async def fake_update_gate_message(*_args, **_kwargs):
        return {"ok": True}

    async def unexpected_wait(*_args, **_kwargs):
        raise AssertionError("facts gate should block before waiting")

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
    monkeypatch.setattr(comms_release, "wait_for_gate_action", unexpected_wait)
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action_at_correlation", unexpected_wait
    )

    result = await comms_release.handler(
        comms_release.Input(
            brief="generate for x: launch", user_id="U123", delivery={}
        ),
        Ctx(),
    )

    assert result == {"status": "blocked", "stage": "facts", "error": "too_many_facts"}


@pytest.mark.asyncio
async def test_release_workflow_rejects_invalid_gate_and_stops(monkeypatch):
    import comms_release

    calls: list[str] = []

    async def fake_call_comms_tool(_ctx, _name, method, _args):
        calls.append(method)
        if method == "validate":
            return {"ok": True, "passed": True}
        if method == "ground_from_tools":
            return {"ok": True, "facts": ["Fact A is live"]}
        raise AssertionError(f"unexpected tool call after rejected gate: {method}")

    async def fake_post_gate_message(_ctx, **kwargs):
        return {"channel": "C123", "ts": kwargs["name"]}

    async def fake_update_gate_message(*_args, **_kwargs):
        return {"ok": True}

    async def fake_wait_for_gate_action(*_args, **_kwargs):
        raise GateValidationError("wrong_stage")

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
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action", fake_wait_for_gate_action
    )
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action_at_correlation", fake_wait_for_gate_action
    )

    result = await comms_release.handler(
        comms_release.Input(
            brief="generate for x: launch Fact A",
            thread_key="slack:C123:1.2",
            user_id="U123",
            delivery={"platform": "slack", "channel": "C123", "thread_ts": "1.2"},
        ),
        Ctx(),
    )

    assert result == {"status": "rejected", "stage": "facts", "error": "wrong_stage"}
    assert calls == ["ground_from_tools"]


@pytest.mark.asyncio
async def test_release_blocks_unknown_channels_before_any_tool_call(monkeypatch):
    import comms_release

    calls: list[str] = []

    async def fake_call_comms_tool(_ctx, _name, method, _args):
        calls.append(method)
        return {"ok": True}

    posted: list[dict] = []

    async def fake_post_gate_message(_ctx, **kwargs):
        posted.append(kwargs)
        return {"channel": "C123", "ts": kwargs["name"]}

    class Ctx:
        run_id = "run_test"

        async def step(self, _name, fn, **_kwargs):
            return await fn()

    monkeypatch.setattr(comms_release, "call_comms_tool", fake_call_comms_tool)
    monkeypatch.setattr(comms_release, "post_gate_message", fake_post_gate_message)

    result = await comms_release.handler(
        comms_release.Input(
            brief="for x, tiktok: launch",
            user_id="U123",
            delivery={"platform": "slack"},
        ),
        Ctx(),
    )

    assert result["status"] == "blocked"
    assert result["stage"] == "channels"
    assert result["error"] == "unknown_channels"
    assert result["unknown_channels"] == ["tiktok"]
    assert calls == []  # blocked BEFORE grounding
    assert "tiktok" in posted[-1]["text"]
    assert "x-thread" in posted[-1]["text"]  # teaching message lists valid formats


@pytest.mark.asyncio
async def test_release_drops_planning_only_channels_with_note(monkeypatch):
    """`for email, x:` → generates for x only; the echo notes email is planning-only."""
    import comms_release

    generate_channels: list[list[str]] = []
    posted: list[dict] = []

    async def fake_call_comms_tool(_ctx, _name, method, args):
        if method == "validate":
            return {"ok": True, "passed": True}
        if method == "ground_from_tools":
            assert args["workflow_run_id"] == "run_test"
            assert args["job_id"] == "comms:comms_release:run_test"
            assert args["thread_key"] == "slack:C123:1.2"
            assert args["idempotency_prefix"] == "run_test:ground:1"
            return {
                "ok": True,
                "verified_facts": [
                    {"text": "Fact A is live", "evidence_ids": ["ev_1"]}
                ],
                "evidence": [{"id": "ev_1"}],
            }
        if method == "build_card":
            return {
                "ok": True,
                "release_card": {
                    "kind": "launch-tier",
                    "deployed_facts": ["Fact A is live"],
                },
            }
        if method == "generate":
            generate_channels.append(list(args["channels"]))
            return {
                "ok": True,
                "candidates": [{"text": "Fact A is live.", "channel": "x"}],
            }
        raise AssertionError(method)

    async def fake_post_gate_message(_ctx, **kwargs):
        posted.append(kwargs)
        return {"channel": "C123", "ts": kwargs["name"]}

    async def fake_update_gate_message(*_args, **_kwargs):
        return {"ok": True}

    events = iter(
        [
            _event(
                run_id="run_test",
                stage="facts",
                action="approve_fact",
                target_id="fact_1",
            ),
            _event(run_id="run_test", stage="card", action="approve"),
            _event(run_id="run_test", stage="candidate", action="approve"),
        ]
    )

    async def fake_wait_for_gate_action(*_args, **_kwargs):
        return next(events)

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
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action", fake_wait_for_gate_action
    )
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action_at_correlation", fake_wait_for_gate_action
    )

    result = await comms_release.handler(
        comms_release.Input(
            brief="for email, x: launch Fact A",
            thread_key="slack:C123:1.2",
            user_id="U123",
            delivery={"platform": "slack", "channel": "C123", "thread_ts": "1.2"},
        ),
        Ctx(),
    )

    assert result["status"] == "ready_to_ship"
    assert result["channels"] == ["x"]
    first_text = str(posted[0]["text"])
    assert "*Generating for:* x" in first_text
    assert "email" in first_text  # planning-only note names the dropped touchpoint
    assert "planning-only" in first_text
    assert generate_channels == [["x"]]


def test_parse_channels_still_extracts_prefix():
    import comms_release

    assert comms_release._parse_channels("for x, blog-thing: launch") == [
        "x",
        "blog-thing",
    ]
    assert comms_release._parse_channels("no prefix here") == []


# --- Director verdict surfacing in the candidate gate (U1/U2/U3) ---


def _candidate(idx, *, audit=None, channel="x"):
    cand = {"id": f"actor-x-option-{idx}", "channel": channel, "text": f"copy {idx}"}
    if audit is not None:
        cand["director_audit"] = audit
    return cand


def test_picks_from_generation_digs_envelope():
    import comms_release

    assert comms_release._picks_from_generation(
        {"output": {"picks": [{"id": "a"}]}}
    ) == [{"id": "a"}]
    assert comms_release._picks_from_generation({"picks": [{"id": "b"}]}) == [
        {"id": "b"}
    ]
    assert comms_release._picks_from_generation({"output": {}}) == []
    assert comms_release._picks_from_generation(None) == []


def test_publication_holds_only_when_gate_failed():
    import comms_release

    failed = _candidate(
        1,
        audit={
            "publication_gate_passed": False,
            "publication_gate_issues": ["confirm live", "confirm $1B"],
        },
    )
    assert comms_release._publication_holds(failed) == ["confirm live", "confirm $1B"]
    passed = _candidate(
        2, audit={"publication_gate_passed": True, "publication_gate_issues": ["x"]}
    )
    assert comms_release._publication_holds(passed) == []
    assert comms_release._publication_holds(_candidate(3)) == []  # no director_audit
    assert comms_release._publication_holds(None) == []


def test_format_generation_failure_is_human_readable_with_retry_hint():
    import comms_release

    result = {
        "error": "comms_factory_http_error",
        "ok": False,
        "response": {
            "error": "internal_error",
            "message": "internal server error",
            "ok": False,
        },
        "status_code": 500,
    }
    out = comms_release._format_generation_failure(result, "comms_factory_http_error")
    assert "{" not in out and "'ok'" not in out  # no raw dict
    assert "comms_factory_http_error" in out
    assert "internal server error" in out
    assert (
        "transient" in out.lower() and "retry" in out.lower()
    )  # retry guidance on 500


def test_format_generation_failure_non_transient_gives_generic_guidance():
    import comms_release

    out = comms_release._format_generation_failure(
        {"error": "bad_request"}, "bad_request"
    )
    assert "bad_request" in out
    assert "{" not in out
    assert "service logs" in out


def test_seed_final_by_channel_prefers_director_pick_and_falls_back():
    import comms_release

    candidates = [
        {"id": "c1", "channel": "x", "text": "x copy 1"},
        {"id": "c2", "channel": "x", "text": "x copy 2"},
        {"id": "b1", "channel": "blog", "text": "blog copy"},
    ]
    picks = [
        {"id": "c2", "channel": "x", "text": "x copy 2"}
    ]  # flat, like the live route
    state = comms_release._seed_final_by_channel(
        ["x", "blog", "modal"], candidates, picks
    )
    assert state["x"] == {
        "text": "x copy 2",
        "candidate_id": "c2",
        "edited": False,
        "pick": True,
    }
    # no blog pick → first blog candidate
    assert state["blog"] == {
        "text": "blog copy",
        "candidate_id": "b1",
        "edited": False,
        "pick": False,
    }
    # no modal candidates at all → missing (None entry)
    assert state["modal"] is None


def test_candidate_gate_blocks_star_only_director_picked_entries():
    import comms_release

    gate = Gate("run_1", "candidate", 1, "U123")
    candidates = [
        {"id": "c1", "channel": "x", "text": "x copy"},
        {"id": "b1", "channel": "blog", "text": "blog copy"},
    ]
    state = {
        "x": {"text": "x copy", "candidate_id": "c1", "edited": False, "pick": True},
        "blog": {
            "text": "blog copy",
            "candidate_id": "b1",
            "edited": False,
            "pick": False,
        },
    }
    blocks = comms_release._candidate_gate_blocks(
        gate,
        ["x", "blog"],
        state,
        candidates,
        retry_available=True,
        audit_line="",
        terminal=False,
    )
    flat = str(blocks)
    # the starred header is exactly the pick-seeded channel, not the fallback
    assert "*x*  ⭐ Director's pick" in flat
    assert "*blog*  ⭐ Director's pick" not in flat


def test_candidate_gate_blocks_render_per_channel_with_scoped_buttons():
    import comms_release

    gate = Gate("run_1", "candidate", 3, "U123", ("U999",))
    candidates = [
        {
            "id": "c1",
            "channel": "x",
            "text": "x copy",
            "director_audit": {"publication_gate_passed": True},
        },
        {"id": "t1", "channel": "x-thread", "text": "tweet1\n\ntweet2"},
    ]
    state = {
        "x": {"text": "x copy", "candidate_id": "c1", "edited": False},
        "x-thread": {"text": "tweet1\n\ntweet2", "candidate_id": "t1", "edited": False},
        "blog": None,
    }
    blocks = comms_release._candidate_gate_blocks(
        gate,
        ["x", "x-thread", "blog"],
        state,
        candidates,
        retry_available=True,
        audit_line="",
        terminal=False,
    )
    flat = str(blocks)
    assert "*x*" in flat and "*x-thread*" in flat
    assert "no candidates generated" in flat  # blog missing
    assert '"target_id":"x"' in flat  # Edit x carries its channel
    assert '"label":"r3 · Edit x"' in flat  # round-stamped modal label
    assert '"target_id":"x-thread"' not in flat  # structured: pick-or-retry only
    assert flat.count('"action":"edit_candidate"') == 1  # only the one editable channel
    assert '"action":"retry"' in flat and '"action":"approve"' in flat

    terminal_blocks = comms_release._candidate_gate_blocks(
        gate,
        ["x"],
        state,
        candidates,
        retry_available=False,
        audit_line="done",
        terminal=True,
    )
    assert '"type": "actions"' not in str(terminal_blocks).replace("'", '"')


# --- Round-based per-channel candidate gate loop ---


def _gen(candidates, picks=None):
    return {"ok": True, "candidates": candidates, "picks": picks or []}


def _gen_x_blog():
    return _gen(
        [
            {"id": "c1", "channel": "x", "text": "x pick copy"},
            {"id": "b1", "channel": "blog", "text": "blog pick copy"},
        ],
        [
            {"id": "c1", "channel": "x", "text": "x pick copy"},
            {"id": "b1", "channel": "blog", "text": "blog pick copy"},
        ],
    )


def _candidate_event(action, *, gate_version=1, target_id=None, values=None):
    return _event(
        run_id="run_test",
        stage="candidate",
        gate_version=gate_version,
        action=action,
        target_id=target_id,
        values=values,
    )


def _blog_edit(text="better blog", *, gate_version=1):
    return _candidate_event(
        "edit_candidate",
        gate_version=gate_version,
        target_id="blog",
        values={"comms_input.value": text},
    )


async def _run_release(
    monkeypatch, *, brief, candidate_events, generations, validate_result=None
):
    """Drive the release workflow through grounding/card with standard fakes,
    feeding `candidate_events` to the round-based candidate gate.

    `generations` is keyed by durable step name (`generate_candidates_attempt_1`,
    `generate_candidates_r{n}`). Returns (result, posts, updates, tool_calls).
    """
    import comms_release

    posts: list[dict] = []
    updates: list[dict] = []
    tool_calls: list[tuple[str, str]] = []

    async def fake_call_comms_tool(_ctx, name, method, _args):
        tool_calls.append((name, method))
        if method == "validate":
            return validate_result or {"ok": True, "passed": True}
        if method == "ground_from_tools":
            return {"ok": True, "facts": [{"claim": "A", "value": "Fact A"}]}
        if method == "build_card":
            return {"ok": True, "release_card": {"kind": "launch-tier"}}
        if method == "generate":
            return generations[name]
        raise AssertionError((name, method))

    async def fake_post_gate_message(_ctx, **kwargs):
        posts.append(kwargs)
        return {"channel": "C123", "ts": kwargs["name"]}

    async def fake_update_gate_message(_ctx, **kwargs):
        updates.append(kwargs)
        return {"ok": True}

    fact_events = iter(
        [_event(run_id="run_test", action="approve_fact", target_id="fact_1")]
    )
    gate_events = iter(
        [_event(run_id="run_test", stage="card", action="approve"), *candidate_events]
    )

    async def fake_wait_for_fact_action(*_args, **_kwargs):
        return next(fact_events)

    async def fake_wait_for_gate_action(*_args, **_kwargs):
        return next(gate_events)

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
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action", fake_wait_for_gate_action
    )
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action_at_correlation", fake_wait_for_fact_action
    )

    result = await comms_release.handler(
        comms_release.Input(brief=brief, user_id="U123", delivery={}),
        Ctx(),
    )
    return result, posts, updates, tool_calls


@pytest.mark.asyncio
async def test_release_multichannel_happy_path_ships_per_channel(monkeypatch):
    result, _posts, _updates, _calls = await _run_release(
        monkeypatch,
        brief="for x, blog: launch Fact A",
        candidate_events=[_candidate_event("approve")],
        generations={"generate_candidates_attempt_1": _gen_x_blog()},
    )

    assert result["status"] == "ready_to_ship"
    assert result["final_by_channel"]["x"]["text"] == "x pick copy"
    assert result["final_by_channel"]["blog"]["text"] == "blog pick copy"
    assert result["missing_channels"] == []
    assert "final_copy" not in result
    assert result["no_external_posting"] is True


@pytest.mark.asyncio
async def test_release_edit_round_preserves_provenance_and_revalidates(monkeypatch):
    result, _posts, updates, calls = await _run_release(
        monkeypatch,
        brief="for x, blog: launch Fact A",
        candidate_events=[
            _blog_edit("better blog"),
            _candidate_event("approve", gate_version=2),
        ],
        generations={"generate_candidates_attempt_1": _gen_x_blog()},
        validate_result={
            "ok": True,
            "passed": False,
            "failures": [{"rule": "cliche", "reason": "banned phrase"}],
        },
    )

    # The edit stands and preserves provenance (candidate_id is NOT nulled).
    assert result["status"] == "ready_to_ship"
    assert result["final_by_channel"]["blog"] == {
        "text": "better blog",
        "candidate_id": "b1",
        "edited": True,
        "pick": True,  # blog was seeded from a Director pick; edits keep the flag
    }
    assert result["final_by_channel"]["x"] == {
        "text": "x pick copy",
        "candidate_id": "c1",
        "edited": False,
        "pick": True,
    }
    # The edited copy was re-checked via /validate as a round-scoped durable step.
    assert ("validate_edit_blog_r1", "validate") in calls
    # Validator failures surface as a non-blocking ⚠️ line in a gate render.
    assert any(
        "edit flagged by validator" in str(update.get("blocks"))
        and "cliche" in str(update.get("blocks"))
        for update in updates
    )


@pytest.mark.asyncio
async def test_release_empty_edit_modal_is_noop_with_warning(monkeypatch):
    result, _posts, updates, calls = await _run_release(
        monkeypatch,
        brief="for x, blog: launch Fact A",
        candidate_events=[
            _candidate_event("edit_candidate", target_id="blog", values={}),
            _candidate_event("approve", gate_version=2),
        ],
        generations={"generate_candidates_attempt_1": _gen_x_blog()},
    )

    assert result["status"] == "ready_to_ship"
    assert result["final_by_channel"]["blog"]["text"] == "blog pick copy"
    assert result["final_by_channel"]["blog"]["edited"] is False
    assert any("previous copy kept" in str(update.get("blocks")) for update in updates)
    # No validate re-check for a no-op edit.
    assert ("validate_edit_blog_r1", "validate") not in calls


@pytest.mark.asyncio
async def test_release_retry_failure_keeps_state_and_budget(monkeypatch):
    result, _posts, updates, _calls = await _run_release(
        monkeypatch,
        brief="for x, blog: launch Fact A",
        candidate_events=[
            _blog_edit("better blog"),
            _candidate_event(
                "retry", gate_version=2, values={"comms_input.value": "feedback"}
            ),
            _candidate_event("approve", gate_version=3),
        ],
        generations={
            "generate_candidates_attempt_1": _gen_x_blog(),
            "generate_candidates_r2": {"ok": False, "error": "boom"},
        },
    )

    # The failed retry did not kill the run or discard the operator's edit.
    assert result["status"] == "ready_to_ship"
    assert result["final_by_channel"]["blog"]["text"] == "better blog"
    assert result["final_by_channel"]["x"]["text"] == "x pick copy"
    assert any("Retry failed" in str(update.get("blocks")) for update in updates)
    # The one-retry budget was NOT consumed: round 3 still offers Retry.
    round_3 = [u for u in updates if u.get("name") == "render_candidate_gate_r3"]
    assert len(round_3) == 1
    assert '"action":"retry"' in str(round_3[0]["blocks"])


@pytest.mark.asyncio
async def test_release_retry_success_reseeds_and_keeps_missing_channels(monkeypatch):
    result, _posts, updates, _calls = await _run_release(
        monkeypatch,
        brief="for x, blog: launch Fact A",
        candidate_events=[
            _blog_edit("better blog"),
            _candidate_event(
                "retry", gate_version=2, values={"comms_input.value": "feedback"}
            ),
            _candidate_event("approve", gate_version=3),
        ],
        generations={
            "generate_candidates_attempt_1": _gen_x_blog(),
            "generate_candidates_r2": _gen(
                [{"id": "c9", "channel": "x", "text": "new x copy"}],
                [{"id": "c9", "channel": "x", "text": "new x copy"}],
            ),
        },
    )

    assert result["status"] == "ready_to_ship"
    # x was re-seeded from the retry's Director pick.
    assert result["final_by_channel"]["x"]["text"] == "new x copy"
    # blog produced no retry candidates → previous (edited) entry survives.
    assert result["final_by_channel"]["blog"] == {
        "text": "better blog",
        "candidate_id": "b1",
        "edited": True,
        "pick": True,  # blog was pick-seeded; the flag rides along through the edit
    }
    assert any(
        "kept from previous round" in str(update.get("blocks")) for update in updates
    )
    # Budget consumed on success: round 3 no longer offers Retry.
    round_3 = [u for u in updates if u.get("name") == "render_candidate_gate_r3"]
    assert len(round_3) == 1
    assert '"action":"retry"' not in str(round_3[0]["blocks"])


@pytest.mark.asyncio
async def test_release_structured_channel_gets_no_edit_button(monkeypatch):
    result, posts, _updates, _calls = await _run_release(
        monkeypatch,
        brief="for x-thread: launch Fact A",
        candidate_events=[_candidate_event("approve")],
        generations={
            "generate_candidates_attempt_1": _gen(
                [{"id": "t1", "channel": "x-thread", "text": "tweet1\n\ntweet2"}],
                [{"id": "t1", "channel": "x-thread", "text": "tweet1\n\ntweet2"}],
            )
        },
    )

    assert result["status"] == "ready_to_ship"
    gate_posts = [p for p in posts if p.get("name") == "render_candidate_gate_r1"]
    assert len(gate_posts) == 1
    blocks = gate_posts[0]["blocks"]
    # Exactly one actions block — the global one. No per-channel Edit for
    # structured channels (pick-or-retry only).
    assert str(blocks).replace("'", '"').count('"type": "actions"') == 1
    assert '"action":"edit_candidate"' not in str(blocks)


@pytest.mark.asyncio
async def test_release_blocks_when_no_channel_has_candidates(monkeypatch):
    result, posts, updates, _calls = await _run_release(
        monkeypatch,
        brief="generate for x: launch",
        candidate_events=[_candidate_event("approve")],
        generations={
            # Empty candidates list is a VALID generation — not a tool error.
            "generate_candidates_attempt_1": {"ok": True, "candidates": []}
        },
    )

    assert result["status"] == "blocked"
    assert result["stage"] == "candidate"
    assert result["error"] == "no_shippable_channels"
    assert result["final_by_channel"] == {"x": None}
    assert result["missing_channels"] == ["x"]
    assert all("Ready to ship" not in str(post.get("text")) for post in posts)
    terminal = [u for u in updates if u.get("name") == "render_candidate_gate_terminal"]
    assert len(terminal) == 1
    assert '"type": "actions"' not in str(terminal[0]["blocks"]).replace("'", '"')


@pytest.mark.asyncio
async def test_release_abandon_leaves_terminal_buttonless_gate(monkeypatch):
    result, _posts, updates, _calls = await _run_release(
        monkeypatch,
        brief="for x, blog: launch Fact A",
        candidate_events=[_candidate_event("abandon")],
        generations={"generate_candidates_attempt_1": _gen_x_blog()},
    )

    assert result["status"] == "abandoned"
    assert result["stage"] == "candidate"
    assert result["final_by_channel"]["x"]["text"] == "x pick copy"
    assert result["final_by_channel"]["blog"]["text"] == "blog pick copy"
    terminal = [u for u in updates if u.get("name") == "render_candidate_gate_terminal"]
    assert len(terminal) == 1
    assert '"type": "actions"' not in str(terminal[0]["blocks"]).replace("'", '"')


@pytest.mark.asyncio
async def test_release_blocks_after_candidate_round_limit(monkeypatch):
    result, _posts, updates, _calls = await _run_release(
        monkeypatch,
        brief="for x, blog: launch Fact A",
        candidate_events=[
            _blog_edit(f"edit {round_n}", gate_version=round_n)
            for round_n in range(1, 31)
        ],
        generations={"generate_candidates_attempt_1": _gen_x_blog()},
    )

    assert result["status"] == "blocked"
    assert result["stage"] == "candidate"
    assert result["error"] == "candidate_gate_limit"
    # State survives into the terminal payload — the last edit is recorded.
    assert result["final_by_channel"]["blog"]["text"] == "edit 30"
    assert result["missing_channels"] == []
    terminal = [u for u in updates if u.get("name") == "render_candidate_gate_terminal"]
    assert len(terminal) == 1
    assert "limit" in str(terminal[0]["text"])
    assert '"type": "actions"' not in str(terminal[0]["blocks"]).replace("'", '"')


@pytest.mark.asyncio
async def test_candidate_gate_constructs_fresh_gate_each_round(monkeypatch):
    """Each round MUST pass a distinct (name, gate_version) to wait_for_gate_action.

    This is the first-write-wins durable-event invariant: if gate_version is frozen
    (mutated to always be 1) the per-round correlation key collides with round 1 and
    the workflow cannot distinguish stale events.  A mutation that freezes
    gate_version=1 and the step name to "wait_candidate_gate_r1" must cause this test
    to fail.
    """
    import comms_release

    posts: list[dict] = []
    updates: list[dict] = []

    async def fake_call_comms_tool(_ctx, name, method, _args):
        if method == "validate":
            return {"ok": True, "passed": True}
        if method == "ground_from_tools":
            return {"ok": True, "facts": [{"claim": "A", "value": "Fact A"}]}
        if method == "build_card":
            return {"ok": True, "release_card": {"kind": "launch-tier"}}
        if method == "generate":
            return _gen_x_blog()
        raise AssertionError((name, method))

    async def fake_post_gate_message(_ctx, **kwargs):
        posts.append(kwargs)
        return {"channel": "C123", "ts": kwargs["name"]}

    async def fake_update_gate_message(_ctx, **kwargs):
        updates.append(kwargs)
        return {"ok": True}

    fact_events = iter(
        [_event(run_id="run_test", action="approve_fact", target_id="fact_1")]
    )
    card_events = iter([_event(run_id="run_test", stage="card", action="approve")])

    # Candidate events: two non-empty blog edits (rounds 1 and 2) then approve
    # (round 3).  Three distinct candidate-gate waits are expected.
    candidate_events = iter(
        [
            _blog_edit("edit round 1", gate_version=1),
            _blog_edit("edit round 2", gate_version=2),
            _candidate_event("approve", gate_version=3),
        ]
    )

    waits: list[tuple[str, int]] = []

    async def fake_wait_for_fact_action(*_args, **_kwargs):
        return next(fact_events)

    async def fake_wait_for_card_or_candidate(ctx, name, gate, allowed):
        # Card gate comes first (single call); after that all calls are candidate-gate.
        if gate.stage == "card":
            return next(card_events)
        # Candidate gate: record (step name, gate_version) before returning event.
        waits.append((name, gate.gate_version))
        return next(candidate_events)

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
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action", fake_wait_for_card_or_candidate
    )
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action_at_correlation", fake_wait_for_fact_action
    )

    result = await comms_release.handler(
        comms_release.Input(
            brief="for x, blog: launch Fact A", user_id="U123", delivery={}
        ),
        Ctx(),
    )

    assert result["status"] == "ready_to_ship"

    # Core invariant: each round produces a fresh (step_name, gate_version) pair.
    assert waits == [
        ("wait_candidate_gate_r1", 1),
        ("wait_candidate_gate_r2", 2),
        ("wait_candidate_gate_r3", 3),
    ]

    # Each render step name must also be round-scoped.
    post_update_names = [p.get("name") for p in posts] + [
        u.get("name") for u in updates
    ]
    assert "render_candidate_gate_r1" in post_update_names
    assert "render_candidate_gate_r2" in post_update_names
    assert "render_candidate_gate_r3" in post_update_names


@pytest.mark.asyncio
async def test_candidate_gate_validation_error_exits_with_rejected_status(monkeypatch):
    """GateValidationError raised during a candidate-gate wait must:
    - return status="rejected", stage="candidate", error=<reason>
    - carry the state payload (final_by_channel, missing_channels)
    - record an update with name "update_candidate_gate_rejected_r1" whose
      blocks contain no actions block (the gate is terminal/buttonless).
    """
    import comms_release

    posts: list[dict] = []
    updates: list[dict] = []

    async def fake_call_comms_tool(_ctx, name, method, _args):
        if method == "ground_from_tools":
            return {"ok": True, "facts": [{"claim": "A", "value": "Fact A"}]}
        if method == "build_card":
            return {"ok": True, "release_card": {"kind": "launch-tier"}}
        if method == "generate":
            return _gen_x_blog()
        raise AssertionError((name, method))

    async def fake_post_gate_message(_ctx, **kwargs):
        posts.append(kwargs)
        return {"channel": "C123", "ts": kwargs["name"]}

    async def fake_update_gate_message(_ctx, **kwargs):
        updates.append(kwargs)
        return {"ok": True}

    fact_events = iter(
        [_event(run_id="run_test", action="approve_fact", target_id="fact_1")]
    )
    card_events = iter([_event(run_id="run_test", stage="card", action="approve")])

    async def fake_wait_for_fact_action(*_args, **_kwargs):
        return next(fact_events)

    async def fake_wait_for_gate_action(ctx, name, gate, allowed):
        if gate.stage == "card":
            return next(card_events)
        # First (and only) candidate-stage call raises GateValidationError.
        raise GateValidationError("unauthorized_slack_user")

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
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action", fake_wait_for_gate_action
    )
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action_at_correlation", fake_wait_for_fact_action
    )

    result = await comms_release.handler(
        comms_release.Input(
            brief="for x, blog: launch Fact A", user_id="U123", delivery={}
        ),
        Ctx(),
    )

    assert result["status"] == "rejected"
    assert result["stage"] == "candidate"
    assert result["error"] == "unauthorized_slack_user"

    # State payload present: candidates were generated before the rejection.
    assert "final_by_channel" in result
    assert "missing_channels" in result

    # The rejection update step name must be round-scoped to r1.
    rejection_updates = [
        u for u in updates if u.get("name") == "update_candidate_gate_rejected_r1"
    ]
    assert len(rejection_updates) == 1
    blocks = rejection_updates[0]["blocks"]
    # Rejected gate is terminal — no actions block with interactive buttons.
    assert '"type": "actions"' not in str(blocks).replace("'", '"')
