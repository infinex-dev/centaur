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

from api.workflow_engine import WorkflowContext

from comms_shared import (
    Gate,
    GateValidationError,
    SlackWorkflowInput,
    actions_block,
    call_comms_tool,
    chunked_markdown_blocks,
    context_block,
    extract_action,
    markdown_block,
    post_gate_message,
    update_gate_message,
    wait_for_gate_action,
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


def typefully_failure_note(results: list[dict[str, Any]]) -> str:
    """Audit-line suffix naming every failed draft — failures must be visible
    in the gate UI, never silently absorbed by a partial success."""
    return "".join(
        f" Typefully failed for {item.get('channel')}:"
        f" {item.get('error') or 'unknown'}."
        for item in results
        if item.get("status") == "failed"
    )


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
            # Failed entries are LISTED, not filtered: a mixed result must show
            # the operator exactly which channel needs manual follow-up.
            rendered = ", ".join(
                f"{item.get('channel')}: FAILED ({item.get('error') or 'unknown'})"
                if item.get("status") == "failed"
                else str(item.get("url"))
                for item in deliveries["typefully"]
                if item.get("status") == "failed" or item.get("url")
            )
            blocks.append(markdown_block(f"*Typefully drafts* — created: {rendered}"))
    if audit_line:
        blocks.append(context_block(audit_line))
    if not terminal:
        actions.append(("Finish", "finish", None))
        blocks.append(actions_block(gate, actions))
    return blocks


async def run_delivery_gate(
    ctx: WorkflowContext,
    inp: SlackWorkflowInput,
    *,
    card: dict[str, Any],
    channels: list[str],
    final_by_channel: dict[str, Any],
    candidates: list[dict[str, Any]],
    caps: dict[str, Any],
    deliveries: dict[str, Any],
) -> tuple[dict[str, Any], str]:
    groups = destination_groups(channels, final_by_channel)
    enabled = deliverable_groups(groups, caps)
    deliveries["copy_only"] = groups["copy_only"]
    if not (enabled["platform_pr"] or enabled["typefully"]):
        return deliveries, "no_destinations"

    approvers = tuple(inp.approver_user_ids)
    state = {"pr": "idle", "typefully": "idle"}
    gate_message: dict[str, Any] = {}
    audit_line = ""

    async def _render(gate: Gate, name: str, *, terminal: bool, text: str) -> None:
        nonlocal gate_message
        blocks = delivery_gate_blocks(
            gate,
            groups,
            enabled,
            state,
            deliveries,
            final_by_channel=final_by_channel,
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
                    "event_payload": {"run_id": ctx.run_id, "stage": "deliver"},
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

    def _emit_args(dry_run: bool, typefully_url: str | None = None) -> dict[str, Any]:
        args: dict[str, Any] = {
            "release_card": card,
            "final_by_channel": final_by_channel,
            "candidates": candidates,
            "dry_run": dry_run,
            "run_id": ctx.run_id,
        }
        if typefully_url:
            args["typefully_url"] = typefully_url
        return args

    async def _create_typefully_drafts(round_n: int) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        for channel in groups["typefully"]:
            posts = tweets_for_channel(
                candidates, final_by_channel.get(channel), channel
            )
            result = await call_comms_tool(
                ctx,
                f"typefully_{channel}_r{round_n}",
                "typefully_draft",
                {
                    "channel": channel,
                    "tweets": posts,
                    "title": str(card.get("title") or "")[:80],
                    "scratchpad": f"comms_release {ctx.run_id}",
                },
            )
            entry = {
                "channel": channel,
                "status": "created" if result.get("ok") else "failed",
                "url": result.get("share_url") or result.get("draft_url"),
            }
            if entry["status"] == "failed":
                entry["error"] = str(result.get("error") or "unknown")[:200]
            results.append(entry)
        deliveries["typefully"] = results
        # Only leave "idle" when EVERY draft failed — the button re-renders next
        # round so a transient Typefully outage stays retryable within the gate
        # (fresh per-round step names keep the retry replay-safe).
        if any(item["status"] == "created" for item in results):
            state["typefully"] = "created"
        return results

    outcome = ""
    for round_n in range(1, MAX_DELIVERY_ROUNDS + 1):
        gate = Gate(ctx.run_id, "deliver", round_n, inp.user_id, approvers)
        await _render(
            gate,
            f"render_delivery_gate_r{round_n}",
            terminal=False,
            text="Deliver approved copy.",
        )
        allowed = {"finish"}
        if enabled["platform_pr"] and state["pr"] == "idle":
            allowed.add("preview_pr")
        if enabled["platform_pr"] and state["pr"] in ("previewed", "create_failed"):
            allowed.update({"create_pr", "cancel_pr"})
        if enabled["typefully"] and state["typefully"] == "idle":
            allowed.add("typefully")
        try:
            event = await wait_for_gate_action(
                ctx, f"wait_delivery_gate_r{round_n}", gate, allowed
            )
        except GateValidationError as exc:
            audit_line = f"Delivery gate rejected: {exc.reason}."
            outcome = "rejected"
            break
        action = extract_action(event)
        slack = event.get("slack") if isinstance(event.get("slack"), dict) else {}
        audit_line = f"Round {round_n}: `{action}` by <@{slack.get('user_id') or '?'}>."

        if action == "finish":
            outcome = "finished"
            break
        if action == "preview_pr":
            preview = await call_comms_tool(
                ctx, f"emit_preview_r{round_n}", "emit_platform_pr", _emit_args(True)
            )
            if preview.get("ok") and preview.get("existing"):
                # crash-retry: this run's branch already has an open PR
                state["pr"] = "created"
                deliveries["platform_pr"] = {
                    "status": "created",
                    "url": preview.get("pr_url"),
                }
            elif preview.get("ok") and preview.get("planned_diff") is not None:
                state["pr"] = "previewed"
                await post_gate_message(
                    ctx,
                    name=f"post_pr_preview_r{round_n}",
                    delivery=inp.delivery,
                    text="Planned platform PR diff",
                    # Per-chunk fences — one fence around the whole diff breaks
                    # when the chunker splits it (middle chunks render unfenced).
                    blocks=fenced_diff_blocks(str(preview["planned_diff"])),
                )
            else:
                audit_line += f" Preview failed: {preview.get('error') or 'unknown'}."
        elif action == "cancel_pr":
            state["pr"] = "cancelled"
        elif action == "typefully":
            results = await _create_typefully_drafts(round_n)
            audit_line += typefully_failure_note(results)
        elif action == "create_pr":
            # ORDERING: run Typefully first so the draft URL lands in the blog
            # frontmatter's typefullyUrl (the cross-link the org maintains by hand).
            typefully_url = None
            if enabled["typefully"] and state["typefully"] == "idle":
                results = await _create_typefully_drafts(round_n)
                audit_line += typefully_failure_note(results)
                typefully_url = next(
                    (item["url"] for item in results if item.get("url")), None
                )
            elif deliveries["typefully"]:
                typefully_url = next(
                    (i["url"] for i in deliveries["typefully"] if i.get("url")), None
                )
            emit = await call_comms_tool(
                ctx,
                f"emit_pr_r{round_n}",
                "emit_platform_pr",
                _emit_args(False, typefully_url),
            )
            if emit.get("ok") and emit.get("pr_url"):
                state["pr"] = "created"
                deliveries["platform_pr"] = {
                    "status": "created",
                    "url": emit.get("pr_url"),
                }
                note = (
                    f"*Platform PR created:* {emit['pr_url']}\n"
                    f"Rendered preview: https://infinex.xyz/preview/start?branch="
                    f"{emit.get('branch')}&to=/news/{emit.get('slug')}\n"
                    "_Merging publishes to infinex.xyz/news automatically; the in-app"
                    " changelog popout follows the next platform prod release. The PR"
                    " gets the platform repo's automatic AI content review._"
                )
                await post_gate_message(
                    ctx,
                    name=f"post_pr_created_r{round_n}",
                    delivery=inp.delivery,
                    text="Platform PR created",
                    blocks=[markdown_block(note)],
                )
            else:
                # Distinct render state: the operator must see the failure AND
                # know any Typefully drafts already exist before retrying.
                state["pr"] = "create_failed"
                deliveries["platform_pr"] = {"status": "failed", "url": None}
                audit_line += f" Create PR failed: {emit.get('error') or 'unknown'}."
    else:
        outcome = "exhausted"

    terminal_text = {
        "finished": "Delivery complete.",
        "rejected": "Delivery gate rejected.",
        "exhausted": f"Delivery gate limit reached ({MAX_DELIVERY_ROUNDS} rounds).",
    }[outcome]
    await _render(
        Gate(ctx.run_id, "deliver", 0, inp.user_id, approvers),
        "render_delivery_gate_terminal",
        terminal=True,
        text=terminal_text,
    )
    return deliveries, outcome


def _revise_result_error(result: dict[str, Any]) -> str:
    """Mirror of comms_release._generation_result_error semantics for the revise
    envelope (kept local: comms_release imports this module, so importing back
    would be circular)."""
    if not isinstance(result, dict):
        return "invalid_tool_response"
    if result.get("ok") is False or result.get("error"):
        return str(result.get("error") or "tool_call_failed")[:500]
    if not str(result.get("markdown") or "").strip():
        return "revise_response_missing_markdown"
    return ""


def blog_review_blocks(
    gate: Gate,
    *,
    url: str,
    version: int,
    audit_line: str = "",
    pending_confirm: int = 0,
    processing: str = "",
    stale_note: str = "",
    budget_exhausted: bool = False,
    terminal: bool = False,
) -> list[dict[str, Any]]:
    blocks = [
        markdown_block(
            f"*Blog draft review* — v{version} published (private, reviewer"
            f" allowlist): {url}\nComment inline on the page, then click a button."
            " The bot revises and republishes the same URL; humans never edit"
            " in-browser. The rendered theme is display.dev's, not infinex.xyz —"
            " styling is approximate."
        )
    ]
    if stale_note:
        # In the render proper, not just the context line: reviewers checking
        # display.dev will otherwise wonder why these threads stay open.
        blocks.append(markdown_block(stale_note))
    if audit_line:
        blocks.append(context_block(audit_line))
    if processing and not terminal:
        # Buttonless while a slow durable step runs (revise ≈ minutes): the
        # click is acknowledged and the double-click window is closed.
        blocks.append(markdown_block(f"⏳ _{processing}_"))
        return blocks
    if not terminal:
        if budget_exhausted:
            # Budget exhaustion is NOT an auto-abandon: the operator still gets
            # a final round, just without the revise button.
            blocks.append(
                markdown_block(
                    f"_Revision budget ({MAX_BLOG_REVIEW_ROUNDS}) exhausted —"
                    " approve or abandon._"
                )
            )
        if pending_confirm:
            blocks.append(
                markdown_block(
                    f"⚠️ {pending_confirm} open comment(s) not yet addressed —"
                    " approve anyway?"
                )
            )
            actions = [("Approve anyway", "approve_anyway", "primary")]
            if not budget_exhausted:
                actions.append(("Pull comments & revise", "pull_revise", None))
            actions.append(("Abandon", "abandon", "danger"))
        else:
            actions = (
                []
                if budget_exhausted
                else [("Pull comments & revise", "pull_revise", None)]
            )
            actions.append(("Approve → open PR", "approve", "primary"))
            actions.append(("Abandon", "abandon", "danger"))
        blocks.append(actions_block(gate, actions))
    return blocks


async def run_blog_review_loop(
    ctx: WorkflowContext,
    inp: SlackWorkflowInput,
    *,
    card: dict[str, Any],
    final_by_channel: dict[str, Any],
    deliveries: dict[str, Any],
    reviewer_emails: list[str],
) -> tuple[dict[str, Any], dict[str, Any]]:
    entry = dict(final_by_channel.get("blog") or {})
    original = str(entry.get("text") or "")
    markdown = original
    approvers = tuple(inp.approver_user_ids)

    publish = await call_comms_tool(
        ctx,
        "display_publish_r1",
        "display_publish",
        {
            "markdown": markdown,
            "name": f"comms-blog-{ctx.run_id}",
            "visibility": "private",
            "share": list(reviewer_emails),
        },
    )
    if not publish.get("ok"):
        await post_gate_message(
            ctx,
            name="post_blog_review_unavailable",
            delivery=inp.delivery,
            text="display.dev publish failed — skipping the blog review loop.",
            blocks=[
                context_block(
                    "display.dev publish failed"
                    f" ({publish.get('error') or 'unknown'}) — blog goes straight"
                    " to the delivery PR."
                )
            ],
        )
        return final_by_channel, deliveries

    short_id = str(publish.get("short_id") or "")
    url = str(publish.get("url") or "")
    version = int(publish.get("version") or 1)
    resolved_ids: set[str] = set()
    gate_message: dict[str, Any] = {}
    audit_line = ""
    pending_confirm = 0
    stale_note = ""
    rounds_used = 0
    outcome = ""

    async def _render(
        gate: Gate, name: str, *, terminal: bool, text: str, processing: str = ""
    ) -> None:
        nonlocal gate_message
        blocks = blog_review_blocks(
            gate,
            url=url,
            version=version,
            audit_line=audit_line,
            pending_confirm=pending_confirm,
            processing=processing,
            stale_note=stale_note,
            budget_exhausted=rounds_used >= MAX_BLOG_REVIEW_ROUNDS,
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
                    "event_payload": {"run_id": ctx.run_id, "stage": "blog_review"},
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

    for wait_n in range(1, MAX_BLOG_REVIEW_WAITS + 1):
        # Budget exhaustion is NOT an auto-exit: the operator gets a final
        # approve/abandon round (pull_revise withheld in the render AND the
        # allowed set). The wait cap on this loop stays the only hard
        # exhaustion exit (exhaustion_reason: max_waits_reached).
        budget_exhausted = rounds_used >= MAX_BLOG_REVIEW_ROUNDS
        gate = Gate(ctx.run_id, "blog_review", wait_n, inp.user_id, approvers)
        await _render(
            gate,
            f"render_blog_review_r{wait_n}",
            terminal=False,
            text="Blog draft published for review.",
        )
        allowed = (
            {"approve_anyway", "pull_revise", "abandon"}
            if pending_confirm
            else {"pull_revise", "approve", "abandon"}
        )
        if budget_exhausted:
            allowed.discard("pull_revise")
        try:
            event = await wait_for_gate_action(
                ctx, f"wait_blog_review_r{wait_n}", gate, allowed
            )
        except GateValidationError as exc:
            audit_line = f"Blog review gate rejected: {exc.reason}."
            outcome = "abandoned"
            break
        action = extract_action(event)

        if action == "abandon":
            outcome = "abandoned"
            break
        if action == "approve_anyway":
            outcome = "approved"
            break
        if action == "approve":
            await _render(
                gate,
                f"render_blog_review_checking_r{wait_n}",
                terminal=False,
                text="Checking for open comments…",
                processing="Checking for open comments…",
            )
            open_check = await call_comms_tool(
                ctx,
                f"display_comments_approve_r{wait_n}",
                "display_comments",
                {"short_id": short_id, "status": "open"},
            )
            if open_check.get("ok") is not True:
                # A failed comments check must NOT masquerade as "no comments"
                # (core invariant: feedback is never silently shipped) — do not
                # approve; the next round re-offers the buttons.
                err = str(open_check.get("error") or "unknown")[:200]
                audit_line = (
                    f"Comments check failed: {err} — cannot verify open"
                    " feedback; retry or abandon."
                )
                continue
            open_comments = [
                c
                for c in (open_check.get("comments") or [])
                if str(c.get("id")) not in resolved_ids
            ]
            if open_comments:
                # Feedback is never silently shipped: confirm on the NEXT round
                # (fresh gate_version — a correlation is never reused).
                pending_confirm = len(open_comments)
                audit_line = f"{pending_confirm} open comment(s) not yet addressed."
                continue
            outcome = "approved"
            break
        if action == "pull_revise":
            pending_confirm = 0
            await _render(
                gate,
                f"render_blog_review_revising_r{wait_n}",
                terminal=False,
                text="Revising the draft…",
                processing="Pulling comments and revising the draft — this takes"
                " a few minutes.",
            )
            pulled = await call_comms_tool(
                ctx,
                f"display_comments_r{wait_n}",
                "display_comments",
                {"short_id": short_id, "status": "open"},
            )
            if pulled.get("ok") is not True:
                # Same honesty rule as the approve-path check: a failed pull is
                # not "no new comments" — nothing reaches the reviser, the
                # version is kept, and the revision budget stays intact.
                err = str(pulled.get("error") or "unknown")[:200]
                audit_line = f"Comments pull failed: {err} — keeping v{version}."
                continue
            # Already-addressed feedback is excluded via resolved_ids (fed
            # comments are resolved below) + the route's stale-anchor check.
            # NO createdOnVersion filter: it strands a comment left on a stale
            # page view, and the dsp text-output fallback can't always recover
            # the field (defaulting to 0 would disable the mechanic entirely).
            fresh = [
                c
                for c in (pulled.get("comments") or [])
                if str(c.get("id")) not in resolved_ids
            ]
            if not fresh:
                audit_line = "No new open comments — approve when ready."
                continue
            revise = await call_comms_tool(
                ctx,
                f"display_revise_r{wait_n}",
                "display_revise",
                {
                    "markdown": markdown,
                    "comments": [
                        {"text_quote": c.get("text_quote"), "body": c.get("body")}
                        for c in fresh
                    ],
                    "run_id": ctx.run_id,
                    "release_card": card,
                },
            )
            error = _revise_result_error(revise)
            if error:
                # Failed revision: keep the previous published version and do NOT
                # consume the revision budget (mirrors the surfacing failed-retry
                # rule).
                audit_line = f"Revision failed: {error} — keeping v{version}."
                continue
            revised_markdown = str(revise.get("markdown"))
            republished = await call_comms_tool(
                ctx,
                f"display_publish_r{wait_n + 1}",
                "display_publish",
                {
                    "markdown": revised_markdown,
                    "name": f"comms-blog-{ctx.run_id}",
                    "visibility": "private",
                    "share": list(reviewer_emails),
                    "short_id": short_id,
                    "base_version": version,
                },
            )
            if not republished.get("ok"):
                # Republish failed (base-version conflict / dsp error): the
                # reviewers still see the OLD rendering, so the revision must
                # NOT take effect — discard it, leave comments open, keep the
                # budget intact (same shape as the failed-revise branch above).
                audit_line = (
                    f"Republish failed: {republished.get('error') or 'unknown'}"
                    f" — keeping v{version}; revision discarded."
                )
                continue
            markdown = revised_markdown
            version = int(republished.get("version") or version + 1)
            for comment in fresh:
                cid = str(comment.get("id"))
                await call_comms_tool(
                    ctx,
                    f"display_resolve_{cid}_r{wait_n}",
                    "display_resolve",
                    {"root_comment_id": cid},
                )
                resolved_ids.add(cid)
            rounds_used += 1
            audit = revise.get("director_audit")
            audit_bits = []
            if isinstance(audit, dict):
                audit_bits.append(
                    "Director audit: "
                    + ", ".join(f"{k}={v}" for k, v in list(audit.items())[:4])
                )
            stale = revise.get("stale_anchors") or []
            stale_note = (
                f"_{len(stale)} comment(s) reference spans that were rewritten or"
                " removed — they stay open on display.dev but are treated as"
                " addressed and will not be re-fed to the reviser._"
                if stale
                else ""
            )
            audit_line = (
                f"Revised → v{version}; {len(fresh)} comment(s) addressed. "
                + " ".join(audit_bits)
            )
    else:
        outcome = "exhausted"

    if outcome == "approved":
        if markdown != original:
            entry.update({"text": markdown, "edited": True})
            final_by_channel = {**final_by_channel, "blog": entry}
        deliveries["blog_review"] = {
            "status": "approved",
            "url": url,
            "version": version,
        }
        # Artifact retained as the review record until the PR merges.
        terminal_text = f"Blog review approved at v{version}."
    else:
        await call_comms_tool(
            ctx, "display_unpublish", "display_unpublish", {"short_id": short_id}
        )
        # Spec §6 result enum is approved|abandoned|skipped — exhaustion maps to
        # "abandoned" with a distinct reason rather than widening the enum.
        deliveries["blog_review"] = {
            "status": "abandoned",
            "url": None,
            "version": version,
            **(
                {"exhaustion_reason": "max_waits_reached"}
                if outcome == "exhausted"
                else {}
            ),
            # Human-reviewed revisions are never silently destroyed: the latest
            # revised markdown survives in the durable result even though the
            # PR will ship the PRE-review text.
            **({"discarded_revision": markdown} if markdown != original else {}),
        }
        terminal_text = (
            "Blog review abandoned."
            if markdown == original
            else "Blog review abandoned — ⚠️ the delivery PR will use the"
            f" PRE-review text; {rounds_used} revision round(s) were discarded"
            " (recoverable from the workflow result's"
            " deliveries.blog_review.discarded_revision)."
        )
    await _render(
        Gate(ctx.run_id, "blog_review", 0, inp.user_id, approvers),
        "render_blog_review_terminal",
        terminal=True,
        text=terminal_text,
    )
    return final_by_channel, deliveries
