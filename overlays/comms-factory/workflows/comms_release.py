from __future__ import annotations

from dataclasses import dataclass, field
import json
import re
from typing import Any

from api.workflow_engine import WorkflowContext

from comms_shared import (
    Gate,
    GateValidationError,
    SlackWorkflowInput,
    actions_block,
    call_comms_tool,
    candidates_from_generation,
    card_from_result,
    common_service_envelope,
    context_block,
    extract_action,
    extract_modal_value,
    facts_from_grounding,
    markdown_block,
    post_gate_message,
    tool_plane_ref,
    update_gate_message,
    wait_for_gate_action,
)

WORKFLOW_NAME = "comms_release"


@dataclass
class Input(SlackWorkflowInput):
    brief: str = ""
    channels: list[str] = field(default_factory=list)
    voice_id: str = "infinex"


async def handler(inp: Input, ctx: WorkflowContext) -> dict[str, Any]:
    brief = (inp.brief or inp.text or "").strip()
    if not brief:
        await _post_simple(
            ctx, inp.delivery, "Comms release needs a brief to generate from."
        )
        return {"status": "failed", "error": "missing_brief"}
    channels = inp.channels or _parse_channels(brief) or ["x"]

    validation = await call_comms_tool(
        ctx,
        "validate_brief",
        "validate",
        {
            "text": brief,
            "surface": "brief",
            **common_service_envelope(
                ctx, inp, stage="validate", gate_version=1, workflow_name=WORKFLOW_NAME
            ),
        },
    )
    if validation.get("ok") is False or validation.get("passed") is False:
        await _post_simple(
            ctx,
            inp.delivery,
            f"*Comms release stopped at validation*\n```{validation}```",
        )
        return {"status": "red", "validation": validation}

    await _post_simple(ctx, inp.delivery, "Grounding comms facts…")
    tool_plane = tool_plane_ref(ctx, stage="ground", gate_version=1)
    if tool_plane is None:
        await _post_simple(
            ctx,
            inp.delivery,
            "*Comms release blocked*: Centaur tool channel is not configured.",
        )
        return {
            "status": "blocked",
            "stage": "ground",
            "error": "tool_channel_unavailable",
        }
    grounding = await call_comms_tool(
        ctx,
        "ground_facts",
        "ground_from_tools",
        {
            "brief": brief,
            "run_id": ctx.run_id,
            "stage": "ground",
            "gate_version": 1,
            "tool_plane": tool_plane,
            **common_service_envelope(
                ctx, inp, stage="ground", gate_version=1, workflow_name=WORKFLOW_NAME
            ),
        },
    )
    if grounding.get("ok") is False or grounding.get("status") == "blocked":
        error = str(
            grounding.get("error") or grounding.get("status") or "grounding_failed"
        )
        await _post_simple(
            ctx, inp.delivery, f"*Comms release blocked at grounding*: {error}"
        )
        return {
            "status": "blocked",
            "stage": "ground",
            "error": error,
            "grounding": grounding,
        }
    facts = facts_from_grounding(grounding)
    evidence = (
        grounding.get("evidence") if isinstance(grounding.get("evidence"), list) else []
    )
    approver_user_ids = tuple(inp.approver_user_ids)
    facts_gate = Gate(ctx.run_id, "facts", 1, inp.user_id, approver_user_ids)
    facts_message = await post_gate_message(
        ctx,
        name="post_facts_gate",
        delivery=inp.delivery,
        text="Approve comms facts before generation.",
        blocks=[
            markdown_block("*Approve grounded facts*\n" + _format_facts(facts)),
            actions_block(
                facts_gate,
                [
                    ("Approve facts", "approve", "primary"),
                    ("Edit facts", "edit_facts", None),
                    ("Abandon", "abandon", "danger"),
                ],
            ),
        ],
        metadata={
            "event_type": "comms_gate",
            "event_payload": {"run_id": ctx.run_id, "stage": "facts"},
        },
    )
    try:
        facts_event = await wait_for_gate_action(
            ctx, "wait_facts_gate", facts_gate, {"approve", "edit_facts", "abandon"}
        )
    except GateValidationError as exc:
        await _mark_gate(
            ctx,
            facts_message,
            f"Facts gate rejected: {exc.reason}.",
            "update_facts_gate",
        )
        return {"status": "rejected", "stage": "facts", "error": exc.reason}
    await _mark_gate(ctx, facts_message, "Facts gate completed.", "update_facts_gate")
    if extract_action(facts_event) == "abandon":
        return {"status": "abandoned", "stage": "facts"}
    facts_edit = extract_modal_value(facts_event)
    if facts_edit:
        facts = [line.strip(" •-") for line in facts_edit.splitlines() if line.strip()]

    await _post_simple(ctx, inp.delivery, "Building ReleaseCard…")
    card_result = await call_comms_tool(
        ctx,
        "build_release_card",
        "build_card",
        {
            "brief": brief,
            "facts": facts,
            "evidence": evidence,
            "run_id": ctx.run_id,
            "stage": "build-card",
            "gate_version": 1,
            **common_service_envelope(
                ctx,
                inp,
                stage="build-card",
                gate_version=1,
                workflow_name=WORKFLOW_NAME,
            ),
        },
    )
    card = card_from_result(card_result, brief, facts)
    card_gate = Gate(ctx.run_id, "card", 1, inp.user_id, approver_user_ids)
    card_message = await post_gate_message(
        ctx,
        name="post_card_gate",
        delivery=inp.delivery,
        text="Approve ReleaseCard before Actor generation.",
        blocks=[
            markdown_block("*Approve ReleaseCard*\n```" + str(card)[:2500] + "```"),
            actions_block(
                card_gate,
                [
                    ("Approve card", "approve", "primary"),
                    ("Edit card", "edit_card", None),
                    ("Abandon", "abandon", "danger"),
                ],
            ),
        ],
        metadata={
            "event_type": "comms_gate",
            "event_payload": {"run_id": ctx.run_id, "stage": "card"},
        },
    )
    try:
        card_event = await wait_for_gate_action(
            ctx, "wait_card_gate", card_gate, {"approve", "edit_card", "abandon"}
        )
    except GateValidationError as exc:
        await _mark_gate(
            ctx,
            card_message,
            f"ReleaseCard gate rejected: {exc.reason}.",
            "update_card_gate",
        )
        return {
            "status": "rejected",
            "stage": "card",
            "error": exc.reason,
            "facts": facts,
            "card": card,
        }
    await _mark_gate(
        ctx, card_message, "ReleaseCard gate completed.", "update_card_gate"
    )
    if extract_action(card_event) == "abandon":
        return {"status": "abandoned", "stage": "card", "facts": facts, "card": card}
    card_edit = extract_modal_value(card_event)
    if card_edit:
        card = _apply_card_edit(card, card_edit)

    await _post_simple(ctx, inp.delivery, "Generating Actor candidates…")
    generation = await call_comms_tool(
        ctx,
        "generate_candidates_attempt_1",
        "generate",
        {
            "release_card": card,
            "channels": channels,
            "voice_id": inp.voice_id,
            "run_id": ctx.run_id,
            "stage": "generate",
            "gate_version": 1,
            **common_service_envelope(
                ctx, inp, stage="generate", gate_version=1, workflow_name=WORKFLOW_NAME
            ),
        },
    )
    candidates = candidates_from_generation(generation)
    candidate_gate = Gate(ctx.run_id, "candidate", 1, inp.user_id, approver_user_ids)
    candidate_message = await post_gate_message(
        ctx,
        name="post_candidate_gate",
        delivery=inp.delivery,
        text="Choose final comms copy. This only marks copy ready in Slack.",
        blocks=[
            markdown_block("*Choose final copy*\n" + _format_candidates(candidates)),
            actions_block(
                candidate_gate,
                [
                    ("Mark ready", "approve", "primary"),
                    ("Edit final", "edit_candidate", None),
                    ("Retry", "retry", None),
                    ("Abandon", "abandon", "danger"),
                ],
            ),
        ],
        metadata={
            "event_type": "comms_gate",
            "event_payload": {"run_id": ctx.run_id, "stage": "candidate"},
        },
    )
    try:
        candidate_event = await wait_for_gate_action(
            ctx,
            "wait_candidate_gate",
            candidate_gate,
            {"approve", "edit_candidate", "retry", "abandon"},
        )
    except GateValidationError as exc:
        await _mark_gate(
            ctx,
            candidate_message,
            f"Candidate gate rejected: {exc.reason}.",
            "update_candidate_gate",
        )
        return {
            "status": "rejected",
            "stage": "candidate",
            "error": exc.reason,
            "facts": facts,
            "card": card,
            "candidates": candidates,
        }
    await _mark_gate(
        ctx, candidate_message, "Candidate gate completed.", "update_candidate_gate"
    )
    action = extract_action(candidate_event)
    if action == "abandon":
        return {
            "status": "abandoned",
            "stage": "candidate",
            "facts": facts,
            "card": card,
            "candidates": candidates,
        }
    if action == "retry":
        retry_notes = extract_modal_value(candidate_event)
        generation = await call_comms_tool(
            ctx,
            "generate_candidates_attempt_2",
            "generate",
            {
                "release_card": card,
                "channels": channels,
                "voice_id": inp.voice_id,
                "run_id": ctx.run_id,
                "stage": "generate",
                "gate_version": 2,
                "feedback": retry_notes,
                **common_service_envelope(
                    ctx,
                    inp,
                    stage="generate",
                    gate_version=2,
                    workflow_name=WORKFLOW_NAME,
                ),
            },
        )
        candidates = candidates_from_generation(generation)
        retry_gate = Gate(ctx.run_id, "candidate", 2, inp.user_id, approver_user_ids)
        retry_message = await post_gate_message(
            ctx,
            name="post_candidate_retry_gate",
            delivery=inp.delivery,
            text="Choose final comms copy after retry. This only marks copy ready in Slack.",
            blocks=[
                markdown_block(
                    "*Choose final copy after retry*\n" + _format_candidates(candidates)
                ),
                actions_block(
                    retry_gate,
                    [
                        ("Mark ready", "approve", "primary"),
                        ("Edit final", "edit_candidate", None),
                        ("Abandon", "abandon", "danger"),
                    ],
                ),
            ],
            metadata={
                "event_type": "comms_gate",
                "event_payload": {"run_id": ctx.run_id, "stage": "candidate"},
            },
        )
        try:
            candidate_event = await wait_for_gate_action(
                ctx,
                "wait_candidate_retry_gate",
                retry_gate,
                {"approve", "edit_candidate", "abandon"},
            )
        except GateValidationError as exc:
            await _mark_gate(
                ctx,
                retry_message,
                f"Candidate retry gate rejected: {exc.reason}.",
                "update_candidate_retry_gate",
            )
            return {
                "status": "rejected",
                "stage": "candidate",
                "error": exc.reason,
                "facts": facts,
                "card": card,
                "candidates": candidates,
            }
        await _mark_gate(
            ctx,
            retry_message,
            "Candidate retry gate completed.",
            "update_candidate_retry_gate",
        )
        if extract_action(candidate_event) == "abandon":
            return {
                "status": "abandoned",
                "stage": "candidate",
                "facts": facts,
                "card": card,
                "candidates": candidates,
            }
    final_copy = extract_modal_value(candidate_event) or _first_candidate_text(
        candidates
    )
    await _post_simple(
        ctx,
        inp.delivery,
        "*Ready to ship in Slack (no external posting performed)*\n" + final_copy,
    )
    return {
        "status": "ready_to_ship",
        "channels": channels,
        "facts": facts,
        "card": card,
        "candidates": candidates,
        "final_copy": final_copy,
        "no_external_posting": True,
    }


async def _post_simple(
    ctx: WorkflowContext, delivery: dict[str, Any], text: str
) -> None:
    key = re.sub(r"[^a-z0-9]+", "_", text.lower())[:48].strip("_") or "message"
    await post_gate_message(
        ctx,
        name=f"post_{key}",
        delivery=delivery,
        text=text,
        blocks=[markdown_block(text)],
    )


async def _mark_gate(
    ctx: WorkflowContext, message: dict[str, Any], text: str, name: str
) -> None:
    channel = str(message.get("channel") or "")
    ts = str(message.get("ts") or "")
    if channel and ts:
        await update_gate_message(
            ctx,
            name=name,
            channel=channel,
            ts=ts,
            text=text,
            blocks=[context_block(text)],
        )


def _apply_card_edit(card: dict[str, Any], edit: str) -> dict[str, Any]:
    try:
        parsed = json.loads(edit)
    except json.JSONDecodeError:
        updated = dict(card)
        updated["operator_edit_note"] = edit
        return updated
    return parsed if isinstance(parsed, dict) else card


def _parse_channels(brief: str) -> list[str]:
    match = re.search(r"\bfor\s+([a-z,\s-]+):", brief, flags=re.I)
    if not match:
        return []
    return [part.strip().lower() for part in match.group(1).split(",") if part.strip()]


def _format_facts(facts: list[str | dict[str, Any]]) -> str:
    if not facts:
        return "_No facts returned. Approve only if this is expected._"
    lines = []
    for fact in facts[:20]:
        if isinstance(fact, dict):
            lines.append(
                f"• {fact.get('text') or fact.get('fact') or fact.get('claim') or fact}"
            )
        else:
            lines.append(f"• {fact}")
    return "\n".join(lines)


def _format_candidates(candidates: list[dict[str, Any]]) -> str:
    if not candidates:
        return "_No candidates returned._"
    lines = []
    for idx, candidate in enumerate(candidates[:8], 1):
        text = str(candidate.get("text") or candidate)[:500]
        channel = candidate.get("channel") or candidate.get("surface") or "copy"
        lines.append(f"*{idx}. {channel}*\n>{text}")
    return "\n\n".join(lines)


def _first_candidate_text(candidates: list[dict[str, Any]]) -> str:
    for candidate in candidates:
        text = str(candidate.get("text") or "").strip()
        if text:
            return text
    return "No final copy selected."
