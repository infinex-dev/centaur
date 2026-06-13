"""Tests for the video_store write path (U5).

DB-backed tests reuse the session `pg` fixture and apply the overlay migration
set (so video_runs/events/artifacts exist), mirroring test_video_schema. The
park-not-fail loop is tested with a duck-typed FakeContext (no DB), matching the
repo's FakeContext workflow-test style.

video_store lives under the overlay workflows dir, which is not on the default
import path; we sys.path-insert it (the overlay-test convention).
"""

from __future__ import annotations

import datetime as dt
import re
import sys
from pathlib import Path

import asyncpg
import pytest
import pytest_asyncio

REPO_ROOT = Path(__file__).resolve().parents[3]
OVERLAY_MIGRATIONS_DIR = (
    REPO_ROOT / "overlays" / "comms-factory" / "services" / "api" / "db" / "migrations"
)
sys.path.insert(0, str(REPO_ROOT / "overlays" / "comms-factory" / "workflows"))

import video_store as vs  # noqa: E402

TODAY = dt.date(2026, 6, 13)


def _extract_up_sql(path: Path) -> str:
    text = path.read_text()
    match = re.search(r"-- migrate:up\s*\n(.*?)(?=-- migrate:down|$)", text, re.DOTALL)
    assert match, f"no -- migrate:up in {path}"
    return match.group(1).strip()


@pytest_asyncio.fixture(scope="module")
async def vdsn(pg: str) -> str:
    """Apply the overlay schema once; return the DSN (no live connection yielded,
    so tests build their own pool on their own event loop)."""
    conn = await asyncpg.connect(pg)
    try:
        for f in sorted(OVERLAY_MIGRATIONS_DIR.glob("*.sql")):
            await conn.execute(_extract_up_sql(f))
    finally:
        await conn.close()
    return pg


@pytest_asyncio.fixture
async def vpool(vdsn: str):
    """Function-scoped pool — created on the running test's event loop."""
    pool = await asyncpg.create_pool(vdsn, min_size=1, max_size=4)
    try:
        yield pool
    finally:
        await pool.close()


async def _seed_run(pool, job_id: str) -> None:
    await pool.execute(
        "INSERT INTO video_runs (job_id, persona, run_date, format) "
        "VALUES ($1, 'ada', $2, 'th') ON CONFLICT (job_id) DO NOTHING",
        job_id,
        TODAY,
    )


# ── record_artifact ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_record_artifact_inline_returns_ref_triplet(vpool) -> None:
    await _seed_run(vpool, "j-inline")
    out = await vs.record_artifact(
        vpool,
        job_id="j-inline",
        stage="script",
        kind="scene_plan",
        name="plan",
        persona="ada",
        run_date=TODAY,
        data={"scenes": [1, 2, 3]},
        provenance={"producer": "openrouter", "model": "x", "cost_usd": 0.01},
    )
    assert set(out) == {"artifact_id", "ref", "sha256"}
    assert out["ref"] == "inline"
    row = await vpool.fetchrow(
        "SELECT payload, producer, cost_usd, ref FROM video_artifacts WHERE artifact_id=$1",
        out["artifact_id"],
    )
    assert row["producer"] == "openrouter"
    assert float(row["cost_usd"]) == 0.01
    assert row["payload"] is not None


@pytest.mark.asyncio
async def test_record_artifact_idempotent_same_sha(vpool) -> None:
    await _seed_run(vpool, "j-idem")
    a = await vs.record_artifact(
        vpool,
        job_id="j-idem",
        stage="script",
        kind="k",
        name="plan",
        persona="ada",
        run_date=TODAY,
        data={"v": 1},
    )
    b = await vs.record_artifact(
        vpool,
        job_id="j-idem",
        stage="script",
        kind="k",
        name="plan",
        persona="ada",
        run_date=TODAY,
        data={"v": 1},
    )
    assert a["artifact_id"] == b["artifact_id"]
    n = await vpool.fetchval(
        "SELECT count(*) FROM video_artifacts WHERE job_id='j-idem' AND superseded_by IS NULL"
    )
    assert n == 1


@pytest.mark.asyncio
async def test_record_artifact_supersedes_on_different_sha(vpool) -> None:
    await _seed_run(vpool, "j-sup")
    a = await vs.record_artifact(
        vpool,
        job_id="j-sup",
        stage="script",
        kind="k",
        name="plan",
        persona="ada",
        run_date=TODAY,
        data={"v": 1},
    )
    b = await vs.record_artifact(
        vpool,
        job_id="j-sup",
        stage="script",
        kind="k",
        name="plan",
        persona="ada",
        run_date=TODAY,
        data={"v": 2},
    )
    assert a["artifact_id"] != b["artifact_id"]
    old = await vpool.fetchval(
        "SELECT superseded_by FROM video_artifacts WHERE artifact_id=$1",
        a["artifact_id"],
    )
    assert old == b["artifact_id"]
    live = await vpool.fetchval(
        "SELECT count(*) FROM video_artifacts WHERE job_id='j-sup' AND superseded_by IS NULL"
    )
    assert live == 1


@pytest.mark.asyncio
async def test_record_artifact_cas_ref_requires_sha(vpool) -> None:
    await _seed_run(vpool, "j-cas")
    with pytest.raises(ValueError):
        await vs.record_artifact(
            vpool,
            job_id="j-cas",
            stage="render",
            kind="mp4",
            name="final",
            persona="ada",
            run_date=TODAY,
            cas_ref="cas:deadbeef",
        )  # no sha256
    out = await vs.record_artifact(
        vpool,
        job_id="j-cas",
        stage="render",
        kind="mp4",
        name="final",
        persona="ada",
        run_date=TODAY,
        cas_ref="cas:deadbeef",
        sha256="deadbeef",
        bytes_len=999,
    )
    assert out["ref"] == "cas:deadbeef"
    assert out["sha256"] == "deadbeef"


@pytest.mark.asyncio
async def test_record_artifact_rejects_data_and_cas_ref_both(vpool) -> None:
    with pytest.raises(ValueError):
        await vs.record_artifact(
            vpool,
            job_id="j",
            stage="s",
            kind="k",
            name="n",
            persona="ada",
            run_date=TODAY,
            data={"a": 1},
            cas_ref="cas:x",
            sha256="x",
        )


@pytest.mark.asyncio
async def test_record_artifact_too_large_inline_raises(vpool) -> None:
    big = {"blob": "x" * (vs.INLINE_JSON_MAX_BYTES + 10)}
    with pytest.raises(vs.ArtifactTooLargeForInline):
        await vs.record_artifact(
            vpool,
            job_id="j-big",
            stage="s",
            kind="k",
            name="n",
            persona="ada",
            run_date=TODAY,
            data=big,
        )


# ── emit_event (payload contract) ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_emit_event_inserts_valid(vpool) -> None:
    eid = await vs.emit_event(
        vpool,
        kind="operator-approved",
        payload={"job_id": "j1", "persona": "ada", "approved_by": "U1"},
    )
    assert isinstance(eid, int)
    kind = await vpool.fetchval("SELECT kind FROM video_events WHERE event_id=$1", eid)
    assert kind == "operator-approved"


@pytest.mark.asyncio
async def test_emit_event_missing_required_field_raises(vpool) -> None:
    with pytest.raises(vs.PayloadContractError):
        await vs.emit_event(
            vpool,
            kind="operator-rejected",
            payload={"job_id": "j", "persona": "ada", "reason": "x"},
        )
        # missing rejected_by, blamed_stage, verb


@pytest.mark.asyncio
async def test_emit_event_empty_persona_raises(vpool) -> None:
    with pytest.raises(vs.PayloadContractError):
        await vs.emit_event(
            vpool,
            kind="persona-day-summary",
            payload={"persona": "", "row_count": 2, "forced": False},
        )


@pytest.mark.asyncio
async def test_emit_event_unknown_kind_raises(vpool) -> None:
    with pytest.raises(vs.PayloadContractError):
        await vs.emit_event(vpool, kind="not-a-kind", payload={"persona": "ada"})


@pytest.mark.asyncio
async def test_emit_provider_failure(vpool) -> None:
    eid = await vs.emit_provider_failure(
        vpool,
        job_id="j",
        persona="ada",
        stage="seedance",
        provider="kinovi",
        model="seedance-20",
        params_hash="abc",
        error="timeout",
        disposition=vs.PROVIDER_ABANDONED,
        provider_job_id="task-42",
    )
    payload = await vpool.fetchval(
        "SELECT payload FROM video_events WHERE event_id=$1", eid
    )
    import json

    assert json.loads(payload)["disposition"] == "abandoned"
    with pytest.raises(ValueError):
        await vs.emit_provider_failure(
            vpool,
            job_id="j",
            persona="ada",
            stage="s",
            provider="p",
            model="m",
            params_hash="h",
            error="e",
            disposition="weird",
        )


@pytest.mark.asyncio
async def test_set_status(vpool) -> None:
    await _seed_run(vpool, "j-status")
    await vs.set_status(vpool, "j-status", "delivered")
    s = await vpool.fetchval("SELECT status FROM video_runs WHERE job_id='j-status'")
    assert s == "delivered"


def test_required_payload_fields_cover_all_doc_kinds() -> None:
    """Every event kind in the DDL CHECK has a REQUIRED_PAYLOAD_FIELDS entry."""
    sql = (OVERLAY_MIGRATIONS_DIR / "002_video_events.sql").read_text()
    block = re.search(r"chk_video_events_kind.*?\((.*?)\)\s*\)", sql, re.DOTALL)
    check_kinds = set(re.findall(r"'([a-z0-9-]+)'", block.group(1)))
    assert check_kinds == set(vs.REQUIRED_PAYLOAD_FIELDS), (
        f"CHECK-only: {sorted(check_kinds - set(vs.REQUIRED_PAYLOAD_FIELDS))}; "
        f"contract-only: {sorted(set(vs.REQUIRED_PAYLOAD_FIELDS) - check_kinds)}"
    )


# ── park_until_recovered (FakeContext, no DB) ─────────────────────────────────


class FakeCtx:
    """Duck-typed workflow context: records ctx.sleep calls, never really sleeps."""

    def __init__(self) -> None:
        self.sleeps: list[str] = []

    async def sleep(self, name: str, duration) -> None:
        self.sleeps.append(name)


@pytest.mark.asyncio
async def test_park_until_recovered_returns_on_recovery() -> None:
    ctx = FakeCtx()
    state = {"ready_after": 3, "n": 0}
    alerts: list[int] = []

    async def probe() -> bool:
        ready = state["n"] >= state["ready_after"]
        state["n"] += 1
        return ready

    async def alert(polls: int) -> None:
        alerts.append(polls)

    await vs.park_until_recovered(ctx, name="cas", probe=probe, alert=alert)
    assert len(ctx.sleeps) == 3  # parked 3 times, recovered on the 4th probe
    assert alerts  # alerted at least once when parking started


@pytest.mark.asyncio
async def test_park_until_recovered_times_out() -> None:
    ctx = FakeCtx()

    async def never() -> bool:
        return False

    with pytest.raises(TimeoutError):
        await vs.park_until_recovered(ctx, name="cas", probe=never, max_polls=3)
