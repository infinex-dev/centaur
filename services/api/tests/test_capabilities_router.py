from __future__ import annotations

import subprocess
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest

from api.api_keys import create_key
from api.tool_manager import LoadedTool, ToolMethod
from centaur_sdk import ToolContext
from tools.infra.repo_context.client import RepoContextClient


def _git(cwd: Path, *args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=cwd, text=True).strip()


def _make_repo(root: Path) -> str:
    repo = root / "owner" / "repo"
    repo.mkdir(parents=True)
    _git(repo, "init")
    _git(repo, "config", "user.email", "test@example.com")
    _git(repo, "config", "user.name", "Test User")
    (repo / "README.md").write_text("hello capability plane\n", encoding="utf-8")
    _git(repo, "add", "README.md")
    _git(repo, "commit", "-m", "initial")
    return _git(repo, "rev-parse", "HEAD")


@pytest.mark.asyncio
async def test_catalog_lists_only_available_capabilities(
    client, managed_app, monkeypatch
) -> None:
    monkeypatch.setenv("REPO_CONTEXT_ROOT", "/tmp/repo-cache")
    monkeypatch.setenv("REPO_CONTEXT_REPOSITORIES", "owner/repo")
    manager = managed_app.state.tool_manager
    old_tools = manager.tools
    monkeypatch.setattr(
        manager,
        "tools",
        {
            "repo_context": SimpleNamespace(
                methods=[SimpleNamespace(method_name="search")]
            )
        },
    )

    response = await client.get("/capabilities/catalog?profile=comms")

    assert response.status_code == 200
    names = [entry["capability"] for entry in response.json()["capabilities"]]
    assert names == ["repo.search"]
    monkeypatch.setattr(manager, "tools", old_tools)


@pytest.mark.asyncio
async def test_execute_unknown_capability_returns_typed_error(client) -> None:
    response = await client.post(
        "/capabilities/execute",
        json={
            "request_id": "cap-test-unknown",
            "job_id": "job-1",
            "thread_key": "thread-1",
            "stage": "ground",
            "capability": "repo.nope",
            "input": {},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert body["error"]["code"] == "capability_not_found"
    assert body["evidence"] == []


@pytest.mark.asyncio
async def test_execute_missing_tool_returns_retryable_unavailable(
    client, managed_app, monkeypatch
) -> None:
    manager = managed_app.state.tool_manager
    monkeypatch.setattr(manager, "tools", {})
    payload = {
        "request_id": "cap-test-unavailable",
        "job_id": "job-1",
        "thread_key": "thread-1",
        "stage": "ground",
        "capability": "repo.search",
        "input": {"repo": "owner/repo", "query": "hello"},
    }

    first = await client.post("/capabilities/execute", json=payload)

    assert first.status_code == 200
    assert first.json()["error"]["code"] == "capability_unavailable"
    assert first.json()["retryable"] is True


@pytest.mark.asyncio
async def test_execute_rejects_internal_web_urls_before_tool_call(
    client, managed_app, monkeypatch
) -> None:
    manager = managed_app.state.tool_manager
    called = False

    async def fake_call_tool_raw(*_args, **_kwargs):
        nonlocal called
        called = True
        return {"ok": True}

    monkeypatch.setattr(
        manager,
        "tools",
        {
            "web_fetch": SimpleNamespace(
                methods=[SimpleNamespace(method_name="fetch_json")]
            )
        },
    )
    monkeypatch.setattr(manager, "call_tool_raw", fake_call_tool_raw)

    response = await client.post(
        "/capabilities/execute",
        json={
            "request_id": "cap-test-internal-url",
            "job_id": "job-1",
            "stage": "ground",
            "capability": "web.fetch_json",
            "input": {"url": "http://api:8000/health", "method": "GET"},
        },
    )

    assert response.status_code == 200
    assert response.json()["error"]["code"] == "invalid_input"
    assert response.json()["evidence"] == []
    assert called is False


@pytest.mark.asyncio
async def test_execute_normalizes_evidence_and_idempotency_conflict(
    client, managed_app, monkeypatch
) -> None:
    monkeypatch.setenv("REPO_CONTEXT_ROOT", "/tmp/repo-cache")
    monkeypatch.setenv("REPO_CONTEXT_REPOSITORIES", "owner/repo")
    manager = managed_app.state.tool_manager
    monkeypatch.setattr(
        manager,
        "tools",
        {
            "repo_context": SimpleNamespace(
                methods=[SimpleNamespace(method_name="search")]
            )
        },
    )

    async def fake_call_tool_raw(tool_name, method_name, args, *, request=None):
        assert tool_name == "repo_context"
        assert method_name == "search"
        assert getattr(request.state, "capability_context")["job_id"] == "job-1"
        return {
            "ok": True,
            "matches": [
                {
                    "path": "README.md",
                    "line": 1,
                    "preview": "hello world",
                    "resolved_commit_sha": "a" * 40,
                }
            ],
            "evidence": [
                {
                    "type": "repo.search_match",
                    "text": "hello world",
                    "provenance": {
                        "repo": "owner/repo",
                        "requested_ref": "main",
                        "resolved_commit_sha": "a" * 40,
                        "path": "README.md",
                        "line_range": {"start": 1, "end": 1},
                        "operation": "search",
                        "query": args["query"],
                        "retrieved_at": "2026-06-03T00:00:00Z",
                    },
                }
            ],
        }

    monkeypatch.setattr(manager, "call_tool_raw", fake_call_tool_raw)
    payload = {
        "request_id": "cap-test-success",
        "job_id": "job-1",
        "thread_key": "thread-1",
        "stage": "ground",
        "capability": "repo.search",
        "input": {"repo": "owner/repo", "query": "hello"},
    }

    response = await client.post("/capabilities/execute", json=payload)
    conflict = await client.post(
        "/capabilities/execute",
        json={**payload, "input": {"repo": "owner/repo", "query": "different"}},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["evidence"][0]["schema_version"] == "centaur.evidence_item.v1"
    assert body["evidence"][0]["source"] == "repo.search_match"
    assert body["evidence"][0]["source_ref"] == f"owner/repo@{'a' * 40}:README.md:1-1"
    assert body["evidence"][0]["provenance"]["resolved_commit_sha"] == "a" * 40
    assert body["content"].startswith("ev_")
    assert body["output"]["ok"] is True
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "idempotency_conflict"


@pytest.mark.asyncio
async def test_execute_repo_list_repos_returns_configured_repos(
    client, managed_app, monkeypatch
) -> None:
    monkeypatch.setenv("REPO_CONTEXT_ROOT", "/tmp/repo-cache")
    monkeypatch.setenv("REPO_CONTEXT_REPOSITORIES", "owner/repo")
    manager = managed_app.state.tool_manager
    monkeypatch.setattr(
        manager,
        "tools",
        {
            "repo_context": SimpleNamespace(
                methods=[SimpleNamespace(method_name="list_repos")]
            )
        },
    )

    async def fake_call_tool_raw(tool_name, method_name, args, *, request=None):
        assert tool_name == "repo_context"
        assert method_name == "list_repos"
        assert args == {}
        return {
            "ok": True,
            "repositories": [{"repo": "owner/repo", "available": True}],
            "aliases": {"platform": "owner/repo"},
        }

    monkeypatch.setattr(manager, "call_tool_raw", fake_call_tool_raw)

    response = await client.post(
        "/capabilities/execute",
        json={
            "request_id": "cap-test-list-repos",
            "job_id": "job-1",
            "stage": "ground",
            "capability": "repo.list_repos",
            "input": {},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["result"]["repositories"] == [{"repo": "owner/repo", "available": True}]
    assert body["evidence"] == []


@pytest.mark.asyncio
async def test_execute_repo_search_smoke_returns_commit_pinned_evidence(
    client, managed_app, monkeypatch, tmp_path
) -> None:
    sha = _make_repo(tmp_path)
    monkeypatch.setenv("REPO_CONTEXT_ROOT", str(tmp_path))
    monkeypatch.setenv("REPO_CONTEXT_REPOSITORIES", "owner/repo")
    repo_client = RepoContextClient(str(tmp_path), ["owner/repo"])
    manager = managed_app.state.tool_manager
    monkeypatch.setattr(
        manager,
        "tools",
        {
            "repo_context": LoadedTool(
                "repo_context",
                "Repo context",
                ToolContext(name="repo_context"),
                [ToolMethod("search", repo_client.search)],
            )
        },
    )

    response = await client.post(
        "/capabilities/execute",
        json={
            "request_id": "cap-test-real-repo-search",
            "job_id": "job-1",
            "thread_key": "thread-1",
            "stage": "ground",
            "capability": "repo.search",
            "input": {"repo": "owner/repo", "query": "capability"},
        },
    )

    body = response.json()
    assert response.status_code == 200
    assert body["ok"] is True
    assert body["evidence"][0]["source"] == "repo.search_match"
    assert body["evidence"][0]["source_ref"] == f"owner/repo@{sha}:README.md:1-1"
    assert body["evidence"][0]["metadata"]["operation"] == "search"


@pytest.mark.asyncio
async def test_capability_scoped_key_cannot_call_tools_directly(
    managed_app, db_pool, monkeypatch
) -> None:
    monkeypatch.setenv("REPO_CONTEXT_ROOT", "/tmp/repo-cache")
    monkeypatch.setenv("REPO_CONTEXT_REPOSITORIES", "owner/repo")
    plaintext, _info = await create_key(
        db_pool,
        name="test-comms-capability",
        scopes=["capabilities:comms"],
        created_by="test",
    )
    manager = managed_app.state.tool_manager
    monkeypatch.setattr(
        manager,
        "tools",
        {
            "repo_context": SimpleNamespace(
                methods=[SimpleNamespace(method_name="search")]
            )
        },
    )

    transport = httpx.ASGITransport(app=managed_app)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Authorization": f"Bearer {plaintext}"},
    ) as scoped:
        catalog = await scoped.get("/capabilities/catalog?profile=comms")
        tool_call = await scoped.post(
            "/tools/repo_context/search",
            json={"repo": "owner/repo", "query": "hello"},
        )

    assert catalog.status_code == 200
    assert [entry["capability"] for entry in catalog.json()["capabilities"]] == [
        "repo.search"
    ]
    assert tool_call.status_code == 403
