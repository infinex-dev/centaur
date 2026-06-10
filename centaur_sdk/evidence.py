"""tool_result.v1 envelope and EvidenceItem convention.

Defines the standard result shape that read-only research tools return through
the native ``/tools/{tool}/{method}`` plane.  Consumers parse this envelope via
``callTool`` in ``packages/api-client`` (TS) or the helpers below (Python).

Schema versions:
    centaur.tool_result.v1   — top-level result envelope
    centaur.evidence_item.v1 — individual evidence receipt
"""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

TOOL_RESULT_SCHEMA = "centaur.tool_result.v1"
EVIDENCE_ITEM_SCHEMA = "centaur.evidence_item.v1"


class ToolResultError(BaseModel):
    """Typed error carried inside a ``tool_result.v1`` envelope."""

    code: str
    message: str


class EvidenceItem(BaseModel):
    """A single piece of citable evidence with stable provenance.

    Evidence is **separate from model-visible text**: freeform tool text is
    context, not claim-supporting proof unless attached to a typed
    ``EvidenceItem``.
    """

    schema_version: Literal["centaur.evidence_item.v1"] = EVIDENCE_ITEM_SCHEMA
    id: str
    source: str
    source_ref: str | None = None
    title: str | None = None
    url: str | None = None
    quote: str | None = None
    retrieved_at: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ToolResult(BaseModel):
    """The ``centaur.tool_result.v1`` envelope returned by research tools.

    Fields:
        ok:        ``True`` for success, ``False`` for error.
        content:   Model-visible summary text (evidence IDs, concise refs).
        text:      Alias for ``content`` (for compat).
        output:    Full structured output (the raw tool result dict).
        evidence:  List of citable evidence items with provenance.
        error:     Typed error (only when ``ok=False``).
        retryable: ``True`` if the caller may retry (transient failure).
    """

    schema_version: Literal["centaur.tool_result.v1"] = TOOL_RESULT_SCHEMA
    ok: bool
    content: str | None = None
    text: str | None = None
    output: dict[str, Any] | str | None = None
    evidence: list[EvidenceItem] = Field(default_factory=list)
    error: ToolResultError | None = None
    retryable: bool = False


# ---------------------------------------------------------------------------
# Builder helpers — tools call these to emit evidence with provenance.
# ---------------------------------------------------------------------------


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _stable_id(data: dict[str, Any]) -> str:
    """Produce a deterministic evidence ID from the item's content."""
    encoded = json.dumps(data, sort_keys=True, default=str).encode()
    return f"ev_{hashlib.sha1(encoded).hexdigest()[:16]}"


def evidence_item(
    *,
    source: str,
    source_ref: str | None = None,
    title: str | None = None,
    url: str | None = None,
    quote: str | None = None,
    retrieved_at: str | None = None,
    metadata: dict[str, Any] | None = None,
    id: str | None = None,
) -> EvidenceItem:
    """Build a single ``EvidenceItem`` with stable provenance."""
    item_data = {
        "source": source,
        "source_ref": source_ref,
        "title": title,
        "url": url,
        "quote": quote,
    }
    return EvidenceItem(
        id=id or _stable_id(item_data),
        source=source,
        source_ref=source_ref,
        title=title,
        url=url,
        quote=quote[:5000] if quote else None,
        retrieved_at=retrieved_at or _now(),
        metadata=metadata or {},
    )


def content_from_evidence(evidence: list[EvidenceItem]) -> str | None:
    """Build concise model-visible content summarizing evidence items."""
    if not evidence:
        return None
    lines: list[str] = []
    for item in evidence[:20]:
        ref = item.source_ref or item.url or item.title or item.source
        quote = (item.quote or "").replace("\n", " ")[:500]
        lines.append(f"{item.id} — {ref}" + (f" — {quote}" if quote else ""))
    return "\n".join(lines)


def tool_result(
    *,
    ok: bool = True,
    content: str | None = None,
    output: dict[str, Any] | str | None = None,
    evidence: list[EvidenceItem] | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
    retryable: bool = False,
) -> dict[str, Any]:
    """Assemble a ``tool_result.v1`` envelope as a plain dict.

    Tools return this dict from their methods; the REST endpoint serializes it
    and — when it detects ``schema_version`` — returns it directly to the
    caller without additional wrapping.
    """
    ev = evidence or []
    resolved_content = content or content_from_evidence(ev)
    result = ToolResult(
        ok=ok,
        content=resolved_content,
        text=resolved_content,
        output=output,
        evidence=ev,
        error=(
            ToolResultError(code=error_code or "unknown", message=error_message or "")
            if not ok
            else None
        ),
        retryable=retryable,
    )
    return result.model_dump(mode="json")


def tool_error(
    *,
    code: str,
    message: str,
    retryable: bool = False,
) -> dict[str, Any]:
    """Shorthand for an error ``tool_result.v1`` envelope."""
    return tool_result(
        ok=False,
        error_code=code,
        error_message=message,
        retryable=retryable,
    )
