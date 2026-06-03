from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from api.workflow_engine import WorkflowContext

from comms_shared import (
    Gate,
    GateValidationError,
    SlackWorkflowInput,
    actions_block,
    call_comms_tool,
    common_service_envelope,
    context_block,
    extract_modal_value,
    extract_action,
    markdown_block,
    post_gate_message,
    update_gate_message,
    wait_for_gate_action,
)

WORKFLOW_NAME = "comms_audit"


@dataclass
class Input(SlackWorkflowInput):
    text: str = ""
    surface: str = "tweet"
    voice_id: str = "infinex"
    facts: list[str] = field(default_factory=list)


async def handler(inp: Input, ctx: WorkflowContext) -> dict[str, Any]:
    text = (inp.text or "").strip()
    if not text:
        await _post_result(ctx, inp.delivery, "Comms audit needs copy to audit.", "red")
        return {"status": "red", "error": "missing_text"}

    await ctx.step("progress_started", lambda: {"stage": "validate"})
    validation = await call_comms_tool(
        ctx,
        "validate_copy",
        "validate",
        {
            "text": text,
            **common_service_envelope(
                ctx, inp, stage="validate", gate_version=1, workflow_name=WORKFLOW_NAME
            ),
        },
    )
    if validation.get("ok") is False or validation.get("passed") is False:
        await _post_result(
            ctx,
            inp.delivery,
            f"*Comms audit: red deterministic verdict*\n```{validation}```",
            "red",
        )
        return {"status": "red", "validation": validation}

    fact_source = {"deployed_facts": inp.facts} if inp.facts else None
    audit = await call_comms_tool(
        ctx,
        "director_audit",
        "audit",
        {
            "text": text,
            "surface": inp.surface,
            "voice_id": inp.voice_id,
            **({"fact_source": fact_source} if fact_source else {}),
            **common_service_envelope(
                ctx, inp, stage="audit", gate_version=1, workflow_name=WORKFLOW_NAME
            ),
        },
    )
    questions = (
        audit.get("questions") if isinstance(audit.get("questions"), list) else []
    )
    if questions:
        gate = Gate(
            ctx.run_id, "audit_qna", 1, inp.user_id, tuple(inp.approver_user_ids)
        )
        message = await post_gate_message(
            ctx,
            name="post_audit_qna_gate",
            delivery=inp.delivery,
            text="Comms audit needs fact confirmation.",
            blocks=[
                markdown_block(
                    "*Comms audit needs fact confirmation*\n"
                    + _format_questions(questions)
                ),
                actions_block(
                    gate, [("Answer", "answer_qna", "primary"), ("Skip", "skip", None)]
                ),
            ],
            metadata={
                "event_type": "comms_gate",
                "event_payload": {"run_id": ctx.run_id, "stage": gate.stage},
            },
        )
        try:
            event = await wait_for_gate_action(
                ctx, "wait_audit_qna", gate, {"answer_qna", "skip"}
            )
        except GateValidationError as exc:
            await _mark_gate_complete(
                ctx, message, f"Comms audit gate rejected: {exc.reason}."
            )
            return {"status": "rejected", "stage": gate.stage, "error": exc.reason}
        await _mark_gate_complete(ctx, message, "Fact confirmation received.")
        if extract_action(event) != "skip":
            answer = extract_modal_value(event)
            if answer:
                audit = await call_comms_tool(
                    ctx,
                    "director_audit_with_answers",
                    "audit",
                    {
                        "text": text,
                        "surface": inp.surface,
                        "voice_id": inp.voice_id,
                        "thread": [{"role": "human", "content": answer}],
                        **common_service_envelope(
                            ctx,
                            inp,
                            stage="audit",
                            gate_version=2,
                            workflow_name=WORKFLOW_NAME,
                        ),
                    },
                )

    light = str(audit.get("light") or audit.get("status") or "amber")
    await _post_result(ctx, inp.delivery, _format_audit_result(audit), light)
    return {"status": light, "validation": validation, "audit": audit}


async def _post_result(
    ctx: WorkflowContext, delivery: dict[str, Any], text: str, light: str
) -> None:
    await post_gate_message(
        ctx,
        name=f"post_audit_result_{light}",
        delivery=delivery,
        text=text,
        blocks=[markdown_block(text)],
    )


async def _mark_gate_complete(
    ctx: WorkflowContext, message: dict[str, Any], text: str
) -> None:
    channel = str(message.get("channel") or "")
    ts = str(message.get("ts") or "")
    if channel and ts:
        await update_gate_message(
            ctx,
            name="update_audit_qna_gate_complete",
            channel=channel,
            ts=ts,
            text=text,
            blocks=[context_block(text)],
        )


def _format_questions(questions: list[Any]) -> str:
    lines = []
    for idx, q in enumerate(questions[:5], 1):
        if isinstance(q, dict):
            lines.append(f"{idx}. {q.get('question') or q.get('text') or q}")
        else:
            lines.append(f"{idx}. {q}")
    return "\n".join(lines)


def _format_audit_result(audit: dict[str, Any]) -> str:
    light = str(audit.get("light") or audit.get("status") or "amber").upper()
    notes = audit.get("notes") if isinstance(audit.get("notes"), list) else []
    note_text = "\n".join(f"• {note}" for note in notes[:8]) or "No notes returned."
    axes = audit.get("axes") if isinstance(audit.get("axes"), dict) else {}
    return f"*Comms audit: {light}*\n{note_text}\n\n```{axes}```"
