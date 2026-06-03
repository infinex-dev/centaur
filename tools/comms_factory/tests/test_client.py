from __future__ import annotations

import json

import httpx
from tools.comms_factory.client import CommsFactoryClient


def test_validate_posts_to_service_with_auth(monkeypatch):
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        assert request.url.path == "/validate"
        assert request.headers["authorization"] == "Bearer token"
        assert json.loads(request.content) == {"text": "hello"}
        return httpx.Response(200, json={"passed": True})

    transport = httpx.MockTransport(handler)
    original_client = httpx.Client
    monkeypatch.setattr(httpx, "Client", lambda **_: original_client(transport=transport))

    result = CommsFactoryClient("http://comms.test", "token").validate("hello")

    assert result == {"passed": True, "ok": True}
    assert len(calls) == 1


def test_generate_applies_defaults_and_maps_5xx(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/generate"
        body = json.loads(request.content)
        assert body["channels"] == ["x"]
        assert body["n"] == 5
        return httpx.Response(503, json={"error": "down"})

    transport = httpx.MockTransport(handler)
    original_client = httpx.Client
    monkeypatch.setattr(httpx, "Client", lambda **_: original_client(transport=transport))

    result = CommsFactoryClient("http://comms.test", "token").generate(
        {"kind": "feature", "deployed_facts": ["Fact A"]}
    )

    assert result["ok"] is False
    assert result["status_code"] == 503
    assert result["response"] == {"error": "down"}


def test_error_response_redacts_auth_token(monkeypatch):
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            500,
            json={
                "authorization": "Bearer token",
                "message": "bad token token",
            },
        )

    transport = httpx.MockTransport(handler)
    original_client = httpx.Client
    monkeypatch.setattr(httpx, "Client", lambda **_: original_client(transport=transport))

    result = CommsFactoryClient("http://comms.test", "token").validate("hello")

    assert result["response"] == {
        "authorization": "[REDACTED]",
        "message": "bad [REDACTED] [REDACTED]",
    }


def test_reads_base_url_from_secret_backend_environment(monkeypatch):
    monkeypatch.setenv("COMMS_FACTORY_BASE_URL", "http://comms.internal/")

    client = CommsFactoryClient()

    assert client.base_url == "http://comms.internal"


def test_missing_base_url_is_workflow_readable_error(monkeypatch):
    monkeypatch.delenv("COMMS_FACTORY_BASE_URL", raising=False)

    result = CommsFactoryClient().validate("hello")

    assert result == {"ok": False, "error": "comms_factory_base_url_not_configured"}
