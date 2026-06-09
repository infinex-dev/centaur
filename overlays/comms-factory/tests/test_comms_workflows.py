from __future__ import annotations

from pathlib import Path
import sys

import pytest

OVERLAY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(OVERLAY_ROOT / "workflows"))
sys.path.insert(0, str(OVERLAY_ROOT))

from comms_shared import (  # noqa: E402
    Gate,
    GateValidationError,
    apply_fact_review_action,
    approved_fact_payloads,
    card_from_result,
    compact_ref,
    fact_review_complete,
    gate_correlation_id,
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
    review = normalize_grounded_fact_review({"facts": [{"claim": "A", "value": "A value"}]})
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

    approved_blocks = render_release_card_blocks(card, complete=True, approved_by="U123")
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
    card_updates = [update for update in updates if update.get("name") == "update_card_gate"]
    assert "ReleaseCard approved" in str(card_updates[-1]["blocks"])
    assert calls == [
        ("comms_factory", "validate"),
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
                    {"claim": "B", "value": "Original B", "source_ref": "https://b.example"},
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
    monkeypatch.setattr(comms_release, "wait_for_gate_action", fake_wait_for_gate_action)
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action_at_correlation", fake_wait_for_fact_action
    )

    result = await comms_release.handler(
        comms_release.Input(brief="generate for x: launch", user_id="U123", delivery={}),
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

    fact_events = iter([_event(run_id="run_test", action="approve_fact", target_id="fact_1")])
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
    monkeypatch.setattr(comms_release, "wait_for_gate_action", fake_wait_for_gate_action)
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action_at_correlation", fake_wait_for_fact_action
    )

    result = await comms_release.handler(
        comms_release.Input(brief="generate for x: launch", user_id="U123", delivery={}),
        Ctx(),
    )

    assert result["status"] == "blocked"
    assert result["stage"] == "generate"
    assert result["error"] == expected_error
    assert calls == ["validate", "ground_from_tools", "build_card", "generate"]
    assert "post_candidate_gate" not in [post.get("name") for post in posts]
    assert all("Ready to ship" not in str(post.get("text")) for post in posts)


@pytest.mark.asyncio
async def test_release_workflow_blocks_retry_generate_error_without_ready_gate(monkeypatch):
    import comms_release

    posts: list[dict] = []

    async def fake_call_comms_tool(_ctx, _name, method, _args):
        if method == "validate":
            return {"ok": True, "passed": True}
        if method == "ground_from_tools":
            return {"ok": True, "facts": [{"claim": "A", "value": "Fact A"}]}
        if method == "build_card":
            return {"ok": True, "release_card": {"kind": "launch-tier"}}
        if method == "generate" and _name == "generate_candidates_attempt_1":
            return {"ok": True, "candidates": [{"text": "First copy", "channel": "x"}]}
        if method == "generate" and _name == "generate_candidates_attempt_2":
            return {"error": "Tool call timed out after 120s"}
        raise AssertionError((method, _name))

    async def fake_post_gate_message(_ctx, **kwargs):
        posts.append(kwargs)
        return {"channel": "C123", "ts": kwargs["name"]}

    async def fake_update_gate_message(*_args, **_kwargs):
        return {"ok": True}

    fact_events = iter([_event(run_id="run_test", action="approve_fact", target_id="fact_1")])
    gate_events = iter(
        [
            _event(run_id="run_test", stage="card", action="approve"),
            _event(run_id="run_test", stage="candidate", action="retry"),
        ]
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
    monkeypatch.setattr(comms_release, "wait_for_gate_action", fake_wait_for_gate_action)
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action_at_correlation", fake_wait_for_fact_action
    )

    result = await comms_release.handler(
        comms_release.Input(brief="generate for x: launch", user_id="U123", delivery={}),
        Ctx(),
    )

    assert result["status"] == "blocked"
    assert result["stage"] == "generate"
    assert result["gate_version"] == 2
    assert result["error"] == "Tool call timed out after 120s"
    assert "post_candidate_gate" in [post.get("name") for post in posts]
    assert "post_candidate_retry_gate" not in [post.get("name") for post in posts]
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

    fact_events = iter([_event(run_id="run_test", action="approve_fact", target_id="fact_1")])

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
        comms_release.Input(brief="generate for x: launch", user_id="U123", delivery={}),
        Ctx(),
    )

    assert result["status"] == "blocked"
    assert result["stage"] == "build-card"
    assert result["error"] == expected_error
    assert calls == ["validate", "ground_from_tools", "build_card"]
    assert "post_card_gate" not in [post.get("name") for post in posts]
    assert any("Comms release blocked building ReleaseCard" in post["text"] for post in posts)


@pytest.mark.asyncio
async def test_release_workflow_does_not_ready_to_ship_without_final_copy(monkeypatch):
    import comms_release

    posts: list[dict] = []

    async def fake_call_comms_tool(_ctx, _name, method, _args):
        if method == "validate":
            return {"ok": True, "passed": True}
        if method == "ground_from_tools":
            return {"ok": True, "facts": [{"claim": "A", "value": "Fact A"}]}
        if method == "build_card":
            return {"ok": True, "release_card": {"kind": "launch-tier"}}
        if method == "generate":
            return {"ok": True, "candidates": []}
        raise AssertionError(method)

    async def fake_post_gate_message(_ctx, **kwargs):
        posts.append(kwargs)
        return {"channel": "C123", "ts": kwargs["name"]}

    async def fake_update_gate_message(*_args, **_kwargs):
        return {"ok": True}

    fact_events = iter([_event(run_id="run_test", action="approve_fact", target_id="fact_1")])
    gate_events = iter(
        [
            _event(run_id="run_test", stage="card", action="approve"),
            _event(run_id="run_test", stage="candidate", action="approve"),
        ]
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
    monkeypatch.setattr(comms_release, "wait_for_gate_action", fake_wait_for_gate_action)
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action_at_correlation", fake_wait_for_fact_action
    )

    result = await comms_release.handler(
        comms_release.Input(brief="generate for x: launch", user_id="U123", delivery={}),
        Ctx(),
    )

    assert result["status"] == "blocked"
    assert result["stage"] == "candidate"
    assert result["error"] == "missing_final_copy"
    assert all("Ready to ship" not in str(post.get("text")) for post in posts)
    assert all("No final copy selected" not in str(post.get("text")) for post in posts)


@pytest.mark.asyncio
async def test_release_workflow_blocks_too_many_facts_before_waiting(monkeypatch):
    import comms_release

    async def fake_call_comms_tool(_ctx, _name, method, _args):
        if method == "validate":
            return {"ok": True, "passed": True}
        if method == "ground_from_tools":
            return {
                "ok": True,
                "facts": [{"claim": f"Fact {idx}", "value": f"Value {idx}"} for idx in range(21)],
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
    monkeypatch.setattr(comms_release, "wait_for_gate_action_at_correlation", unexpected_wait)

    result = await comms_release.handler(
        comms_release.Input(brief="generate for x: launch", user_id="U123", delivery={}),
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
    assert calls == ["validate", "ground_from_tools"]


# --- Director verdict surfacing in the candidate gate (U1/U2/U3) ---


def _candidate(idx, *, audit=None, channel="x"):
    cand = {"id": f"actor-x-option-{idx}", "channel": channel, "text": f"copy {idx}"}
    if audit is not None:
        cand["director_audit"] = audit
    return cand


def test_format_candidates_renders_director_verdict_and_issues():
    import comms_release

    audit = {
        "primary_tempo": "commanding",
        "copy_voice_passed": True,
        "factual_passed": True,
        "publication_gate_passed": False,
        "publication_gate_issues": ["verify $1B is publicly defensible"],
        "factual_issues": [],
    }
    out = comms_release._format_candidates([_candidate(1, audit=audit)])
    assert "tempo *commanding*" in out
    assert "voice ✅" in out and "factual ✅" in out and "publish ⚠️" in out
    assert "⚠️ verify $1B is publicly defensible" in out


def test_format_candidates_stars_director_pick_by_id():
    import comms_release

    candidates = [_candidate(1), _candidate(2)]
    picks = [{"id": "actor-x-option-2", "text": "copy 2"}]
    out = comms_release._format_candidates(candidates, picks)
    # The star annotates option 2's header, not option 1's.
    option_2_header = [ln for ln in out.splitlines() if ln.startswith("*2.")][0]
    option_1_header = [ln for ln in out.splitlines() if ln.startswith("*1.")][0]
    assert "Director's pick" in option_2_header
    assert "Director's pick" not in option_1_header


def test_format_candidates_backward_compatible_without_audit_or_picks():
    import comms_release

    candidates = [{"id": "c1", "channel": "x", "text": "hello"}]
    out = comms_release._format_candidates(candidates)
    assert out == "*1. x*\n>hello"  # no badges, no star — identical to legacy format


def test_format_candidates_tolerates_empty_or_unmatched_picks():
    import comms_release

    candidates = [_candidate(1), _candidate(2)]
    assert "Director's pick" not in comms_release._format_candidates(candidates, [])
    unmatched = [{"id": "nope", "text": "x"}]
    assert "Director's pick" not in comms_release._format_candidates(candidates, unmatched)


def test_director_pick_text_ships_recommended_candidate_not_first():
    import comms_release

    candidates = [_candidate(1), _candidate(2)]
    picks = [{"id": "actor-x-option-2", "text": "copy 2"}]
    assert comms_release._director_pick_text(candidates, picks) == "copy 2"


def test_director_pick_text_falls_back_to_pick_text_when_id_unmatched():
    import comms_release

    candidates = [_candidate(1)]
    picks = [{"id": "ghost", "text": "the recommended copy"}]
    assert comms_release._director_pick_text(candidates, picks) == "the recommended copy"


def test_director_pick_text_falls_back_to_first_candidate_without_picks():
    import comms_release

    candidates = [_candidate(1), _candidate(2)]
    assert comms_release._director_pick_text(candidates, None) == "copy 1"
    assert comms_release._director_pick_text([], None) == ""


def test_picks_from_generation_digs_envelope():
    import comms_release

    assert comms_release._picks_from_generation({"output": {"picks": [{"id": "a"}]}}) == [
        {"id": "a"}
    ]
    assert comms_release._picks_from_generation({"picks": [{"id": "b"}]}) == [{"id": "b"}]
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
    passed = _candidate(2, audit={"publication_gate_passed": True, "publication_gate_issues": ["x"]})
    assert comms_release._publication_holds(passed) == []
    assert comms_release._publication_holds(_candidate(3)) == []  # no director_audit
    assert comms_release._publication_holds(None) == []


def test_format_validation_failure_is_human_readable_not_a_dict_dump():
    import comms_release

    validation = {
        "ok": True,
        "passed": False,
        "surface": "brief",
        "failures": [
            {"rule": "cliches", "reason": 'cliché "leverage"'},
            {"rule": "ai-slop", "reason": "em-dash density 1 in 106 chars"},
        ],
    }
    out = comms_release._format_validation_failure(validation)
    assert "{" not in out and "'ok'" not in out  # no raw dict
    assert "*cliches*" in out and 'cliché "leverage"' in out
    assert "*ai-slop*" in out and "em-dash density" in out
    assert "Rephrase" in out  # actionable guidance


def test_format_validation_failure_falls_back_when_no_structured_failures():
    import comms_release

    out = comms_release._format_validation_failure({"ok": False, "error": "tool_unavailable"})
    assert "tool_unavailable" in out
    assert "{" not in out
