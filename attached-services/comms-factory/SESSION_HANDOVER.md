# Session handover — comms-factory voice + render pipeline

**Last session: 2026-05-12 → 2026-05-13.** Context was at 72% when handed over.

This doc is the load-bearing context for the next Claude session. Read it top-to-bottom before doing anything.

---

## TL;DR — where we are

- 4 voice specs locked (Infinex, Cream of the Crop, ProjectJin, Nigel)
- Skill (`laban-voice-for-ai-agents`) substantially patched + a new methodology layer
- Remotion renderer working end-to-end: release card → generator → validator → orchestrator → mp4 + poster
- Square 1080×1080 with platform-screenshot background composition
- perps-app dev server **STILL RUNNING** on `:5179` (PID 93462) — leave it up
- Design brief **PREPARED** — zip at `/tmp/comms-factory-design-brief.zip` + full prompt below
- Two rounds of Codex review addressed (5 + 2 findings, all fixed)
- Locked Infinex placement = Stable + Flow + Penetrating (Spell-Vision, Diagram D)

Next session's main asks (in priority order):
1. When Design returns: port tokens into `src/brand-stub.ts`
2. Add `--render-tempo=<single>` CLI flag for terse video captions (Phase 3 prep)
3. Phase 3: channel routing — Twitter / script / longform per-channel shaping
4. Phase 4: ship-gate preview HTML
5. Optional: live-DOM animation via Puppeteer (bigger build)

---

## State of code (uncommitted — all changes are working tree)

### Voice specs — all 4 working via `--voice=<brand>`
- `src/voice/types.ts` — extended for all 24 framework tempi (Near/Mobile/Awake added). `TempoName` is now the full 24. `Tempo.motor` widened to `[WorkingAction, WorkingAction]` (was `[Sus, Q]` only). `CharacterSpec.tempi` is `Partial<Record<...>>`.
- `src/voice/infinex.ts` — locked from prior work. Stable + Flow + Penetrating + Spell-Vision (Diagram D, no Passion). Bound pole.
- `src/voice/cream.ts` — NEW. Near + Flow + Circumscribing + Doing-Passion. 6 main tempi at even 16.7%.
- `src/voice/projectjin.ts` — NEW. Stable + Time (with Flow swing) + Penetrating + Doing-Passion. 5 main tempi at 20% each. Modern equivalent: Nick Fury / Circus MC / spy-agency overseer.
- `src/voice/nigel.ts` — NEW. Stable + Flow (Bound) + Penetrating + Spell-Vision (same family as Infinex but Bound-pole variant). 5 main tempi. Methodology test converged 6/7 dimensions with the locked answer; Unsociable replaced Egocentric.

### Generator / validator / orchestrator
- `src/generator.ts` — accepts `voice` and `defaultBeats` options. Stub mode uses `voice.tempi[name]` (not Infinex's getTempo). Live-mode prompt drives off-spec language from `voice.off_spec_regexes` (no Infinex hardcoding). Prep-hierarchy guidance matches the validator's both-Quick / both-Sus handling.
- `src/validator.ts` — **substantially modified by recent lint/Codex passes**. Now includes:
  - voice-aware `rejectOffSpecDrive(s, voice)` (no longer hardcoded to Infinex)
  - `auditPrepHierarchy` skips non-Sus→Q tempi (both-Quick tempi like Cool fire without prep)
  - `auditClaimContract` — NEW. Validates `deployed_facts_used` + `not_said` receipts against the release card. Catches generator inventing facts.
  - `BlindTempoClassification` — NEW. Blind classifier scoring per the Nigel Track-5b pattern. Doesn't read declared beat while scoring.
  - Beat-tempo-fit failures push to `failures[]` but don't flip `passed` to false (treated as warning, not hard fail).
- `src/orchestrator.ts` — accepts `{ voice, beats }` options + threads to `validate()`. Picks-vs-displayed-validation now consistent. Also passes `deployed_facts_used` / `not_said` from each candidate through to validate.

### CLI
- `src/cli.ts` — `--voice=infinex|cream|projectjin|nigel` works on `generate`, `validate`, `tempi`, `demo`, `render`. `parseBeats` validates against voice's available tempi (fail-loud on unknown). `--out=<dir>` + `--bg=<path>` flags wired to `render`.

### Renderer (Phase 2 — NEW this session)
- `src/brand-stub.ts` — 4 brand-token stubs (Infinex, Cream, ProjectJin, Nigel). Square 1080×1080 geometry for all. **STUB pending brand-factory `voiced` status** — single-file swap path.
- `src/remotion/Root.tsx` — `registerRoot` + composition registry. Only `data-card-official` is wired.
- `src/remotion/data-card-official/Composition.tsx` — 1080×1080 square. Reads brand tokens. Layout: wordmark + accent bar top-left, optional metric pill top-right, headline + caption + handle bottom. Supports optional background_image_path (with Ken Burns scale + scrim gradient).
- `src/remotion/render.ts` — programmatic renderer. `bundle()` with webpack extensionAlias `.js→.tsx/.ts` to handle NodeNext-style imports. Public dir at `.remotion-public/` (gitignored — copied to from `--bg=`). Picks metric from card kind via `resolveCardSlots()`.
- `dist/render-test/final.mp4` + `dist/render-test/poster.png` — proof-of-concept output (1080×1080, 132 frames @ 30fps, 4.4s).

### Skill (`skills/laban-voice-for-ai-agents/`)
- `SKILL.md` — substantially rewritten. STUPID MISTAKES section + Aspect-vs-Stress disambiguation + Q2/Q3/Q4 patches (baseline-filtered + operator-native phrasing). **Inside-out flow is the DEFAULT;** abstract-Q fast path is demoted to fallback. Plus a new "Delivery mechanics" section pointing at `scripts/gen-samples-and-classifier.py`. Plus "After placement" Inner-vs-Outer time-spent teaching.
- `templates/interview-questions.md` — mirrored patches.
- `references/literary-refs-glossary.md` — NEW. 18 Mirodan characters glossed with modern equivalents (Werle → Logan Roy / Don Corleone; Big Daddy → Tony Soprano / Anthony Bourdain; Tesman → Wes Anderson narrator; etc).
- `scripts/gen-samples-and-classifier.py` — NEW. Takes brand-config.json → 72 samples via Sonnet → clickable HTML classifier. Same script for any brand.

---

## What's running

- **perps-app dev server** at `http://localhost:5179` — PID `93462` (Next.js dev server, NOT the pnpm wrapper which is 93147). Started during this session. Leave it up. Has CORS errors against `app.test.infinex.xyz` (Cloudflare Access gated) — chrome renders fine, data is placeholder. To get real TradingView chart visible: `cd ~/Sites/infinex-xyz/platform/apps/perps-app && pnpm prepare:pkg` (one-shot, copies TV bundle to public/).
- **Env vars:** `ANTHROPIC_API_KEY` is in `~/Sites/infinex-xyz/agents/nigel/.env`. Source it as:
  ```bash
  export ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY ~/Sites/infinex-xyz/agents/nigel/.env | cut -d= -f2)
  ```
- **X API bearer** in 1Password — item `ag4euuusf3olddxllmzxljsfpu`, vault `Employee`, field `password` (length 116). See `research/X_API_RECIPE.md` for full recipe. CRITICAL: use JSON parse, NOT `op --fields password`. Cached at `/tmp/xapi.json` from yesterday.

---

## Memory snapshot — read these

In `~/.claude/projects/-Users-opaque--superset-projects-comms-factory/memory/`:

- `MEMORY.md` — index of all memories
- `methodology-skill-cold-test.md` — validate skills against known-answer brands
- `methodology-out-of-placement-diagnostic.md` — sample adjacent cells to catch misroutes
- `methodology-inside-out-interview.md` — sample-recognition > abstract Qs
- `methodology-cadence-by-observation.md` — start at even cadence, calibrate from output
- `x-api-recipe.md` — bearer location + extraction
- `infinex-brand-laban-frame.md` — **SUPERSEDED** by `infinex-drive-spell-not-passion.md`
- `infinex-drive-spell-not-passion.md` — locked placement: Stable + Flow + Penetrating + Spell-Vision
- `infinex-5-tempi-locked.md` — Commanding · Practical · Sombre · Irradiant · Sociable @ 45/22/18/10/5

---

## Codex review status

Two rounds, all addressed:

**Round 1 (5 findings, all fixed):**
1. Generator's `defaultBeatsForKind` was hardcoded to Infinex — now threads through CLI's `--voice`
2. Validator's `rejectOffSpecDrive` ignored voice — now voice-aware
3. Prep hierarchy broken for both-Quick tempi — now skips non-Sus→Q tempi
4. Live-prompt Infinex assumptions in `buildSystemPrompt` — now reads from `voice.off_spec_regexes`
5. Orchestrator validated with default Infinex rules — now threads voice + beats

**Round 2 (2 findings, all fixed):**
1. Live prompt still contradicted both-Quick prep model — now explicitly handles all 3 motor patterns
2. Invalid beats silently passed (`parseBeats` cast strings to TempoName) — now validates against voice + fails loud

**Plus bonus:** pre-existing `validator.ts:248` exactOptionalPropertyTypes issue fixed.

---

## Design brief — what was sent to Design

**Zip with all attachments:** `/tmp/comms-factory-design-brief.zip` (14 MB, 21 files)
- 3 perps-app platform screenshots
- 10 anti-reference slides (the TikTok-shaped prototype — what NOT to copy)
- 1 current Remotion poster (starting point we're improving from)
- 1 sample release card JSON
- 1 palette audit doc
- 1 Infinex logo SVG

**The prompt sent** — verbatim, paste into Design chat alongside the unzipped attachments:

> I'm building the visual language for comms-factory — an automated pipeline that turns Infinex product releases into shippable video + text comms. I need a complete design system you can produce in stills + tokens, and I'll translate to Remotion myself.
>
> **Context:** comms-factory is a 4-stage pipeline: release card → generator (writes captions in Infinex's locked Mirodan voice) → validator (rejects slop / off-spec language) → orchestrator (channel routing) → renderer (Remotion) → human ship gate. I have the voice locked. I have the Remotion scaffolding working. What I don't have is a coherent visual language that (a) reads as Infinex — not generic crypto/SaaS, (b) supports 4 distinct card kinds (below), (c) layers cleanly over real perps-app screenshots, (d) has 5 motion variants matching the 5 voice tempi.
>
> **Attachments:** 3 perps-app live screenshots (root / trades-tab / market-dropdown — the market-dropdown is the visually richest frame). 10 anti-reference slides from a prototype — too TikTok-shaped, creator-mode chrome strings, two-tone gradient mismatched with single accent. DO NOT replicate these. 1 current Remotion render poster — the starting point we're improving from. Square 1080×1080, text overlay, no real platform animation yet. 1 release card JSON (`demo-card.json`) — the actual data shape my renderer receives. 1 palette usage audit — proves the Radix-discipline is real. Single accent #FE6F39 + neutral grays, no two-tone gradients, no chain-tinting. 1 Infinex logo SVG.
>
> **Voice register — visuals must support, not fight:** Infinex voice: Stable + Flow-stressed + Penetrating, Spell-Vision drive (no Passion). Werle / the Duke from Measure for Measure energy. Wise-old-guard register. NEVER urgency theatre, "act now", FOMO, "next-gen", em-dash spam, hype emojis.
>
> **5 main tempi rotated as beat sequences:**
> - Sombre (Strong/Bound — heavy held weight, slow crossfade, type lands with mass). Example: *"The wall between wallet and exchange has been load-bearing for years. We're taking it down section by section."*
> - Commanding (Strong/Direct — bold resolve, single decisive cut, block typography). Example: *"Today: spot Hyperliquid is live in Infinex. Same passkey, the orderbook your portfolio already lives in."*
> - Practical (Strong/Flexible — analytical justification, underlines, side-by-side comparisons). Example: *"Spot was harder than perps. The orderbook semantics had to feel native, not bolted on. We held it back until that was true."*
> - Irradiant (Light/Free — future-vision lift, upward motion, gentle glow, lighter weight type). Example: *"A few months from now, you won't think about which chain your assets are on when you make a trade. Your agent will."*
> - Sociable (Direct/Free — partner credit, mention-pill chrome, ecosystem warmth). Example: *"Working with @HyperliquidX, the orderbook just shows up native inside Infinex."*
>
> Visual implications: layout feels SETTLED not eager. Patient hold frames. Slow reveals. Single decisive cuts. Sub-1-second moves. Springs damped, not bouncy.
>
> **The 4 card kinds I need a visual treatment for:**
> 1. **data-card-official** — workhorse (~70%). Live product metric as protagonist. Layered over perps-app screenshot.
> 2. **data-card-wry** — same chrome, in-on-the-joke caption.
> 3. **launch-tier** — reserved (~4x/year). Cleaner, more theatrical, more breathing room. NOT gimmicky-bigger — quieter and more confident.
> 4. **split** — semantic two-color split (bridge from/to, in/out, principal/yield, spot/perp). Two halves of a single composition.
>
> **Deliverables:**
> 1. 12 storyboard stills at 1080×1080 — 3 per card kind (entry / hold / exit). PNG. Layered over the perps-app screenshots.
> 2. 5 motion-language stills — one per tempo. The motion vocabulary keys.
> 3. Token spec as TypeScript matching `{palette, type, motion, geometry}` shape. Maps directly into `src/brand-stub.ts`.
> 4. Scrim / overlay recipe for perps-app bg + Canteloupe accent legibility.
> 5. One animated mockup (Lottie / Framer Motion / CSS keyframes) for ONE card kind's entry-to-hold transition.
>
> **Constraints:** Vertical 1080×1920 is OUT. Square 1080×1080 is IN. Single accent (#FE6F39). Type locked to Inter Variable. Real perps-app UI in bg — not abstract gradients. No creator-mode chrome strings ("save this", "by the numbers", "your move", "follow . save . share"). Motion patient.
>
> **Success:** I can take your stills + tokens and translate them into Remotion compositions for all 4 card kinds in one 2-hour session.
>
> **One framing note:** Brand-factory is the upstream brand-spec source. It hasn't shipped Infinex at "voiced" status yet. Treat your tokens as the bridge — produce a system brand-factory can refine, not a locked final. Single-file swap path is `src/brand-stub.ts` in my repo.
>
> Ask me clarifying questions before producing the stills if anything's ambiguous.

**When Design returns,** port path:
- Stills → `dist/design-stills/` for reference
- Tokens → port into `src/brand-stub.ts` (replace stub values per brand)
- Motion language → expand `src/voice/types.ts` with `Tempo.visual_signature?: VisualSignature` per tempo
- Per-tempo motion config → `src/remotion/data-card-official/Composition.tsx` reads tempo-specific spring configs

---

## Open tasks (Phase 3 / 4 / polish)

1. **Terse video caption** — currently grabs lead-beat of 4-paragraph post. For video, want single-beat in brand's tersest tempo. Add `--render-tempo=<single>` flag to CLI that runs generate with `{ beats: [{ tempo: <terse> }] }`.

2. **Channel routing (Phase 3)** — orchestrator's channel-specific shaping for Twitter / scripts / longform. ~1 hour.

3. **Ship-gate preview (Phase 4)** — single HTML report at `dist/<release-id>/preview.html` showing all per-channel artifacts. Human approves manually. ~30 min.

4. **Live-DOM animation** — Remotion loads `localhost:5179` in iframe-equivalent OR multi-state stop-motion. Bigger build (~1-2 hours).

5. **Brand-factory dependency** — `src/brand-stub.ts` is a stub. When brand-factory ships Infinex at `voiced`, swap stub for loader. Single-file swap.

6. **Sample card variety** — only `data/demo-card.json` exists (kind: `launch-tier`). Need samples for `data-card-official`, `data-card-wry`, `split` kinds to smoke-test all 4.

7. **Pre-existing TS error** — none currently. Tests: 51/51 passing as of this writing.

---

## Don't-repeat traps from this session

These cost time. Future sessions can skip them.

- **`op item get --fields password` returns malformed value.** Use JSON parse instead. See `research/X_API_RECIPE.md`.
- **`/tmp/xapi.json` cached from yesterday** is usable for ~24h. Check before re-extracting.
- **Remotion `bundle()` signature** is `bundle(entryPoint, onProgress, options)` — NOT a single options object. TS complains but runtime accepts options-object too. Use the positional form to satisfy types.
- **Remotion + NodeNext imports** — webpack doesn't strip `.js` suffix. Need `webpackOverride` with `extensionAlias: { ".js": [".js", ".tsx", ".ts"] }`.
- **Don't render before brand-locked** — per CLAUDE.md, real renders blocked until brand-factory ships Infinex at `voiced`. Stub tokens are the bridge.

---

## Project rules summary (from `CLAUDE.md`)

- Pipeline contract: never collapse stages. Generator generates, validator gates, orchestrator picks, renderer renders. Each stage one job.
- Don't auto-post. Ship gate is human-approve.
- Don't add validator rules without tests. Every rule has positive + negative test cases.
- Don't decide visual specs. Brand-factory does that. comms-factory consumes.
- Don't proliferate template families. 4 card kinds. Adding a 5th is a re-architecture decision.
- Don't claim a competitor palette. See `research/visual-vocabulary.md` §06.

---

## Files Codex / next-session reviewer should pay attention to

- `src/voice/types.ts` (TempoName + motor type widening)
- `src/voice/{infinex,cream,projectjin,nigel}.ts` (4 specs)
- `src/voice/laban.ts` (added `isQuick` export)
- `src/cli.ts` (`--voice`, `--out`, `--bg` flag wiring; cmdRender end-to-end)
- `src/generator.ts` (voice-threading; off-spec from voice; both-Quick prep guidance)
- `src/validator.ts` (voice-aware off-spec; auditClaimContract; BlindTempoClassification — Codex/lint added)
- `src/orchestrator.ts` (voice + beats threaded; passes deployed_facts_used / not_said)
- `src/brand-stub.ts` (STUB — swap when brand-factory ships)
- `src/remotion/Root.tsx` + `data-card-official/Composition.tsx` + `render.ts` (Phase 2 build)
- `skills/laban-voice-for-ai-agents/SKILL.md` + `references/literary-refs-glossary.md` + `scripts/gen-samples-and-classifier.py`
- `research/X_API_RECIPE.md` (don't re-derive)

---

## End state

51/51 tests passing. Typecheck clean (pre-existing validator.ts:248 issue resolved). 4 voices working via CLI flag. Remotion renders 1080×1080 square mp4 + poster with optional platform-screenshot background. Skill fully patched + delivery-mechanism scripts in place. Methodology compounded into 4 portable memories + a literary-refs glossary.

Next Claude: start with the Design brief return (port tokens), then `--render-tempo` flag (10 min), then Phase 3 channel routing if user wants forward motion.

---

## 2026-05-15 Codex update — Nigel-style Sonnet validator loop

User context: Claude was down, so Codex continued the Infinex website/platform dogfood + validator-loop work. The important ask was to build the real Nigel-style second-model validator rather than relying on the deterministic regex/anchor scorer and calling that "blind classification."

### What changed

- `src/validator-llm.ts` — NEW. Anthropic/Sonnet validator adapter mirroring Nigel's architecture:
  - default model `claude-sonnet-4-6`
  - `auditTextLLM(text, opts)` for one-off copy/string audits
  - `auditBeatsLLM(text, beats, opts)` for beat-sequence audits
  - `auditCopySetLLM(samples, opts)` for batched website/platform copy inventories
  - tool-use contracts:
    - `audit_pass({ notes, independent_classification })`
    - `audit_fail({ voice_issues, factual_issues, feedback, independent_classification })`
    - `audit_copy_set({ items: [...] })` for batched surface audits
  - `independent_classification` emits `{ tempo, motifs, confidence, rationale }` and explicitly instructs Sonnet to classify **blind to declared_tempo**.

- `src/validator.ts` — exports `auditBeatsLLM()` as the production-parity Nigel path. The old deterministic `auditBeats()` / `classifyTempoBlind()` remain as cheap fallback/test infrastructure. Do not conflate them with Nigel's second-model loop.

- `src/cli.ts` — `validate` now supports:
  ```bash
  pnpm tsx src/cli.ts validate --llm --surface='Import wallet pitch' --job='existing product copy' 'Give your wallet Infinex superpowers.'
  pnpm tsx src/cli.ts validate --llm --beats=commanding,practical '<two-paragraph copy>'
  ```
  It prints JSON containing Sonnet's pass/fail, voice issues, factual issues, and blind classification.

- `src/__tests__/validator-llm.test.ts` — NEW. Tests the tool schema, parser, one-shot LLM audit glue, beat intent mismatch, and batched copy-set audit. Current test count after this work: **86/86 passing**.

- `scripts/dogfood-existing-copy.ts` — updated with optional `--llm` and `--ids=S01,S02` support. `--llm` now uses **one batched Sonnet call** for the selected copy set, not one call per string.

- `scripts/dogfood-homepage-tempo-fit.ts` — updated with optional `--llm` and `--ids=H01,H04,H12` support. `--llm` now uses **one batched Sonnet call** for the selected homepage set. Progress is printed to stderr so the user can see that something is happening even when stdout is redirected to Markdown.

### Generated research artifacts

- `research/infinex-app-dogfood-handover.md`
  - Colleague-facing handover for the **actual website/platform dogfood**, separate from generator/validator work.
  - Synthesizes Opaque's screen-recording/transcript notes, Gemini passes, and in-session critique into a product/design/frontend/brand backlog.
  - Priority issues: cleartext seed/private-key inputs, imported-wallet HYPE/Hyperliquid dead-end, Send-to-self blocking instead of auto-routing to Move, buried deposit networks/assets, stale campaigns, and product UI using marketing copy during utility tasks.
  - Use this as the narrative brief for a new app cleanup thread.

- `research/infinex-dogfood-triage.md` — **NEW 2026-05-15**
  - Companion to the handover. Working triage list for a team meeting.
  - Row-per-issue inventory, area-grouped (Marketing site / Onboarding / Dashboard / Earn / Switch / Perps / Send / Deposit / Gas Account / Recovery / Settings), severity + type tagged (P0–P3, SEC/BUG/UX/COPY/IA/DEAD/RES).
  - Each row has evidence (transcript timestamp + quote), suggested fix, and a "decision" column for the team to mark FIX / DEFER / SUNSET / CLARIFY / NOT A BUG.
  - Has an [Executive cut](research/infinex-dogfood-triage.md#executive-cut) (3 P0s + 22 P1s in one table) and a [Decisions to make before tactical fixes](research/infinex-dogfood-triage.md#decisions-to-make-before-tactical-fixes) section listing 15 product-level questions whose answers gate the tactical rows.
  - Built from the existing handover + a full Explore-agent pass over the ElevenLabs transcript — captures issues the prose-formatted handover would have buried.

- `research/infinex-dogfood-audit.md`
  - Source-led audit from the 45m03s ElevenLabs transcript and Gemini synthesis.
  - Platform backlog + TOV rules + copy rewrites.

- `research/infinex-dogfood-pipeline.md`
  - Deterministic dogfood pass over real shipped/platform strings.

- `research/infinex-dogfood-pipeline.llm.md`
  - Sonnet dogfood pass over shipped/platform strings.
  - Useful output: Sonnet catches strings the regex layer missed:
    - "Change the way you crypto."
    - "Give your wallet Infinex superpowers."
    - "Hang tight while we check."
    - "Nice one!"
    - "Infinex, a crypto super app."
    - "Track your positions and PnL at a glance."
  - Note: it passes some copy that is voice-clean but UX-wrong, e.g. "You can't send to your own Infinex account address. Use Move instead." This is correct: validator can judge voice; product backlog still says the flow should auto-route to Move.

- `research/infinex-homepage-tempo-fit.md`
  - Deterministic homepage tempo-fit pass.

- `research/infinex-homepage-tempo-fit.llm.md`
  - Sonnet homepage tempo-fit pass.
  - **Important review note:** the batched Sonnet run is more permissive than the earlier one-string-per-call run. It still fails obvious allergens (`H01`, `H06`, `H07`, `H13`, `H14`) but accepts many short homepage fragments as Commanding/Practical/Sociable.
  - This may be correct for taxonomy-like homepage strings, or it may be prompt softness/context contamination from batching. Claude should review this specifically before treating the pass/match counts as canonical.
  - `H12` ("Passkey to Ledger to Safe. Choose the Opsec to suit your spec.") is especially suspect. The audit declared it off-spec because the rhyme/casual "Opsec/spec" couplet may be a Passion/hype artefact, but batched Sonnet classified it Commanding/Practical and passed it. This is a good test case for whether we are preserving the art-history/Mirodan strictness or letting the model normalize slick copy.

- `research/pi-codex-notes.md`
  - Short note on Pi as optional agent harness, not required for current comms-factory work.

### What was verified

Commands run after implementation:

```bash
pnpm typecheck
pnpm test
pnpm tsx scripts/dogfood-homepage-tempo-fit.ts > /tmp/homepage.det.md
pnpm tsx scripts/dogfood-homepage-tempo-fit.ts --llm --ids=H01,H04,H12 > /tmp/homepage-sample.llm.md
pnpm tsx scripts/dogfood-homepage-tempo-fit.ts --llm > research/infinex-homepage-tempo-fit.llm.md
pnpm tsx scripts/dogfood-existing-copy.ts --llm > research/infinex-dogfood-pipeline.llm.md
```

`pnpm test`: 6 files, 86 tests, all passing.

### Important caveats for Claude review

- Do **not** delete the Mirodan / Working Action / art-history layer. The LLM validator prompt explicitly preserves:
  - Stable + Flow-stressed + Penetrating
  - Spell-Vision / no Passion
  - Commanding, Practical, Sombre, Irradiant, Sociable
  - working action motifs (`pressing`, `wringing`, `gliding`, `floating`, `punching`, `slashing`, `dabbing`, `flicking`)
  - `unknown` as a valid classification when the prose is outside character

- But the current prompt may still be too forgiving in batched mode. Review whether the validator should:
  - fail generic taxonomy fragments more often,
  - distinguish "voice-clean label" from "actually Infinex-character copy",
  - treat rhyming/casual couplets (`Opsec/spec`) as off-spec even if they can be explained mechanically,
  - output `pass_voice: true/false` separately from `product_decision: keep/change` for UI strings.

- The old regex reject layer is still present. User is worried the repo was "poisoned" by if-this-then-that reject rules from impeccable/style work. I did **not** rip those out in this pass. Safer next step is to demote brand/taste regexes after reviewing Sonnet output, while keeping hard fact-contract / unsupported-claim checks.

- The right architecture split from here:
  - Generated comms: one candidate/post -> one Sonnet validator verdict, Nigel-style.
  - Website/platform copy inventory: batch by surface/flow, not one call per tiny string.
  - Ad hoc review: `cli validate --llm` for a single string.

### Suggested next step

Have Claude review `src/validator-llm.ts` prompt and the two LLM reports side by side:

1. `research/infinex-dogfood-pipeline.llm.md`
2. `research/infinex-homepage-tempo-fit.llm.md`

The review question is not "does Sonnet produce a table?" It is:

> Does this second-model validator preserve the locked Infinex Mirodan character, including the art-history / Working Action specificity, or is it laundering generic product copy into plausible tempo labels?

### Proposed next build — intent-stripped copy generator loop

User proposed the next loop after seeing the validator shape:

> Take the existing website/platform sentence, strip it back to the underlying job/intention, then give that intention to a generator. The generator selects the most appropriate of the five Infinex tempi, writes replacement copy in that tempo, and hands the batch to the verifier.

This should be built as a separate website/platform-copy generator, not shoved into the release-card generator.

Recommended architecture:

1. **Input inventory**
   - Array of `{ id, surface, current_text, job, intent, constraints }`.
   - `intent` is the underlying thing the sentence is trying to do, not the current wording.
   - Example:
     ```json
     {
       "id": "H01",
       "surface": "homepage hero",
       "current_text": "Change the way you crypto.",
       "job": "hero",
       "intent": "State Infinex's core product thesis for a first-time visitor: one account across chains and venues.",
       "constraints": ["homepage hero", "short", "no hype", "specific product mechanic"]
     }
     ```

2. **Generator**
   - New module suggestion: `src/copy-generator-llm.ts`.
   - Input: inventory batch + `INFINEX_VOICE`.
   - Model: Opus by default if this becomes production-quality rewrite; Sonnet acceptable for cheaper dogfood.
   - Tool output:
     ```ts
     {
       id: string;
       selected_tempo: TempoName;
       tempo_reason: string;
       replacement_text: string;
       preserved_intent: string;
       changed_from_current: string;
     }
     ```
   - Must choose among the five main tempi unless it explicitly returns `needs_product_decision`.
   - Must not copy current wording if the validator already failed it.

3. **Verifier**
   - Feed generated replacements into `auditCopySetLLM()`.
   - Compare generator `selected_tempo` to verifier `independent_classification.tempo`.
   - Same Nigel consistency rule:
     - exact tempo match for generated replacement,
     - or explicit acceptable alias if we later define one.
   - If mismatch/fail: retry up to 3 attempts with verifier feedback.

4. **Report**
   - New script suggestion: `scripts/rewrite-homepage-copy.ts`.
   - Output Markdown table:
     - id
     - current text
     - stripped intent
     - selected tempo
     - replacement
     - verifier tempo
     - verifier pass/fail
     - retry count
     - notes

5. **Important constraint**
   - Do not let this become a generic "make it better" rewrite prompt.
   - The load-bearing move is intent extraction:
     - "what is this sentence trying to do?"
     - "what does the user need to understand here?"
     - "which Infinex tempo should carry that job?"
   - Then generation happens from the stripped intent, not from the flawed sentence.

This is the closest comms-factory analogue to the Nigel generator -> validator -> orchestrator loop for non-release website/platform copy.

---

# 2026-05-18 morning Handover — voice pipeline hardening + Phase 1 (LANDED — see final section)

**For:** Claude Opus (next session)
**Read this section after the sections above for full context.**

> **SUPERSEDED 2026-05-18 afternoon.** Phase 1 is done and committed. Jump to the final section "2026-05-18 afternoon — Phase 1 landed" at the bottom of this doc for current state. The text below describes Phase 1 *as it was planned* and remains a useful spec/reference.

## Summary of work done 2026-05-15 → 2026-05-18

Phases 2–5 of `research/implementation-plan-2026-05-15.md` are complete. Phase 1 (fact-grounder) is not started.

```
pnpm typecheck   → CLEAN
pnpm test        → 118/118 PASS
```

## What was built (do not redo)

### Phase 3 — `detected_drive` structured field
`src/validator-llm.ts`: `DetectedDrive` type + `DETECTED_DRIVES` array. `LLMIndependentClassification.detected_drive` required. Both tool builders include it in schema. Parser defaults to `"unknown"`. System prompt tells Sonnet to emit drive structurally.

### Phase 4 — `classification_scope: "primary" | "beat"`
`src/validator-llm.ts`: `ClassificationScope` type. `"primary"` restricts enum to `main_tempi + "unknown"` (reserve tempi fail). `"beat"` widens to include `beat_only_tempi`. `auditBeatsLLM` always passes `"beat"` automatically.

### Phase 5 — de-Infinex the generator
`src/voice/types.ts`: `CharacterSpec.structural_traits?: string[]`.
`src/voice/infinex.ts`: `structural_traits` populated with two Infinex-specific shape rules.
`src/generator.ts`: `buildSystemPrompt` is now **exported**. Reads from `voice.structural_traits` loop instead of hardcoded strings.

### Phase 2 — hybrid validation
`src/validator.ts`: `auditTextHybrid()` — regex pre-filter → LLM judge. Returns `HybridValidationVerdict`.
`src/orchestrator.ts`: `orchestrateLLM()` async orchestrator.
`src/cli.ts`: `--validator=deterministic|llm|hybrid` flag (default: deterministic).

## Phase 1 — the only thing remaining

Full spec at `research/implementation-plan-2026-05-15.md` Phase 1 (sections 1a–1i).

### Why it exists

Rewrite loop strips partner names and numbers from intent (correct anti-poisoning). Generator then invents. Fix: actively fetch ground truth from authoritative sources, thread as immutable constraints into generator and validator.

### Files to create

```
src/fact-grounder-llm.ts                       ← main orchestrator + types
src/fact-grounder/sources/platform-code.ts     ← ripgrep wrapper
src/fact-grounder/sources/partner-registry.ts  ← registry loader
src/fact-grounder/sources/infinex-pages.ts     ← HTTP fetch + 24h TTL cache
src/fact-grounder/sources/projectjin-research.ts ← subprocess → projectjin → Grok + X
src/__tests__/fact-grounder-llm.test.ts        ← all mocked, no live API
config/partner-registry.json                   ← feature→provider mapping
```

### Files to modify

`src/copy-rewrite-llm.ts` — add `groundFacts()` step before extractor, thread `verified_facts` into generator and validator.

### Core types

```typescript
export type FactCategory = "partner" | "capability" | "number" | "chain" | "product" | "url" | "date" | "ticker";
export type FactSource = "platform-code" | "platform-docs" | "partner-registry" | "infinex-page" | "web-search" | "operator-input";

export interface VerifiedFact {
  category: FactCategory;
  claim: string;       // "max perp leverage"
  value: string;       // "50"
  source: FactSource;
  source_ref: string;  // file:line or URL
  confidence: number;
  verified_at: string; // ISO date
}

export interface FactGroundingResult {
  facts: VerifiedFact[];
  unverifiable: { claim: string; reason: string }[];
  model: string;
  ground_turns: number;
  truncated?: boolean;
}
```

### Tool-loop mechanics (mirror Nigel's `nigel_voice_validator.py:531–593`)

Max 6 turns, 60s timeout per tool. Each turn: call Sonnet → check for `done_grounding` → execute research tools in **parallel** (`Promise.all`) → thread results back. Bail with `truncated: true` if no tool called in a turn.

External tools (`infinex_web_search`, `infinex_search_recent_posts`) call:
`projectjin [--profile X] --agent --json tool call <tool> --input <json>`
Auth via `PROJECTJIN_BIN` env var.

Internal tools (`grep_platform_code`, `read_platform_file`, `lookup_partner`, `fetch_infinex_page`) are new — Nigel doesn't have these.

Sink tools: `record_fact`, `mark_unverifiable`, `done_grounding`.

### Platform facts discovered

- `apps/perps-app/src/app/[[...params]]/page.tsx:73`: `maxLeverage = marketData?.maxLeverage ?? 50` — platform defaults to 50. Homepage says 40x. Homepage is WRONG.
- Hyperliquid powers perps (see `apps/perps-app/src/app/api/og/lib/hyperliquid.ts`)
- Polymarket powers prediction markets (find path in platform)
- Turnkey powers passkey custody (see `packages/wallet-security/`)

### Partner registry seed (`config/partner-registry.json`)

At minimum: perps_trading → Hyperliquid, prediction_markets → Polymarket, passkey_custody → Turnkey.

### Integration into `src/copy-rewrite-llm.ts`

BEFORE: extractIntent → generateInCharacter → auditTextLLM
AFTER:  groundFacts → extractIntent → generateInCharacter → auditTextLLM

Generator MUST still never see `current_text`. The 20 existing tests assert this. Don't break it.
After validator passes: deterministic entity-presence post-check. Missing entity → retry with feedback.

### Operator decisions (defaults chosen)

| Decision | Default |
|---|---|
| Partner registry location | `config/partner-registry.json` in this repo |
| External research | projectjin subprocess (mirrors Nigel) |
| CLI `--facts` flag | Yes — `--facts='{"perps_max_leverage":"50"}'` |
| Cache TTL | 24h for pages, 1h for grounder results |
| `infinex_search_recent_posts` | Include but secondary |

### Acceptance criteria

- [ ] `pnpm typecheck` clean, `pnpm test` ≥135 tests pass
- [ ] `rewriteCopyLoop` on H15 ("40x leverage") returns verified `"50"` from platform code
- [ ] `rewriteCopyLoop` on H17 (Polymarket) preserves "Polymarket" from registry
- [ ] Entity-presence post-check fails and retries on missing partner
- [ ] `groundFacts()` degrades gracefully when `PROJECTJIN_BIN` unset

## Don't-repeat traps

- Allergen list was intentionally removed from validator prompt. Do not re-add.
- `classification_scope: "beat"` is intentional. Don't remove.
- `buildSystemPrompt` is exported from generator.ts. Don't make private.
- Test `grepPlatform` against a FIXTURE directory — not the live platform repo.
- Generator NEVER sees `current_text`. Don't break this.
- `PLATFORM_ROOT` is env-driven. Default `~/Sites/infinex-xyz/platform`.

## How to run

```bash
export ANTHROPIC_API_KEY=$(grep '^ANTHROPIC_API_KEY=' ~/Sites/infinex-xyz/agents/nigel/.env | cut -d= -f2)
pnpm typecheck && pnpm test
pnpm tsx src/cli.ts validate --validator=hybrid "your string here"
```

## Nigel reference

`~/Sites/infinex-xyz/agents/nigel/bot/voice/`
- `nigel_voice_validator.py:531–593` — tool-loop mechanics
- `market_research.py:68–127` — projectjin subprocess

---

# 2026-05-18 afternoon — Phase 1 LANDED

All five phases of `research/implementation-plan-2026-05-15.md` are now implemented and committed.

```
pnpm typecheck   → CLEAN
pnpm test        → 143/143 PASS (8 files)
```

## What landed in this session

| Commit | Theme | Scope |
|---|---|---|
| `d45b667` | Sonnet voice validator + hybrid composition path | Phases 2–5 baseline. Hybrid validation (`auditTextHybrid`, `orchestrateLLM`, `--validator=hybrid`), structured `detected_drive` field, `classification_scope: primary\|beat`, de-Infinex generator via `structural_traits`, plus the May-15 codex baseline (`validator-llm.ts`, dogfood scripts, research artifacts, brand assets). |
| `0d7d8d0` | Fact-grounder layer + intent-stripped rewrite loop | Phase 1. `src/fact-grounder-llm.ts`, four sources (`platform-code`, `partner-registry`, `infinex-pages`, `projectjin-research`), `config/partner-registry.json`, full integration into `copy-rewrite-llm.ts`, 25 fact-grounder tests + 20 rewrite-loop tests. |
| `61bda25` | Drive column on HTML diff | Phase 3 §3d. `scripts/build-soft-vs-hardened-html.ts` now extracts `detected_drive` from validator rationale prose and renders a colored drive badge (green on-spec, red off-spec) per row in sections 1 + 2. Re-rendered `research/soft-vs-hardened.html`. |

## Plan acceptance criteria — status

From `research/implementation-plan-2026-05-15.md`:

- ✅ `pnpm typecheck` clean, `pnpm test` ≥125 tests pass (got 143).
- ⏳ `rewriteCopyLoop` on H15 returns verified `50` from platform code. *Unit-tested with mocks; live-API smoke pending.*
- ⏳ `rewriteCopyLoop` on H17 preserves Polymarket from registry. *Unit-tested with mocks; live-API smoke pending.*
- ✅ `auditTextHybrid` short-circuits on regex failure without an LLM call. *Unit-tested.*
- 🟡 HTML diff has a `drive` column. *Phase 3 §3d done structurally — column renders, H01 shows `passion` as planned. Full coverage (H02 = `spell-vision` etc.) requires a live re-dogfood so the underlying markdown carries the structured `detected_drive` field; the current rationale-parse only catches drives explicitly named in prose (mostly off-spec / FAIL rows).*
- ✅ `auditBeatsLLM` accepts beat-scope reserve tempi. *Unit-tested.*
- ✅ Other voices (`CREAM_VOICE`, etc.) don't inherit Infinex `structural_traits`. *Unit-tested.*
- ✅ Partner registry covers perps_trading (Hyperliquid), prediction_markets (Polymarket), passkey_custody (Turnkey), swap_routing (Swidge).

## What's actually pending (forward-looking)

**Live smoke tests (single command, no code changes):**

```bash
export ANTHROPIC_API_KEY=$(grep '^ANTHROPIC_API_KEY=' ~/Sites/infinex-xyz/agents/nigel/.env | cut -d= -f2)
export PLATFORM_ROOT=~/Sites/infinex-xyz/platform
# Optional, only needed for external research:
# export PROJECTJIN_BIN=$(which projectjin)
pnpm tsx scripts/rewrite-homepage-copy.ts --ids=H15,H17
```

`scripts/rewrite-homepage-copy.ts` already references H15/H17 and uses `rewriteCopyLoop`. Grounding auto-engages when `ANTHROPIC_API_KEY` is set (`enable_grounding` defaults true). Without `PROJECTJIN_BIN` the grounder uses internal sources only; that's by design.

**Smaller deferred items:**

1. ~~Update `scripts/build-soft-vs-hardened-html.ts` to render the `detected_drive` column. Plan §3d.~~ **DONE** in `61bda25`.
2. CLI `rewrite` subcommand + `--facts='{"perps_max_leverage":"50"}'` flag. Plan §"Operator decisions". Optional — the script path covers the same surface.
3. Re-run full dogfood (`scripts/rewrite-homepage-copy.ts`, `scripts/dogfood-homepage-tempo-fit.ts --llm`, `scripts/dogfood-existing-copy.ts --llm`) with fact-grounding live, then re-render `research/soft-vs-hardened.html`. This refreshes the HTML diff with full drive coverage and verifies the H15 / H17 fact-grounding acceptance criteria.
4. (Optional) update the two dogfood scripts to emit a structured `Drive` column in their markdown output so the HTML script can parse the field directly instead of from rationale prose.

**Bigger deferred items (independent tracks, not part of Phase 1):**

- Brand-factory `voiced` status before any real (non-stub) Remotion render.
- Channel routing (was Phase 3 in the old 2026-05-12 handover).
- Ship-gate preview HTML (was Phase 4 in the old handover).
- Remotion compositions for `data-card-wry`, `launch-tier`, `split`.

## Don't-repeat traps (still apply)

- Generator NEVER sees `current_text`, even on retry. The 20 copy-rewrite-llm tests assert this.
- Allergen list is intentionally removed from the validator prompt. Don't re-add — the character-based judgment is the design.
- `classification_scope: "beat"` in `auditBeatsLLM` is intentional. Don't remove.
- `grepPlatform` tests run against a fixture directory, not the live platform repo. `PLATFORM_ROOT` env override is the seam.
- `groundFacts()` degrades gracefully without `PROJECTJIN_BIN`. `ProjectjinUnavailableError` is caught inside the tool runner and surfaced to Sonnet as a tool-result string ("UNAVAILABLE: ..."), not an exception.
- `_resetRegistryCache()` exists in `partner-registry.ts` purely for tests that swap the JSON file — don't call from production code paths.
- The pre-existing 2026-05-12 handover claims 51/51 tests passing. That's stale. Trust `pnpm test` over any number in this file.

## Files reviewer should pay attention to (post-Phase 1)

- `src/fact-grounder-llm.ts` — grounder orchestrator (9 tools, 6-turn max, parallel research)
- `src/fact-grounder/sources/{platform-code,partner-registry,infinex-pages,projectjin-research}.ts`
- `src/copy-rewrite-llm.ts` — full rewrite loop with grounding wired in (`rewriteCopyLoop`)
- `config/partner-registry.json` — operator-maintained feature→provider mapping
- `src/__tests__/fact-grounder-llm.test.ts` — 25 tests including rewriteCopyLoop integration
- `src/__tests__/copy-rewrite-llm.test.ts` — 20 tests; assert generator never sees `current_text`

