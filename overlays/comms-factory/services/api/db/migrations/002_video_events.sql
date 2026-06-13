-- migrate:up

-- video_events: the durable event log — PR157's 25-kind vocabulary
-- (daily_core/core/state.py EventKind) PLUS provider-call-failed (a failed
-- provider call has no artifact row; the event carries provider/model/
-- params_hash/error/latency/cost/disposition/provider_job_id — flow gap 4) and
-- persona-day-skipped-overlap (flow gap 6). Per-kind required payload fields are
-- contracted in overlays/comms-factory/docs/video-event-payloads.md and ENFORCED
-- at write time by U5's events-emit helper (a doc-only contract lets prod drift
-- while tests stay green — the feedback_penalty=0.0-forever failure, one level up).
--
-- event_id is a monotonic surrogate; the ranker's 30-day feedback walk and the
-- unbounded blacklist replay read this table by (persona, kind, created_at) and
-- break ties on event_id (wall-clock created_at can tie or skew across pods).

CREATE TABLE IF NOT EXISTS video_events (
    event_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- NO FK to video_runs: candidate-scouted / candidate-* events on a scout run
    -- precede the job row (origin §3). persona is NOT NULL but '' is rejected by
    -- the U5 validator for every kind whose contract lists persona (so a
    -- persona-day-summary can't pollute the ranker index with an empty bucket).
    job_id              TEXT,
    persona             TEXT NOT NULL DEFAULT '',
    kind                TEXT NOT NULL,
    payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_video_events_kind
        CHECK (kind IN (
            -- 25 PR157 EventKind values (daily_core/core/state.py), verbatim
            'candidate-scouted', 'candidate-selected', 'candidate-auto-picked',
            'candidate-rejected', 'job-created', 'brief-built', 'script-generated',
            'asset-resolved', 'render-completed', 'render-degraded', 'qa-passed',
            'qa-failed', 'revision-requested', 'revision-applied',
            'operator-approved', 'operator-rejected', 'draft-created',
            'auto-drafted', 'operator-drafted', 'draft-failed',
            'performance-observed', 'source-blacklisted', 'asset-blacklisted',
            'format-requested', 'persona-day-summary',
            -- 2 centaur-port additions
            'provider-call-failed', 'persona-day-skipped-overlap'
        ))
);

-- The ranker/blacklist read path. event_id DESC tiebreaks same-created_at rows.
CREATE INDEX IF NOT EXISTS idx_video_events_persona_kind_time
    ON video_events (persona, kind, created_at DESC, event_id DESC);

-- Per-job timeline assembly (U11/U12).
CREATE INDEX IF NOT EXISTS idx_video_events_job
    ON video_events (job_id, created_at)
    WHERE job_id IS NOT NULL;

-- migrate:down

DROP INDEX IF EXISTS idx_video_events_job;
DROP INDEX IF EXISTS idx_video_events_persona_kind_time;
DROP TABLE IF EXISTS video_events;
