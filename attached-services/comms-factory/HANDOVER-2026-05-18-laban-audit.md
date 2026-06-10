# Session handover — Laban audit + Phantom-vs-Infinex + productisation framing

**Date:** 2026-05-18 (afternoon → evening)
**Predecessor session:** the fact-grounder + Phase 1 work captured in `SESSION_HANDOVER.md` (different concern)
**Successor task:** resume after Claude Code Design returns improved 3-shell viz files

This handover is dense by design. Read it top-to-bottom before resuming.

---

## 0. TL;DR — where we are right now

A long single session that produced (in order):

1. **A 9-surface Laban analysis of Phantom vs Infinex** (859 samples classified, then re-classified with corrected taxonomy).
2. **A canonical Mirodan drive-mapping reference** (`skills/laban-voice-for-ai-agents/references/drive-mapping.md` — the 24-cell embodied-character table with Action Axis per cell).
3. **A rewritten Laban classifier** with the full taxonomy (6 inner attitudes, 4 aspects, 3 stresses, factor-coherence rules) + rich per-sample emission (tempo, derived inner attitude, drive_axis, drive_introvert/extravert, outer_action_tempi).
4. **Three viz iterations** before landing on the operator-designed **3-shell viz** (4 aspect nodes inner core + 6 inner attitudes hexagon + 24 tempi outer ring + 3 stress triangles). Includes pole-pair and motor-pair canonical labels per tempo.
5. **A productisability groundmap** (`PRODUCT-MAP.md` at repo root) — what the work is, why it could matter as a product, who the buyers might be, honest demarcation of shipped vs in-flight vs pitched.
6. **A non-leading research prompt** for Gemini Deep Research + ChatGPT Pro Deep Research to validate market need (in chat history; not saved as a file).
7. **A handover zip for Claude Code Design** at `~/Downloads/3shell-viz-bundle.zip` — the renderer + current output + framework reference for someone to improve the visual.

**Status: blocked on Claude Code Design returning improved viz files.** Everything else upstream and downstream is ready.

---

## 1. The journey of this session (chronological)

Useful for picking up cold without re-reading the whole transcript.

### Phase A — Phantom multi-surface corpus harvest (4 surfaces, 479 samples)

User asked to reverse-engineer Phantom's Laban character. Wave-based parallel agent dispatch:

- Agent 1: Phantom website corpus (homepage, get-started, /learn including 8 blog/Crypto101 articles) → **89 samples**
- Agent 2: Phantom tweets corpus (from `research/wave-1.5-tweets/phantom.*`, including apology-class samples) → **55 samples**, stratified
- User dropped Phantom app screenshots (22 total across multiple batches) → OCR'd by parallel agents → **244 app samples** (the scam-block screenshot — "Request blocked. Domain found on blocklists maintained by: Blowfish. For your safety, Phantom has blocked this request." — was the highest-signal friction copy)
- Agent for app-adjacent (App Store + Google Play + help center) → **92 samples**

Result: **480 Phantom samples across 4 surfaces.** All four corpus files stored at `research/phantom-corpus-{website,tweets,app-adjacent,app}.md`.

### Phase B — First-pass classifier built + run

Built `scripts/classify-corpus.ts` (Sonnet 4.6 Laban classifier, batched). System prompt teaches the framework with 5 worked literary anchors. Tool schema enforces enums (inner_attitude, stress, aspect, drive_primary, etc.). Output JSON per sample.

Ran on all 4 Phantom surfaces in parallel background (~5 min wall clock).

### Phase C — Three vizzes built side by side

User wanted to see multiple visualization styles and pick:

1. **`render-laban-radar.py`** — Chart.js percentage radar with 8 trait axes. **Operator rejected** (I'd invented non-Laban label aliases like "Institutional weight" / "Aspirational reach"; corrected to use Laban terms directly). Now DEPRECATED.
2. **`render-laban-lattice.py`** — 6-node hexagon (my synthesis topology). **Operator rejected** in favor of 3-shell. Now DEPRECATED.
3. **`render-laban-cube.py`** — Mirodan-canonical Effort Cube (8 working-action vertices, 12 edges). Discovered via agent-dispatch into the Mirodan PDF — the cube IS Mirodan's actual topology. **Operator rejected** because the cube caps at 12 of 24 tempi (the 3 non-Flow inner attitudes); the other 12 disappear into a Flow-cloud abstraction. Now DEPRECATED.
4. **`render-laban-3shell.py`** — operator's own design: inner aspect nodes + middle hexagon + outer 24 tempi fanning radially. **OPERATOR CHOSE THIS.** All future iteration goes here.

### Phase D — Infinex corpus harvest (5 surfaces, 380 samples)

User asked the structural question: where does Infinex fall short? Need to compare apples-to-apples.

- Agent 1: Infinex marketing + utility + emergency from platform repo grep (~/Sites/infinex-xyz/platform) + existing dogfood research → 70 + 99 + 99 samples. **Critical finding: emergency surface count not anemic but ~30 units are Blockaid pass-through.** Plus IE099 "Henlo, and furthermore deploy your Beravault" on a funds-at-risk surface (casual founder voice intruding into emergency).
- Agent 2: Infinex tweets (52) + blog (60) from `research/wave-1.5-tweets/infinex.full.json` + `infinex.xyz/news`. Found the apology tweet ("We got the sale wrong") + the Sonar sale tweets including the famous one-word "Oversubscribed." + the Yaprun-pause blog post.

Result: **380 Infinex samples across 5 surfaces.** Stored at `research/infinex-corpus-{marketing,utility,emergency,tweets,blog}.md`.

### Phase E — First synthesis written (now INTERIM)

Wrote `research/phantom-vs-infinex-gap.md` with the framing:
- **Phantom = multi-voice** (marketing guy + ops guy + cultural guy + security guy — different "people" run different surfaces)
- **Infinex = single-voice** (founder voice bleeding through brand account, blog, apology, Sonar sale)
- **Both anchor on Stable + Penetrating** (where legible)
- **Infinex emergency outsourced to Blockaid** (institutional voice belongs to Blockaid, Infinex is messenger)

Plus 4 strategic options ranked by leverage.

User pushed back. Their hypothesis: Phantom might actually be **ONE Adream character** (the Ghost is an Adream creature), not 4 separate people. The multi-register reading was over-fitting.

### Phase F — Drive theory deep dive (PhD-level)

User: "Wait — where does Spell-Vision come from? I think it's just Spell. How many drives are there?"

Dispatched a deep agent into the Mirodan PDF (`/Users/opaque/Downloads/Mirodan-PhD-1997-Vol2.pdf` pp. 525–558 + character-diagram pages 561a/563a/565a) and the master reference markdown (`/Users/opaque/Downloads/nigel-session-2026-04-28/laban-mirodan-reference-2026-04-28.md`).

Findings:

- **4 base drives** = 3-of-4 motion factors active, named by the LATENT factor. Flow latent → Doing. Time latent → Spell. Space latent → Passion. Weight latent → Vision.
- **The X-diagram per placement.** Each (Inner + Aspect + Stress) cell has 4 corners: bottom-left = Inner Character Drive (resting), bottom-right = Outer Character Drive (secondary formative), top-right = Main Outer Action Drive (visible projection), top-left = Main Inner Action Drive (hidden lining).
- **Main Character-Action Axis** = bottom-left → top-right diagonal. Names the placement's drive-pair (e.g. "Spell→Vision" for Infinex Diagram D).
- **For Infinex (Stable + Flow + Penetrating, Diagram D):** Inner Drive = Spell, Outer Action Drive = Vision, Hidden lining = Passion, Secondary formative = Doing. Axis = Spell→Vision. So Spell-Vision is the AXIS name, not a single drive.
- **CORRECTION TO MEMORY:** the locked spec note "Infinex = Spell, not Passion" needs softening. Passion is the introvert/lining (top-left of Diagram D) — NOT absent, just hidden. Off-spec is **Passion as extravert**, not Passion at all. Time-pressure / hype / FOMO copy specifically swaps Vision out of the extravert slot and puts Passion in its place.
- **24 Action Diagrams** (vol 2 pp. 552–557) = 6 baselines × 2 Aspects × 2 Stresses, with only Stable/Adream/Near producing embodied characters (12 cells). The other 12 (Mobile/Remote/Awake "diagrams") exist but only as Outer Action Attitudes inside the 12 embodied ones.
- **Existing skill drive-mapping.md was incomplete + partially wrong on Stable.** Rows B and C marked "(varies)" should be Doing→Vision (B) and Spell→Passion (C). Also Mirodan herself prints a typo at p. 564 (Rebecca Nurse "B" should be "D").
- **6 possible drive-combos** (4-choose-2). 3 are formative (Doing+Spell=Stable, Doing+Passion=Near, Passion+Spell=Adream). 3 are outer-state-only (Passion+Vision=Mobile, Spell+Vision=Remote, Doing+Vision=Awake).
- **Mirodan emendation (pp. 540–541)** proposed swapping Spell↔Vision parent Mental Factors. Non-standard. Use Carpenter-canonical (Spell=Intuiting, Vision=Thinking) unless explicitly opted into.

### Phase G — Drive-mapping.md rewrite + classifier v2 rewrite

Rewrote `skills/laban-voice-for-ai-agents/references/drive-mapping.md` with the full canonical 24-cell embodied table, page-cited to Mirodan vol 2, with all rows filled (no more "(varies)"), plus the X-diagram explanation + decision recipe for deriving Drive from placement.

Rewrote `scripts/classify-corpus.ts` (v2):
- Inner attitude enum: full 6 (added adream + remote)
- Stress enum: only time/space/flow (dropped weight — weight is never a stress)
- Aspect enum: full 4 (added enclosing + radiating)
- Factor-coherence rules applied in normalize step (illegal stresses for a given inner downgrade to unknown; same for illegal aspects)
- **Rich per-sample emission:** Sonnet emits what it reads from the prose; code DERIVES drive_primary/drive_secondary/drive_introvert/drive_extravert/drive_axis from (inner, aspect, stress) via the canonical 24-cell table in code (`DRIVE_TABLE` dict in `classify-corpus.ts`).
- Inner attitude is also auto-derived from `tempo_primary` via a 24-tempo→inner map.
- `outer_action_tempi`: array of secondary tempi that flash within a sample as transient Outer Action moments (user's "if it's Commanding I want to see Stable too; if it has an Unsociable beat I want to see Remote too" requirement).

### Phase H — Full re-classify with v2 (15 min wall clock, ~$1-2 API)

All 9 surfaces re-classified. **860 samples total** (Phantom 479 + Infinex 380, +1 from a friction screenshot).

**Key findings from the corrected data:**

- **Phantom-as-Adream hypothesis: PARTIALLY supported.** Adream IS present (13% of Phantom website samples, vs 0% in the broken-enum data). Passion→Vision is the top drive axis on the website (15 samples). The hero "The money app that'll take you places" classifies as Overpowering (Adream Diagram D) with literary anchor "Blanche DuBois projecting illusions / Lovborg's grand vision." BUT Phantom uses **all three baselines** across surfaces — Stable + Adream + Near all appear. Most accurate read: **Phantom casts a different placement per surface, with Vision as the common destination.**
- **CORRECTION 2026-05-19 — chronology matters.** The locked Infinex character (Stable + Penetrating + Flow-stress, Spell→Vision) was established DURING this session arc, **after** the 380-sample corpus was produced. There was no contemporaneous spec for the team to violate. Earlier framings of this finding as a "fidelity gap" or "drift" are wrong — see `.claude/projects/.../memory/infinex-character-lock-postdates-corpus.md`. Treat all backward-looking numbers as baseline observations, not failure metrics. Forward-looking language only.
- **Pre-lock corpus baseline observation.** The 380-sample pre-lock Infinex corpus distributed predominantly into Stable Diagram **B** (Doing→Vision, Time-stress) across most surfaces — same Stable baseline, same Penetrating aspect, different stress axis from the now-locked Diagram **D** (Spell→Vision, Flow-stress). The locked Spell→Vision axis appeared in ~3-5% of the pre-lock corpus. Diagram-B register dominated at ~30%.
- **Status grammar observation:** Time-stress reads adolescent/lower-status per Mirodan pp. 458. The pre-lock corpus's Diagram-B register accordingly reads adolescent compared to the locked Flow-stressed character. This is the baseline against which post-lock copy will be measured.
- **Forward-looking fix path:** bias toward Flow-stress framing — less urgency / clock vocabulary, more yielding / continuity / emotion-visible framing. Already actioned in `research/infinex-character-sheet.md` (colleague-facing distillation, written 2026-05-19, plain English, real exemplars from both registers). Validator (paste-and-go) is the natural next deliverable.

### Phase I — 3-shell viz iteration

Built `scripts/render-laban-3shell.py` with operator's architecture:
- Inner core: 4 aspect nodes
- Middle ring: 6 hexagon inner attitudes (Mirodan canonical colors)
- 3 stress triangles (translucent overlays — {Stable, Near, Awake} blue / {Stable, Adream, Remote} turquoise / {Near, Adream, Mobile} green)
- Outer ring: 24 tempi fanning radially

Then iterations:
- Added stress-triangle overlays
- Re-rendered with v2 corrected-taxonomy data
- Added pole-pair canonical label per tempo (e.g. "Strong+Free" for Overpowering)
- Added motor-pair canonical label per tempo (e.g. "pressing→punching" for Overpowering)
- Bumped SVG to 560×600 with wider angular spread (50° per tempo group) + radial-rotated labels (so labels don't horizontally collide) + bottom-half flip (so all read left-to-right)

User screenshotted current state: still "cut off and jumbled." Built a `~/Downloads/3shell-viz-bundle.zip` for Claude Code Design to improve.

### Phase J — Productisation framing

User: "why hasn't this been used for product stuff before? Silicon Valley / consultancy would lap this shit up. it's also giving a framework for agents to be diverse psychologically rich human projections."

Wrote `PRODUCT-MAP.md` at repo root — 6-tier groundmap (front page → thesis → framework → case studies → infrastructure → product wedge → demo path) with honest demarcation of shipped / in-flight / pitched-not-built. Three product surfaces named: brand voice consultancy + spec authoring, brand voice audit (Phantom-style), multi-agent voice infrastructure (the wedge).

Drafted a **non-leading research prompt** (after user corrected an initial draft that named Laban — leading) for Gemini Deep Research and ChatGPT Pro Deep Research to validate market need. Prompt is in chat history; not saved as a file. User can re-extract from the transcript.

### Phase K — Cleanup + zip handover for designer

- Marked rejected scripts (radar, lattice, cube) as DEPRECATED in their docstrings
- Deleted superseded HTMLs (kept only `research/viz-yours-3shell.html`)
- Added INTERIM banner to `research/phantom-vs-infinex-gap.md` (it was written from broken-taxonomy data; structural findings hold but percentages will shift)
- Built `~/Downloads/3shell-viz-bundle.zip` with renderer + output + data + framework reference + a designer's brief README

---

## 2. Files added / modified this session

### Added (new files)

```
PRODUCT-MAP.md                                           ← groundmap for productisability eval
HANDOVER-2026-05-18-laban-audit.md                       ← this file

scripts/
  classify-corpus.ts                                     (REWRITTEN as v2 — full taxonomy + rich emission)
  analyze-laban-coherence.py                             ← cross-surface analyzer
  render-laban-3shell.py                                 ← THE viz (operator-chosen)
  render-laban-radar.py                                  ← DEPRECATED — kept for ref
  render-laban-lattice.py                                ← DEPRECATED — kept for ref
  render-laban-cube.py                                   ← DEPRECATED — kept for ref

research/
  phantom-corpus-{website,tweets,app-adjacent,app}.md    ← Phantom corpora (480 samples)
  phantom-classifications-{...}.json                     ← v2 classifications
  infinex-corpus-{marketing,utility,emergency,tweets,blog}.md  ← Infinex corpora (380 samples)
  infinex-classifications-{...}.json                     ← v2 classifications
  phantom-vs-infinex-gap.md                              ← INTERIM synthesis (banner inside)
  phantom-laban-coherence.md                             ← Phantom-only coherence analyzer output
  infinex-laban-coherence.md                             ← Infinex-only coherence analyzer output
  viz-yours-3shell.html                                  ← current 3-shell render
```

### Modified (existing files)

```
skills/laban-voice-for-ai-agents/references/drive-mapping.md  ← FULL REWRITE
  - Canonical 24-cell embodied-character table with Mirodan page citations
  - X-diagram explanation (4 corners + Main Action Axis)
  - Decision recipe for deriving Drive from (Inner + Aspect + Stress)
  - Documented Mirodan p. 564 typo (Rebecca Nurse "B" → actually "D")
  - Documented Spell↔Vision parentage emendation (pp. 540-541)
  - "Why Passion isn't absent" — Passion is the hidden lining of Stable Diagram D, not absent
```

### Auto-memory (saved to `.claude/projects/.../memory/`)

```
laban-vocabulary-only.md        ← don't invent synthesis labels; use Laban/Mirodan terms directly
python-template-braces.md       ← only double `{{ }}` in f-strings; plain .replace() templates use single braces
```

Both indexed in `MEMORY.md` so future sessions pick them up.

### Files deleted (superseded)

```
research/phantom-vs-infinex-radar.html        ← Chart.js radar (rejected design)
research/phantom-vs-infinex-lattice-smoke.html ← my hexagon (rejected)
research/viz-mine-hexagon.html                ← duplicate of above
research/viz-mirodan-cube.html                ← cube (rejected)
research/phantom-vs-infinex-3shell.html       ← older 3-shell render (before stress triangles)
/tmp/phantom-only-radar.html                  ← smoke artifact
/tmp/phantom-radar-renamed.html               ← smoke artifact
```

---

## 3. What's next — the work queue when you resume

### Blocked on designer return

1. **Take the improved 3-shell viz from designer.** They got `~/Downloads/3shell-viz-bundle.zip`. They'll return either:
   - An updated `render-laban-3shell.py` (drop-in replacement at `scripts/`)
   - A new visual treatment (could be a different file structure / different rendering approach)

   When their files come back, validate by:
   ```bash
   python3 scripts/render-laban-3shell.py research/viz-yours-3shell.html \
     "Phantom website"=research/phantom-classifications-website.json \
     "Phantom tweets"=research/phantom-classifications-tweets.json \
     "Phantom app-adjacent"=research/phantom-classifications-app-adjacent.json \
     "Phantom app"=research/phantom-classifications-app.json \
     "Infinex marketing"=research/infinex-classifications-marketing.json \
     "Infinex utility"=research/infinex-classifications-utility.json \
     "Infinex emergency"=research/infinex-classifications-emergency.json \
     "Infinex tweets"=research/infinex-classifications-tweets.json \
     "Infinex blog"=research/infinex-classifications-blog.json
   open research/viz-yours-3shell.html
   ```

2. **Refresh `research/phantom-vs-infinex-gap.md` with v2 data.** Remove the INTERIM banner. Rewrite the trait tables + per-surface findings against the corrected classifications (the structural findings still hold, but percentages need updating). Re-evaluate the "Phantom multi-voice vs single-Adream" framing — the v2 data suggests **multi-placement-with-Vision-destination**, neither pure multi-voice nor pure single-Adream. Land on the most accurate framing.

3. **Decide on Phantom diagnostic verdict.** Right now: open question. Three competing reads:
   - **Multi-voice** (4 people: marketing/ops/cultural/security) — my first framing, partially supported.
   - **Single Adream-D character with multi-surface projections** — operator's hypothesis, partially supported.
   - **Multi-placement casting director** (uses Stable + Adream + Near intentionally per surface, with Vision as common destination) — what the v2 data most cleanly supports.

   This decision shapes how Infinex SHOULD respond — whether to also cast multi-placement (add a "security correspondent" character, a "cultural" character) or hold single-voice tighter.

### Independent of designer

4. **Send the non-leading research prompt** to Gemini Deep Research and ChatGPT Pro Deep Research (the version in chat that doesn't name Laban/Mirodan). Compare results from both. Where citations overlap = real landscape. Where they diverge = worth investigating directly.

5. **Update PRODUCT-MAP.md** with whatever the deep research reveals. Specifically: the "Honest demarcation" section + the "Counter-arguments" need real evidence (today they're informed guesses). Add citations.

6. **Refresh `MEMORY.md` index** if there are findings from the deep research worth saving as memories. Possible candidates: competitor names, structural reasons the market hasn't adopted character frameworks, pricing benchmarks for brand voice consultancies.

7. **Memory note worth writing** (didn't get to it this session): something like `infinex-fidelity-gap-time-vs-flow.md` capturing the Phase H finding that shipped voice fires Diagram B (Doing→Vision, Time-stress) instead of locked Diagram D (Spell→Vision, Flow-stress). Status-grammar consequence: shipped reads adolescent. Fix path: shift Time-stress framing → Flow-stress framing.

### Bigger / longer-term threads

8. **Apply the same audit methodology to another brand.** Pendle, Coinbase, Robinhood, Linear, Stripe, Apple. Run their classifier output through the 3-shell viz. The scripts are corpus-agnostic. This validates the methodology generalises beyond crypto.

9. **Stand up the multi-agent character-licensing product surface.** From PRODUCT-MAP.md Tier 5 Surface 3. Concrete next step: write a CharacterSpec format spec doc + an SDK shape (TypeScript + Python) for how an agent platform consumes a `CharacterSpec` at runtime. Nigel's `bot/voice/*` is the reference implementation; abstract that into a portable SDK.

10. **The Phantom-as-Adream-D bet** — interesting as a comparative-art finding. If Phantom is really Adream-D (Passion→Vision, Blanche/Lovborg shape), and Infinex is Stable-D (Spell→Vision, Werle/Duke shape), then both brands point at Vision but FROM DIFFERENT BASELINES. Pendle, Polymarket, Hyperliquid would be informative comparisons. Are most crypto brands actually Vision-destination, just with different baseline character?

11. **The Mirodan vs Jung essay.** Tier 1 of PRODUCT-MAP frames the choice. Worth writing as a standalone essay (~1500-2500 words) for external publication — explains why the framework you're productising beats the dominant alternative. Stripe-tier explainer. The deep research output is the input to this essay.

12. **Re-look at `infinex-drive-spell-not-passion.md` memory.** Should be updated with the Phase F finding that Passion is the hidden lining of Diagram D, not absent. Memory currently overstates "no Passion" — should be "no Passion as extravert."

---

## 4. Key files for the next session — bookmarks

### The state-of-the-art files

- **`PRODUCT-MAP.md`** (repo root) — the groundmap. Read tier 0 in 30s to remember where we are.
- **`skills/laban-voice-for-ai-agents/references/drive-mapping.md`** — canonical 24-cell reference. The authoritative framework doc as of this session.
- **`scripts/classify-corpus.ts`** — v2 classifier. Working, smoke-tested. Reused by anyone wanting to classify any brand corpus.
- **`scripts/render-laban-3shell.py`** — the viz. Pending designer improvements.
- **`research/viz-yours-3shell.html`** — current render. Open in browser to see live state.
- **`research/phantom-vs-infinex-gap.md`** — synthesis (INTERIM). Needs v2 refresh.

### The data

- **`research/phantom-classifications-*.json`** — 4 files, ~480 v2 classifications.
- **`research/infinex-classifications-*.json`** — 5 files, ~380 v2 classifications.
- **`research/phantom-corpus-*.md`** — raw corpora (480 samples).
- **`research/infinex-corpus-*.md`** — raw corpora (380 samples).

### Live production reference (different repo)

- **`~/Sites/infinex-xyz/agents/nigel/`** — the live Polymarket bot. Voice subsystem at `bot/voice/`. Reference architecture for what a production agent looks like.

### Mirodan primary source (different repo)

- **`/Users/opaque/Downloads/Mirodan-PhD-1997-Vol2.pdf`** — 50MB PDF, ~1000 pages. Drive theory at pp. 525-557. Character-diagram illustrations at pp. 561a / 563a / 565a. 24 Action Diagrams construction at pp. 552-557. DO NOT try to read the whole thing — sample specific pages.
- **`/Users/opaque/Downloads/nigel-session-2026-04-28/laban-mirodan-reference-2026-04-28.md`** — 1070-line operator synthesis of the Mirodan PDF. Faster than reading the PDF for most lookups.

### The designer handover

- **`~/Downloads/3shell-viz-bundle.zip`** — what was sent. 184K. Contains the renderer, current output, all 9 data files, framework reference, and a README brief.

---

## 5. Don't-repeat traps (learned this session)

These are session-specific. The user's memory store (`MEMORY.md`) already captures the cross-session ones.

1. **Don't invent synthesis labels for Laban axes.** The user has built deep vocabulary around Mirodan terms. Use them directly. "% Stable inner attitude" beats "Institutional weight." Saved to memory: `laban-vocabulary-only.md`.

2. **Don't double-brace `{{ }}` in plain-string Python templates.** Only do that in f-strings or `.format()` templates. Plain `.replace()`-based templates use single braces. Saved to memory: `python-template-braces.md`.

3. **Don't claim a Laban placement is the answer in a non-leading research prompt.** The user corrected me on a research prompt where I'd named Laban/Mirodan — that's leading. The right shape: describe the problem space, ask broadly for what frameworks exist, let the tools surface specific names independently. If they surface from any angle, that's signal the framework is discoverable in the productisation landscape.

4. **Read tool fails on `/Users/opaque/Desktop/` paths from main thread but works from agent dispatch.** Sandbox quirk. If you need to OCR an image on the user's Desktop, dispatch an agent.

5. **Don't over-narrate progress.** User has explicit preference for terse comms. After my third "headline finding emerging" mid-session, the user moved on — I was burning their attention.

6. **The 3-shell viz `tempo_name` → `tempo_primary` field rename.** v1 classifier emitted `tempo_name`. v2 emits `tempo_primary`. The 3-shell renderer was patched to read both (with v2 preferred). If anyone touches the renderer, preserve this fallback so older classification JSONs still render.

7. **Mirodan's cube is canonical but caps at 12 of 24 tempi.** Don't build a cube viz for production analysis — the 12 Flow-involving tempi disappear into a side panel. Stick with the 3-shell. Documented in `scripts/render-laban-cube.py`'s deprecation docstring.

8. **The user is FAST in voice-to-text.** Their messages sometimes have transcription artifacts (e.g. "Mirrodon" for Mirodan, "Zonar" for "Sonar", "Ear" for "Near", "Larvin" for "Laban"). Parse charitably and confirm understanding rather than asking literal-text clarifying questions.

---

## 6. Strategic threads the user is holding

These came up across the session but aren't fully resolved.

### Voice infrastructure as the agent-economy wedge

User's framing: "It's giving a framework for agents to be diverse psychologically rich human projections." This is the **product wedge** described in PRODUCT-MAP.md Tier 5.

Concrete unlocks:
- Brands commission a Laban CharacterSpec per agent.
- Multi-agent products spec each agent in a distinct cell → mechanically distinct.
- Shared validator infrastructure across agents → off-spec drift detection.
- Licensable CharacterSpecs (a marketplace eventually).

Today's analog: brand archetypes (Jung) are dominant but not auditable. Mirodan is auditable.

Open questions:
- Who's the first paying buyer? Crypto / Web3 projects (heavy social agent use)? Enterprise brand teams? Agent platform operators?
- What's the right packaging? Open-source the validator (give away picks-and-shovels), monetize the CharacterSpec authoring?
- Stripe-tier essay or product-first?

### The Phantom hypothesis ambiguity

We have THREE competing reads of Phantom and the data doesn't fully resolve which:
- **A: Phantom is 4 people** (marketing/ops/cultural/security) — multi-voice deliberately deployed by surface
- **B: Phantom is one Adream-D character** (the Ghost) with multi-surface projections
- **C: Phantom is a multi-placement casting director** — picks Stable for utility, Adream for aspiration, Near for community

C is what the v2 data most cleanly supports. But B has the elegance of "the brand has a coherent character that projects different facets" which is more sellable than C.

Decision point: which read does Infinex respond to?

### Infinex strategic question — multi-cast or hold single-voice

Per the Phantom analysis: if Phantom multi-casts (whether 4 people or 1 character projecting), Infinex could either:
- Match — add a security-correspondent character, a cultural character. Multi-cast like Phantom.
- Counter — hold tighter single-voice. Lean into founder-voice authenticity that Phantom can't match.

This is a strategic call the operator hasn't made yet.

### The corpus-vs-lock baseline finding deserves its own write-up

Phase H baseline observation (pre-lock corpus distributed predominantly into Diagram B, not the now-locked Diagram D — one stress-cell off the lock) is **the most actionable single observation** of the whole audit. It's not "rewrite everything," it's "going forward, bias toward Flow-stress framing." Specific, mechanical, falsifiable. **NOTE: framing matters here — the lock postdates the corpus, so this is an observation about pre-spec baseline distribution, not a critique of past work.** See `research/infinex-character-sheet.md` for the colleague-facing distillation (written 2026-05-19) and the chronology-correction memory note.

Already in progress: the CharacterSheet (plain English, no Laban vocabulary, real exemplars from both registers). Next step toward broader adoption is the paste-and-go validator — colleagues get red/yellow/green + plain-English fix suggestions without reading the sheet at all.

---

## 7. How to pick up cold

If you're a Claude session reading this in 3 days / 3 weeks / 3 months:

1. **Read `PRODUCT-MAP.md`** (tier 0 + tier 1) — 5 min. Now you know what the project is.
2. **Read this handover doc top-to-bottom** — 15-20 min. Now you know where we left off.
3. **Skim `skills/laban-voice-for-ai-agents/references/drive-mapping.md`** — 5 min. Now you know the framework.
4. **Open `research/viz-yours-3shell.html`** in a browser. Now you see the live state.
5. **Check `~/Downloads/`** for any files the designer returned. If yes, drop them in `scripts/` and re-render.
6. **`cat /Users/opaque/.claude/projects/-Users-opaque--superset-projects-comms-factory/memory/MEMORY.md`** — auto-memory index. Pick up the operator's preferences + cross-session learnings.

Then decide which of section 3's "What's next" items to tackle. Most likely path: **resume from designer return → integrate improved viz → refresh `phantom-vs-infinex-gap.md` with v2 data + new viz → land the Phantom diagnostic verdict → write the strategic note for Infinex.**

---

## 8. Acknowledgements / debts

Things I didn't do well this session, surfaced for next time:

- **Verbose mid-session reporting.** User preference is terse; I drifted into "headline finding emerging" repetitions multiple times. Future: single-sentence updates, then shut up until I have the next concrete thing to ship.
- **Three sequential viz scripts I had to deprecate.** Could have asked the user upfront whether they wanted my best guess at the viz or wanted to see options. Building three to choose from cost ~45 min of session attention. Faster: ask "want a fast pick, three options, or your own architecture?" → user said "my own architecture" they'd have gone straight to 3-shell.
- **Drive theory understanding was missing.** Spell-Vision-as-axis (not single drive) was a knowledge gap I had until Phase F. The drive-mapping.md was outdated and I hadn't checked. Faster: when about to make a claim about Mirodan drive mechanics, check the reference doc first.
- **Synthesis label slip.** "Institutional weight" / "Aspirational reach" — invented aliases on top of Laban terms. The user correctly called this out as creating confusion. Saved to memory; should never recur.
- **Brace escaping bug.** Trivially fixable, embarrassing because it broke the HTML render before the user. Saved to memory.

Things that went well:

- **Wave-based parallel agent dispatch** for corpus harvest worked exactly as the operator's global rules describe. 6-7 corpus harvest agents in parallel completed faster than a sequential approach.
- **Mid-session memory writes** when learning surfaced (laban-vocabulary-only, python-template-braces). Both will benefit future sessions.
- **Honest demarcation in PRODUCT-MAP.md.** I resisted the temptation to overclaim. The "shipped vs in-flight vs pitched-not-built" structure is the most useful single section of that doc.
- **Drive theory deep dive.** Dispatching a focused agent into the Mirodan PDF + reference markdown returned the corrected drive-mapping.md within ~10 min. PhD-level material made tractable.

---

End of handover. Pick up when ready.
