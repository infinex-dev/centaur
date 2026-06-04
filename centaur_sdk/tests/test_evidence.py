"""Tests for centaur_sdk.evidence — tool_result.v1 envelope + EvidenceItem."""

from __future__ import annotations

import json

from centaur_sdk.evidence import (
    EVIDENCE_ITEM_SCHEMA,
    TOOL_RESULT_SCHEMA,
    EvidenceItem,
    ToolResult,
    content_from_evidence,
    evidence_item,
    tool_error,
    tool_result,
)


class TestEvidenceItem:
    def test_build_evidence_item_with_defaults(self):
        item = evidence_item(source="repo.search_match", source_ref="org/repo@abc123:path.py:10-10")
        assert item.schema_version == EVIDENCE_ITEM_SCHEMA
        assert item.source == "repo.search_match"
        assert item.source_ref == "org/repo@abc123:path.py:10-10"
        assert item.id.startswith("ev_")
        assert item.retrieved_at is not None

    def test_stable_id_is_deterministic(self):
        a = evidence_item(source="web.page", url="https://example.com")
        b = evidence_item(source="web.page", url="https://example.com")
        assert a.id == b.id

    def test_stable_id_differs_for_different_inputs(self):
        a = evidence_item(source="web.page", url="https://example.com/a")
        b = evidence_item(source="web.page", url="https://example.com/b")
        assert a.id != b.id

    def test_explicit_id_overrides_stable_id(self):
        item = evidence_item(source="test", id="my-custom-id")
        assert item.id == "my-custom-id"

    def test_quote_is_capped_at_5000(self):
        long_quote = "x" * 10000
        item = evidence_item(source="test", quote=long_quote)
        assert item.quote is not None
        assert len(item.quote) == 5000

    def test_metadata_defaults_to_empty(self):
        item = evidence_item(source="test")
        assert item.metadata == {}

    def test_metadata_preserved(self):
        item = evidence_item(source="test", metadata={"repo": "org/repo", "sha": "abc"})
        assert item.metadata == {"repo": "org/repo", "sha": "abc"}


class TestToolResult:
    def test_success_envelope_with_evidence(self):
        items = [
            evidence_item(source="repo.search_match", source_ref="org/repo@abc:f.py:1-1", quote="hello"),
            evidence_item(source="repo.search_match", source_ref="org/repo@abc:g.py:5-5", quote="world"),
        ]
        result = tool_result(ok=True, evidence=items, output={"matches": 2})
        assert result["schema_version"] == TOOL_RESULT_SCHEMA
        assert result["ok"] is True
        assert len(result["evidence"]) == 2
        assert result["evidence"][0]["schema_version"] == EVIDENCE_ITEM_SCHEMA
        assert result["output"] == {"matches": 2}
        # content auto-built from evidence
        assert result["content"] is not None
        assert items[0].id in result["content"]
        assert result["text"] == result["content"]

    def test_success_envelope_with_zero_evidence(self):
        result = tool_result(ok=True, content="No matches found.")
        assert result["ok"] is True
        assert result["evidence"] == []
        assert result["content"] == "No matches found."
        assert result["error"] is None

    def test_error_envelope(self):
        result = tool_error(code="repo_denied", message="not allowed", retryable=False)
        assert result["ok"] is False
        assert result["error"]["code"] == "repo_denied"
        assert result["error"]["message"] == "not allowed"
        assert result["retryable"] is False
        assert result["evidence"] == []

    def test_retryable_error_envelope(self):
        result = tool_error(code="timeout", message="backing service timeout", retryable=True)
        assert result["ok"] is False
        assert result["retryable"] is True

    def test_freeform_output_is_not_promoted_to_evidence(self):
        result = tool_result(ok=True, output={"text": "some freeform analysis"})
        assert result["evidence"] == []
        assert result["output"]["text"] == "some freeform analysis"

    def test_envelope_round_trips_json(self):
        items = [evidence_item(source="test", quote="hello")]
        result = tool_result(ok=True, evidence=items)
        serialized = json.dumps(result)
        parsed = json.loads(serialized)
        # ToolResult can validate the parsed dict
        validated = ToolResult.model_validate(parsed)
        assert validated.ok is True
        assert len(validated.evidence) == 1
        assert validated.evidence[0].id == items[0].id

    def test_explicit_content_overrides_auto_content(self):
        items = [evidence_item(source="test", quote="hello")]
        result = tool_result(ok=True, content="Custom summary", evidence=items)
        assert result["content"] == "Custom summary"


class TestContentFromEvidence:
    def test_empty_evidence_returns_none(self):
        assert content_from_evidence([]) is None

    def test_builds_lines_from_evidence(self):
        items = [
            evidence_item(source="web.page", url="https://example.com", quote="Example text"),
        ]
        content = content_from_evidence(items)
        assert content is not None
        assert items[0].id in content
        assert "https://example.com" in content

    def test_caps_at_20_items(self):
        items = [evidence_item(source="test", id=f"ev_{i}") for i in range(30)]
        content = content_from_evidence(items)
        assert content is not None
        lines = content.strip().split("\n")
        assert len(lines) == 20
