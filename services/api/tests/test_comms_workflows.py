from __future__ import annotations

import pytest

from workflows.comms_shared import Gate, compact_ref, gate_correlation_id


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


@pytest.mark.asyncio
async def test_release_workflow_never_calls_external_publishing(monkeypatch):
    from workflows import comms_release

    calls: list[tuple[str, str]] = []

    async def fake_call_comms_tool(_ctx, _name, method, _args):
        calls.append(("comms_factory", method))
        if method == "validate":
            return {"ok": True, "passed": True}
        if method == "ground":
            return {"ok": True, "facts": ["Fact A is live"]}
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
            {"action": "approve", "stage": "facts"},
            {"action": "approve", "stage": "card"},
            {"action": "approve", "stage": "candidate"},
        ]
    )

    async def fake_wait_for_gate(*_args, **_kwargs):
        return next(events)

    class Ctx:
        run_id = "run_test"

        async def step(self, _name, fn, **_kwargs):
            return await fn()

    monkeypatch.setattr(comms_release, "call_comms_tool", fake_call_comms_tool)
    monkeypatch.setattr(comms_release, "post_gate_message", fake_post_gate_message)
    monkeypatch.setattr(comms_release, "update_gate_message", fake_update_gate_message)
    monkeypatch.setattr(comms_release, "wait_for_gate", fake_wait_for_gate)

    result = await comms_release.handler(
        comms_release.Input(
            brief="generate for x: launch Fact A",
            user_id="U123",
            delivery={"platform": "slack", "channel": "C123", "thread_ts": "1.2"},
        ),
        Ctx(),
    )

    assert result["status"] == "ready_to_ship"
    assert result["no_external_posting"] is True
    assert calls == [
        ("comms_factory", "validate"),
        ("comms_factory", "ground"),
        ("comms_factory", "build_card"),
        ("comms_factory", "generate"),
    ]
