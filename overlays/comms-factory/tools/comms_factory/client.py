from __future__ import annotations

import os
from typing import Any

import httpx

_DEFAULT_TIMEOUT = httpx.Timeout(60.0, connect=3.0)
_LONG_TIMEOUT = httpx.Timeout(180.0, connect=3.0)


class CommsFactoryClient:
    """Thin wrapper around the internal comms-factory attached service."""

    def __init__(self, base_url: str | None = None, token: str | None = None) -> None:
        # The comms-factory attached service is an internal ClusterIP service, not an
        # external HTTPS API routed through Centaur's secret placeholder/iron-proxy
        # flow. Its URL is deployment config and its bearer token is raw internal
        # service auth injected into both the API/tool pod and attached service pod.
        self.base_url = (
            (base_url or os.getenv("COMMS_FACTORY_BASE_URL", "")).strip().rstrip("/")
        )
        self.token = (token or os.getenv("COMMS_FACTORY_SERVICE_TOKEN", "")).strip()

    def validate(self, text: str, **kwargs: Any) -> dict[str, Any]:
        return self._post("/validate", {"text": text, **kwargs})

    def audit(
        self,
        text: str,
        *,
        surface: str = "tweet",
        voice_id: str = "infinex",
        fact_source: dict[str, Any] | None = None,
        thread: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "text": text,
            "surface": surface,
            "voice_id": voice_id,
            **kwargs,
        }
        if fact_source is not None:
            payload["fact_source"] = fact_source
        if thread is not None:
            payload["thread"] = thread
        return self._post("/audit", payload, timeout=_LONG_TIMEOUT)

    def ground(
        self,
        brief: str,
        *,
        run_id: str | None = None,
        stage: str = "ground",
        gate_version: int = 1,
        **kwargs: Any,
    ) -> dict[str, Any]:
        return self._post(
            "/ground",
            {
                "brief": brief,
                "run_id": run_id,
                "stage": stage,
                "gate_version": gate_version,
                **kwargs,
            },
            timeout=_LONG_TIMEOUT,
        )

    def build_card(
        self,
        brief: str,
        facts: list[str] | list[dict[str, Any]],
        *,
        run_id: str | None = None,
        stage: str = "build-card",
        gate_version: int = 1,
        **kwargs: Any,
    ) -> dict[str, Any]:
        return self._post(
            "/build-card",
            {
                "brief": brief,
                "facts": facts,
                "run_id": run_id,
                "stage": stage,
                "gate_version": gate_version,
                **kwargs,
            },
            timeout=_LONG_TIMEOUT,
        )

    def generate(
        self,
        release_card: dict[str, Any],
        *,
        channels: list[str] | None = None,
        n: int = 5,
        voice_id: str = "infinex",
        run_id: str | None = None,
        stage: str = "generate",
        gate_version: int = 1,
        **kwargs: Any,
    ) -> dict[str, Any]:
        return self._post(
            "/generate",
            {
                "release_card": release_card,
                "channels": channels or ["x"],
                "n": n,
                "voice_id": voice_id,
                "run_id": run_id,
                "stage": stage,
                "gate_version": gate_version,
                **kwargs,
            },
            timeout=_LONG_TIMEOUT,
        )

    def _post(
        self,
        path: str,
        payload: dict[str, Any],
        *,
        timeout: httpx.Timeout = _DEFAULT_TIMEOUT,
    ) -> dict[str, Any]:
        if not self.base_url:
            return {"ok": False, "error": "comms_factory_base_url_not_configured"}
        try:
            headers = {"Content-Type": "application/json"}
            if self.token:
                headers["Authorization"] = f"Bearer {self.token}"
            with httpx.Client(timeout=timeout, trust_env=True) as client:
                response = client.post(
                    f"{self.base_url}{path}", json=payload, headers=headers
                )
            data = _read_json(response)
            if response.is_success:
                if isinstance(data, dict):
                    data.setdefault("ok", True)
                    return data
                return {"ok": True, "data": data}
            return {
                "ok": False,
                "error": "comms_factory_http_error",
                "status_code": response.status_code,
                "response": _redact_sensitive(data, self.token),
            }
        except httpx.TimeoutException:
            return {"ok": False, "error": "comms_factory_timeout"}
        except httpx.HTTPError as exc:
            return {
                "ok": False,
                "error": "comms_factory_request_failed",
                "detail": _redact_sensitive(str(exc), self.token),
            }


_SENSITIVE_KEY_RE = ("authorization", "token", "secret", "cookie", "password")


def _redact_sensitive(value: Any, token: str = "") -> Any:
    if isinstance(value, str):
        redacted = value
        if token:
            redacted = redacted.replace(token, "[REDACTED]")
        return redacted
    if isinstance(value, list):
        return [_redact_sensitive(item, token) for item in value]
    if isinstance(value, dict):
        output: dict[str, Any] = {}
        for key, item in value.items():
            if any(marker in str(key).lower() for marker in _SENSITIVE_KEY_RE):
                output[key] = "[REDACTED]"
            else:
                output[key] = _redact_sensitive(item, token)
        return output
    return value


def _read_json(response: httpx.Response) -> Any:
    if not response.text:
        return None
    try:
        return response.json()
    except ValueError:
        return response.text[:1000]


def _client() -> CommsFactoryClient:
    return CommsFactoryClient()
