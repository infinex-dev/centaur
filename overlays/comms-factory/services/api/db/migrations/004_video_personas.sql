-- migrate:up

-- video_personas: persona identity + render props (pure data; the renderer image
-- never changes per persona — origin §4). props flow personas -> recipe_snapshot
-- -> Remotion inputProps. Assets (hero.png, voice-ref.wav, scene backdrops) live
-- in runstore CAS as `keep`-class, pinned-permanent blobs; this table holds only
-- their sha refs (a few-MB-each BYTEA hazard otherwise). The voice_id ledger is
-- updated by fal_tts's re-clone-on-4xx (U7), evented as a ledger-update.

CREATE TABLE IF NOT EXISTS video_personas (
    persona             TEXT PRIMARY KEY,     -- the @handle slug (matches video_runs.persona)
    handle              TEXT NOT NULL,        -- display @handle
    display_name        TEXT NOT NULL DEFAULT '',

    -- render props (origin §4: handle/accent/face_src/font_stack flow to inputProps)
    accent              TEXT NOT NULL DEFAULT '',   -- hex accent colour
    palette             JSONB NOT NULL DEFAULT '{}'::jsonb,
    font_stack          TEXT NOT NULL DEFAULT '',
    motion_brief        JSONB NOT NULL DEFAULT '{}'::jsonb,
    props               JSONB NOT NULL DEFAULT '{}'::jsonb,   -- catch-all for additional inputProps

    -- cadence config (drives video_persona_day, U18). zoneinfo tz lives here so the
    -- dispatcher can compute "due in its own timezone".
    cadence             JSONB NOT NULL DEFAULT '{}'::jsonb,
    timezone            TEXT NOT NULL DEFAULT 'UTC',
    auto_if_qa_passes   JSONB NOT NULL DEFAULT '{}'::jsonb,   -- per-format auto-enable flags (gated by the agreement bar)
    daily_caps          JSONB NOT NULL DEFAULT '{}'::jsonb,   -- per-format hard caps

    -- voice_id ledger (MiniMax clone ids; re-clone-on-4xx appends here)
    voice_id            TEXT,                 -- the current/default clone id
    voice_id_ledger     JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{voice_id, ref_sha256, created_at, reason}]

    -- persona asset CAS sha refs (keep-class, pinned-permanent; counted live in GC)
    hero_sha256         TEXT,
    voice_ref_sha256    TEXT,
    asset_refs          JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {scene_backdrops:[sha...], outfit:sha, ...}

    enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_personas_enabled
    ON video_personas (enabled)
    WHERE enabled = TRUE;

-- migrate:down

DROP INDEX IF EXISTS idx_video_personas_enabled;
DROP TABLE IF EXISTS video_personas;
