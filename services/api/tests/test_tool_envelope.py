"""Tests for api.tool_envelope — wrapping raw tool results into tool_result.v1."""

from __future__ import annotations

from api.tool_envelope import wrap_tool_result


class TestWrapToolResult:
    """Tests for the top-level ``wrap_tool_result`` function."""

    def test_passthrough_existing_envelope(self):
        """Already-enveloped results are returned unchanged."""
        envelope = {
            "schema_version": "centaur.tool_result.v1",
            "ok": True,
            "content": "hello",
            "evidence": [],
        }
        result = wrap_tool_result(envelope, "test_tool", "test_method")
        assert result is envelope  # identity — no copy

    def test_success_with_repo_evidence(self):
        """repo_context-style results have their evidence projected."""
        raw = {
            "ok": True,
            "repo": "org/repo",
            "requested_ref": "HEAD",
            "resolved_commit_sha": "abc123" * 7 + "ab",
            "query": "hello",
            "matches": [{"path": "f.py", "line": 10}],
            "evidence": [
                {
                    "type": "repo.search_match",
                    "text": "hello world",
                    "provenance": {
                        "repo": "org/repo",
                        "requested_ref": "HEAD",
                        "resolved_commit_sha": "abc123" * 7 + "ab",
                        "path": "f.py",
                        "line_range": {"start": 10, "end": 10},
                        "operation": "search",
                        "query": "hello",
                        "retrieved_at": "2026-06-04T00:00:00Z",
                    },
                }
            ],
        }
        result = wrap_tool_result(raw, "repo_context", "search")
        assert result["schema_version"] == "centaur.tool_result.v1"
        assert result["ok"] is True
        assert len(result["evidence"]) == 1
        ev = result["evidence"][0]
        assert ev["schema_version"] == "centaur.evidence_item.v1"
        assert ev["source"] == "repo.search_match"
        assert "org/repo@" in ev["source_ref"]
        assert ev["quote"] == "hello world"
        assert result["content"] is not None
        assert ev["id"] in result["content"]

    def test_success_with_no_evidence(self):
        """Tools with no evidence produce an empty evidence list."""
        raw = {"ok": True, "data": "some output"}
        result = wrap_tool_result(raw, "some_tool", "some_method")
        assert result["schema_version"] == "centaur.tool_result.v1"
        assert result["ok"] is True
        assert result["evidence"] == []
        assert result["content"] is None
        assert result["output"] == raw

    def test_error_with_ok_false(self):
        """Error results detected via ok=False."""
        raw = {
            "ok": False,
            "error": {"code": "repo_denied", "message": "not allowed"},
            "retryable": False,
        }
        result = wrap_tool_result(raw, "repo_context", "search")
        assert result["schema_version"] == "centaur.tool_result.v1"
        assert result["ok"] is False
        assert result["error"]["code"] == "repo_denied"
        assert result["error"]["message"] == "not allowed"
        assert result["retryable"] is False
        assert result["evidence"] == []

    def test_retryable_error(self):
        raw = {
            "ok": False,
            "error": {"code": "timeout", "message": "backing service timeout"},
            "retryable": True,
        }
        result = wrap_tool_result(raw, "websearch", "search")
        assert result["ok"] is False
        assert result["retryable"] is True

    def test_error_with_string_error_field(self):
        raw = {"ok": False, "error": "something went wrong"}
        result = wrap_tool_result(raw, "test", "test")
        assert result["ok"] is False
        assert result["error"]["message"] == "something went wrong"

    def test_error_with_status_error(self):
        raw = {"status": "error", "error": "connection failed"}
        result = wrap_tool_result(raw, "test", "test")
        assert result["ok"] is False
        assert result["error"]["code"] == "tool_error"

    def test_websearch_evidence_extraction(self):
        """websearch results are projected from the results list."""
        raw = {
            "query": "centaur ai",
            "results": [
                {
                    "source_id": 0,
                    "title": "Centaur AI",
                    "url": "https://centaur.ai",
                    "snippet": "Centaur is an AI platform",
                    "domain": "centaur.ai",
                    "published_date": "2026-01-01",
                },
                {
                    "source_id": 1,
                    "title": "Another Result",
                    "url": "https://example.com",
                    "snippet": "Example page",
                    "domain": "example.com",
                },
            ],
            "answer_markdown": "Some answer",
        }
        result = wrap_tool_result(raw, "websearch", "search")
        assert result["ok"] is True
        assert len(result["evidence"]) == 2
        ev0 = result["evidence"][0]
        # Evidence type matches the capability-era `web.search_result`.
        assert ev0["source"] == "web.search_result"
        assert ev0["url"] == "https://centaur.ai"
        assert ev0["source_ref"] == "https://centaur.ai"
        # Stable, citable evidence id.
        assert ev0["id"].startswith("ev_")
        assert ev0["id"] != result["evidence"][1]["id"]
        # Provenance is carried through metadata.
        meta = ev0["metadata"]
        assert meta["url"] == "https://centaur.ai"
        assert meta["query"] == "centaur ai"
        assert meta["domain"] == "centaur.ai"
        assert meta["retrieved_at"]
        # The model-visible content references each evidence id.
        assert ev0["id"] in result["content"]

    def test_twitter_evidence_extraction(self):
        """Twitter search_tweets results are projected as x.post evidence."""
        raw = (
            [
                {
                    "tweet_id": "12345",
                    "screen_name": "alice",
                    "text": "Hello from twitter",
                    "created_at": "2026-06-01T00:00:00Z",
                }
            ],
            {"api_calls_remaining": 100},
        )
        result = wrap_tool_result(raw, "twitter", "search_tweets")
        assert result["ok"] is True
        assert len(result["evidence"]) == 1
        ev = result["evidence"][0]
        # Evidence type matches the capability-era `x.post`.
        assert ev["source"] == "x.post"
        assert "alice" in ev["source_ref"]
        assert "12345" in ev["source_ref"]
        # Stable, citable evidence id.
        assert ev["id"].startswith("ev_")
        # Provenance is carried through metadata.
        meta = ev["metadata"]
        assert meta["tweet_id"] == "12345"
        assert meta["author"] == "alice"
        assert meta["created_at"] == "2026-06-01T00:00:00Z"
        assert meta["url"] == "https://x.com/alice/status/12345"
        assert meta["retrieved_at"]
        assert ev["quote"] == "Hello from twitter"

    def test_company_context_evidence_extraction(self):
        """company_context results are projected."""
        raw = {
            "status": "ok",
            "query": "onboarding",
            "results": [
                {
                    "document_id": "doc-1",
                    "source": "notion",
                    "source_type": "page",
                    "title": "Onboarding Guide",
                    "preview": "Welcome to the team...",
                    "url": "https://notion.so/onboarding",
                }
            ],
        }
        result = wrap_tool_result(raw, "company_context", "search")
        assert result["ok"] is True
        assert len(result["evidence"]) == 1
        ev = result["evidence"][0]
        assert ev["source"] == "company_context.document"
        assert "notion.so" in (ev["source_ref"] or "")

    def test_non_dict_raw_result(self):
        """Non-dict raw results are wrapped."""
        raw = "plain string result"
        result = wrap_tool_result(raw, "test", "test")
        assert result["ok"] is True
        assert result["output"] == {"value": "plain string result"}
        assert result["evidence"] == []

    def test_evidence_item_has_stable_id(self):
        """Evidence IDs are deterministic for the same content."""
        raw = {
            "ok": True,
            "evidence": [
                {
                    "type": "repo.file",
                    "text": "content",
                    "provenance": {"repo": "org/repo", "path": "f.py"},
                }
            ],
        }
        r1 = wrap_tool_result(raw, "repo_context", "read_file")
        r2 = wrap_tool_result(raw, "repo_context", "read_file")
        assert r1["evidence"][0]["id"] == r2["evidence"][0]["id"]
