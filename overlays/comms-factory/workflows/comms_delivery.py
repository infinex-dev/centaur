"""Delivery routing for comms_release (phase 2): destination grouping, the
human-confirmed delivery gate, and the optional display.dev blog review loop.

Same durable round-gate discipline as the candidate gate (comms_release.py
:453-607): fresh Gate(run_id, stage, gate_version) per interactive round
(events are first-write-wins per (event_type, correlation_id) — never reuse a
correlation for a second wait), terminal buttonless render on every exit,
bounded loops. All external calls are durable ctx.steps via call_comms_tool;
replay safety lives at the service routes (PR pre-flight + blob sha; display
--base-version guard). Typefully has no idempotency key — a crash between the
API call and the checkpoint can duplicate a DRAFT (accepted, spec Limitations).
"""

from __future__ import annotations

from typing import Any

# Task 11 imports ONLY what the pure helpers use — ruff F401 (unused import)
# fails the lint gate otherwise. Task 12 extends this import block when
# run_delivery_gate lands (WorkflowContext, GateValidationError,
# SlackWorkflowInput, call_comms_tool, extract_action, post_gate_message,
# update_gate_message, wait_for_gate_action).
from comms_shared import (
    Gate,
    actions_block,
    chunked_markdown_blocks,
    context_block,
    markdown_block,
)

PR_CHANNELS = ("blog", "web")
TYPEFULLY_CHANNELS = ("x", "x-thread")
MAX_DELIVERY_ROUNDS = 12
MAX_BLOG_REVIEW_ROUNDS = 10  # revision rounds (failed revisions don't consume)
MAX_BLOG_REVIEW_WAITS = 30  # hard cap on gate waits, failures included


def destination_groups(
    channels: list[str], final_by_channel: dict[str, Any]
) -> dict[str, list[str]]:
    approved = [c for c in channels if final_by_channel.get(c) is not None]
    return {
        "platform_pr": [c for c in approved if c in PR_CHANNELS],
        "typefully": [c for c in approved if c in TYPEFULLY_CHANNELS],
        "copy_only": [
            c for c in approved if c not in PR_CHANNELS and c not in TYPEFULLY_CHANNELS
        ],
    }


def deliverable_groups(
    groups: dict[str, list[str]], caps: dict[str, Any]
) -> dict[str, bool]:
    """Buttons appear only when the group is non-empty AND its capability is true."""
    return {
        "platform_pr": bool(groups["platform_pr"]) and bool(caps.get("platform_pr")),
        "typefully": bool(groups["typefully"]) and bool(caps.get("typefully")),
    }


def tweets_for_channel(
    candidates: list[dict[str, Any]], entry: dict[str, Any] | None, channel: str
) -> list[str]:
    """Typefully posts for an X channel. x-thread MUST consume the chosen
    candidate's structured tweets array (joined back via candidate_id) — never
    re-split the flattened text when structured exists. Solo x is one post."""
    text = str((entry or {}).get("text") or "")
    if channel != "x-thread":
        return [text] if text.strip() else []
    candidate = next(
        (c for c in candidates if c.get("id") == (entry or {}).get("candidate_id")),
        None,
    )
    structured = (candidate or {}).get("structured")
    if isinstance(structured, dict) and isinstance(structured.get("tweets"), list):
        tweets = [str(t) for t in structured["tweets"] if str(t).strip()]
        if tweets:
            return tweets
    return [part.strip() for part in text.split("\n\n") if part.strip()]


def empty_deliveries() -> dict[str, Any]:
    return {
        "platform_pr": {"status": "skipped", "url": None},
        "typefully": [],
        "copy_only": [],
        "blog_review": {"status": "skipped", "url": None, "version": None},
    }


def deliveries_made(deliveries: dict[str, Any]) -> bool:
    if deliveries["platform_pr"].get("status") == "created":
        return True
    return any(item.get("status") == "created" for item in deliveries["typefully"])


def fenced_diff_blocks(diff: str, limit: int = 2800) -> list[dict[str, Any]]:
    """Render a unified diff as Slack blocks, fencing EACH chunk individually.

    chunked_markdown_blocks splits on line boundaries with no fence awareness —
    wrapping the whole diff in one ``` fence leaves middle chunks unfenced (raw
    +/- lines render as mrkdwn). Chunk first, then fence each chunk."""
    lines = str(diff or "").split("\n")
    chunks: list[str] = []
    current: list[str] = []
    size = 0
    for line in lines:
        addition = len(line) + (1 if current else 0)
        if current and size + addition > limit:
            chunks.append("\n".join(current))
            current, size = [line], len(line)
            continue
        current.append(line)
        size += addition
    if current:
        chunks.append("\n".join(current))
    return [markdown_block(f"```\n{chunk}\n```") for chunk in chunks]


def delivery_gate_blocks(
    gate: Gate,
    groups: dict[str, list[str]],
    enabled: dict[str, bool],
    state: dict[str, str],
    deliveries: dict[str, Any],
    *,
    final_by_channel: dict[str, Any] | None = None,
    audit_line: str = "",
    terminal: bool = False,
) -> list[dict[str, Any]]:
    blocks = [
        markdown_block(
            "*Delivery* — route approved copy to its real destinations. Nothing"
            " auto-publishes: the PR is human-merged; Typefully drafts are"
            " human-published. *Finish* always means: done — accept the current"
            " delivery state."
        )
    ]
    for channel in groups["copy_only"]:
        blocks.append(
            markdown_block(
                f"_{channel}: no automated destination — copy below; deliver manually._"
            )
        )
        # Inline the copy so the operator doesn't have to scroll back for it
        # (modal especially: the exact text is what gets posted by hand).
        entry = (final_by_channel or {}).get(channel) or {}
        if entry.get("text"):
            blocks.extend(chunked_markdown_blocks(f">{entry['text']}"))
    actions: list[Any] = []
    if enabled["platform_pr"]:
        chans = " + ".join(groups["platform_pr"])
        # The typefully-first ordering is a side effect of Create PR — say so on
        # the button itself, never silently.
        drafts_pending = bool(enabled["typefully"] and state["typefully"] == "idle")
        create_label = "Create Typefully drafts + PR" if drafts_pending else "Create PR"
        if state["pr"] == "idle":
            blocks.append(
                markdown_block(f"*Platform PR* ({chans}) — preview the diff first.")
            )
            actions.append(("Preview platform PR", "preview_pr", None))
        elif state["pr"] == "previewed":
            note = (
                "\n_Typefully drafts are created first so the draft URL lands in"
                " the blog frontmatter's typefullyUrl._"
                if drafts_pending
                else ""
            )
            blocks.append(
                markdown_block(
                    f"*Platform PR* ({chans}) — planned diff posted above.{note}"
                )
            )
            actions.append((create_label, "create_pr", "primary"))
            actions.append(("Cancel PR", "cancel_pr", None))
        elif state["pr"] == "create_failed":
            blocks.append(
                markdown_block(
                    f"*Platform PR* ({chans}) — creation FAILED (see the context"
                    " line). Any Typefully drafts already created are listed"
                    " below. Retry is safe: the route pre-flight finds an"
                    " existing PR and contents PUTs are idempotent."
                )
            )
            actions.append((create_label, "create_pr", "primary"))
            actions.append(("Cancel PR", "cancel_pr", None))
        elif state["pr"] == "created":
            blocks.append(
                markdown_block(
                    f"*Platform PR* — created: {deliveries['platform_pr'].get('url')}"
                )
            )
        elif state["pr"] == "cancelled":
            blocks.append(markdown_block("*Platform PR* — cancelled this run."))
    if enabled["typefully"]:
        if state["typefully"] == "idle":
            blocks.append(
                markdown_block(
                    f"*Typefully drafts* ({' + '.join(groups['typefully'])}) —"
                    " creates DRAFTS; a human publishes."
                )
            )
            actions.append(("Create Typefully drafts", "typefully", None))
        else:
            urls = ", ".join(
                str(item.get("url"))
                for item in deliveries["typefully"]
                if item.get("url")
            )
            blocks.append(markdown_block(f"*Typefully drafts* — created: {urls}"))
    if audit_line:
        blocks.append(context_block(audit_line))
    if not terminal:
        actions.append(("Finish", "finish", None))
        blocks.append(actions_block(gate, actions))
    return blocks
