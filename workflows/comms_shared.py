from __future__ import annotations

from dataclasses import dataclass, field
import json
from typing import Any

from api import slackbot_client
from api.workflow_engine import WorkflowContext

EVENT_TYPE = "comms.action"


@dataclass
class SlackWorkflowInput:
    thread_key: str = ""
    text: str = ""
    brief: str = ""
    user_id: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)
    delivery: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class Gate:
    run_id: str
    stage: str
    gate_version: int
    requester_user_id: str = ""

    @property
    def correlation_id(self) -> str:
        return gate_correlation_id(self.run_id, self.stage, self.gate_version)


def gate_correlation_id(run_id: str, stage: str, gate_version: int) -> str:
    return f"{run_id}:{stage}:{gate_version}"


def compact_ref(gate: Gate, action: str, target_id: str | None = None) -> str:
    payload: dict[str, Any] = {
        "run_id": gate.run_id,
        "stage": gate.stage,
        "gate_version": gate.gate_version,
        "action": action,
    }
    if target_id:
        payload["target_id"] = target_id
    if gate.requester_user_id:
        payload["requester_user_id"] = gate.requester_user_id
    return json.dumps(payload, separators=(",", ":"))


def button(
    gate: Gate,
    text: str,
    action: str,
    *,
    style: str | None = None,
    target_id: str | None = None,
) -> dict[str, Any]:
    element: dict[str, Any] = {
        "type": "button",
        "text": {"type": "plain_text", "text": text},
        "action_id": f"comms:{action}",
        "value": compact_ref(gate, action, target_id),
    }
    if style:
        element["style"] = style
    return element


def actions_block(
    gate: Gate, actions: list[tuple[str, str, str | None]]
) -> dict[str, Any]:
    return {
        "type": "actions",
        "elements": [
            button(gate, label, action, style=style) for label, action, style in actions
        ],
    }


def markdown_block(text: str) -> dict[str, Any]:
    return {"type": "section", "text": {"type": "mrkdwn", "text": truncate(text, 2900)}}


def context_block(text: str) -> dict[str, Any]:
    return {
        "type": "context",
        "elements": [{"type": "mrkdwn", "text": truncate(text, 2900)}],
    }


def truncate(text: Any, limit: int = 2800) -> str:
    value = str(text or "")
    return value if len(value) <= limit else f"{value[: limit - 1]}…"


async def post_gate_message(
    ctx: WorkflowContext,
    *,
    name: str,
    delivery: dict[str, Any],
    text: str,
    blocks: list[dict[str, Any]],
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    async def _post() -> dict[str, Any]:
        result = await slackbot_client.post_message(
            delivery,
            text=text,
            blocks=blocks,
            metadata=metadata,
        )
        if not result:
            raise RuntimeError("slack_gate_post_failed")
        return result

    return await ctx.step(name, _post, step_kind="slack_post")


async def update_gate_message(
    ctx: WorkflowContext,
    *,
    name: str,
    channel: str,
    ts: str,
    text: str,
    blocks: list[dict[str, Any]] | None = None,
) -> dict[str, Any] | None:
    async def _update() -> dict[str, Any] | None:
        return await slackbot_client.update_message(
            channel=channel, ts=ts, text=text, blocks=blocks
        )

    return await ctx.step(name, _update, step_kind="slack_update")


async def wait_for_gate(ctx: WorkflowContext, name: str, gate: Gate) -> dict[str, Any]:
    return await ctx.wait_for_event(
        name, event_type=EVENT_TYPE, correlation_id=gate.correlation_id
    )


async def call_comms_tool(
    ctx: WorkflowContext,
    name: str,
    method: str,
    args: dict[str, Any],
) -> dict[str, Any]:
    from api.app import get_tool_manager

    async def _call() -> dict[str, Any]:
        raw = await get_tool_manager().call_tool("comms_factory", method, args)
        if isinstance(raw, dict):
            return raw
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw
        except (TypeError, json.JSONDecodeError):
            return {
                "ok": False,
                "error": "invalid_tool_response",
                "raw": str(raw)[:1000],
            }
        return data if isinstance(data, dict) else {"ok": True, "data": data}

    return await ctx.step(name, _call, step_kind="tool_call")


def extract_action(event: dict[str, Any]) -> str:
    return str(
        event.get("action") or (event.get("ref") or {}).get("action") or ""
    ).strip()


def extract_modal_value(event: dict[str, Any]) -> str:
    values = event.get("values") if isinstance(event.get("values"), dict) else {}
    for value in values.values():
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def facts_from_grounding(result: dict[str, Any]) -> list[str]:
    facts = (
        result.get("facts")
        or result.get("verified_facts")
        or result.get("deployed_facts")
        or []
    )
    output: list[str] = []
    if isinstance(facts, list):
        for item in facts:
            if isinstance(item, str) and item.strip():
                output.append(item.strip())
            elif isinstance(item, dict):
                text = str(
                    item.get("fact") or item.get("text") or item.get("claim") or ""
                ).strip()
                if text:
                    output.append(text)
    return output


def candidates_from_generation(result: dict[str, Any]) -> list[dict[str, Any]]:
    raw = result.get("candidates") or result.get("data") or []
    if isinstance(raw, dict):
        raw = raw.get("candidates") or []
    candidates: list[dict[str, Any]] = []
    if isinstance(raw, list):
        for idx, item in enumerate(raw):
            if isinstance(item, str):
                candidates.append({"id": f"candidate_{idx + 1}", "text": item})
            elif isinstance(item, dict):
                candidate = dict(item)
                candidate.setdefault("id", f"candidate_{idx + 1}")
                candidates.append(candidate)
    return candidates


def card_from_result(
    result: dict[str, Any], brief: str, facts: list[str]
) -> dict[str, Any]:
    card = result.get("release_card") or result.get("card")
    if isinstance(card, dict):
        return card
    return {
        "kind": "feature",
        "title": brief[:80] or "Comms release",
        "deployed_facts": facts,
    }
