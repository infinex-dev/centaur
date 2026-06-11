from __future__ import annotations

from dataclasses import dataclass, field
import json
import os
from typing import Any, Iterable, Sequence

from api import slackbot_client
from api.workflow_engine import WorkflowContext

EVENT_TYPE = "comms.action"
MAX_FACT_REVIEW_ITEMS = 20

# Mirrors the TS Channel union (src/generator.ts) AND the /generate route
# allowlist (services/api/routes/generate.ts CHANNELS) — the route is the
# contract; if a channel is added there, add it here (and vice versa).
GENERATED_CHANNELS = ("x", "x-thread", "web", "carousel", "modal", "in-product", "blog")
# Enumerated in the card audience (card.ts Audience) but NOT generated —
# planning / human-adaptation touchpoints only.
PLANNING_ONLY_CHANNELS = ("telegram", "email", "press", "internal")
DEFAULT_CHANNELS = ("x",)
# Aliases the service accepts (routes/generate.ts maps tweet→x). Applied here
# so briefs that work today keep working.
CHANNEL_ALIASES = {"tweet": "x"}
# Channels whose candidates are structured payloads (thread tweets, carousel
# slides, web card fields). Free-text modal edits cannot round-trip these;
# they are pick-or-retry at the candidate gate.
STRUCTURED_CHANNELS = ("x-thread", "carousel", "web")


def normalize_channels(raw: Iterable[str]) -> tuple[list[str], list[str], list[str]]:
    """Split requested channel names into (generated, planning_only, unknown).

    Lower-cases, applies CHANNEL_ALIASES, dedupes, preserves first-seen order.
    """
    generated: list[str] = []
    planning: list[str] = []
    unknown: list[str] = []
    seen: set[str] = set()
    for item in raw:
        name = CHANNEL_ALIASES.get(str(item).strip().lower(), str(item).strip().lower())
        if not name or name in seen:
            continue
        seen.add(name)
        if name in GENERATED_CHANNELS:
            generated.append(name)
        elif name in PLANNING_ONLY_CHANNELS:
            planning.append(name)
        else:
            unknown.append(name)
    return generated, planning, unknown


@dataclass
class SlackWorkflowInput:
    thread_key: str = ""
    text: str = ""
    brief: str = ""
    user_id: str = ""
    approver_user_ids: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    delivery: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class Gate:
    run_id: str
    stage: str
    gate_version: int
    requester_user_id: str = ""
    approver_user_ids: tuple[str, ...] = ()
    # When True, buttons on this gate carry per_item=True so the generic base
    # slackbot scopes correlation to target_id (matching this gate's per-target
    # wait_for_gate_action_at_correlation). The base carries no gate domain
    # knowledge; this flag is the overlay's data contribution.
    per_item: bool = False

    @property
    def correlation_id(self) -> str:
        return gate_correlation_id(self.run_id, self.stage, self.gate_version)


def gate_correlation_id(run_id: str, stage: str, gate_version: int) -> str:
    return f"{run_id}:{stage}:{gate_version}"


def target_gate_correlation_id(gate: Gate, target_id: str) -> str:
    return f"{gate.correlation_id}:{target_id}"


def compact_ref(
    gate: Gate, action: str, target_id: str | None = None, label: str | None = None
) -> str:
    payload: dict[str, Any] = {
        "run_id": gate.run_id,
        "stage": gate.stage,
        "gate_version": gate.gate_version,
        "action": action,
        # The generic base slackbot dispatches whatever event_type the ref names
        # (default gate.action); comms gates wait on EVENT_TYPE, so carry it here.
        "event_type": EVENT_TYPE,
    }
    if gate.per_item:
        payload["per_item"] = True
    if target_id:
        payload["target_id"] = target_id
    if label:
        payload["label"] = label
    if gate.requester_user_id:
        payload["requester_user_id"] = gate.requester_user_id
    if gate.approver_user_ids:
        payload["approver_user_ids"] = list(gate.approver_user_ids)
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=False)


def button(
    gate: Gate,
    text: str,
    action: str,
    *,
    style: str | None = None,
    target_id: str | None = None,
    label: str | None = None,
) -> dict[str, Any]:
    element: dict[str, Any] = {
        "type": "button",
        "text": {"type": "plain_text", "text": text},
        "action_id": f"comms:{action}",
        "value": compact_ref(gate, action, target_id, label=label),
    }
    if style:
        element["style"] = style
    return element


ActionSpec = (
    tuple[str, str, str | None]
    | tuple[str, str, str | None, str | None]
    | tuple[str, str, str | None, str | None, str | None]
)


def actions_block(gate: Gate, actions: Sequence[ActionSpec]) -> dict[str, Any]:
    elements = []
    for spec in actions:
        text, action, style = spec[:3]
        target_id = spec[3] if len(spec) > 3 else None
        label = spec[4] if len(spec) > 4 else None
        elements.append(
            button(gate, text, action, style=style, target_id=target_id, label=label)
        )
    return {"type": "actions", "elements": elements}


def markdown_block(text: str) -> dict[str, Any]:
    return {"type": "section", "text": {"type": "mrkdwn", "text": truncate(text, 2900)}}


def chunked_markdown_blocks(text: str, limit: int = 2900) -> list[dict[str, Any]]:
    """Render text as one or more section blocks, splitting on line boundaries.

    Slack hard-caps a section at 3000 chars; ``markdown_block`` truncates at
    2900 with an ellipsis. Long copy (a 3600-char blog) must instead chunk so
    the full text is always readable.
    """
    value = str(text or "")
    if len(value) <= limit:
        return [markdown_block(value)]
    blocks: list[dict[str, Any]] = []
    current: list[str] = []
    size = 0
    for line in value.split("\n"):
        if len(line) > limit:
            # pathological line: flush, then hard-split it
            if current:
                blocks.append(markdown_block("\n".join(current)))
                current, size = [], 0
            for start in range(0, len(line), limit):
                blocks.append(markdown_block(line[start : start + limit]))
            continue
        # +1 for the newline that joins it to the previous line in this chunk
        addition = len(line) + (1 if current else 0)
        if current and size + addition > limit:
            blocks.append(markdown_block("\n".join(current)))
            current, size = [line], len(line)
            continue
        current.append(line)
        size += addition
    if current:
        blocks.append(markdown_block("\n".join(current)))
    return blocks


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


class GateValidationError(ValueError):
    """Raised when a resumed Slack gate event does not match workflow state."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def validate_gate_event(
    event: dict[str, Any], gate: Gate, allowed_actions: Iterable[str]
) -> dict[str, Any]:
    ref = event.get("ref") if isinstance(event.get("ref"), dict) else {}
    action = extract_action(event)
    allowed = {str(item) for item in allowed_actions}
    if ref.get("run_id") != gate.run_id:
        raise GateValidationError("wrong_run_id")
    if ref.get("stage") != gate.stage:
        raise GateValidationError("wrong_stage")
    try:
        gate_version = int(ref.get("gate_version"))
    except (TypeError, ValueError):
        raise GateValidationError("wrong_gate_version") from None
    if gate_version != gate.gate_version:
        raise GateValidationError("wrong_gate_version")
    if action not in allowed:
        raise GateValidationError("unsupported_action")

    slack = event.get("slack") if isinstance(event.get("slack"), dict) else {}
    slack_user_id = str(slack.get("user_id") or "").strip()
    authorized = {
        user for user in (gate.requester_user_id, *gate.approver_user_ids) if user
    }
    if authorized and not slack_user_id:
        raise GateValidationError("missing_slack_user")
    if authorized and slack_user_id not in authorized:
        raise GateValidationError("unauthorized_slack_user")
    return event


async def wait_for_gate_action(
    ctx: WorkflowContext,
    name: str,
    gate: Gate,
    allowed_actions: Iterable[str],
) -> dict[str, Any]:
    return validate_gate_event(
        await wait_for_gate(ctx, name, gate), gate, allowed_actions
    )


async def wait_for_gate_action_at_correlation(
    ctx: WorkflowContext,
    name: str,
    gate: Gate,
    allowed_actions: Iterable[str],
    correlation_id: str,
) -> dict[str, Any]:
    event = await ctx.wait_for_event(
        name, event_type=EVENT_TYPE, correlation_id=correlation_id
    )
    return validate_gate_event(event, gate, allowed_actions)


def common_service_envelope(
    ctx: WorkflowContext,
    inp: SlackWorkflowInput,
    *,
    stage: str,
    gate_version: int = 1,
    workflow_name: str,
) -> dict[str, Any]:
    return {
        "schema_version": "comms_factory.centaur_request.v2",
        "job_id": f"comms:{workflow_name}:{ctx.run_id}",
        "workflow_run_id": ctx.run_id,
        "thread_key": inp.thread_key,
        "requester_user_id": inp.user_id,
        "approver_user_ids": list(inp.approver_user_ids),
        "stage": stage,
        "gate_version": gate_version,
        "constraints": {
            "no_external_publish": True,
            "human_ship_gate_required": True,
            "director_never_self_grounds": True,
        },
        "trace": {"source": "centaur_workflow", "workflow_name": workflow_name},
    }


def tool_plane_ref(
    ctx: WorkflowContext, *, stage: str, gate_version: int = 1
) -> dict[str, Any] | None:
    """The workflow's contribution to Centaur's native tool-plane reference.

    The comms-factory service calls ``POST {base}/tools/{tool}/{method}`` with its
    own scoped research-bundle token (read from the ``CENTAUR_TOKEN`` env on the
    service, never passed in the payload). The endpoint base + auth mode are owned
    by the client (``CommsFactoryClient._tool_plane_ref``), which derives them from
    deployment config so a tool caller cannot redirect the token to an arbitrary
    host. The workflow only contributes the idempotency prefix it uniquely knows,
    and gates on availability: returns ``None`` when neither ``CENTAUR_BASE_URL``
    nor ``AGENT_API_URL`` is set so the caller can early-block.
    """
    base_url = (
        (os.getenv("CENTAUR_BASE_URL") or os.getenv("AGENT_API_URL") or "")
        .strip()
        .rstrip("/")
    )
    if not base_url:
        return None
    return {"idempotency_prefix": f"{ctx.run_id}:{stage}:{gate_version}"}


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


def facts_from_grounding(result: dict[str, Any]) -> list[str | dict[str, Any]]:
    facts = (
        result.get("facts")
        or result.get("verified_facts")
        or result.get("deployed_facts")
        or []
    )
    output: list[str | dict[str, Any]] = []
    if isinstance(facts, list):
        for item in facts:
            if isinstance(item, str) and item.strip():
                output.append(item.strip())
            elif isinstance(item, dict):
                text = str(
                    item.get("value")
                    or item.get("fact")
                    or item.get("text")
                    or item.get("claim")
                    or ""
                ).strip()
                if text:
                    fact = dict(item)
                    fact.setdefault("text", text)
                    output.append(fact)
    return output


def normalize_grounded_fact_review(result: dict[str, Any]) -> dict[str, Any]:
    """Convert comms-factory grounding output into Slack-reviewable fact items."""
    raw_facts = facts_from_grounding(result)
    evidence = _dedupe_evidence(
        result.get("evidence") if isinstance(result.get("evidence"), list) else []
    )
    facts: list[dict[str, Any]] = []
    for idx, item in enumerate(raw_facts, 1):
        raw = dict(item) if isinstance(item, dict) else {"text": str(item)}
        claim = str(
            raw.get("claim") or raw.get("fact") or raw.get("text") or ""
        ).strip()
        value = str(
            raw.get("value") or raw.get("text") or raw.get("fact") or claim
        ).strip()
        source_ref = str(
            raw.get("source_ref") or raw.get("source") or raw.get("url") or ""
        ).strip()
        evidence_summaries = _match_evidence(raw, evidence)
        original_evidence_ids = [
            str(item).strip()
            for item in raw.get("evidence_ids", [])
            if str(item).strip()
        ]
        matched_evidence_ids = [
            item["id"] for item in evidence_summaries if item.get("id")
        ]
        evidence_ids = list(
            dict.fromkeys([*original_evidence_ids, *matched_evidence_ids])
        )
        facts.append(
            {
                "id": f"fact_{idx}",
                "claim": claim,
                "value": value,
                "text": value,
                "source_ref": source_ref,
                "confidence": raw.get("confidence"),
                "verified_at": raw.get("verified_at"),
                "category": raw.get("category"),
                "evidence_ids": evidence_ids,
                "evidence": evidence_summaries,
                "status": "pending",
                "raw": raw,
            }
        )
    unverifiable = result.get("unverifiable")
    return {
        "facts": facts,
        "evidence": evidence,
        "unverifiable": unverifiable if isinstance(unverifiable, list) else [],
    }


def render_fact_review_blocks(
    gate: Gate,
    facts: list[dict[str, Any]],
    unverifiable: list[Any] | None = None,
    *,
    complete: bool = False,
    footer_text: str | None = None,
) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = [markdown_block("*Review grounded facts*")]
    if unverifiable:
        warning_lines = ["*⚠️ Unverifiable claims* — not included for approval."]
        for item in unverifiable[:5]:
            warning_lines.append(f"• {truncate(_unverifiable_text(item), 450)}")
        blocks.append(markdown_block("\n".join(warning_lines)))
    if not facts:
        blocks.append(markdown_block("_No verifiable facts returned._"))
    active_pending_id = next(
        (str(fact.get("id")) for fact in facts if fact.get("status") == "pending"),
        None,
    )
    for fact in facts[:MAX_FACT_REVIEW_ITEMS]:
        blocks.append(markdown_block(_format_fact_for_review(fact)))
        if not complete and str(fact.get("id") or "") == active_pending_id:
            target_id = str(fact.get("id") or "")
            blocks.append(
                actions_block(
                    gate,
                    [
                        ("Approve", "approve_fact", "primary", target_id),
                        ("Reject", "reject_fact", "danger", target_id),
                        ("Edit", "edit_fact", None, target_id),
                    ],
                )
            )
    if len(facts) > MAX_FACT_REVIEW_ITEMS:
        blocks.append(
            context_block(
                f"Showing {MAX_FACT_REVIEW_ITEMS} of {len(facts)} grounded facts."
            )
        )
    if complete:
        blocks.append(context_block(footer_text or "Facts review completed."))
    else:
        blocks.append(
            context_block("Reject discards this fact. Cancel run stops the workflow.")
        )
        blocks.append(
            actions_block(
                gate, [("Cancel run", "abandon", "danger", active_pending_id)]
            )
        )
    return blocks[:50]


def render_release_card_blocks(
    card: dict[str, Any],
    gate: Gate | None = None,
    *,
    complete: bool = False,
    footer_text: str | None = None,
    approved_by: str | None = None,
) -> list[dict[str, Any]]:
    """Render a ReleaseCard as a Slack review card instead of a raw dict dump."""
    heading = "*ReleaseCard approved*" if complete else "*Approve ReleaseCard*"
    headline = str(card.get("headline") or card.get("title") or "Comms release").strip()
    title = str(card.get("title") or "").strip()
    intro_lines = [heading, f"*Headline:* {truncate(headline, 500)}"]
    if title and title != headline:
        intro_lines.append(f"*Title:* {truncate(title, 220)}")
    blocks: list[dict[str, Any]] = [markdown_block("\n".join(intro_lines))]

    fields = _release_card_fields(card)
    if fields:
        blocks.append(
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": truncate(field, 1900)}
                    for field in fields[:10]
                ],
            }
        )

    facts = _release_card_facts(card)
    if facts:
        fact_lines = [f"*Approved fact contract* — {len(facts)} fact(s) included"]
        for idx, fact in enumerate(facts[:10], 1):
            fact_lines.append(f"{idx}. {truncate(fact, 240)}")
        if len(facts) > 10:
            fact_lines.append(
                f"_+{len(facts) - 10} more approved fact(s) included in generation._"
            )
        blocks.append(markdown_block("\n".join(fact_lines)))
    else:
        blocks.append(
            markdown_block("*Approved fact contract*\n_No deployed facts returned._")
        )

    if complete:
        footer = footer_text or "ReleaseCard gate completed."
        if approved_by:
            footer = f"✅ Approved by {_slack_user_label(approved_by)}."
        blocks.append(context_block(footer))
    elif gate is not None:
        blocks.append(
            actions_block(
                gate,
                [
                    ("Approve card", "approve", "primary"),
                    ("Edit card", "edit_card", None),
                    ("Abandon", "abandon", "danger"),
                ],
            )
        )
    return blocks[:50]


def _release_card_fields(card: dict[str, Any]) -> list[str]:
    fields: list[str] = []
    audience = card.get("audience")
    if isinstance(audience, list):
        audience_text = ", ".join(str(item) for item in audience if str(item).strip())
    else:
        audience_text = str(audience or "").strip()
    field_values = [
        ("Audience", audience_text),
        ("Ship date", card.get("ship_date")),
        ("Kind", card.get("kind")),
        ("Tier reason", card.get("tier_reason")),
    ]
    for label, raw_value in field_values:
        value = str(raw_value or "").strip()
        if value:
            fields.append(f"*{label}:*\n{truncate(value, 280)}")
    return fields


def _release_card_facts(card: dict[str, Any]) -> list[str]:
    raw_facts = (
        card.get("deployed_facts")
        or card.get("facts")
        or card.get("approved_facts")
        or []
    )
    if not isinstance(raw_facts, list):
        raw_facts = [raw_facts]
    facts: list[str] = []
    for item in raw_facts:
        if isinstance(item, dict):
            value = str(
                item.get("value") or item.get("text") or item.get("claim") or item
            ).strip()
        else:
            value = str(item).strip()
        if value:
            facts.append(value)
    return facts


def _slack_user_label(user_id: str) -> str:
    value = user_id.strip()
    if value.startswith("U") or value.startswith("W"):
        return f"<@{value}>"
    return value


def apply_fact_review_action(
    facts: list[dict[str, Any]], event: dict[str, Any]
) -> list[dict[str, Any]]:
    action = extract_action(event)
    ref = event.get("ref") if isinstance(event.get("ref"), dict) else {}
    target_id = str(ref.get("target_id") or "").strip()
    if action == "abandon":
        return facts
    if action not in {"approve_fact", "reject_fact", "edit_fact"}:
        raise GateValidationError("unsupported_action")
    if not target_id:
        raise GateValidationError("missing_target_id")
    updated = [dict(item) for item in facts]
    fact = next((item for item in updated if item.get("id") == target_id), None)
    if fact is None:
        raise GateValidationError("invalid_target_id")
    status = str(fact.get("status") or "pending")
    desired_status = {
        "approve_fact": "approved",
        "reject_fact": "rejected",
        "edit_fact": "edited",
    }[action]
    if status != "pending":
        if status == desired_status or (
            status == "edited" and action == "approve_fact"
        ):
            return updated
        raise GateValidationError("fact_already_reviewed")
    if action == "edit_fact":
        edit_text = extract_modal_value(event)
        if not edit_text:
            raise GateValidationError("missing_edit_value")
        fact["original_value"] = fact.get("value")
        fact["value"] = edit_text
        fact["text"] = edit_text
        fact["edit_text"] = edit_text
    fact["status"] = desired_status
    return updated


def fact_review_complete(facts: list[dict[str, Any]]) -> bool:
    return bool(facts) and all(
        str(fact.get("status") or "pending") in {"approved", "rejected", "edited"}
        for fact in facts
    )


def approved_fact_payloads(facts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    payloads: list[dict[str, Any]] = []
    for fact in facts:
        if str(fact.get("status") or "pending") not in {"approved", "edited"}:
            continue
        payload = {
            "id": fact.get("id"),
            "claim": fact.get("claim"),
            "value": fact.get("value"),
            "text": fact.get("value") or fact.get("text") or fact.get("claim"),
            "source_ref": fact.get("source_ref"),
            "confidence": fact.get("confidence"),
            "verified_at": fact.get("verified_at"),
            "category": fact.get("category"),
            "status": fact.get("status"),
            "evidence_ids": fact.get("evidence_ids") or [],
            "evidence": fact.get("evidence") or [],
        }
        if fact.get("edit_text"):
            payload["edit_text"] = fact.get("edit_text")
            payload["original_value"] = fact.get("original_value")
        payloads.append({k: v for k, v in payload.items() if v not in (None, "", [])})
    return payloads


def evidence_for_approved_facts(facts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    evidence: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for fact in facts:
        if str(fact.get("status") or "pending") not in {"approved", "edited"}:
            continue
        for item in fact.get("evidence") or []:
            if not isinstance(item, dict):
                continue
            key = (
                str(item.get("id") or ""),
                str(item.get("url") or item.get("source_ref") or ""),
                str(item.get("quote") or ""),
            )
            if key in seen:
                continue
            seen.add(key)
            evidence.append(dict(item))
    return evidence


def _dedupe_evidence(raw_evidence: list[Any]) -> list[dict[str, Any]]:
    evidence: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    seen_url_quotes: set[tuple[str, str]] = set()
    for item in raw_evidence:
        if not isinstance(item, dict):
            continue
        quote = str(
            item.get("quote") or item.get("snippet") or item.get("text") or ""
        ).strip()
        url = str(
            item.get("url") or item.get("source_ref") or item.get("source") or ""
        ).strip()
        evidence_id = str(item.get("id") or item.get("evidence_id") or "").strip()
        url_quote = (url, quote)
        if (evidence_id and evidence_id in seen_ids) or url_quote in seen_url_quotes:
            continue
        if evidence_id:
            seen_ids.add(evidence_id)
        seen_url_quotes.add(url_quote)
        evidence.append(
            {
                **item,
                "id": evidence_id,
                "title": str(item.get("title") or item.get("name") or "").strip(),
                "url": url,
                "source_ref": str(item.get("source_ref") or url).strip(),
                "quote": quote,
            }
        )
    return evidence


def _match_evidence(
    fact: dict[str, Any], evidence: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    ids = {
        str(item).strip()
        for item in (fact.get("evidence_ids") or fact.get("evidence") or [])
        if str(item).strip()
    }
    source_ref = str(
        fact.get("source_ref") or fact.get("source") or fact.get("url") or ""
    ).strip()
    matches: list[dict[str, Any]] = []
    for item in evidence:
        if ids and str(item.get("id") or "") in ids:
            matches.append(item)
            continue
        if source_ref and source_ref in {
            str(item.get("source_ref") or ""),
            str(item.get("url") or ""),
        }:
            matches.append(item)
    return matches[:2]


def _format_fact_for_review(fact: dict[str, Any]) -> str:
    status = {
        "approved": "✅ Approved",
        "rejected": "❌ Rejected",
        "edited": "✏️ Edited + approved",
        "pending": "⏳ Pending",
    }.get(str(fact.get("status") or "pending"), "⏳ Pending")
    lines = [f"*{status} — {fact.get('id', 'fact')}*"]
    claim = str(fact.get("claim") or "").strip()
    value = str(fact.get("value") or fact.get("text") or "").strip()
    if claim:
        lines.append(f"*Claim:* {truncate(claim, 350)}")
    if value and value != claim:
        lines.append(f"*Value:* {truncate(value, 700)}")
    elif value:
        lines.append(f"*Value:* {truncate(value, 700)}")
    source_ref = str(fact.get("source_ref") or "").strip()
    if source_ref:
        lines.append(f"*Source:* {source_ref}")
    confidence = fact.get("confidence")
    if confidence not in (None, ""):
        lines.append(f"*Confidence:* {confidence}")
    evidence = fact.get("evidence") if isinstance(fact.get("evidence"), list) else []
    if evidence:
        first = evidence[0]
        title = str(
            first.get("title")
            or first.get("url")
            or first.get("source_ref")
            or "Evidence"
        ).strip()
        quote = str(first.get("quote") or "").strip()
        lines.append(f"*Evidence:* {truncate(title, 180)}")
        if quote:
            lines.append(f">{truncate(quote, 500)}")
    return "\n".join(lines)


def _unverifiable_text(item: Any) -> str:
    if isinstance(item, dict):
        return str(
            item.get("claim") or item.get("text") or item.get("reason") or item
        ).strip()
    return str(item).strip()


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
    result: dict[str, Any], brief: str, facts: list[str | dict[str, Any]]
) -> dict[str, Any] | None:
    card = result.get("release_card") or result.get("card")
    if isinstance(card, dict):
        return card
    return None
