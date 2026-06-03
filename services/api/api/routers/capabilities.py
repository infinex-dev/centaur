from __future__ import annotations

import hashlib
import ipaddress
import json
import os
from datetime import UTC, datetime
from urllib.parse import urlparse
from typing import Any

import structlog
import structlog.contextvars
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse

from api.api_keys import APIKeyInfo, check_scope
from api.capability_models import (
    CAPABILITY_RESULT_SCHEMA,
    EVIDENCE_ITEM_SCHEMA,
    CapabilityCatalogEntry,
    CapabilityCatalogResponse,
    CapabilityError,
    CapabilityExecuteRequest,
    CapabilityResult,
    EvidenceItem,
)
from api.capability_registry import CapabilitySpec, get_capability, iter_capabilities
from api.deps import get_key_info, verify_api_key

log = structlog.get_logger()

router = APIRouter(prefix="/capabilities", dependencies=[Depends(verify_api_key)])


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _json_hash(data: Any) -> str:
    encoded = json.dumps(
        data, sort_keys=True, separators=(",", ":"), default=str
    ).encode()
    return hashlib.sha256(encoded).hexdigest()


def _is_tool_available(request: Request, spec: CapabilitySpec) -> bool:
    if spec.tool_name == "repo_context" and not (
        (os.getenv("REPO_CONTEXT_ROOT") or os.getenv("REPOS_PATH"))
        and os.getenv("REPO_CONTEXT_REPOSITORIES")
    ):
        return False
    tool_manager = request.app.state.tool_manager
    loaded = tool_manager.tools.get(spec.tool_name)
    if loaded is None:
        return False
    return any(method.method_name == spec.method_name for method in loaded.methods)


def _capability_allowed(info: APIKeyInfo, capability: str) -> bool:
    if check_scope(info, "admin") or check_scope(
        info, "capabilities", resource=capability
    ):
        return True
    # Profile-level scope for the comms attached service. It grants only the
    # registry entries explicitly tagged with the comms profile, not /tools.
    if any(scope in {"capabilities:comms", "capabilities:*"} for scope in info.scopes):
        spec = get_capability(capability)
        return bool(spec and "comms" in spec.profiles)
    return False


def _error_result(
    *,
    capability: str,
    request_id: str,
    code: str,
    message: str,
    retryable: bool = False,
    details: dict[str, Any] | None = None,
) -> CapabilityResult:
    return CapabilityResult(
        ok=False,
        capability=capability,
        request_id=request_id,
        error=CapabilityError(code=code, message=message, details=details or {}),
        retryable=retryable,
    )


def _extract_error(raw: Any) -> tuple[str, str, bool, dict[str, Any]] | None:
    if not isinstance(raw, dict):
        return None
    if raw.get("ok") is False:
        err = raw.get("error")
        if isinstance(err, dict):
            return (
                str(err.get("code") or "capability_failed"),
                str(err.get("message") or err),
                bool(raw.get("retryable", False)),
                {k: v for k, v in raw.items() if k not in {"ok", "error", "retryable"}},
            )
        return (
            "capability_failed",
            str(err or "capability failed"),
            bool(raw.get("retryable", False)),
            {},
        )
    if "error" in raw and raw.get("status") != "ok":
        return (
            "tool_error",
            str(raw.get("error") or "tool returned error"),
            bool(raw.get("retryable", False)),
            {},
        )
    if raw.get("status") == "error":
        return (
            "tool_error",
            str(raw.get("error") or "tool returned error"),
            bool(raw.get("retryable", False)),
            {},
        )
    return None


def _raw_evidence_items(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, dict):
        return []
    evidence = raw.get("evidence")
    return evidence if isinstance(evidence, list) else []


def _web_evidence(raw: dict[str, Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
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


def _company_context_evidence(raw: dict[str, Any]) -> list[dict[str, Any]]:
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
    if isinstance(raw, dict):
        tweets: Any = raw.get("tweets") or raw.get("results") or raw.get("posts") or []
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
            f"https://x.com/{handle}/status/{tweet_id}" if handle and tweet_id else None
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


def _source_ref(capability: str, provenance: dict[str, Any]) -> str | None:
    if capability.startswith("repo."):
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
    if capability.startswith("web.") or capability == "browser.render":
        return str(provenance.get("url") or "") or None
    if capability == "x.search_recent":
        post_id = (
            provenance.get("post_id")
            or provenance.get("tweet_id")
            or provenance.get("id")
        )
        return str(provenance.get("url") or post_id or "") or None
    return (
        str(
            provenance.get("source_ref")
            or provenance.get("document_id")
            or provenance.get("url")
            or ""
        )
        or None
    )


def _evidence_projection(
    capability: str,
    item_type: str,
    text: str,
    provenance: dict[str, Any],
    item: dict[str, Any],
) -> dict[str, Any]:
    source = str(item.get("source") or item_type or capability)
    source_ref = (
        str(item.get("source_ref") or _source_ref(capability, provenance) or "") or None
    )
    title = item.get("title") or provenance.get("title") or provenance.get("path")
    url = item.get("url") or provenance.get("url")
    quote = item.get("quote") or text
    return {
        "source": source,
        "source_ref": source_ref,
        "title": str(title) if title else None,
        "url": str(url) if url else None,
        "quote": str(quote)[:5000] if quote else None,
        "metadata": {**provenance, "capability": capability},
    }


def _normalize_evidence(capability: str, raw: Any) -> list[EvidenceItem]:
    if not isinstance(raw, dict):
        raw_items = _x_evidence(raw) if capability == "x.search_recent" else []
    else:
        raw_items = _raw_evidence_items(raw)
    if not raw_items:
        if isinstance(raw, dict) and capability in {
            "web.search",
            "web.fetch",
            "web.fetch_json",
            "browser.render",
        }:
            raw_items = _web_evidence(raw)
        elif isinstance(raw, dict) and capability == "slack.context_search":
            raw_items = _company_context_evidence(raw)
        elif capability == "x.search_recent":
            raw_items = _x_evidence(raw)
    normalized: list[EvidenceItem] = []
    for index, item in enumerate(raw_items, start=1):
        if not isinstance(item, dict):
            continue
        provenance = (
            item.get("provenance") if isinstance(item.get("provenance"), dict) else {}
        )
        retrieved_at = str(
            provenance.get("retrieved_at") or item.get("retrieved_at") or _now()
        )
        text = str(item.get("text") or item.get("preview") or item.get("quote") or "")[
            :5000
        ]
        item_type = str(item.get("type") or item.get("source") or capability)
        evidence_id = str(
            item.get("id")
            or f"ev_{hashlib.sha1(json.dumps(item, sort_keys=True, default=str).encode()).hexdigest()[:16]}"
        )
        projection = _evidence_projection(capability, item_type, text, provenance, item)
        normalized.append(
            EvidenceItem(
                schema_version=EVIDENCE_ITEM_SCHEMA,
                id=evidence_id,
                type=item_type,
                capability=capability,
                text=text,
                provenance=provenance,
                retrieved_at=retrieved_at,
                **projection,
            )
        )
    return normalized


def _content_from_evidence(evidence: list[EvidenceItem]) -> str | None:
    if not evidence:
        return None
    lines = []
    for item in evidence[:20]:
        ref = item.source_ref or item.url or item.title or item.source
        quote = (item.quote or item.text or "").replace("\n", " ")[:500]
        lines.append(f"{item.id} — {ref}" + (f" — {quote}" if quote else ""))
    return "\n".join(lines)


def _normalize_success(body: CapabilityExecuteRequest, raw: Any) -> CapabilityResult:
    partial_failures: list[dict[str, Any]] = []
    if isinstance(raw, dict) and isinstance(raw.get("partial_failures"), list):
        partial_failures = raw["partial_failures"]
    result = raw if isinstance(raw, dict) else {"value": raw}
    evidence = _normalize_evidence(body.capability, raw)
    content = _content_from_evidence(evidence)
    return CapabilityResult(
        schema_version=CAPABILITY_RESULT_SCHEMA,
        ok=True,
        capability=body.capability,
        request_id=body.request_id,
        result=result,
        output=result,
        content=content,
        text=content,
        evidence=evidence,
        partial_failures=partial_failures,
    )


async def _load_idempotent_response(
    request: Request,
    key_info: APIKeyInfo,
    body: CapabilityExecuteRequest,
    payload_hash: str,
) -> CapabilityResult | JSONResponse | None:
    pool = request.app.state.db_pool
    inserted = await pool.fetchval(
        """
        INSERT INTO capability_requests (key_id, request_id, payload_hash, status)
        VALUES ($1, $2, $3, 'running')
        ON CONFLICT (key_id, request_id) DO NOTHING
        RETURNING TRUE
        """,
        key_info.id,
        body.request_id,
        payload_hash,
    )
    if inserted:
        return None
    row = await pool.fetchrow(
        """
        SELECT payload_hash, status, response, updated_at
        FROM capability_requests
        WHERE key_id = $1 AND request_id = $2
        """,
        key_info.id,
        body.request_id,
    )
    if row is None:
        return None
    if row["payload_hash"] != payload_hash:
        result = _error_result(
            capability=body.capability,
            request_id=body.request_id,
            code="idempotency_conflict",
            message="request_id was already used with a different payload",
        )
        return JSONResponse(status_code=409, content=result.model_dump(mode="json"))
    if row["status"] == "completed" and row["response"] is not None:
        response_data = row["response"]
        if isinstance(response_data, str):
            response_data = json.loads(response_data)
        return CapabilityResult.model_validate(response_data)
    if row["status"] == "running":
        stale = await pool.fetchval(
            """
            UPDATE capability_requests
            SET updated_at = NOW()
            WHERE key_id = $1
              AND request_id = $2
              AND status = 'running'
              AND updated_at < NOW() - INTERVAL '15 minutes'
            RETURNING TRUE
            """,
            key_info.id,
            body.request_id,
        )
        if stale:
            return None
    result = _error_result(
        capability=body.capability,
        request_id=body.request_id,
        code="request_in_progress",
        message="request_id is already in progress",
        retryable=True,
    )
    return JSONResponse(status_code=409, content=result.model_dump(mode="json"))


async def _store_idempotent_response(
    request: Request, key_info: APIKeyInfo, request_id: str, result: CapabilityResult
) -> None:
    if result.retryable:
        await request.app.state.db_pool.execute(
            "DELETE FROM capability_requests WHERE key_id = $1 AND request_id = $2",
            key_info.id,
            request_id,
        )
        return
    await request.app.state.db_pool.execute(
        """
        UPDATE capability_requests
        SET status = 'completed', response = $3::jsonb, updated_at = NOW()
        WHERE key_id = $1 AND request_id = $2 AND status = 'running'
        """,
        key_info.id,
        request_id,
        json.dumps(result.model_dump(mode="json")),
    )


async def _release_idempotency_marker(
    request: Request, key_info: APIKeyInfo, request_id: str
) -> None:
    await request.app.state.db_pool.execute(
        "DELETE FROM capability_requests WHERE key_id = $1 AND request_id = $2",
        key_info.id,
        request_id,
    )


_BLOCKED_HOST_SUFFIXES = (
    ".cluster.local",
    ".svc",
    ".svc.cluster.local",
    ".localhost",
    ".local",
    ".internal",
)


def _public_url_error(url: str, *, https_only: bool = False) -> str | None:
    parsed = urlparse(url.strip())
    allowed_schemes = {"https"} if https_only else {"http", "https"}
    if parsed.scheme not in allowed_schemes or not parsed.hostname:
        scheme_msg = "https://" if https_only else "http(s)://"
        return f"URL must use {scheme_msg} with a hostname"
    host = parsed.hostname.lower().rstrip(".")
    if host == "localhost" or host.endswith(_BLOCKED_HOST_SUFFIXES) or "." not in host:
        return "URL host is not allowed for public read-only capabilities"
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return None
    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
    ):
        return "URL IP address is not allowed for public read-only capabilities"
    return None


def _validate_capability_input(
    body: CapabilityExecuteRequest,
) -> CapabilityResult | None:
    if body.capability in {"web.fetch", "web.fetch_json", "browser.render"}:
        url = str(body.input.get("url") or "")
        if error := _public_url_error(
            url, https_only=body.capability.startswith("web.")
        ):
            return _error_result(
                capability=body.capability,
                request_id=body.request_id,
                code="invalid_input",
                message=error,
            )
    if body.capability == "web.fetch_json":
        method = str(body.input.get("method") or "GET").upper()
        if method != "GET" or body.input.get("body") is not None:
            return _error_result(
                capability=body.capability,
                request_id=body.request_id,
                code="invalid_input",
                message="web.fetch_json is read-only and only supports GET without a request body",
            )
    return None


def _tool_args_for_capability(
    capability: str, raw_input: dict[str, Any]
) -> dict[str, Any]:
    args = dict(raw_input)
    if capability == "repo.search":
        query = args.get("query") or args.get("pattern")
        path_glob = args.get("path_glob") or args.get("glob") or args.get("path")
        limit = args.get("limit") or args.get("max_results") or args.get("maxResults")
        return {
            key: value
            for key, value in {
                "repo": args.get("repo"),
                "query": query,
                "ref": args.get("ref") or "HEAD",
                "path_glob": path_glob,
                "limit": limit,
            }.items()
            if value not in {None, ""}
        }
    if capability == "web.search":
        limit = args.get("num_results") or args.get("max_results") or args.get("limit")
        max_age_hours = args.get("max_age_hours") or args.get("hours_back")
        return {
            key: value
            for key, value in {
                "query": args.get("query"),
                "num_results": limit,
                "max_age_hours": max_age_hours,
            }.items()
            if value not in {None, ""}
        }
    if capability == "x.search_recent":
        search_type = str(args.get("search_type") or args.get("sort_order") or "latest")
        if search_type not in {"latest", "top"}:
            search_type = "latest"
        limit = args.get("limit") or args.get("max_results") or args.get("maxResults")
        return {
            key: value
            for key, value in {
                "query": args.get("query"),
                "search_type": search_type,
                "limit": limit,
            }.items()
            if value not in {None, ""}
        }
    return args


def _log_completed(result: CapabilityResult) -> None:
    if result.error and result.error.code in {
        "capability_unavailable",
        "capability_forbidden",
        "repo_denied",
        "repo_unavailable",
    }:
        log.warning(
            result.error.code,
            capability=result.capability,
            request_id=result.request_id,
        )
    log.info(
        "capability_execute_completed",
        capability=result.capability,
        request_id=result.request_id,
        ok=result.ok,
        evidence_count=len(result.evidence),
        error_code=result.error.code if result.error else None,
    )


@router.get("/catalog", response_model=CapabilityCatalogResponse)
async def catalog(
    request: Request, profile: str = Query("default")
) -> CapabilityCatalogResponse:
    """Return the read-only capability catalog visible to this caller."""
    key_info = get_key_info(request)
    entries: list[CapabilityCatalogEntry] = []
    for spec in iter_capabilities(profile):
        if not _capability_allowed(key_info, spec.capability):
            continue
        if not _is_tool_available(request, spec):
            continue
        entries.append(
            CapabilityCatalogEntry(
                capability=spec.capability,
                description=spec.description,
                input_schema=spec.input_schema,
                evidence_types=list(spec.evidence_types),
                read_only=spec.read_only,
                available=True,
            )
        )
    return CapabilityCatalogResponse(profile=profile, capabilities=entries)


@router.post("/execute", response_model=CapabilityResult)
async def execute(
    request: Request, body: CapabilityExecuteRequest
) -> CapabilityResult | JSONResponse:
    """Execute one approved, read-only capability through Centaur's tool plane."""
    key_info = get_key_info(request)
    spec = get_capability(body.capability)
    if spec is None:
        result = _error_result(
            capability=body.capability,
            request_id=body.request_id,
            code="capability_not_found",
            message=f"Unknown capability: {body.capability}",
        )
        _log_completed(result)
        return result
    if not _capability_allowed(key_info, body.capability):
        result = _error_result(
            capability=body.capability,
            request_id=body.request_id,
            code="capability_forbidden",
            message="API key scope does not permit capability execution",
        )
        _log_completed(result)
        return JSONResponse(status_code=403, content=result.model_dump(mode="json"))

    if input_error := _validate_capability_input(body):
        _log_completed(input_error)
        return input_error

    payload_hash = _json_hash(body.model_dump(mode="json", exclude_none=True))
    replay = await _load_idempotent_response(request, key_info, body, payload_hash)
    if replay is not None:
        return replay

    structlog.contextvars.bind_contextvars(
        capability=body.capability,
        request_id=body.request_id,
        job_id=body.job_id,
        thread_key=body.thread_key,
        stage=body.stage,
    )
    request.state.capability_context = {
        "capability": body.capability,
        "capability_request_id": body.request_id,
        "job_id": body.job_id,
        "thread_key": body.thread_key,
        "stage": body.stage,
        "requester": body.requester,
    }
    log.info(
        "capability_execute_started",
        capability=body.capability,
        request_id=body.request_id,
        job_id=body.job_id,
        thread_key=body.thread_key,
        stage=body.stage,
        key_prefix=key_info.key_prefix,
    )

    if not _is_tool_available(request, spec):
        result = _error_result(
            capability=body.capability,
            request_id=body.request_id,
            code="capability_unavailable",
            message=f"Backing tool is unavailable: {spec.tool_name}.{spec.method_name}",
            retryable=True,
        )
        await _store_idempotent_response(request, key_info, body.request_id, result)
        _log_completed(result)
        return result

    tool_args = _tool_args_for_capability(body.capability, body.input)
    try:
        raw = await request.app.state.tool_manager.call_tool_raw(
            spec.tool_name,
            spec.method_name,
            tool_args,
            request=request,
        )
    except Exception as exc:
        result = _error_result(
            capability=body.capability,
            request_id=body.request_id,
            code="capability_execution_error",
            message=str(exc),
            retryable=True,
        )
        await _release_idempotency_marker(request, key_info, body.request_id)
        _log_completed(result)
        return result
    if (tool_error := _extract_error(raw)) is not None:
        code, message, retryable, details = tool_error
        result = _error_result(
            capability=body.capability,
            request_id=body.request_id,
            code=code,
            message=message,
            retryable=retryable,
            details=details,
        )
    else:
        result = _normalize_success(body, raw)

    await _store_idempotent_response(request, key_info, body.request_id, result)
    _log_completed(result)
    return result
