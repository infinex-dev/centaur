# Video event payload contracts (U4)

The per-kind **required** payload fields for `video_events`. These are not merely
documentation: U5's events-emit helper validates every emission against this table
**at write time** (fail-loud in tests, log-and-alert in prod). A doc-only contract
lets production emissions drift while tests stay green — that is the
`feedback_penalty = 0.0`-forever failure mode the ranker would inherit (origin §3).

**Doc-completeness invariant (asserted in `test_video_schema.py`):** every kind in
this table appears in the `chk_video_events_kind` CHECK in `002_video_events.sql`,
and every kind in that CHECK appears here. **27 = 27** (25 PR157 kinds + 2 port additions).

Fields are derived from PR157 emission sites (cited) **adjusted for the centaur
port**: daily's on-disk `path` becomes an `artifact_id`/`ref` (bytes live in CAS,
not a run-dir path); daily's `recipe` key becomes `recipe_hash` where the experiment
join needs it. `persona` carried on a payload MUST be non-empty — the U5 validator
rejects `''` (the `video_events.persona` column defaults to `''`, so the validator
is the only guard against an empty-persona row polluting the `(persona, kind, …)`
ranker index).

## Required fields per kind

| kind | required payload fields | source / port note |
|---|---|---|
| `candidate-scouted` | `candidate_id, persona, title, url, mode, fit_score, source` | state.py:764 |
| `candidate-selected` | `job_id, persona, candidate_id, source, mode, media, title, keyword, url, fit_score, format, recipe_hash, host, slot_index` | daily.py:4300; `recipe`→`recipe_hash` |
| `candidate-auto-picked` | `candidate_id, persona, format, recipe_hash, slot_index, title, url, total_score, component_scores, pick_rationale, considered_alternatives, pool_quality, should_ship` | runner.py:476 |
| `candidate-rejected` | `candidate_id, persona, reason, title, host, format` | operator_cli.py:69 |
| `job-created` | `job_id, persona, candidate_id, source, mode, media, keyword, url` | state.py:878 |
| `brief-built` | `job_id, persona, brief_artifact_id` | NEW (port) — no daily emission site |
| `script-generated` | `job_id, persona, mode, script_style, scene_count, treatment_set, artifact_id, step_count` | daily.py:4010; `path`→`artifact_id` |
| `asset-resolved` | `job_id, persona, asset_count, sources` | daily.py:4072 |
| `render-completed` | `job_id, persona, artifact_id, media, exit_code, qa_skipped` | daily.py:4473; `path`→`artifact_id` |
| `render-degraded` | `job_id, persona, artifact_id, media, exit_code, qa_skipped` | daily.py:4473 (degraded variant) |
| `qa-passed` | `job_id, persona, verdict, stage, checked_at, findings` (`caveats` optional) | daily.py:4103 — see qa-union note |
| `qa-failed` | `job_id, persona, reasons, stage, checked_at, findings` | daily.py:4090 — see qa-union note |
| `revision-requested` | `job_id, persona, kind, fields_reset, reason, target_status` + `blamed_stage, verb, note` | revise.py:191 + per-verb gate labels (origin §7.1) |
| `revision-applied` | `job_id, persona, kind, child_run_id` | NEW (port) — no daily emission site |
| `operator-approved` | `job_id, persona, approved_by` (`rating` 1-5 optional) | job.py:394; rating → runs.rating |
| `operator-rejected` | `job_id, persona, reason, rejected_by` + `blamed_stage, verb, note` | job.py:420 + per-verb gate labels |
| `operator-drafted` | `job_id, persona, format, post_id, drafted_via, scheduled_for` | run.py:1500; `post_id`→`postiz_post_id` |
| `draft-created` | `job_id, persona, format, post_id` | NEW (port) — superseded by auto/operator-drafted |
| `auto-drafted` | `job_id, persona, format, post_id, drafted_via, scheduled_for` | draft.py:303 |
| `draft-failed` | `job_id, persona, format, rc, detail` | draft.py:353 |
| `performance-observed` | `job_id, persona, postiz_post_id, metrics, observed_at` | NEW (Phase 4) — metrics-pull join on postiz_post_id |
| `source-blacklisted` | `persona, host, reason, lifted` | blacklist.py:71 |
| `asset-blacklisted` | `persona, asset_sha256, reason, lifted` | NEW (port) — mirrors source-blacklisted on a CAS asset |
| `format-requested` | `format, recipe_hash, approval, persona, plan_date, slot_index` | planner.py:528; `recipe`→`recipe_hash` |
| `persona-day-summary` | `persona, row_count, forced` | draft.py:769; `persona` added (daily omits it; index needs it) |
| `provider-call-failed` | `job_id, persona, stage, provider, model, params_hash, error, latency_ms, cost_usd, disposition, provider_job_id` | NEW (flow gap 4); `disposition ∈ {failed, abandoned}` |
| `persona-day-skipped-overlap` | `persona, run_date, active_job_id, reason` | NEW (flow gap 6); emitted when the mutex blocks an overlapping persona-day |

### Notes / source conflicts

- **`qa-passed`/`qa-failed` have two source payloads** (stage-3b `_emit_qa_event` vs Phase-5 `record_qa` from `QaReport.to_dict()`). The port unifies them by requiring the **superset** present in both: `job_id, persona, verdict|reasons, stage, checked_at, findings`. U5's validator rejects a qa event missing any unified-required field.
- **`findings[]` item shape** = `QaFinding` (state.py:189-206): `kind, severity, scene_idx (nullable), field (nullable), detail (default ""), suggested_revision (nullable)` **+ `treatment`** (centaur port addition). The treatment value is in-hand at `qa.py:140` via `scene.get("treatment")`; daily only embeds it inside the `detail` string. Adding it as a first-class field makes "which treatment fails most" a `GROUP BY` instead of a string-parse. **Unbackfillable: U5/U13 must populate `treatment` from the first emission** — there is no backfill for findings whose treatment lived only in a free-text detail.
- **5 daily kinds are defined-but-never-emitted in source** (`brief-built, revision-applied, draft-created, performance-observed, asset-blacklisted`). Their contracts here are newly defined for the port (marked NEW) — no daily.py emission-site cite exists.

---

## Status transition contract (for U13's Python state machine)

U4's DDL enforces only the status **value set** (`chk_video_runs_status`). The legal
**transition graph** is owned by U13's ported `set_status` (PR157
`daily_core/core/state.py`). This section is the ground truth U13 builds
`LEGAL_TRANSITIONS` from — **generate the dict from this table and assert it
arc-for-arc in a characterization test; do not hand-transcribe** (a dropped arc is
silent). The DDL holds no transition logic, so refining this model in U13 needs no
schema change.

### PR157 statuses (16, verbatim — `JobStatus`)
`created, scouted, selected, briefed, planned, scripted, assets-ready, rendered,
qa-passed, qa-failed, revision-requested, revised, approved, drafted, rejected, failed`

### PR157 `LEGAL_TRANSITIONS` (verbatim, 39 arcs — state.py:101)
```
created            → scouted, selected, rejected
scouted            → selected, rejected
selected           → briefed, scripted, rejected
briefed            → planned, scripted, rejected
planned            → scripted, rejected
scripted           → assets-ready, qa-passed, qa-failed, rendered, rejected
assets-ready       → qa-passed, qa-failed, rendered, rejected
qa-passed          → rendered, approved, revision-requested, rejected, drafted
qa-failed          → revision-requested, rejected
rendered           → qa-passed, qa-failed, approved, rejected
revision-requested → revised, rejected
revised            → rendered, rejected
approved           → drafted, rejected
drafted            → ∅ (terminal)
rejected           → ∅ (terminal)
failed             → ∅ (terminal)
```
Plus: `failed` is reachable from **any** state in daily (omitted from the table;
`set_status` checks it explicitly). Idempotent same-status writes are no-ops.

### Centaur-port additions (2 statuses + the arcs)
- **`delivered` — INTERMEDIATE, non-terminal, resumable.** Sits between approval and
  draft: `approved → delivered` (manual lane) and `qa-passed → delivered` (auto lane:
  a QA-pass under the agreement bar is the "approval" that permits the Cloudinary
  delivery upload — origin §9). `delivered → drafted` after the human ship gate. A
  Postiz failure leaves the run **resumable at `delivered`** (plan U22 split-brain);
  `delivered` is **exempt from failure-pinning**. (daily's `qa-passed → drafted` and
  `approved → drafted` arcs stay legal for source-compat but the port's canonical
  path runs through `delivered`.)
- **`gate-expired` — TERMINAL, non-pinning, revivable.** A gate timeout (72h default)
  moves the gate-waiting status → `gate-expired` (gate-waiting statuses: `scripted`
  for the script gate; `qa-passed`/`rendered` for the final-cut gate; `delivered` for
  the ship gate). Revival is via the `revise` verb (a child run), modelled as
  `gate-expired → revision-requested`/`revised` — confirm the exact entry arc against
  `revise.py` semantics when U13/U16 land.

### Failed-reachability narrowing (resolves the source-invariant collision — plan U4)
daily: `failed` reachable from **every** state. The port **narrows** this: `failed`
is reachable from any state **EXCEPT** the post-spend protected set —
**`{delivered, drafted}` and any parked-awaiting-provider-TTL state**. Rationale:
once provider/delivery spend has produced a shipped or about-to-ship artifact, a
late failure must not pin the chain to keep-1yr or discard a healthy result; the ship
step is retryable, not failable. U13's characterization test must encode this
exception, **not** the verbatim daily "failed from any state" rule.
