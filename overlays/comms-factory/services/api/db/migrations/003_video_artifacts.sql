-- migrate:up

-- video_artifacts: one row per stage output, the full forensic record (origin §3).
-- Metadata lives here (API pod, asyncpg); bytes live in runstore CAS addressed by
-- sha256. A row is inserted BEFORE its blob counts as live (the two-phase-GC
-- contract, U10/U19). record_artifact (U5) is idempotent on
-- (job_id, stage, name, sha256).

CREATE TABLE IF NOT EXISTS video_artifacts (
    artifact_id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

    -- ownership (persona + run_date denormalized for cross-run search/grid)
    job_id              TEXT NOT NULL,
    run_id              TEXT,
    persona             TEXT NOT NULL,
    run_date            DATE NOT NULL,

    -- addressing
    stage               TEXT NOT NULL,
    kind                TEXT NOT NULL,
    name                TEXT NOT NULL,
    ref                 TEXT NOT NULL,        -- scheme-prefixed: cas:<sha> | cloudinary:<id> | inline | expired
    sha256              TEXT,                 -- NULL for inline-payload-only rows
    thumb_sha256        TEXT,                 -- derived preview; COUNTS AS A LIVE CAS REF (GC refcount must union this)
    bytes               BIGINT,
    mime                TEXT,
    payload             JSONB,                -- inline JSON for <=100KB; larger JSON -> CAS (retention class preserved)

    -- provenance (R4). NULLABLE where "not captured" must stay distinguishable
    -- from a real zero: tokens/latency_ms/seed/cost_usd are NULL when uncaptured
    -- (a DEFAULT 0 would fabricate "free"/"instant"/"seed 0"). total_cost_usd on
    -- runs sums COALESCE(cost_usd,0).
    producer            TEXT,
    provider            TEXT,
    model               TEXT,
    provider_job_id     TEXT,                 -- checkpointed BEFORE fetching provider bytes (at-least-once safety)
    params              JSONB NOT NULL DEFAULT '{}'::jsonb,
    params_hash         TEXT,
    prompt_sha          TEXT,
    template_id         TEXT,                 -- template provenance is EXPLICIT (workflow_version hashes only the handler file)
    template_sha        TEXT,
    seed                BIGINT,
    cost_usd            NUMERIC(12,6),        -- NULL = uncaptured (PR157 does not capture hero/TTS/seedance cost)
    tokens              INTEGER,
    latency_ms          INTEGER,

    -- lineage edges (the visual-bisect graph). GIN-indexed below.
    input_artifact_ids  TEXT[] NOT NULL DEFAULT '{}',

    -- variant / supersession (revision chains coexist with stable addressing).
    -- The self-FK is DEFERRABLE INITIALLY DEFERRED so record_artifact can mark the
    -- prior row superseded BEFORE the (not-yet-inserted) successor exists, within one
    -- transaction — otherwise the new live row and the still-live old row both satisfy
    -- the `superseded_by IS NULL` partial unique index and collide. FK integrity is
    -- still enforced at commit.
    variant             TEXT,
    superseded_by       TEXT REFERENCES video_artifacts(artifact_id)
                            ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,

    -- retention (origin §3): keep (forever) | window (30d). expires_at NULL for keep.
    retention           TEXT NOT NULL DEFAULT 'window',
    expires_at          TIMESTAMPTZ,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_video_artifacts_retention
        CHECK (retention IN ('keep', 'window'))
);

-- Stable addressing: at most one LIVE (non-superseded) artifact per (job, stage,
-- name); superseded revision attempts coexist. This is the record_artifact
-- idempotency / supersede invariant (origin §3).
CREATE UNIQUE INDEX IF NOT EXISTS uq_video_artifacts_live
    ON video_artifacts (job_id, stage, name)
    WHERE superseded_by IS NULL;

-- Lineage walk in both directions (input_artifact_ids[] contains queries).
CREATE INDEX IF NOT EXISTS idx_video_artifacts_inputs
    ON video_artifacts USING GIN (input_artifact_ids);

-- Per-job timeline + cross-run search (U11/U12).
CREATE INDEX IF NOT EXISTS idx_video_artifacts_job_stage
    ON video_artifacts (job_id, stage);

CREATE INDEX IF NOT EXISTS idx_video_artifacts_persona_date
    ON video_artifacts (persona, run_date DESC);

-- sha refcount for the GC sweep (union of sha256 + thumb_sha256 live refs).
CREATE INDEX IF NOT EXISTS idx_video_artifacts_sha
    ON video_artifacts (sha256)
    WHERE sha256 IS NOT NULL;

-- The window-class expiry sweep candidate scan (U19).
CREATE INDEX IF NOT EXISTS idx_video_artifacts_expiry
    ON video_artifacts (expires_at)
    WHERE retention = 'window' AND expires_at IS NOT NULL;

-- migrate:down

DROP INDEX IF EXISTS idx_video_artifacts_expiry;
DROP INDEX IF EXISTS idx_video_artifacts_sha;
DROP INDEX IF EXISTS idx_video_artifacts_persona_date;
DROP INDEX IF EXISTS idx_video_artifacts_job_stage;
DROP INDEX IF EXISTS idx_video_artifacts_inputs;
DROP INDEX IF EXISTS uq_video_artifacts_live;
DROP TABLE IF EXISTS video_artifacts;
