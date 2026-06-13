-- migrate:up

-- video_runs: one row per LOGICAL video job. `job_id` is the stable id and is
-- decoupled from any workflow run_id — revision/experiment verbs are child
-- workflow runs against the same job_id (origin §3; plan U4). The status value
-- set is enforced here; the legal-TRANSITION graph is owned by U13's Python
-- state machine (ported verbatim from PR157 daily_core/core/state.py, where
-- set_status validates arcs) — see overlays/comms-factory/docs/video-event-payloads.md
-- §"Status transition contract". Keeping transitions out of the DDL means a new
-- status ships as a CHECK-replacement migration, never an `ALTER TYPE ADD VALUE`
-- (which cannot run in a transaction). That is why status is TEXT+CHECK, not an enum.

CREATE TABLE IF NOT EXISTS video_runs (
    -- identity
    job_id              TEXT PRIMARY KEY,
    persona             TEXT NOT NULL,
    run_date            DATE NOT NULL,
    format              TEXT NOT NULL,

    -- workflow-run linkage + per-job single-writer mutex (flow gap 3, U21).
    -- active_run_id is the durable home of the mutex; acquisition (CAS to NULL,
    -- or steal when the referenced run is terminal) is enforced in U21's workflow
    -- code, not by a DB constraint.
    workflow_run_id     TEXT,
    active_run_id       TEXT,

    -- status: PR157's 16-status graph PLUS the two centaur-port additions
    -- gate-expired (flow gap 2) and delivered (flow gap 7). NOTE on the two new
    -- states (modelled in U13, recorded here for grep-ability):
    --   delivered  = INTERMEDIATE, non-terminal, resumable: approved -> delivered
    --                -> (ship gate) -> drafted. A Postiz failure leaves the run
    --                resumable at delivered (plan U22 split-brain); delivered is
    --                exempt from failure-pinning.
    --   gate-expired = TERMINAL, non-pinning, revivable via the `revise` verb
    --                (a new child run, not an in-graph auto-arc) (plan U21).
    status              TEXT NOT NULL DEFAULT 'created',
    status_changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- candidate provenance (the scout pick that became this job; mirrors PR157
    -- ContentJob fields source/mode/media/keyword/url/topic + the pick's fit).
    candidate_id        TEXT,
    source              TEXT NOT NULL DEFAULT '',
    mode                TEXT NOT NULL DEFAULT '',
    media               TEXT NOT NULL DEFAULT '',
    keyword             TEXT NOT NULL DEFAULT '',
    url                 TEXT NOT NULL DEFAULT '',
    topic               TEXT NOT NULL DEFAULT '',
    fit_score           DOUBLE PRECISION,

    -- recipe (frozen config). recipe_hash is the experiment/A-B join key (origin
    -- §7.3). U15's job-creation step MUST populate recipe_hash in the SAME
    -- transaction as the runs insert (snapshot contract, flow gap 8); eval views
    -- MUST filter recipe_hash <> '' so un-snapshotted rows never collapse into one
    -- experiment bucket. DEFAULT '' supports only the insert-then-update window.
    recipe_id           TEXT NOT NULL DEFAULT '',
    recipe_hash         TEXT NOT NULL DEFAULT '',
    recipe_snapshot     JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- production knobs (denormalized for the runs grid + ranker format-mix)
    voice_id            TEXT,
    pose_slug           TEXT,

    -- delivery / performance-loop join key (set at Postiz draft time)
    postiz_post_id      TEXT,

    -- experiment fan-out (self-FK; experiment child links to its baseline job)
    variant_of          TEXT REFERENCES video_runs(job_id) ON DELETE SET NULL,

    -- capture-time labels (R8 improvement loop). rating is optional 1-5 on approve.
    rating              SMALLINT,
    labels              JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- terminal pointers. final_artifact_id is a plain TEXT pointer (NO FK): the
    -- artifacts table is created after this one and a hard FK would form a cycle
    -- with artifacts.job_id. Readers MUST resolve "the shipped final" through
    -- video_artifacts.superseded_by IS NULL, not by trusting this pointer after a
    -- revision supersedes the final (the revision/ship step re-points it).
    final_artifact_id   TEXT,

    -- NON-AUTHORITATIVE cache of SUM(COALESCE(video_artifacts.cost_usd,0)) for the
    -- job. Recomputable from artifacts; the runs grid may show it but budget/eval
    -- truth is the per-artifact sum. retention_sweep reconciles it (U19).
    total_cost_usd      NUMERIC(12,6) NOT NULL DEFAULT 0,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_video_runs_rating
        CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
    CONSTRAINT chk_video_runs_status
        CHECK (status IN (
            -- 16 PR157 statuses (daily_core/core/state.py JobStatus), verbatim
            'created', 'scouted', 'selected', 'briefed', 'planned', 'scripted',
            'assets-ready', 'rendered', 'qa-passed', 'qa-failed',
            'revision-requested', 'revised', 'approved', 'drafted', 'rejected',
            'failed',
            -- 2 centaur-port additions
            'gate-expired', 'delivered'
        ))
);

CREATE INDEX IF NOT EXISTS idx_video_runs_persona_date
    ON video_runs (persona, run_date DESC);

CREATE INDEX IF NOT EXISTS idx_video_runs_status
    ON video_runs (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_video_runs_postiz
    ON video_runs (postiz_post_id)
    WHERE postiz_post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_video_runs_variant_of
    ON video_runs (variant_of)
    WHERE variant_of IS NOT NULL;

-- migrate:down

DROP INDEX IF EXISTS idx_video_runs_variant_of;
DROP INDEX IF EXISTS idx_video_runs_postiz;
DROP INDEX IF EXISTS idx_video_runs_status;
DROP INDEX IF EXISTS idx_video_runs_persona_date;
DROP TABLE IF EXISTS video_runs;
