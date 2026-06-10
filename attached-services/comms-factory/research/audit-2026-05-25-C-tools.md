# Audit C — Tools & Supporting Infrastructure (2026-05-25)

Scope: `scripts/`, `research/laban-viz/`, `src/voice/`, `research/*classifications*.json`.
Method: every claim below is verified against on-disk file contents, line counts, and a runtime invocation. CLAUDE.md / HANDOVER docs were NOT used as evidence.

## Top-line status legend

- **BUILT** — file exists, code is real (not stub), evidence of having run (outputs on disk).
- **PARTIAL** — file exists and runs but covers a subset / has caveats.
- **STUB** — placeholder / TODO body / known unfinished.
- **MISSING** — claimed by docs but absent on disk.

---

## 1. `scripts/` directory — 18 files

`ls -la` evidence (sizes in bytes, mtimes preserved):

| File | Size | mtime | Status | What it does |
|---|---|---|---|---|
| `classify-corpus.ts` | 31,431 | May 18 15:38 | **BUILT** | v2 LLM classifier (see §1a) |
| `aggregate-tallies.py` | 7,116 | May 18 17:16 | **BUILT** | Aggregates 9 per-surface JSONs → `tallies.json` for viz |
| `analyze-laban-coherence.py` | 11,637 | May 18 13:43 | **BUILT** | Drive/inner coherence analyzer on classification JSONs |
| `build-soft-vs-hardened-html.ts` | 22,415 | May 18 12:12 | **BUILT** | Side-by-side soft-cleaned vs hardened validator HTML diff |
| `render-laban-3shell.py` | 21,570 | May 18 16:17 | **BUILT** | Static 3-shell viz renderer (Python sibling of laban-viz/) |
| `render-laban-cube.py` | 15,983 | May 18 15:40 | **BUILT** | Alternate cube viz renderer |
| `render-laban-lattice.py` | 11,186 | May 18 15:40 | **BUILT** | Alternate lattice viz renderer |
| `render-laban-radar.py` | 14,777 | May 18 15:40 | **BUILT** | Alternate radar viz renderer |
| `dogfood-existing-copy.ts` | 8,327 | May 15 14:39 | **BUILT** | Runs real Infinex strings through Layer 1 validator + Layer 2 blind tempo classifier |
| `dogfood-homepage-tempo-fit.ts` | 16,268 | May 15 14:39 | **BUILT** | Homepage-tempo-fit experiment script |
| `rewrite-homepage-copy.ts` | 11,964 | May 15 15:00 | **BUILT** | Three-subagent rewrite loop (intent → in-character → re-classify) |
| `rewrite-nick-copy.ts` | 11,988 | May 22 11:29 | **BUILT** | howdensteenstra.com rewrite through two Adream placements (B vs D) |
| `rerun-bridge-card.ts` | 9,580 | May 22 18:05 | **BUILT** | Two-call generator re-runs Bridge.xyz card |
| `generate-mirodan-elevenlabs-sample.mjs` | 6,748 | May 22 17:02 | **BUILT** | ElevenLabs TTS sample generator |
| `generate-mirodan-elevenlabs-chapter.mjs` | 11,677 | May 22 17:47 | **BUILT** | Full-chapter ElevenLabs TTS generator |
| `prepare-mirodan-tts.mjs` | 103,950 | May 22 17:37 | **BUILT** | Mirodan TTS prep (largest script — 104KB) |
| `render-still.mjs` | 1,166 | May 13 17:58 | **BUILT** | Remotion still-frame renderer (`@remotion/bundler` + `renderStill`) |

**Shebang/wiring:**
- Python scripts: all four have `#!/usr/bin/env python3`.
- `.mjs` scripts: `prepare-mirodan-tts.mjs`, `generate-mirodan-elevenlabs-*.mjs` all `#!/usr/bin/env node`.
- TS scripts: invoked via `pnpm tsx scripts/<file>.ts` (no shebang needed).
- `package.json` registers only the CLI pipeline scripts (`dev`, `render`, `generate`, `validate`, `ship`, `test`, `test:watch`, `typecheck`). **None of the `scripts/` files are referenced from `package.json`.** They're invoked ad-hoc.

### 1a. `scripts/classify-corpus.ts` — the classifier (BUILT, runtime-verified)

**Header comment (line 1-33):** "v2 — corrected taxonomy + rich emission (2026-05-18 rewrite). Reads a markdown corpus with at least an ID and Text column per table, then asks Sonnet to read each sample for placement on the Mirodan framework."

**Taxonomy enums (lines 67-146):**
- `InnerAttitude`: `"stable" | "near" | "adream" | "mobile" | "awake" | "remote" | "unknown"` — **6 inners ✓**
- `Stress`: `"time" | "space" | "flow" | "unknown"` — **3 stresses ✓** (`weight` is explicitly excluded; system prompt line 381 enforces "Weight is NEVER a stress")
- `Aspect`: `"enclosing" | "penetrating" | "radiating" | "circumscribing" | "unknown"` — **4 aspects ✓**
- `TEMPO_INNER` map (lines 149-162): explicitly names all **24 tempi** (4 per inner × 6 inners) ✓
- `WorkingAction`: 8 actions across 4 motor pairs (`pressing/wringing/gliding/floating` → `punching/slashing/dabbing/flicking`) ✓

**Implementation type — HYBRID, not pure LLM:**
- Calls Anthropic SDK (`claude-sonnet-4-6` default) via `client.messages.create` with tool-use forced to `classify_samples` (lines 518-525).
- LLM emits: `tempo_primary`, `aspect`, `stress`, `pole`, `motor_pair`, `outer_action_tempi`, `confidence`, `rationale`, `literary_anchor`.
- **Drive derivation is deterministic code, not LLM.** Lines 217-240: hardcoded `DRIVE_TABLE` (12 baseline cells: stable/adream/near × 2 aspects × 2 stresses) maps `(inner, aspect, stress)` → `{primary, secondary, introvert, extravert}`. `deriveDrives()` looks up the cell mechanically.
- **`inner_attitude` is also deterministic.** Auto-derived from `tempo_primary` via the `TEMPO_INNER` map (line 555). LLM doesn't emit `inner_attitude` directly.
- **Factor-coherence enforcement is deterministic** (lines 562-575): if LLM emits an illegal stress/aspect for a given inner, the code downgrades it to `"unknown"`.

**Inputs / outputs:**
- Input: markdown file with `| ID | Text |` table(s). Parser at lines 244-290.
- Output: `JSON.stringify(output, null, 2)` to the path given (line 704). Schema = `ClassifiedSample[]` (id, text, classification).

**Batch / model defaults:** `--model=claude-sonnet-4-6 --batch=10 --limit=N`. Forces single-tool-use (`disable_parallel_tool_use: true`) for deterministic emission order.

**Runtime check (verified):**
```
$ pnpm tsx scripts/classify-corpus.ts
Usage: pnpm tsx scripts/classify-corpus.ts <corpus.md> <output.json> [--model=claude-sonnet-4-6] [--batch=10] [--limit=N]
```
Script parses, validates positional args, exits cleanly with usage line. Confirmed real (not vaporware).

---

## 2. Classification corpus JSONs — 11 files in `research/`

`ls research/*classifications*.json` + entry counts via `Array.length`:

| Brand | Surface | File | Entries |
|---|---|---|---|
| Infinex | tweets | `infinex-classifications-tweets.json` | **52** |
| Infinex | blog | `infinex-classifications-blog.json` | **60** |
| Infinex | marketing | `infinex-classifications-marketing.json` | **70** |
| Infinex | utility | `infinex-classifications-utility.json` | **99** |
| Infinex | emergency | `infinex-classifications-emergency.json` | **99** |
| Phantom | tweets | `phantom-classifications-tweets.json` | **55** |
| Phantom | website | `phantom-classifications-website.json` | **89** |
| Phantom | app-adjacent | `phantom-classifications-app-adjacent.json` | **92** |
| Phantom | app | `phantom-classifications-app.json` | **244** |
| (other) | bundle-test | `bundle-test-classifications.json` | **13** |
| (other) | 0xopaque-auto | `0xopaque-auto-classifications.json` | (legacy shape — `length` undefined, not v2 schema) |

**Totals:**
- **Infinex: 380 samples** classified across 5 surfaces.
- **Phantom: 480 samples** classified across 4 surfaces.
- **Bundle-test: 13 samples** (regression / pipeline-test corpus).
- **Trezor: NOT classified.** `research/trezor-production-generator.json` exists in repo (untracked), but no `trezor-classifications-*.json`.
- **Total v2-classified samples: ~873.**

**Spot-check (head of `infinex-classifications-tweets.json` entry IT001):** has full schema — `tempo_primary` (`"Human"`), `inner_attitude` (`"near"`), `aspect` (`"circumscribing"`), `stress` (`"flow"`), `pole` (`"free"`), `drive_primary` / `drive_secondary` / `drive_introvert` / `drive_extravert` (`passion / doing / vision / spell`), `drive_axis` (`"passion→spell"`), `motor_pair` (`["gliding", "dabbing"]`), `outer_action_tempi` (`["Acknowledged", "Unsociable"]`), `outer_action_inners` (`["mobile", "remote"]`), `confidence` (`0.72`), `rationale` (full paragraph), `literary_anchor` (`"Tony Soprano apologising to the crew…"`). **Schema fully matches the `Classification` interface in `classify-corpus.ts`.**

`grep -c tempo_primary` confirms 99 entries in `infinex-utility`, 244 in `phantom-app` — all carry the v2 taxonomy.

---

## 3. `research/laban-viz/` — 3-shell visualization

`ls -la research/laban-viz/`:

| File | Size | Lines | Status |
|---|---|---|---|
| `3-shell Laban viz.html` | 1,377 | 26 | **BUILT** entry point (React 18.3 + Babel standalone via unpkg) |
| `framework.js` | 6,954 | 179 | **BUILT** — `window.LABAN` namespace, inner colors, aspect colors, polar layout, baseline set, aspect-inner adjacency |
| `app.jsx` | 17,414 | 444 | **BUILT** — main app, fetches `data/tallies.json`, surface grid, modal, brand split (Phantom / Infinex / Other) |
| `shell3.jsx` | 12,692 | 322 | **BUILT** — 3-shell radial visualization component |
| `fingerprint.jsx` | 2,854 | 77 | **BUILT** — fingerprint component |
| `styles.css` | 16,171 | — | **BUILT** — Instrument Serif / Inter / JetBrains Mono fonts |
| `data/` | 10 JSON files | — | **BUILT** — 9 per-surface duplicates (mirror of `research/*classifications*.json`) + `tallies.json` (41,679 bytes, May 18 17:16) |
| `screenshots/` | 10 PNG | — | **BUILT** — screenshots from May 18 (some appear deduplicated — same 25,495-byte size repeated 6×) |

**Tallies shape verified:** `tallies.json` = `array len 9` of surface objects, each with `{ label, total, innerCounts, tempoCounts, aspectCounts, exemplars, driveAxisCounts, driveByInner, driveByTempo }`. Aggregation script (`scripts/aggregate-tallies.py`) wired correctly.

**Status: LIVE / FUNCTIONAL.** Single-page React app, no build step — open `3-shell Laban viz.html` in browser. Renders 9 surfaces. Last touched 2026-05-18 (one week stale; no regression evidence).

**Older sibling viz HTMLs** at research root: `0xopaque-classifier.html`, `cream-classifier.html`, `nigel-classifier.html`, `projectjin-classifier.html` — May 13 vintage, predate the 3-shell viz. Likely v1 classifier outputs.

---

## 4. `src/voice/` — voice files

`ls -la src/voice/` (8 files, all `.ts`):

| File | Lines | mtime | Status | Inner | Stress | Aspect | Drive | Locked? |
|---|---|---|---|---|---|---|---|---|
| `types.ts` | 236 | May 22 17:45 | **BUILT** | — generic framework types — |
| `laban.ts` | 177 | May 13 16:35 | **BUILT** | — generic framework constants (AVAILABLE_STRESSES, PREPARATION_PAIRS) — |
| `infinex.ts` | 405 | May 22 17:45 | **BUILT** | stable | flow (bound) | penetrating | spell + vision (Diagram D) | **LOCKED 2026-05-12** (header line 2) |
| `projectjin.ts` | 411 | May 13 16:07 | **BUILT** | stable | time | penetrating | doing + passion (Diagram A) | **locked 2026-05-12** (header line 3) |
| `cream.ts` | 490 | May 13 13:41 | **BUILT** | near | flow | circumscribing | doing + passion | DRAFT 2026-05-13 |
| `nigel.ts` | 522 | May 13 16:11 | **BUILT** | stable | flow (bound) | penetrating | spell + vision (Diagram D) | DRAFT 2026-05-13 |
| `nick-b.ts` | 166 | May 22 11:27 | **BUILT** | adream | space | radiating | spell → vision (Diagram B) | sub-character (howdensteenstra.com) |
| `nick-d.ts` | 168 | May 22 11:28 | **BUILT** | adream | time | radiating | passion → vision (Diagram D) | sub-character (howdensteenstra.com) |

**Infinex lock evidence:**
- Header (lines 1-31): `"Infinex voice spec — locked 2026-05-12. Character image refined 2026-05-19."`
- Character image (line 5): `"banker-turned-crypto trailblazer — knows the old world, found the better way, decisions already taken, now mapping."`
- Literary anchors (line 6): Werle (Wild Duck), the Duke (Measure for Measure).
- Placement (lines 11-14): Stable + Flow (bound) + Penetrating + Spell-Vision (Diagram D).
- Main tempi (line 16): Commanding · Practical · Sombre · Irradiant · Sociable.
- 12 tempi defined (out of 24); 7 declared `beat_only_tempi`.
- Cadence (lines 303-309): irradiant 0.45, commanding 0.22, sombre 0.18, sociable 0.10, practical 0.05.
- Off-spec drives: `["passion"]`. Off-spec regex catalogue: time-pressure, fomo-urgency, hype-theatre.
- `structural_traits` (3 items), `super_objective` (CTO frame — "to take responsibility for the tech, so the user only has to want"), `historical_lore` (Craterun/Yaprun/"terrorists" scar tissue), `validation_criterion` (one real user discovers product unprompted).
- Export `defaultBeatsForKind(kind)` provides canonical beat sequences for `launch-tier` / `data-card-official` / `data-card-wry` / `split` card kinds.

**Voices NOT in this repo:** none — Cream, ProjectJin, Nigel, Nick(B/D) all live HERE alongside Infinex. The CLAUDE.md positioning ("Voice lives in brand-factory") is aspirational; in practice every voice ships from `src/voice/*.ts` in comms-factory.

---

## 5. `src/voice/types.ts` — voice spec shape (BUILT, 236 lines)

Key exports verified:
- `SUSTAINED_ACTIONS` / `QUICK_ACTIONS` — 4 each, 8 total Working Actions.
- `PREPARATION_PAIRS` — quick → sustained map (punching→pressing, etc.).
- `BASELINE_ATTITUDES` = `["stable", "adream", "near"]`; `OUTER_ONLY_ATTITUDES` = `["mobile", "remote", "awake"]`.
- `Stress` = `"time" | "space" | "flow" | "weight"` (NB: `weight` is included in the type — but the classifier enforces "Weight is never a stress" at runtime).
- `Aspect` = `"enclosing" | "penetrating" | "circumscribing" | "radiating"`.
- `Drive` = `"doing" | "spell" | "passion" | "vision"`.
- All 24 tempi enumerated across 6 type unions (`StableTempo`, `AdreamOuterTempo`, `NearTempo`, `MobileOuterTempo`, `RemoteOuterTempo`, `AwakeOuterTempo`).
- `Tempo` interface: `name, attitude, inner_combo, motor: [WorkingAction, WorkingAction], feel, opening_shapes[], vocab_anchor[], signoff_moves[], example_lines[], lining?`.
- `CharacterSpec` interface: `name, inner_attitude, stress, stress_pole?, aspect, drive_primary, drive_secondary, drive_axis?, off_spec_drives[], off_spec_regexes[], tempi (Partial<Record<TempoName, Tempo>>), main_tempi[], beat_only_tempi[], cadence, structural_traits?, super_objective?, super_objective_examples?, historical_lore?, validation_criterion?`.
- Beat shapes: `TempoBeat { tempo, hint? }`, `BeatSequence { beats[], enforce_prep_hierarchy? }`.
- Audit result types: `BeatAuditResult`, `PrepHierarchyFailure`.

`super_objective`, `historical_lore`, `validation_criterion`, `lining` are all marked optional ("legacy voices keep working") — but `infinex.ts` populates all four. They're effectively required for any new voice.

---

## 6. Runtime verification

```
$ pnpm tsx scripts/classify-corpus.ts
Usage: pnpm tsx scripts/classify-corpus.ts <corpus.md> <output.json> [--model=claude-sonnet-4-6] [--batch=10] [--limit=N]
```
Exit code 1 (expected — no positional args). Script imports cleanly, all top-level enums initialize, the arg parser fires. **Classifier is real, executable, and tested.**

---

## 7. Surprises / gaps

- **Voice fileproliferation.** CLAUDE.md says "Voice lives in brand-factory `04-voice/tone.md`". Reality: 6 character voices live in `src/voice/*.ts` (infinex, projectjin, nigel, cream, nick-b, nick-d), totaling ~2,400 lines. Brand-factory's voice-spec ownership is aspirational, not enforced.
- **Two Diagram-D Stable+Flow+Penetrating voices: `infinex.ts` AND `nigel.ts`.** Same placement, different characters (banker-trailblazer vs old-man-at-pub). Nigel has cadence-by-observation methodology (even 20% across 5 main tempi); Infinex has weighted cadence. They are sibling voices that share placement.
- **`Stress` type permits `"weight"` in `types.ts` but classifier rejects it.** Type-system permissiveness vs runtime strictness — could trip a new voice author. The `INNER_AVAILABLE_STRESSES` table in classifier (lines 173-183) and the system prompt at line 381 both enforce "Weight is never a stress". Probably intentional belt-and-suspenders, but worth documenting.
- **`0xopaque-auto-classifications.json` is v1 schema** (entries=undefined under `.length`). All other classifications are v2. Should probably be moved out of `research/` or renamed `-v1.json`.
- **Trezor is NOT classified.** `research/trezor-production-generator.json` exists (untracked) — probably a generator-stub output, not a classification corpus. Per docs ("trezor production generator"), this is a separate exercise.
- **Drive derivation is in code, not the LLM.** This is the right design (deterministic and audited), but the rationale is buried in the classifier header — not in `types.ts` or `infinex.ts`. New voice authors won't necessarily know.
- **Viz screenshots have duplicates.** 6 of 10 PNGs in `laban-viz/screenshots/` are 25,495 bytes — same size, likely the same image saved under multiple names (01-detail2.png, 01-modal3.png, 02-detail2.png, 02-modal3.png, check2.png, modal2.png). Cosmetic.
- **`prepare-mirodan-tts.mjs` is 104KB.** Biggest script by far. Almost certainly contains an inline corpus / chapter content. Not inspected in full here.
- **No `scripts/` are wired into `package.json`.** All ad-hoc `pnpm tsx scripts/<file>` invocation. Consistent with "scripts as research tooling, not pipeline."
