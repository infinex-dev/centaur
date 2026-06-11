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
    apply_fact_review_action,
    approved_fact_payloads,
    call_comms_tool,
    candidates_from_generation,
    card_from_result,
    chunked_markdown_blocks,
    common_service_envelope,
    context_block,
    DEFAULT_CHANNELS,
    evidence_for_approved_facts,
    extract_action,
    extract_modal_value,
    fact_review_complete,
    GENERATED_CHANNELS,
    MAX_FACT_REVIEW_ITEMS,
    markdown_block,
    normalize_channels,
    normalize_grounded_fact_review,
    post_gate_message,
    render_fact_review_blocks,
    render_release_card_blocks,
    STRUCTURED_CHANNELS,
    target_gate_correlation_id,
    tool_plane_ref,
    update_gate_message,
    wait_for_gate_action,
    wait_for_gate_action_at_correlation,
)

WORKFLOW_NAME = "comms_release"
ALLOWED_RELEASE_CARD_KINDS = {
    "data-card-official",
    "data-card-wry",
    "launch-tier",
    "split",
}


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
    requested = inp.channels or _parse_channels(brief) or list(DEFAULT_CHANNELS)
    channels, planning_only, unknown = normalize_channels(requested)
    if unknown:
        await _post_simple(
            ctx,
            inp.delivery,
            "*Comms release blocked*: unknown format(s): "
            + ", ".join(f"`{name}`" for name in unknown)
            + ".\nValid formats: "
            + ", ".join(GENERATED_CHANNELS)
            + ".",
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
            "\n_Note: "
            + ", ".join(f"`{name}`" for name in planning_only)
            + " are planning-only touchpoints — not auto-generated; they stay on the"
            " release card for human adaptation._"
        )
    if not channels:
        channels = list(DEFAULT_CHANNELS)
        selection_note += "\n_Falling back to the default format: x._"

    # No brief-level validation gate. The service `validate` runs publishable-copy
    # allergen rules (cliché, em-dash/ai-slop) and ignores `surface`, so validating
    # the operator's brief rejected legitimate instructions (e.g. "leverage", an
    # em-dash). Copy quality is enforced where it belongs — on the generated
    # candidates (the generate path strips em-dashes and runs the rules + Director).
    await _post_simple(
        ctx,
        inp.delivery,
        f"*Generating for:* {', '.join(channels)}{selection_note}\nGrounding comms facts…",
    )
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
            "idempotency_prefix": tool_plane["idempotency_prefix"],
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
    fact_review = normalize_grounded_fact_review(grounding)
    facts = fact_review["facts"]
    approver_user_ids = tuple(inp.approver_user_ids)
    facts_gate = Gate(
        ctx.run_id, "facts", 1, inp.user_id, approver_user_ids, per_item=True
    )
    blocked_reason = ""
    if not facts:
        blocked_reason = "Facts gate blocked: no verifiable facts were returned."
    elif len(facts) > MAX_FACT_REVIEW_ITEMS:
        blocked_reason = (
            f"Facts gate blocked: {len(facts)} facts were returned; "
            f"the review limit is {MAX_FACT_REVIEW_ITEMS}. Ask for a smaller fact set."
        )
    facts_message = await post_gate_message(
        ctx,
        name="post_facts_gate",
        delivery=inp.delivery,
        text=blocked_reason or "Review grounded comms facts before generation.",
        blocks=render_fact_review_blocks(
            facts_gate,
            facts,
            fact_review.get("unverifiable") or [],
            complete=bool(blocked_reason),
            footer_text="Facts review blocked." if blocked_reason else None,
        ),
        metadata={
            "event_type": "comms_gate",
            "event_payload": {"run_id": ctx.run_id, "stage": "facts"},
        },
    )
    if not facts:
        return {"status": "blocked", "stage": "facts", "error": "no_approved_facts"}
    if len(facts) > MAX_FACT_REVIEW_ITEMS:
        return {"status": "blocked", "stage": "facts", "error": "too_many_facts"}

    facts_approved_by = ""
    for attempt in range(1, 51):
        pending_fact_id = _next_pending_fact_id(facts)
        if not pending_fact_id:
            break
        try:
            facts_event = await wait_for_gate_action_at_correlation(
                ctx,
                f"wait_facts_gate_{attempt}",
                facts_gate,
                {"approve_fact", "reject_fact", "edit_fact", "abandon"},
                target_gate_correlation_id(facts_gate, pending_fact_id),
            )
            if extract_action(facts_event) == "abandon":
                await _update_facts_gate_message(
                    ctx,
                    facts_message,
                    facts_gate,
                    facts,
                    fact_review.get("unverifiable") or [],
                    "Facts gate abandoned.",
                    f"update_facts_gate_{attempt}",
                    complete=True,
                )
                return {"status": "abandoned", "stage": "facts", "facts": facts}
            facts = apply_fact_review_action(facts, facts_event)
            slack = (
                facts_event.get("slack")
                if isinstance(facts_event.get("slack"), dict)
                else {}
            )
            facts_approved_by = str(slack.get("user_id") or facts_approved_by)
        except GateValidationError as exc:
            await _mark_gate(
                ctx,
                facts_message,
                f"Facts gate rejected: {exc.reason}.",
                f"update_facts_gate_{attempt}",
            )
            return {"status": "rejected", "stage": "facts", "error": exc.reason}
        complete = fact_review_complete(facts)
        await _update_facts_gate_message(
            ctx,
            facts_message,
            facts_gate,
            facts,
            fact_review.get("unverifiable") or [],
            "Facts review completed." if complete else "Facts review updated.",
            f"update_facts_gate_{attempt}",
            complete=complete,
        )
        if complete:
            break
    else:
        return {"status": "blocked", "stage": "facts", "error": "facts_gate_limit"}

    approved_facts = approved_fact_payloads(facts)
    if not approved_facts:
        await _post_simple(
            ctx,
            inp.delivery,
            "*Comms release blocked*: no approved facts remain after review.",
        )
        return {
            "status": "blocked",
            "stage": "facts",
            "error": "no_approved_facts",
            "facts": facts,
        }
    evidence = evidence_for_approved_facts(facts)

    card_result = await call_comms_tool(
        ctx,
        "build_release_card",
        "build_card",
        {
            "brief": brief,
            "facts": approved_facts,
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
    card = card_from_result(card_result, brief, approved_facts)
    card_error = _card_result_error(card_result, card)
    if card_error:
        await _post_blocked_tool_result(
            ctx,
            inp.delivery,
            message="Comms release blocked building ReleaseCard",
            error=card_error,
            result=card_result,
        )
        return {
            "status": "blocked",
            "stage": "build-card",
            "error": card_error,
            "card_result": _sanitize_tool_result(card_result),
            "facts": approved_facts,
        }
    card_gate = Gate(ctx.run_id, "card", 1, inp.user_id, approver_user_ids)
    card_message = await post_gate_message(
        ctx,
        name="post_card_gate",
        delivery=inp.delivery,
        text="Approve ReleaseCard before Actor generation.",
        blocks=render_release_card_blocks(card, card_gate),
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
            "facts": approved_facts,
            "card": card,
        }
    if extract_action(card_event) == "abandon":
        await _update_card_gate_message(
            ctx,
            card_message,
            card,
            "ReleaseCard gate abandoned.",
            "update_card_gate",
            complete=True,
        )
        return {
            "status": "abandoned",
            "stage": "card",
            "facts": approved_facts,
            "card": card,
        }
    card_edit = extract_modal_value(card_event)
    if card_edit:
        card = _apply_card_edit(card, card_edit)
    card_slack = (
        card_event.get("slack") if isinstance(card_event.get("slack"), dict) else {}
    )
    approval = {
        "workflow_run_id": ctx.run_id,
        "facts_gate_version": 1,
        "card_gate_version": 1,
        "facts_approved_by": facts_approved_by,
        "approved_by": str(
            card_slack.get("user_id") or facts_approved_by or inp.user_id
        ),
    }
    card = _with_card_approval(card, approval, approved_facts)
    await _update_card_gate_message(
        ctx,
        card_message,
        card,
        "ReleaseCard gate completed.",
        "update_card_gate",
        complete=True,
        approved_by=approval["approved_by"],
    )

    await _post_simple(ctx, inp.delivery, "Generating Actor candidates…")
    generation = await call_comms_tool(
        ctx,
        "generate_candidates_attempt_1",
        "generate",
        {
            "release_card": card,
            "approved": True,
            "approved_facts": approved_facts,
            "approval": approval,
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
    generation_error = _generation_result_error(generation)
    if generation_error:
        await _post_simple(
            ctx, inp.delivery, _format_generation_failure(generation, generation_error)
        )
        return {
            "status": "blocked",
            "stage": "generate",
            "gate_version": 1,
            "error": generation_error,
            "generation": _sanitize_tool_result(generation),
            "facts": approved_facts,
            "card": card,
        }
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
            "missing_channels": [
                c for c in channels if final_by_channel.get(c) is None
            ],
            "facts": approved_facts,
            "card": card,
            "candidates": candidates,
        }

    async def _render(
        gate: Gate, name: str, *, retry_available: bool, terminal: bool, text: str
    ) -> None:
        nonlocal gate_message
        blocks = _candidate_gate_blocks(
            gate,
            channels,
            final_by_channel,
            candidates,
            retry_available=retry_available,
            audit_line=audit_line,
            terminal=terminal,
        )
        if not gate_message:
            gate_message = await post_gate_message(
                ctx,
                name=name,
                delivery=inp.delivery,
                text=text,
                blocks=blocks,
                metadata={
                    "event_type": "comms_gate",
                    "event_payload": {"run_id": ctx.run_id, "stage": "candidate"},
                },
            )
        else:
            await update_gate_message(
                ctx,
                name=name,
                channel=str(gate_message.get("channel") or ""),
                ts=str(gate_message.get("ts") or ""),
                text=text,
                blocks=blocks,
            )

    for round_n in range(1, MAX_CANDIDATE_ROUNDS + 1):
        gate = Gate(ctx.run_id, "candidate", round_n, inp.user_id, approver_user_ids)
        await _render(
            gate,
            f"render_candidate_gate_r{round_n}",
            retry_available=attempts < 2,
            terminal=False,
            text="Choose final comms copy per format.",
        )
        try:
            event = await wait_for_gate_action(
                ctx,
                f"wait_candidate_gate_r{round_n}",
                gate,
                {"approve", "edit_candidate", "retry", "abandon"},
            )
        except GateValidationError as exc:
            await _mark_gate(
                ctx,
                gate_message,
                f"Candidate gate rejected: {exc.reason}.",
                f"update_candidate_gate_rejected_r{round_n}",
            )
            return {
                "status": "rejected",
                "stage": "candidate",
                "error": exc.reason,
                **_state_payload(),
            }

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
            if (
                channel not in channels
                or channel in STRUCTURED_CHANNELS
                or final_by_channel.get(channel) is None
            ):
                audit_line += f" (edit for `{channel or '?'}` ignored — not editable)"
            elif not value:
                audit_line += f" Edit for {channel} was empty — previous copy kept."
            else:
                previous = final_by_channel.get(channel) or {}
                final_by_channel[channel] = {
                    "text": value,
                    # Provenance preserved (harness pattern: candidates are
                    # immutable; edits are recorded against them — keeping the id
                    # lets consumers derive the diff from the result's candidates).
                    "candidate_id": previous.get("candidate_id"),
                    "edited": True,
                    "pick": bool(previous.get("pick")),
                }
                # Re-check the edited copy through the existing /validate route
                # (allergen/slop + standalone-X link rejection). Non-blocking:
                # warnings surface in the gate render; the edit still stands.
                # Response shape (routes/validate.ts spreads ValidationResult):
                # {ok, passed: bool, failures: [{rule, reason}], ...}
                check = await call_comms_tool(
                    ctx,
                    f"validate_edit_{channel}_r{round_n}",
                    "validate",
                    {"text": value, "surface": channel},
                )
                failures = check.get("failures")
                if check.get("passed") is False and isinstance(failures, list):
                    audit_line += (
                        f" ⚠️ {channel} edit flagged by validator: "
                        + "; ".join(
                            f"{f.get('rule')}: {str(f.get('reason'))[:100]}"
                            for f in failures[:3]
                            if isinstance(f, dict)
                        )
                    )
        elif action == "retry":
            feedback = extract_modal_value(event)
            retry_gen = await call_comms_tool(
                ctx,
                f"generate_candidates_r{round_n}",
                "generate",
                {
                    "release_card": card,
                    "approved": True,
                    "approved_facts": approved_facts,
                    "approval": approval,
                    "channels": channels,
                    "voice_id": inp.voice_id,
                    "run_id": ctx.run_id,
                    "stage": "generate",
                    "gate_version": round_n,
                    "feedback": feedback,
                    **common_service_envelope(
                        ctx,
                        inp,
                        stage="generate",
                        gate_version=round_n,
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
            "No shippable channels."
            if outcome_error == "no_shippable_channels"
            else f"Candidate gate limit reached ({MAX_CANDIDATE_ROUNDS} rounds)."
        ),
    }[outcome]
    terminal_gate = Gate(ctx.run_id, "candidate", 0, inp.user_id, approver_user_ids)
    await _render(
        terminal_gate,
        "render_candidate_gate_terminal",
        retry_available=False,
        terminal=True,
        text=terminal_text,
    )

    if outcome == "abandoned":
        return {"status": "abandoned", "stage": "candidate", **_state_payload()}
    if outcome == "blocked":
        return {
            "status": "blocked",
            "stage": "candidate",
            "error": outcome_error,
            **_state_payload(),
        }

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
        holds = _publication_holds(
            _candidate_by_id(candidates, entry.get("candidate_id"))
        )
        if holds and not entry.get("edited"):
            ship_blocks.append(
                markdown_block(
                    "⚠️ *Publication holds (verify before posting):*\n"
                    + "\n".join(f"• {hold}" for hold in holds)
                )
            )
    ship_blocks.append(
        context_block(
            "Full untruncated copy lives in the workflow result's final_by_channel."
        )
    )
    await post_gate_message(
        ctx,
        name="post_ready_to_ship",
        delivery=inp.delivery,
        text="Ready to ship in Slack (no external posting performed)",
        blocks=ship_blocks,
    )
    return {
        "status": "ready_to_ship",
        **_state_payload(),
        "no_external_posting": True,
    }


async def _post_blocked_tool_result(
    ctx: WorkflowContext,
    delivery: dict[str, Any],
    *,
    message: str,
    error: str,
    result: dict[str, Any],
) -> None:
    diagnostic = json.dumps(_sanitize_tool_result(result), sort_keys=True)[:1200]
    await _post_simple(
        ctx,
        delivery,
        f"*{message}*: {error}\n```{diagnostic}```",
    )


def _card_result_error(result: dict[str, Any], card: dict[str, Any] | None) -> str:
    error = _tool_result_error(result)
    if error:
        return error
    if card is None:
        return "release_card_missing"
    kind = str(card.get("kind") or "").strip()
    if kind not in ALLOWED_RELEASE_CARD_KINDS:
        return f"invalid_release_card_kind:{kind or 'missing'}"
    return ""


def _generation_result_error(result: dict[str, Any]) -> str:
    error = _tool_result_error(result)
    if error:
        return error
    if not _has_candidate_payload(result):
        return "generation_response_missing_candidates"
    return ""


def _tool_result_error(result: dict[str, Any]) -> str:
    if not isinstance(result, dict):
        return "invalid_tool_response"
    if result.get("ok") is False:
        return _result_error_summary(result, "tool_call_failed")
    if result.get("error"):
        return _result_error_summary(result, "tool_call_failed")
    status = str(result.get("status") or "").strip().lower()
    if status in {"blocked", "error", "failed", "failure"}:
        return _result_error_summary(result, status)
    status_code = result.get("status_code")
    if isinstance(status_code, int) and status_code >= 400:
        return _result_error_summary(result, f"http_{status_code}")
    return ""


def _result_error_summary(result: dict[str, Any], fallback: str) -> str:
    for key in ("error", "message", "detail", "status"):
        value = result.get(key)
        if value:
            return str(value)[:500]
    status_code = result.get("status_code")
    if status_code:
        return f"{fallback}:{status_code}"
    return fallback


def _has_candidate_payload(result: dict[str, Any]) -> bool:
    if "candidates" in result:
        return isinstance(result.get("candidates"), list)
    data = result.get("data")
    if isinstance(data, list):
        return True
    if isinstance(data, dict) and "candidates" in data:
        return isinstance(data.get("candidates"), list)
    return False


_SENSITIVE_RESULT_KEY_PARTS = ("authorization", "token", "secret", "cookie", "password")


def _sanitize_tool_result(value: Any) -> Any:
    if isinstance(value, dict):
        sanitized: dict[str, Any] = {}
        for idx, (raw_key, raw_value) in enumerate(value.items()):
            if idx >= 30:
                sanitized["..."] = "truncated"
                break
            key = str(raw_key)
            if any(part in key.lower() for part in _SENSITIVE_RESULT_KEY_PARTS):
                sanitized[key] = "[REDACTED]"
            else:
                sanitized[key] = _sanitize_tool_result(raw_value)
        return sanitized
    if isinstance(value, list):
        return [_sanitize_tool_result(item) for item in value[:30]]
    if isinstance(value, str):
        return value if len(value) <= 1000 else f"{value[:999]}…"
    return value


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


async def _update_facts_gate_message(
    ctx: WorkflowContext,
    message: dict[str, Any],
    gate: Gate,
    facts: list[dict[str, Any]],
    unverifiable: list[Any],
    text: str,
    name: str,
    *,
    complete: bool = False,
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
            blocks=render_fact_review_blocks(
                gate, facts, unverifiable, complete=complete
            ),
        )


async def _update_card_gate_message(
    ctx: WorkflowContext,
    message: dict[str, Any],
    card: dict[str, Any],
    text: str,
    name: str,
    *,
    complete: bool = False,
    approved_by: str | None = None,
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
            blocks=render_release_card_blocks(
                card, complete=complete, footer_text=text, approved_by=approved_by
            ),
        )


def _next_pending_fact_id(facts: list[dict[str, Any]]) -> str | None:
    for fact in facts:
        if fact.get("status") == "pending":
            return str(fact.get("id") or "")
    return None


def _with_card_approval(
    card: dict[str, Any], approval: dict[str, Any], approved_facts: list[dict[str, Any]]
) -> dict[str, Any]:
    updated = dict(card)
    updated["approved"] = True
    updated["approved_facts"] = approved_facts
    updated["approval"] = approval
    return updated


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


def _format_generation_failure(result: dict[str, Any], error: str) -> str:
    """Human-readable Slack message for a failed generation (no raw dict dump)."""
    lines = ["⚠️ *Comms release blocked at generation*"]
    message = ""
    response = result.get("response") if isinstance(result, dict) else None
    if isinstance(response, dict):
        message = str(response.get("message") or response.get("error") or "").strip()
    if not message:
        message = (
            str(result.get("message") or "").strip() if isinstance(result, dict) else ""
        )
    label = f"{error}" + (f" — {message}" if message and message != error else "")
    lines.append(f"• {label}" if label else "• generation failed")
    status = result.get("status_code") if isinstance(result, dict) else None
    blob = f"{message} {error}".lower()
    transient = status == 500 or any(
        sig in blob for sig in ("internal", "overload", "timeout", "rate", "503", "529")
    )
    if transient:
        lines.append(
            "This usually means a transient model overload during generation. "
            "Re-run the command — it typically succeeds on retry."
        )
    else:
        lines.append(
            "Re-run the command; if it persists, check the comms-factory service logs."
        )
    return "\n".join(lines)


def _picks_from_generation(generation: Any) -> list[dict[str, Any]]:
    """Director-ranked picks from a generate result envelope (.output.picks or .picks)."""
    if not isinstance(generation, dict):
        return []
    out = generation.get("output")
    source = out if isinstance(out, dict) else generation
    picks = source.get("picks")
    return [p for p in picks if isinstance(p, dict)] if isinstance(picks, list) else []


EDITABLE_CHANNELS = tuple(c for c in GENERATED_CHANNELS if c not in STRUCTURED_CHANNELS)
MAX_CANDIDATE_ROUNDS = 30


def _seed_final_by_channel(
    channels: list[str],
    candidates: list[dict[str, Any]],
    picks: list[dict[str, Any]],
) -> dict[str, dict[str, Any] | None]:
    """Director pick per channel (flat picks: top-level id/text/channel), else the
    first candidate of that channel, else None (missing); `pick` flags which path
    seeded the entry so renders can distinguish picks from fallbacks."""
    state: dict[str, dict[str, Any] | None] = {}
    for channel in channels:
        pick = next((p for p in picks if p.get("channel") == channel), None)
        if pick and str(pick.get("text") or "").strip():
            state[channel] = {
                "text": str(pick.get("text")),
                "candidate_id": pick.get("id"),
                "edited": False,
                "pick": True,
            }
            continue
        candidate = next(
            (
                c
                for c in candidates
                if c.get("channel") == channel and str(c.get("text") or "").strip()
            ),
            None,
        )
        state[channel] = (
            {
                "text": str(candidate.get("text")),
                "candidate_id": candidate.get("id"),
                "edited": False,
                "pick": False,
            }
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
        markdown_block(
            "*Choose final copy per format.* This only marks copy ready in Slack."
        )
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
        elif candidate is not None and entry.get("pick"):
            header += "  ⭐ Director's pick"
        lines = [header]
        if isinstance((candidate or {}).get("director_audit"), dict) and not entry.get(
            "edited"
        ):
            audit = candidate["director_audit"]
            lines.append(_verdict_line(audit))
            lines.extend(f"⚠️ {issue}" for issue in _collect_issues(audit))
        blocks.append(markdown_block("\n".join(lines)))
        blocks.extend(chunked_markdown_blocks(f">{entry['text']}"))
        if not terminal and channel in EDITABLE_CHANNELS:
            blocks.append(
                actions_block(
                    gate,
                    [
                        (
                            f"Edit {channel}",
                            "edit_candidate",
                            None,
                            channel,
                            f"r{gate.gate_version} · Edit {channel}",
                        )
                    ],
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


def _collect_issues(audit: dict[str, Any]) -> list[str]:
    """Publication-gate + factual issues the Director raised, for operator display."""
    issues: list[str] = []
    for key in ("publication_gate_issues", "factual_issues"):
        raw = audit.get(key)
        if isinstance(raw, list):
            issues.extend(str(i).strip() for i in raw if str(i).strip())
    return issues


def _publication_holds(candidate: dict[str, Any] | None) -> list[str]:
    """Publication-gate issues, only when the Director did NOT pass the gate."""
    if not isinstance(candidate, dict):
        return []
    audit = candidate.get("director_audit")
    if not isinstance(audit, dict) or audit.get("publication_gate_passed") is not False:
        return []
    issues = audit.get("publication_gate_issues")
    return (
        [str(i).strip() for i in issues if str(i).strip()]
        if isinstance(issues, list)
        else []
    )


def _verdict_line(audit: dict[str, Any]) -> str:
    """Compact one-line Director verdict: tempo + pass/fail badges."""

    def badge(flag: Any) -> str:
        return "✅" if flag is True else ("⚠️" if flag is False else "•")

    tempo = audit.get("primary_tempo") or "—"
    return (
        f"_Director: tempo *{tempo}* · "
        f"voice {badge(audit.get('copy_voice_passed'))} · "
        f"factual {badge(audit.get('factual_passed'))} · "
        f"publish {badge(audit.get('publication_gate_passed'))}_"
    )
