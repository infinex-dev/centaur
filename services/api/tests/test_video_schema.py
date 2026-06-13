"""Schema tests for the video-capabilities overlay migration set (U4).

These apply the overlay migrations (overlays/comms-factory/services/api/db/
migrations) onto the ephemeral Postgres that the session `pg` fixture already
seeded with the core set, then assert the unbackfillable invariants: the four
tables exist, the status/kind CHECK value sets, the artifacts partial-unique
"one live row per (job, stage, name)" invariant, provenance-honesty nullability,
idempotent re-apply, and the doc<->CHECK event-kind completeness invariant.

The overlay set is not applied by the core conftest bootstrap, so a module
fixture applies it here (idempotent: every object is IF NOT EXISTS).
"""

from __future__ import annotations

import re
from pathlib import Path

import asyncpg
import pytest
import pytest_asyncio

REPO_ROOT = Path(__file__).resolve().parents[3]
OVERLAY_MIGRATIONS_DIR = (
    REPO_ROOT / "overlays" / "comms-factory" / "services" / "api" / "db" / "migrations"
)
PAYLOAD_DOC = (
    REPO_ROOT / "overlays" / "comms-factory" / "docs" / "video-event-payloads.md"
)


def _extract_up_sql(path: Path) -> str:
    """Mirror of conftest's dbmate `-- migrate:up` extractor."""
    text = path.read_text()
    match = re.search(r"-- migrate:up\s*\n(.*?)(?=-- migrate:down|$)", text, re.DOTALL)
    if not match:
        raise ValueError(f"No '-- migrate:up' section found in {path}")
    return match.group(1).strip()


def _overlay_migration_files() -> list[Path]:
    files = sorted(OVERLAY_MIGRATIONS_DIR.glob("*.sql"))
    assert files, f"no overlay migrations found at {OVERLAY_MIGRATIONS_DIR}"
    return files


@pytest_asyncio.fixture(scope="module")
async def overlay_dsn(pg: str) -> str:
    """Apply the overlay migration set onto the session Postgres (idempotent)."""
    conn = await asyncpg.connect(pg)
    try:
        for migration_file in _overlay_migration_files():
            await conn.execute(_extract_up_sql(migration_file))
    finally:
        await conn.close()
    return pg


@pytest.mark.asyncio
async def test_overlay_tables_and_indexes_exist(overlay_dsn: str) -> None:
    conn = await asyncpg.connect(overlay_dsn)
    try:
        tables = {
            r["tablename"]
            for r in await conn.fetch(
                "SELECT tablename FROM pg_tables WHERE tablename LIKE 'video_%'"
            )
        }
        assert {
            "video_runs",
            "video_events",
            "video_artifacts",
            "video_personas",
        } <= tables

        indexes = {
            r["indexname"]
            for r in await conn.fetch(
                "SELECT indexname FROM pg_indexes WHERE tablename LIKE 'video_%'"
            )
        }
        # the load-bearing ones: partial-unique live artifact, GIN lineage, ranker feed
        assert "uq_video_artifacts_live" in indexes
        assert "idx_video_artifacts_inputs" in indexes
        assert "idx_video_events_persona_kind_time" in indexes
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_overlay_migrations_idempotent(overlay_dsn: str) -> None:
    """Re-applying every up-section is a no-op (CREATE ... IF NOT EXISTS house style)."""
    conn = await asyncpg.connect(overlay_dsn)
    try:
        for migration_file in _overlay_migration_files():
            await conn.execute(_extract_up_sql(migration_file))  # must not raise
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_runs_status_check(overlay_dsn: str) -> None:
    conn = await asyncpg.connect(overlay_dsn)
    try:
        tx = conn.transaction()
        await tx.start()
        try:
            # the two centaur-port additions are accepted
            for status in ("created", "gate-expired", "delivered"):
                await conn.execute(
                    "INSERT INTO video_runs (job_id, persona, run_date, format, status) "
                    "VALUES ($1, 'p', CURRENT_DATE, 'th', $2)",
                    f"job-{status}",
                    status,
                )
            # an unknown status is rejected by chk_video_runs_status
            with pytest.raises(asyncpg.exceptions.CheckViolationError):
                await conn.execute(
                    "INSERT INTO video_runs (job_id, persona, run_date, format, status) "
                    "VALUES ('job-bad', 'p', CURRENT_DATE, 'th', 'not-a-status')"
                )
        finally:
            await tx.rollback()
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_runs_rating_check(overlay_dsn: str) -> None:
    conn = await asyncpg.connect(overlay_dsn)
    try:
        tx = conn.transaction()
        await tx.start()
        try:
            with pytest.raises(asyncpg.exceptions.CheckViolationError):
                await conn.execute(
                    "INSERT INTO video_runs (job_id, persona, run_date, format, rating) "
                    "VALUES ('job-r', 'p', CURRENT_DATE, 'th', 9)"
                )
        finally:
            await tx.rollback()
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_artifacts_partial_unique_live(overlay_dsn: str) -> None:
    """At most one non-superseded artifact per (job_id, stage, name); superseded coexist."""
    conn = await asyncpg.connect(overlay_dsn)
    try:
        tx = conn.transaction()
        await tx.start()
        try:
            await conn.execute(
                "INSERT INTO video_artifacts "
                "(job_id, persona, run_date, stage, kind, name, ref) "
                "VALUES ('j1','p',CURRENT_DATE,'script','scene_plan','plan','inline')"
            )
            # a second LIVE row with the same (job, stage, name) violates the partial unique
            with pytest.raises(asyncpg.exceptions.UniqueViolationError):
                await conn.execute(
                    "INSERT INTO video_artifacts "
                    "(job_id, persona, run_date, stage, kind, name, ref) "
                    "VALUES ('j1','p',CURRENT_DATE,'script','scene_plan','plan','inline')"
                )
        finally:
            await tx.rollback()

        # in a fresh tx: supersede the first, then a new live row is allowed
        tx2 = conn.transaction()
        await tx2.start()
        try:
            a1 = await conn.fetchval(
                "INSERT INTO video_artifacts "
                "(job_id, persona, run_date, stage, kind, name, ref) "
                "VALUES ('j2','p',CURRENT_DATE,'script','scene_plan','plan','inline') "
                "RETURNING artifact_id"
            )
            a2 = await conn.fetchval(
                "INSERT INTO video_artifacts "
                "(job_id, persona, run_date, stage, kind, name, ref, superseded_by) "
                "VALUES ('j2','p',CURRENT_DATE,'script','scene_plan','plan','inline', $1) "
                "RETURNING artifact_id",
                a1,
            )
            # a1 is live, a2 is superseded -> mark a1 superseded by a2, then a fresh live row is ok
            await conn.execute(
                "UPDATE video_artifacts SET superseded_by=$1 WHERE artifact_id=$2",
                a2,
                a1,
            )
            await conn.execute(
                "INSERT INTO video_artifacts "
                "(job_id, persona, run_date, stage, kind, name, ref) "
                "VALUES ('j2','p',CURRENT_DATE,'script','scene_plan','plan','inline')"
            )
        finally:
            await tx2.rollback()
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_artifacts_cost_and_provenance_nullable(overlay_dsn: str) -> None:
    """Uncaptured provenance stays NULL (distinguishable from a real zero)."""
    conn = await asyncpg.connect(overlay_dsn)
    try:
        tx = conn.transaction()
        await tx.start()
        try:
            row = await conn.fetchrow(
                "INSERT INTO video_artifacts "
                "(job_id, persona, run_date, stage, kind, name, ref) "
                "VALUES ('jc','p',CURRENT_DATE,'tts','vo_mp3','vo-1','cas:abc') "
                "RETURNING cost_usd, tokens, latency_ms, seed, retention"
            )
            assert row["cost_usd"] is None
            assert row["tokens"] is None
            assert row["latency_ms"] is None
            assert row["seed"] is None
            assert row["retention"] == "window"  # default class
        finally:
            await tx.rollback()
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_artifacts_retention_check(overlay_dsn: str) -> None:
    conn = await asyncpg.connect(overlay_dsn)
    try:
        tx = conn.transaction()
        await tx.start()
        try:
            with pytest.raises(asyncpg.exceptions.CheckViolationError):
                await conn.execute(
                    "INSERT INTO video_artifacts "
                    "(job_id, persona, run_date, stage, kind, name, ref, retention) "
                    "VALUES ('jr','p',CURRENT_DATE,'tts','vo_mp3','vo','cas:x','forever')"
                )
        finally:
            await tx.rollback()
    finally:
        await conn.close()


# --- doc <-> CHECK completeness invariant (no DB needed) --------------------


def _kinds_from_check() -> set[str]:
    sql = (OVERLAY_MIGRATIONS_DIR / "002_video_events.sql").read_text()
    block = re.search(
        r"chk_video_events_kind.*?CHECK\s*\(kind IN\s*\((.*?)\)\s*\)", sql, re.DOTALL
    )
    assert block, "could not find chk_video_events_kind IN-list"
    return set(re.findall(r"'([a-z0-9-]+)'", block.group(1)))


def _kinds_from_payload_doc() -> set[str]:
    text = PAYLOAD_DOC.read_text()
    # rows in the "Required fields per kind" table look like: | `kind` | ... |
    return set(
        re.findall(r"^\|\s*\*{0,2}`([a-z0-9-]+)`\*{0,2}\s*\|", text, re.MULTILINE)
    )


def test_event_kinds_check_matches_payload_doc() -> None:
    """Every CHECK kind is documented and every documented kind is in the CHECK."""
    check_kinds = _kinds_from_check()
    doc_kinds = _kinds_from_payload_doc()
    assert check_kinds == doc_kinds, (
        f"only in CHECK: {sorted(check_kinds - doc_kinds)}; "
        f"only in doc: {sorted(doc_kinds - check_kinds)}"
    )
    assert (
        len(check_kinds) == 27
    )  # 25 PR157 + provider-call-failed + persona-day-skipped-overlap
