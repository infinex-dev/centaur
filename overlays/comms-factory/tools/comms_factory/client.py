from __future__ import annotations

import os
from typing import Any
from urllib.parse import urlparse

import httpx

_DEFAULT_TIMEOUT = httpx.Timeout(60.0, connect=3.0)
_LONG_TIMEOUT = httpx.Timeout(1800.0, connect=3.0)


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
        # "tweet" is the historical default surface label; the TS /audit route
        # treats surface as free-form (it shapes prompts, not validation).
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

    def ground_from_tools(
        self,
        brief: str,
        *,
        run_id: str | None = None,
        stage: str = "ground",
        gate_version: int = 1,
        idempotency_prefix: str | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        # Native tool-plane grounding contract. This client is the single
        # authority for the tool-plane reference: ``_tool_plane_ref`` derives the
        # base URL + auth mode from deployment env (so a tool caller cannot
        # redirect the scoped token to an arbitrary host) and merges the
        # workflow-supplied idempotency prefix.
        return self._post(
            "/ground",
            {
                **kwargs,
                "schema_version": "comms_factory.ground_from_tools.v1",
                "mode": "ground_from_tools",
                "brief": brief,
                "run_id": run_id,
                "stage": stage,
                "gate_version": gate_version,
                "tool_plane": _tool_plane_ref(idempotency_prefix),
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
        """Generate candidates (channels: x, x-thread, web, carousel, modal, in-product, blog; default x)."""
        return self._post(
            "/generate",
            {
                "release_card": release_card,
                # Default mirrors DEFAULT_CHANNELS in workflows/comms_shared.py (tool
                # plugins can't import workflow modules). Valid channel names are the
                # /generate route allowlist — attached-services/comms-factory/
                # services/api/routes/generate.ts CHANNELS (x, x-thread, web, carousel,
                # modal, in-product, blog; "tweet" aliases to x).
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

    def capabilities(self) -> dict[str, Any]:
        """Probe delivery capabilities — the ONE GET (server matches 'GET /health')."""
        result = self._get("/health")
        raw = result.get("capabilities")
        caps = raw if isinstance(raw, dict) else {}
        return {
            "ok": bool(result.get("ok")),
            "capabilities": {
                "platform_pr": bool(caps.get("platform_pr")),
                "typefully": bool(caps.get("typefully")),
                "display": bool(caps.get("display")),
            },
        }

    # NOTE: no **kwargs on the delivery methods — the tool manager skips its
    # unknown-arg rejection for VAR_KEYWORD signatures, which would silently
    # forward mis-typed workflow args instead of raising
    # tool_argument_validation_failed.
    def emit_platform_pr(
        self,
        release_card: dict[str, Any],
        final_by_channel: dict[str, Any],
        candidates: list[dict[str, Any]],
        *,
        dry_run: bool = True,
        branch: str | None = None,
        run_id: str | None = None,
        typefully_url: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "release_card": release_card,
            "final_by_channel": final_by_channel,
            "candidates": candidates,
            "dry_run": dry_run,
            "run_id": run_id,
        }
        if branch:
            payload["branch"] = branch
        if typefully_url:
            payload["typefully_url"] = typefully_url
        return self._post("/emit", payload, timeout=_LONG_TIMEOUT)

    def typefully_draft(
        self,
        channel: str,
        *,
        text: str | None = None,
        tweets: list[str] | None = None,
        title: str | None = None,
        scratchpad: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"channel": channel}
        if text is not None:
            payload["text"] = text
        if tweets is not None:
            payload["tweets"] = tweets
        if title:
            payload["title"] = title
        if scratchpad:
            payload["scratchpad"] = scratchpad
        return self._post("/typefully-draft", payload, timeout=_LONG_TIMEOUT)

    def display_publish(
        self,
        markdown: str,
        *,
        name: str,
        visibility: str = "private",
        share: list[str] | None = None,
        short_id: str | None = None,
        base_version: int | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "markdown": markdown,
            "name": name,
            "visibility": visibility,
        }
        if share:
            payload["share"] = share
        if short_id:
            # Lost-update guard: the route 400s (missing_base_version) without it.
            if base_version is None:
                raise ValueError("display_base_version_required")
            payload["id"] = short_id
            payload["base_version"] = base_version
        return self._post("/display/publish", payload, timeout=_LONG_TIMEOUT)

    def display_comments(
        self, short_id: str, *, status: str = "open", since: Any = None
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"short_id": short_id, "status": status}
        if since is not None:
            payload["since"] = since
        return self._post("/display/comments", payload)

    def display_revise(
        self,
        markdown: str,
        comments: list[dict[str, Any]],
        *,
        run_id: str | None = None,
        release_card: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return self._post(
            "/display/revise",
            {
                "markdown": markdown,
                "comments": comments,
                "run_id": run_id,
                "release_card": release_card,
            },
            timeout=_LONG_TIMEOUT,
        )

    def display_resolve(self, root_comment_id: str) -> dict[str, Any]:
        return self._post("/display/resolve", {"root_comment_id": root_comment_id})

    def display_unpublish(self, short_id: str) -> dict[str, Any]:
        return self._post("/display/unpublish", {"short_id": short_id})

    def _get(
        self,
        path: str,
        *,
        timeout: httpx.Timeout = _DEFAULT_TIMEOUT,
    ) -> dict[str, Any]:
        # Mirrors _post exactly minus the JSON body (base-url guard, ok-default,
        # status->error mapping, redaction, Bearer auth).
        if not self.base_url:
            return {"ok": False, "error": "comms_factory_base_url_not_configured"}
        try:
            headers: dict[str, str] = {}
            if self.token:
                headers["Authorization"] = f"Bearer {self.token}"
            with httpx.Client(timeout=timeout, trust_env=True) as client:
                response = client.get(f"{self.base_url}{path}", headers=headers)
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


def _tool_plane_ref(idempotency_prefix: str | None = None) -> dict[str, Any]:
    """Build a safe native tool-plane reference without trusting tool callers.

    The attached comms service reads its scoped research-bundle bearer token from
    its own CENTAUR_TOKEN environment variable and calls
    ``POST {base}/tools/{tool}/{method}``. Tool callers may only supply an
    idempotency prefix; the base URL and auth mode are fixed by deployment
    configuration so the comms service cannot be tricked into sending its token
    to an arbitrary host.
    """
    base_url = (
        (
            os.getenv("CENTAUR_BASE_URL")  # noqa: TID251
            or os.getenv("AGENT_API_URL")  # noqa: TID251
            or ""
        )
        .strip()
        .rstrip("/")
    )
    if not base_url:
        return {"schema_version": "centaur.tool_plane_ref.v1", "status": "unavailable"}
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return {"schema_version": "centaur.tool_plane_ref.v1", "status": "unavailable"}
    prefix = str(idempotency_prefix or "")[:300]
    return {
        "schema_version": "centaur.tool_plane_ref.v1",
        "base_url": base_url,
        "tools_url": f"{base_url}/tools",
        "auth": {"type": "bearer_env", "env": "CENTAUR_TOKEN"},
        **({"idempotency_prefix": prefix} if prefix else {}),
    }


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
