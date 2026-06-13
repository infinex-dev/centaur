from __future__ import annotations

import json
from pathlib import Path
import sys

import pytest

OVERLAY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(OVERLAY_ROOT / "tools" / "comms_factory"))

import client as client_module  # noqa: E402
from client import CommsFactoryClient  # noqa: E402


class _FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}
        self.text = json.dumps(self._payload)

    @property
    def is_success(self):
        return 200 <= self.status_code < 300

    def json(self):
        return self._payload


def _fake_httpx_client(monkeypatch, payload, captured):
    class _FakeClient:
        def __init__(self, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def get(self, url, headers=None):
            captured.update({"method": "GET", "url": url, "headers": headers or {}})
            return _FakeResponse(payload=payload)

    monkeypatch.setattr(client_module.httpx, "Client", _FakeClient)


def test_capabilities_is_a_get_to_health_with_bearer_auth(monkeypatch):
    captured: dict = {}
    _fake_httpx_client(
        monkeypatch,
        {
            "ok": True,
            "capabilities": {"platform_pr": True, "typefully": 0, "display": "yes"},
        },
        captured,
    )
    result = CommsFactoryClient(base_url="http://svc:8080", token="tok").capabilities()
    assert captured["method"] == "GET"
    assert captured["url"] == "http://svc:8080/health"
    assert captured["headers"]["Authorization"] == "Bearer tok"
    # booleans coerced, never raw values:
    assert result["capabilities"] == {
        "platform_pr": True,
        "typefully": False,
        "display": True,
    }


def test_capabilities_without_base_url_is_a_safe_error(monkeypatch):
    monkeypatch.delenv("COMMS_FACTORY_BASE_URL", raising=False)
    c = CommsFactoryClient(base_url="", token="")
    # capabilities() is safe (no network call, ok=False)
    result = c.capabilities()
    assert result["ok"] is False
    # the underlying _get/_post guard returns the specific sentinel error
    raw = c._get("/health")
    assert raw["error"] == "comms_factory_base_url_not_configured"


def _capture_post(monkeypatch, client):
    captured: dict = {}

    def fake_post(path, payload, **kwargs):
        captured["path"] = path
        captured["payload"] = payload
        return {"ok": True}

    monkeypatch.setattr(client, "_post", fake_post)
    return captured


def test_emit_platform_pr_envelope(monkeypatch):
    c = CommsFactoryClient(base_url="http://x", token="t")
    captured = _capture_post(monkeypatch, c)
    c.emit_platform_pr(
        {"title": "T"}, {"blog": {"text": "b"}}, [], dry_run=True, run_id="r1"
    )
    assert captured["path"] == "/emit"
    assert captured["payload"]["dry_run"] is True
    assert captured["payload"]["run_id"] == "r1"
    assert "branch" not in captured["payload"]  # only sent when explicitly set
    assert "typefully_url" not in captured["payload"]


def test_typefully_draft_envelope(monkeypatch):
    c = CommsFactoryClient(base_url="http://x", token="t")
    captured = _capture_post(monkeypatch, c)
    c.typefully_draft("x-thread", tweets=["t1", "t2"], title="T", scratchpad="run r1")
    assert captured["path"] == "/typefully-draft"
    assert captured["payload"]["tweets"] == ["t1", "t2"]
    assert "text" not in captured["payload"]


def test_display_method_envelopes(monkeypatch):
    c = CommsFactoryClient(base_url="http://x", token="t")
    captured = _capture_post(monkeypatch, c)
    c.display_publish("md", name="n", share=["a@x.com"])
    assert captured["path"] == "/display/publish"
    assert captured["payload"]["visibility"] == "private"
    c.display_publish("md", name="n", short_id="abc", base_version=2)
    assert captured["payload"]["id"] == "abc"
    assert captured["payload"]["base_version"] == 2
    c.display_comments("abc")
    assert captured["path"] == "/display/comments"
    assert captured["payload"] == {"short_id": "abc", "status": "open"}
    c.display_revise(
        "md", [{"text_quote": "q", "body": "b"}], run_id="r1", release_card={"k": 1}
    )
    assert captured["path"] == "/display/revise"
    c.display_resolve("c1")
    assert captured["payload"] == {"root_comment_id": "c1"}
    c.display_unpublish("abc")
    assert captured["payload"] == {"short_id": "abc"}


def test_display_publish_requires_base_version_when_short_id_given(monkeypatch):
    c = CommsFactoryClient(base_url="http://x", token="t")
    captured: dict = {}
    monkeypatch.setattr(
        c,
        "_post",
        lambda path, payload, **kwargs: captured.update({"path": path}) or {"ok": True},
    )
    with pytest.raises(ValueError, match="display_base_version_required"):
        c.display_publish("md", name="n", short_id="abc")
    assert not captured  # _post must not have been called
