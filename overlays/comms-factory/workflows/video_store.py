"""video_store — the single durable write path for the video pipeline (U5).

Every stage output flows through ``record_artifact``; every event through
``emit_event``; every status change through ``set_status``. The contracts these
enforce are the unbackfillable capture contract (R4) and the producer return
contract (R9) from the build plan's U5.

Design notes that matter:

- **The engine is unmodified.** These helpers take an explicit asyncpg ``pool``
  (the API pod's existing pool) rather than reaching into ``WorkflowContext``
  internals. Workflow handlers pass ``pool_from_ctx(ctx)``; tests pass a real
  test pool directly. ``pool_from_ctx`` reads the context's private pool with a
  documented fallback, so no public engine API is added.
- **Checkpoints carry only refs, never bytes.** ``record_artifact`` returns
  ``{"artifact_id", "ref", "sha256"}`` — that, not the payload, is what a
  ctx.step checkpoint stores (the engine's canonical_json constraint, origin §3).
- **Idempotent + supersede-aware.** ``record_artifact`` is idempotent on
  ``(job_id, stage, name, sha256)``: re-recording the identical output returns the
  same row; recording a *different* output for the same ``(job, stage, name)``
  supersedes the prior live row (the revision chain).
- **CAS bytes land in runstore (U10).** Until runstore exists, ``record_artifact``
  stores JSON inline (≤100KB) and accepts a pre-computed ``cas_ref`` for bytes a
  caller already placed in a store; a large inline binary raises rather than
  silently truncating.
- **Payloads are producer-enforced, not just documented.** ``emit_event`` validates
  every payload against ``REQUIRED_PAYLOAD_FIELDS`` at write time (fail-loud), so
  production emissions can't drift from the contract while tests stay green (the
  ranker's feedback_penalty=0.0-forever failure mode, one level up). The required
  field sets mirror ``overlays/comms-factory/docs/video-event-payloads.md``.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import timedelta
from typing import Any, Mapping, Sequence

# ── Constants ───────────────────────────────────────────────────────────────

INLINE_JSON_MAX_BYTES = 100 * 1024  # >100KB JSON must go to CAS (runstore, U10)

# Fields every event payload MUST carry, per kind. Mirrors video-event-payloads.md.
# `persona` appears here for kinds that feed the (persona, kind, created_at) ranker
# index; emit_event additionally rejects an EMPTY persona for those kinds.
REQUIRED_PAYLOAD_FIELDS: dict[str, tuple[str, ...]] = {
    "candidate-scouted": (
        "candidate_id",
        "persona",
        "title",
        "url",
        "mode",
        "fit_score",
        "source",
    ),
    "candidate-selected": (
        "job_id",
        "persona",
        "candidate_id",
        "source",
        "mode",
        "media",
        "title",
        "url",
        "fit_score",
        "format",
        "recipe_hash",
    ),
    "candidate-auto-picked": (
        "candidate_id",
        "persona",
        "format",
        "recipe_hash",
        "slot_index",
        "total_score",
        "component_scores",
        "pick_rationale",
        "should_ship",
    ),
    "candidate-rejected": ("candidate_id", "persona", "reason", "title", "format"),
    "job-created": ("job_id", "persona", "candidate_id", "source", "mode", "media"),
    "brief-built": ("job_id", "persona", "brief_artifact_id"),
    "script-generated": (
        "job_id",
        "persona",
        "mode",
        "scene_count",
        "treatment_set",
        "artifact_id",
    ),
    "asset-resolved": ("job_id", "persona", "asset_count", "sources"),
    "render-completed": ("job_id", "persona", "artifact_id", "media", "exit_code"),
    "render-degraded": ("job_id", "persona", "artifact_id", "media", "exit_code"),
    "qa-passed": ("job_id", "persona", "verdict", "stage", "checked_at", "findings"),
    "qa-failed": ("job_id", "persona", "reasons", "stage", "checked_at", "findings"),
    "revision-requested": (
        "job_id",
        "persona",
        "kind",
        "fields_reset",
        "reason",
        "target_status",
    ),
    "revision-applied": ("job_id", "persona", "kind", "child_run_id"),
    "operator-approved": ("job_id", "persona", "approved_by"),
    "operator-rejected": (
        "job_id",
        "persona",
        "reason",
        "rejected_by",
        "blamed_stage",
        "verb",
    ),
    "operator-drafted": ("job_id", "persona", "format", "post_id"),
    "draft-created": ("job_id", "persona", "format", "post_id"),
    "auto-drafted": ("job_id", "persona", "format", "post_id"),
    "draft-failed": ("job_id", "persona", "format", "rc", "detail"),
    "performance-observed": (
        "job_id",
        "persona",
        "postiz_post_id",
        "metrics",
        "observed_at",
    ),
    "source-blacklisted": ("persona", "host", "reason", "lifted"),
    "asset-blacklisted": ("persona", "asset_sha256", "reason", "lifted"),
    "format-requested": ("format", "recipe_hash", "approval", "persona", "plan_date"),
    "persona-day-summary": ("persona", "row_count", "forced"),
    "provider-call-failed": (
        "job_id",
        "persona",
        "stage",
        "provider",
        "model",
        "params_hash",
        "error",
        "disposition",
    ),
    "persona-day-skipped-overlap": ("persona", "run_date", "active_job_id", "reason"),
}

# Kinds whose payload `persona` must be non-empty (it keys the ranker index).
_PERSONA_REQUIRED = {
    k for k, fields in REQUIRED_PAYLOAD_FIELDS.items() if "persona" in fields
}

# Provider-failure dispositions (flow gap 4).
PROVIDER_FAILED = "failed"
PROVIDER_ABANDONED = "abandoned"


class PayloadContractError(ValueError):
    """An event payload is missing a contracted field (write-time enforcement)."""


class ArtifactTooLargeForInline(ValueError):
    """A non-JSON / oversized payload was given but no CAS backend exists yet (U10)."""


# ── Pool access (no engine modification) ─────────────────────────────────────


def pool_from_ctx(ctx: Any) -> Any:
    """Return the asyncpg pool a workflow context carries.

    The engine constructs ``WorkflowContext(pool=...)`` and stores it as ``_pool``;
    we read that rather than adding a public engine accessor (the engine stays
    unmodified — a System-Wide invariant). Tests pass a pool directly to the core
    functions and never call this.
    """
    pool = getattr(ctx, "_pool", None) or getattr(ctx, "pool", None)
    if pool is None:
        raise RuntimeError("workflow context carries no asyncpg pool")
    return pool


# ── sha + ref helpers ────────────────────────────────────────────────────────


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _canonical_json_bytes(obj: Any) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")


# ── record_artifact ──────────────────────────────────────────────────────────


async def record_artifact(
    pool: Any,
    *,
    job_id: str,
    stage: str,
    kind: str,
    name: str,
    persona: str,
    run_date: Any,
    data: Any | None = None,
    cas_ref: str | None = None,
    sha256: str | None = None,
    bytes_len: int | None = None,
    mime: str | None = None,
    provenance: Mapping[str, Any] | None = None,
    inputs: Sequence[str] = (),
    retention: str = "window",
    expires_at: Any | None = None,
    run_id: str | None = None,
) -> dict[str, Any]:
    """Record one stage output, idempotent on (job_id, stage, name, sha256).

    Exactly one of ``data`` (JSON, stored inline if ≤100KB) or ``cas_ref`` (bytes
    already in a content store; ``sha256`` required) is provided. Returns
    ``{"artifact_id", "ref", "sha256"}`` — the only thing a checkpoint should store.

    Supersede semantics: if a live (non-superseded) row already exists for
    (job_id, stage, name):
      • identical sha256 → return it unchanged (idempotent re-record);
      • different sha256 → mark the prior row superseded_by the new row (revision).
    """
    provenance = dict(provenance or {})
    if (data is None) == (cas_ref is None):
        raise ValueError("record_artifact requires exactly one of data= or cas_ref=")

    if cas_ref is not None:
        if not sha256:
            raise ValueError("cas_ref requires an explicit sha256")
        ref = cas_ref
        payload_json = None
    else:
        blob = _canonical_json_bytes(data)
        if len(blob) > INLINE_JSON_MAX_BYTES:
            # CAS backend (runstore) lands in U10; never silently truncate.
            raise ArtifactTooLargeForInline(
                f"{len(blob)} bytes > {INLINE_JSON_MAX_BYTES} inline limit; "
                "pass a cas_ref once runstore (U10) exists"
            )
        sha256 = sha256 or sha256_hex(blob)
        bytes_len = bytes_len if bytes_len is not None else len(blob)
        ref = "inline"
        payload_json = json.dumps(data)

    input_ids = list(inputs)

    new_id = str(uuid.uuid4())
    async with pool.acquire() as conn:
        async with conn.transaction():
            existing = await conn.fetchrow(
                "SELECT artifact_id, sha256 FROM video_artifacts "
                "WHERE job_id=$1 AND stage=$2 AND name=$3 AND superseded_by IS NULL",
                job_id,
                stage,
                name,
            )
            if existing is not None and existing["sha256"] == sha256:
                return {
                    "artifact_id": existing["artifact_id"],
                    "ref": ref,
                    "sha256": sha256,
                }

            if existing is not None:
                # Different sha for same (job, stage, name): supersede the prior row
                # FIRST so it leaves the `superseded_by IS NULL` partial unique index
                # before the successor is inserted. The self-FK is DEFERRABLE so
                # pointing at the not-yet-inserted new_id is legal until commit.
                await conn.execute(
                    "UPDATE video_artifacts SET superseded_by=$1 WHERE artifact_id=$2",
                    new_id,
                    existing["artifact_id"],
                )

            await conn.execute(
                "INSERT INTO video_artifacts ("
                "  artifact_id, job_id, run_id, persona, run_date, stage, kind, name,"
                "  ref, sha256, thumb_sha256, bytes, mime, payload, producer, provider,"
                "  model, provider_job_id, params, params_hash, prompt_sha, template_id,"
                "  template_sha, seed, cost_usd, tokens, latency_ms,"
                "  input_artifact_ids, variant, retention, expires_at"
                ") VALUES ("
                "  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,"
                "  $17,$18,$19::jsonb,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31"
                ")",
                new_id,
                job_id,
                run_id,
                persona,
                run_date,
                stage,
                kind,
                name,
                ref,
                sha256,
                provenance.get("thumb_sha256"),
                bytes_len,
                mime,
                payload_json,
                provenance.get("producer"),
                provenance.get("provider"),
                provenance.get("model"),
                provenance.get("provider_job_id"),
                json.dumps(provenance.get("params", {})),
                provenance.get("params_hash"),
                provenance.get("prompt_sha"),
                provenance.get("template_id"),
                provenance.get("template_sha"),
                provenance.get("seed"),
                provenance.get("cost_usd"),
                provenance.get("tokens"),
                provenance.get("latency_ms"),
                input_ids,
                provenance.get("variant"),
                retention,
                expires_at,
            )
            return {"artifact_id": new_id, "ref": ref, "sha256": sha256}


# ── emit_event (producer-enforced payload contract) ──────────────────────────


def validate_event_payload(kind: str, payload: Mapping[str, Any]) -> None:
    """Raise PayloadContractError if the payload violates the kind's contract."""
    if kind not in REQUIRED_PAYLOAD_FIELDS:
        raise PayloadContractError(f"unknown event kind: {kind!r}")
    missing = [f for f in REQUIRED_PAYLOAD_FIELDS[kind] if f not in payload]
    if missing:
        raise PayloadContractError(f"{kind} payload missing required fields: {missing}")
    if kind in _PERSONA_REQUIRED:
        persona = payload.get("persona")
        if not isinstance(persona, str) or not persona.strip():
            raise PayloadContractError(f"{kind} payload requires a non-empty persona")


async def emit_event(
    pool: Any,
    *,
    kind: str,
    payload: Mapping[str, Any],
    persona: str | None = None,
    job_id: str | None = None,
) -> int:
    """Validate (write-time) and insert one video_events row; return event_id.

    ``persona``/``job_id`` default from the payload when present so the indexed
    columns stay consistent with the contracted payload.
    """
    validate_event_payload(kind, payload)
    persona = persona if persona is not None else str(payload.get("persona", ""))
    job_id = job_id if job_id is not None else payload.get("job_id")
    async with pool.acquire() as conn:
        return await conn.fetchval(
            "INSERT INTO video_events (job_id, persona, kind, payload) "
            "VALUES ($1, $2, $3, $4::jsonb) RETURNING event_id",
            job_id,
            persona,
            kind,
            json.dumps(dict(payload)),
        )


async def emit_provider_failure(
    pool: Any,
    *,
    job_id: str,
    persona: str,
    stage: str,
    provider: str,
    model: str,
    params_hash: str,
    error: str,
    disposition: str = PROVIDER_FAILED,
    provider_job_id: str | None = None,
    latency_ms: int | None = None,
    cost_usd: float | None = None,
) -> int:
    """Emit a provider-call-failed event (flow gap 4).

    ``disposition='abandoned'`` carries ``provider_job_id`` so a later re-fetch is
    spend-free within the provider's result-TTL. No artifact row exists for a
    failed provider call — the event carries the provenance.
    """
    if disposition not in (PROVIDER_FAILED, PROVIDER_ABANDONED):
        raise ValueError(f"bad disposition: {disposition!r}")
    return await emit_event(
        pool,
        kind="provider-call-failed",
        payload={
            "job_id": job_id,
            "persona": persona,
            "stage": stage,
            "provider": provider,
            "model": model,
            "params_hash": params_hash,
            "error": error,
            "disposition": disposition,
            "provider_job_id": provider_job_id,
            "latency_ms": latency_ms,
            "cost_usd": cost_usd,
        },
    )


# ── status transitions (graph validation lives in U13) ───────────────────────


async def set_status(pool: Any, job_id: str, status: str) -> None:
    """Update a run's status + status_changed_at.

    The legal-transition graph is validated by U13's ported state machine before
    this is called; this helper performs the durable write only (the DDL CHECK
    guards the value set). Idempotent same-status writes are allowed.
    """
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE video_runs SET status=$2, status_changed_at=NOW(), updated_at=NOW() "
            "WHERE job_id=$1",
            job_id,
            status,
        )


# ── gate → events double-emit ────────────────────────────────────────────────


async def record_gate_resolution(
    pool: Any,
    *,
    kind: str,
    payload: Mapping[str, Any],
    persona: str | None = None,
    job_id: str | None = None,
) -> int:
    """The single write that records a gate resolution into video_events.

    Wrap this in ONE ctx.step alongside the workflow event-consumption so Slack and
    the events table never diverge (the ranker-feed invariant, origin §3). Returns
    the event_id. Kept a thin alias over emit_event so the double-emit is one call
    the workflow checkpoints atomically.
    """
    return await emit_event(
        pool, kind=kind, payload=payload, persona=persona, job_id=job_id
    )


# ── park-not-fail (CAS-budget refusal / store down) ──────────────────────────


async def park_until_recovered(
    ctx: Any,
    *,
    name: str,
    probe: Any,
    alert: Any | None = None,
    poll: timedelta = timedelta(minutes=5),
    escalate_after: int = 6,
    max_polls: int = 288,  # ~24h at 5m
) -> None:
    """Park (sleep-loop) instead of failing while ``probe()`` reports not-ready.

    A CAS-budget refusal or a down store is a *parking* condition, not a step
    failure: provider_job_id makes re-fetch spend-free within the provider TTL, so
    we wait rather than burn the spent work (flow gap 5). ``probe`` is an async
    callable returning truthy when recovered; ``alert`` (optional async callable)
    is invoked once parking starts and again every ``escalate_after`` polls.
    """
    polls = 0
    while True:
        if await probe():
            return
        if alert is not None and polls % escalate_after == 0:
            await alert(polls)
        polls += 1
        if polls >= max_polls:
            raise TimeoutError(f"{name}: store did not recover after {polls} polls")
        await ctx.sleep(f"{name}-park-{polls}", poll)
