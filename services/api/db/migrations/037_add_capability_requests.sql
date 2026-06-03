-- migrate:up
CREATE TABLE IF NOT EXISTS capability_requests (
    key_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (key_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_capability_requests_created_at
    ON capability_requests (created_at DESC);

-- migrate:down
DROP TABLE IF EXISTS capability_requests;
