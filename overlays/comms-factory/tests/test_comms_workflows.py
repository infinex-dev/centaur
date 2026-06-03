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
    compact_ref,
    gate_correlation_id,
    validate_gate_event,
)


def _event(
    *,
    run_id: str = "run_1",
    stage: str = "facts",
    gate_version: int = 1,
    action: str = "approve",
    user_id: str = "U123",
) -> dict:
    return {
        "action": action,
        "ref": {
            "run_id": run_id,
            "stage": stage,
            "gate_version": gate_version,
            "action": action,
            "requester_user_id": "U123",
        },
        "slack": {"user_id": user_id},
    }


def test_gate_correlation_id_includes_stage_and_version():
    assert gate_correlation_id("run_1", "facts", 1) == "run_1:facts:1"
    assert gate_correlation_id("run_1", "card", 1) != gate_correlation_id(
        "run_1", "facts", 1
    )
    assert gate_correlation_id("run_1", "facts", 2) != gate_correlation_id(
        "run_1", "facts", 1
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


def test_capability_plane_ref_uses_env_base_url(monkeypatch):
    from comms_shared import capability_plane_ref

    class Ctx:
        run_id = "run_test"

    monkeypatch.setenv("COMMS_FACTORY_CAPABILITY_BASE_URL", "http://api:8000/")

    ref = capability_plane_ref(Ctx(), stage="ground", gate_version=1)

    assert ref == {
        "schema_version": "centaur.capability_ref.v1",
        "base_url": "http://api:8000",
        "execute_url": "http://api:8000/capabilities/execute",
        "catalog_url": "http://api:8000/capabilities/catalog?profile=comms",
        "auth": {"type": "bearer_env", "env": "CENTAUR_CAPABILITY_TOKEN"},
        "idempotency_prefix": "run_test:ground:1",
    }


def test_capability_plane_ref_returns_none_without_base_url(monkeypatch):
    from comms_shared import capability_plane_ref

    class Ctx:
        run_id = "run_test"

    monkeypatch.delenv("COMMS_FACTORY_CAPABILITY_BASE_URL", raising=False)
    monkeypatch.delenv("CENTAUR_CAPABILITY_BASE_URL", raising=False)
    monkeypatch.delenv("AGENT_API_URL", raising=False)

    assert capability_plane_ref(Ctx(), stage="ground") is None


def test_validate_gate_event_rejects_missing_slack_user_when_authority_is_configured():
    gate = Gate("run_1", "facts", 1, "U123")
    event = _event()
    event["slack"] = {}

    with pytest.raises(GateValidationError) as exc:
        validate_gate_event(event, gate, {"approve"})

    assert exc.value.reason == "missing_slack_user"


@pytest.mark.asyncio
async def test_release_workflow_never_calls_external_publishing(monkeypatch):
    import comms_release

    calls: list[tuple[str, str]] = []

    async def fake_call_comms_tool(_ctx, _name, method, args):
        assert "LOCAL_DEV_API_KEY" not in str(args)
        assert "aiv2_" not in str(args)
        calls.append(("comms_factory", method))
        if method == "validate":
            return {"ok": True, "passed": True}
        if method == "ground_from_capabilities":
            assert args["workflow_run_id"] == "run_test"
            assert args["job_id"] == "comms:comms_release:run_test"
            assert args["thread_key"] == "slack:C123:1.2"
            assert args["capability_plane"]["auth"] == {
                "type": "bearer_env",
                "env": "CENTAUR_CAPABILITY_TOKEN",
            }
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
                    "kind": "feature",
                    "deployed_facts": ["Fact A is live"],
                },
            }
        if method == "generate":
            return {
                "ok": True,
                "candidates": [{"text": "Fact A is live.", "channel": "x"}],
            }
        raise AssertionError(method)

    async def fake_post_gate_message(_ctx, **kwargs):
        return {"channel": "C123", "ts": kwargs["name"]}

    async def fake_update_gate_message(*_args, **_kwargs):
        return {"ok": True}

    events = iter(
        [
            _event(run_id="run_test", stage="facts", action="approve"),
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
        "capability_plane_ref",
        lambda *_args, **_kwargs: {
            "execute_url": "http://api:8000/capabilities/execute",
            "catalog_url": "http://api:8000/capabilities/catalog?profile=comms",
            "auth": {"type": "bearer_env", "env": "CENTAUR_CAPABILITY_TOKEN"},
        },
    )
    monkeypatch.setattr(comms_release, "post_gate_message", fake_post_gate_message)
    monkeypatch.setattr(comms_release, "update_gate_message", fake_update_gate_message)
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action", fake_wait_for_gate_action
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
    assert calls == [
        ("comms_factory", "validate"),
        ("comms_factory", "ground_from_capabilities"),
        ("comms_factory", "build_card"),
        ("comms_factory", "generate"),
    ]


@pytest.mark.asyncio
async def test_release_workflow_rejects_invalid_gate_and_stops(monkeypatch):
    import comms_release

    calls: list[str] = []

    async def fake_call_comms_tool(_ctx, _name, method, _args):
        calls.append(method)
        if method == "validate":
            return {"ok": True, "passed": True}
        if method == "ground_from_capabilities":
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
        "capability_plane_ref",
        lambda *_args, **_kwargs: {
            "execute_url": "http://api:8000/capabilities/execute",
            "catalog_url": "http://api:8000/capabilities/catalog?profile=comms",
            "auth": {"type": "bearer_env", "env": "CENTAUR_CAPABILITY_TOKEN"},
        },
    )
    monkeypatch.setattr(comms_release, "post_gate_message", fake_post_gate_message)
    monkeypatch.setattr(comms_release, "update_gate_message", fake_update_gate_message)
    monkeypatch.setattr(
        comms_release, "wait_for_gate_action", fake_wait_for_gate_action
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
    assert calls == ["validate", "ground_from_capabilities"]
