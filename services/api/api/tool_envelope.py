"""Wrap raw tool results into the tool_result.v1 envelope for HTTP consumers.

This module ports the evidence extraction and projection logic that lived in
``routers/capabilities.py`` (``_normalize_success``, ``_normalize_evidence``,
``_extract_error``, ``_evidence_projection``) into the native tool plane.

Sandbox agents using ``call_tool_raw`` still see the original tool return
format.  Only the REST endpoint at ``POST /tools/{tool}/{method}`` wraps the
result into the envelope so HTTP consumers (comms-factory, etc.) receive the
pinned ``tool_result.v1`` contract.
"""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any

from centaur_sdk.evidence import (
    EVIDENCE_ITEM_SCHEMA,
    TOOL_RESULT_SCHEMA,
    EvidenceItem,
)


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


# ---------------------------------------------------------------------------
# Evidence extraction — tool-specific knowledge of result shapes
# ---------------------------------------------------------------------------


def _extract_raw_evidence(raw: Any) -> list[dict[str, Any]]:
    """Return pre-existing ``evidence`` items from a tool result."""
    if not isinstance(raw, dict):
        return []
    evidence = raw.get("evidence")
    return evidence if isinstance(evidence, list) else []


def _web_evidence(raw: Any) -> list[dict[str, Any]]:
    """Extract evidence from websearch / web_fetch / browser raw results."""
    if not isinstance(raw, dict):
        return []
    items: list[dict[str, Any]] = []
    # websearch returns results as SourceDocument dicts
    for result in raw.get("results") or []:
        if not isinstance(result, dict):
            continue
        url = str(result.get("url") or result.get("source_url") or "")
        title = str(result.get("title") or result.get("source") or url)
        text = str(
            result.get("text")
            or result.get("snippet")
            or result.get("preview")
            or result.get("summary")
            or title
        )
        items.append(
            {
                "type": "web.search_result",
                "text": text[:2000],
                "provenance": {
                    "url": url,
                    "title": title,
                    "query": raw.get("query"),
                    "retrieved_at": _now(),
                    "domain": result.get("domain"),
                    "freshness": result.get("published_date")
                    or result.get("publishedDate"),
                },
            }
        )
    return items


def _company_context_evidence(raw: Any) -> list[dict[str, Any]]:
    """Extract evidence from company_context search results."""
    if not isinstance(raw, dict):
        return []
    items: list[dict[str, Any]] = []
    for result in raw.get("results") or []:
        if not isinstance(result, dict):
            continue
        text = str(
            result.get("preview") or result.get("body") or result.get("title") or ""
        )
        items.append(
            {
                "type": "company_context.document",
                "text": text[:2000],
                "provenance": {
                    "document_id": result.get("document_id"),
                    "source": result.get("source"),
                    "source_type": result.get("source_type"),
                    "source_document_id": result.get("source_document_id"),
                    "source_chunk_id": result.get("source_chunk_id"),
                    "url": result.get("url"),
                    "title": result.get("title"),
                    "occurred_at": result.get("occurred_at"),
                    "source_updated_at": result.get("source_updated_at"),
                    "retrieved_at": _now(),
                },
            }
        )
    return items


def _x_evidence(raw: Any) -> list[dict[str, Any]]:
    """Extract evidence from twitter/x tool results."""
    if isinstance(raw, dict):
        tweets: Any = (
            raw.get("tweets") or raw.get("results") or raw.get("posts") or []
        )
        if isinstance(raw.get("value"), (list, tuple)):
            tweets = raw["value"]
    else:
        tweets = raw
    if isinstance(tweets, tuple):
        tweets = tweets[0]
    items: list[dict[str, Any]] = []
    for tweet in tweets or []:
        if not isinstance(tweet, dict):
            continue
        text = str(
            tweet.get("text") or tweet.get("full_text") or tweet.get("content") or ""
        )
        tweet_id = tweet.get("tweet_id") or tweet.get("id") or tweet.get("post_id")
        handle = (
            tweet.get("screen_name") or tweet.get("username") or tweet.get("author")
        )
        url = tweet.get("url") or (
            f"https://x.com/{handle}/status/{tweet_id}"
            if handle and tweet_id
            else None
        )
        items.append(
            {
                "type": "x.post",
                "text": text[:2000],
                "provenance": {
                    "url": url,
                    "tweet_id": tweet_id,
                    "author": handle,
                    "created_at": tweet.get("created_at") or tweet.get("timestamp"),
                    "retrieved_at": _now(),
                },
            }
        )
    return items


# Tool name → evidence extractor for tools that don't natively emit evidence[].
_TOOL_EVIDENCE_EXTRACTORS: dict[str, Any] = {
    "websearch": _web_evidence,
    "web_fetch": _web_evidence,
    "browser": _web_evidence,
    "company_context": _company_context_evidence,
    "twitter": _x_evidence,
}


# ---------------------------------------------------------------------------
# Evidence projection — raw {type, text, provenance} → EvidenceItem
# ---------------------------------------------------------------------------


def _source_ref_for_repo(provenance: dict[str, Any]) -> str | None:
    repo = provenance.get("repo")
    sha = provenance.get("resolved_commit_sha")
    path = provenance.get("path")
    line_range = provenance.get("line_range")
    if isinstance(line_range, dict):
        start = line_range.get("start")
        end = line_range.get("end")
        line_suffix = f":{start}-{end}" if start and end else ""
    else:
        line_suffix = ""
    if repo and sha and path:
        return f"{repo}@{sha}:{path}{line_suffix}"
    return None


def _source_ref(item_type: str, provenance: dict[str, Any]) -> str | None:
    if item_type.startswith("repo."):
        return _source_ref_for_repo(provenance)
    if item_type.startswith("web.") or item_type == "browser.render":
        return str(provenance.get("url") or "") or None
    if item_type.startswith("x."):
        post_id = (
            provenance.get("post_id")
            or provenance.get("tweet_id")
            or provenance.get("id")
        )
        return str(provenance.get("url") or post_id or "") or None
    return (
        str(
            provenance.get("source_ref")
            or provenance.get("url")
            or provenance.get("document_id")
            or ""
        )
        or None
    )


def _project_evidence_item(item: dict[str, Any]) -> EvidenceItem:
    """Project a raw ``{type, text, provenance}`` item into an ``EvidenceItem``."""
    provenance = (
        item.get("provenance") if isinstance(item.get("provenance"), dict) else {}
    )
    retrieved_at = str(
        provenance.get("retrieved_at") or item.get("retrieved_at") or _now()
    )
    text = str(item.get("text") or item.get("preview") or item.get("quote") or "")[
        :5000
    ]
    item_type = str(item.get("type") or item.get("source") or "unknown")

    evidence_id = str(
        item.get("id")
        or f"ev_{hashlib.sha1(json.dumps(item, sort_keys=True, default=str).encode()).hexdigest()[:16]}"
    )

    source = str(item.get("source") or item_type)
    ref = item.get("source_ref") or _source_ref(item_type, provenance)
    title = item.get("title") or provenance.get("title") or provenance.get("path")
    url = item.get("url") or provenance.get("url")
    quote = item.get("quote") or text

    return EvidenceItem(
        schema_version=EVIDENCE_ITEM_SCHEMA,
        id=evidence_id,
        source=source,
        source_ref=str(ref) if ref else None,
        title=str(title) if title else None,
        url=str(url) if url else None,
        quote=str(quote)[:5000] if quote else None,
        retrieved_at=retrieved_at,
        metadata=provenance,
    )


# ---------------------------------------------------------------------------
# Envelope assembly
# ---------------------------------------------------------------------------


def _extract_error(raw: Any) -> tuple[str, str, bool] | None:
    """Check if a raw tool result represents an error."""
    if not isinstance(raw, dict):
        return None
    if raw.get("ok") is False:
        err = raw.get("error")
        if isinstance(err, dict):
            return (
                str(err.get("code") or "tool_failed"),
                str(err.get("message") or err),
                bool(raw.get("retryable", False)),
            )
        if isinstance(err, str):
            return ("tool_error", err, bool(raw.get("retryable", False)))
        return ("tool_failed", "tool returned error", bool(raw.get("retryable", False)))
    if "error" in raw and raw.get("status") not in {"ok", None}:
        return (
            "tool_error",
            str(raw.get("error") or "tool returned error"),
            bool(raw.get("retryable", False)),
        )
    if raw.get("status") == "error":
        return (
            "tool_error",
            str(raw.get("error") or "tool returned error"),
            bool(raw.get("retryable", False)),
        )
    return None


def _content_from_evidence(evidence: list[EvidenceItem]) -> str | None:
    """Build concise model-visible content from projected evidence."""
    if not evidence:
        return None
    lines: list[str] = []
    for item in evidence[:20]:
        ref = item.source_ref or item.url or item.title or item.source
        quote = (item.quote or "").replace("\n", " ")[:500]
        lines.append(f"{item.id} — {ref}" + (f" — {quote}" if quote else ""))
    return "\n".join(lines)


def wrap_tool_result(
    raw: Any,
    tool_name: str,
    method_name: str,
) -> dict[str, Any]:
    """Wrap a raw tool return value into a ``tool_result.v1`` envelope.

    If the raw result already has ``schema_version: "centaur.tool_result.v1"``,
    it is returned as-is.

    Otherwise the raw result is wrapped: errors are detected and typed,
    evidence items are extracted (from the result's ``evidence`` key or via
    tool-specific extractors) and projected into ``EvidenceItem`` format, and
    content is built from evidence.
    """
    # Already an envelope — pass through
    if isinstance(raw, dict) and raw.get("schema_version") == TOOL_RESULT_SCHEMA:
        return raw

    # Error detection
    error_info = _extract_error(raw)
    if error_info is not None:
        code, message, retryable = error_info
        return {
            "schema_version": TOOL_RESULT_SCHEMA,
            "ok": False,
            "content": None,
            "text": None,
            "output": raw if isinstance(raw, dict) else {"value": raw},
            "evidence": [],
            "error": {"code": code, "message": message},
            "retryable": retryable,
        }

    # Evidence extraction
    raw_items = _extract_raw_evidence(raw)
    if not raw_items:
        extractor = _TOOL_EVIDENCE_EXTRACTORS.get(tool_name)
        if extractor:
            raw_items = extractor(raw)

    # Project to EvidenceItem
    evidence = [_project_evidence_item(item) for item in raw_items if isinstance(item, dict)]
    evidence_dicts = [item.model_dump(mode="json") for item in evidence]
    content = _content_from_evidence(evidence)

    output = raw if isinstance(raw, dict) else {"value": raw}

    return {
        "schema_version": TOOL_RESULT_SCHEMA,
        "ok": True,
        "content": content,
        "text": content,
        "output": output,
        "evidence": evidence_dicts,
        "error": None,
        "retryable": False,
    }
