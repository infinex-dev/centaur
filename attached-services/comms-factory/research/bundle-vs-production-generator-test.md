# Closed-loop voice test — bundle vs production generator

**Date:** 2026-05-19
**Test card:** Trezor hardware wallet support is now live in Infinex (launch-tier)
**Beat sequence (both pipelines):** Sombre → Commanding → Practical → Irradiant
**Judge:** v2 classifier at `scripts/classify-corpus.ts` (gold standard, applied blind to each beat)

## Headline result

| Pipeline | Beat-tempo match | Best candidate | Model |
|---|---|---|---|
| **Bundle + fresh subagent** | **40% (4/10)** | 3-of-4 beats | Sonnet 4.6 via Agent tool |
| **Production generator** | **69% (11/16)** | **4-of-4 beats (candidate 2)** | Opus 4.7 |

Production beats the bundle by **+29 percentage points**, and produces at least one candidate that classifies blindly as the declared character across every beat. The bundle is portable but lossy.

## Per-register breakdown

| Register | Bundle | Production |
|---|---|---|
| Sombre (opener) | **0% (0/2)** | **100% (4/4)** |
| Commanding | 67% (2/3) | 100% (4/4) |
| Practical | 0% (0/2) | 50% (2/4) |
| Irradiant | 67% (2/3) | 50% (2/4) |

## Where production wins (Sombre + Commanding)

All four production candidates opened with on-character Sombre prose. The bundle subagent's two Sombre openers both classified as Near (relational warmth contamination):

- Bundle subagent (Sombre attempt #1, classified as Near/Human): *"The keys used to live on one device and the app used to live on another. You'd bridge the gap with screenshots, seed phrases, and a small prayer."*
- Bundle subagent (Sombre attempt #2, classified as Near/Cool): *"Self-custody used to mean choosing between the wallet that held your keys and the app that could actually do something with them."*

Production openers (all classified as Sombre):
- *"Cold-key storage used to mean choosing a side."*
- *"Your hardware wallet brand used to decide which app you lived in."*
- *"Hardware wallets used to fragment your view by brand."*
- *"Cold-key users used to pick a wallet brand and pick an app to match."*

The mechanical lesson: production uses **"used to" + structural noun ("wall", "fragment", "brand decided")** with no warmth signals. The bundle's openers had warmth signals (*"small prayer"*, *"app that could actually do something"*) that pulled the classifier into Near territory.

## Where both pipelines drift (Practical + Irradiant)

Practical is the weakest beat in both pipelines. Production hits 2/4; bundle hits 0/2. Misreads land on:
- **Self-Contained** (lighter pole within Stable) — bundle's pattern
- **Sociable** (warmth via "alongside" vocab) — production's pattern
- **Unknown** — when the carving energy isn't strong enough to fix any tempo

The one production candidate that hit Practical (candidate 2) used the canonical anchor *"The hard part was..."* verbatim:

> *"The hard part was making both devices feel native, not bolted on. Funds stay on the device; Infinex displays them and routes transactions."*

The two production candidates that missed Practical described the fact thoughtfully without using the canonical anchor — and the classifier read them as Sociable or Unknown.

## Why production wins (mechanical reasons)

1. **Opus 4.7** vs Sonnet — more spec adherence per token.
2. **Structured per-beat user prompt** explicitly tells the generator which beat is which (*"1. sombre (pressing → punching) — set up the wall we are taking down"*). The bundle's "use a beat sequence" guidance is weaker.
3. **Vocab anchor arrays** in `src/voice/infinex.ts` drive specific phrasing patterns. The bundle has them as prose lists, less enforceable.
4. **Channel constraint** (280 chars for X) forces tighter, declarative writing. Kills the rambling that pulls registers off-pole.
5. **Per-candidate retry with validator feedback** is available in the production pipeline. The bundle test was single-shot.

## Implications

### For the Slack bot

Use the production pipeline, not the raw bundle. Wire `generate()` from `src/generator.ts` as the backend. Pass `ReleaseCard` → get N candidates → orchestrator picks best → return to channel. The validator gate is already built in. Production-level 69% beat match means most candidates need 1-2 retries to pass the orchestrator's gate — already supported via the `feedback` field.

### For external licensing (someone else's clanker)

Ship the bundle with honest *"40-50% beat precision, family + destination land correctly"* expectations. Add to the bundle:
- Sharper Sombre opener exemplars with explicit "structural framing, no warmth" note
- A "Practical = carved-tradeoff, not described-tradeoff" pole-pair sanity check
- "Each opener MUST use one of these vocab anchors verbatim or close paraphrase"

These three additions should narrow the gap. Re-run this test after to confirm.

### For the spec itself (`src/voice/infinex.ts`)

Practical's `example_lines` and `opening_shapes` need more *Wringing → Slashing carving* energy. Currently:
- `"Spot was harder than perps. The orderbook semantics had to feel native, not bolted on. We held it back until that was true."`
- `"Yield aggregators have existed for a while. Strategies that auto-rebalance have existed. What didn't exist: a vault where the agent making the decisions can see your full portfolio."`

Both work, but they read more *thoughtful-description* than *carving*. Add 2-3 more openers that visibly enact the tradeoff:
- `"We held it back. The X had to feel native, not bolted on."`
- `"The hard part wasn't the integration. It was making the rest of the app behave as if X were always the default."`

The second one is from the bundle test's Candidate 3 (originally classified as Self-Contained, not Practical — but with the right modification could work).

### For Irradiant

The 50/50 production hit rate on Irradiant is the next thing to investigate. Candidate 3's *"A few months from now, the brand on the device won't shape where you actually work"* classified as Unknown — the future-warmth structure is there but classifier didn't lock. Worth checking whether the closing position of the beat (after Practical) is dragging the classifier toward Practical-extension reads.

## What this test does NOT yet answer

- **Cross-card-kind portability:** we only tested launch-tier. The bundle/production gap may differ on data-card-official / split / wry-tweet.
- **Cross-model portability:** we tested Sonnet (bundle subagent) vs Opus (production). Codex / GPT-5 / Gemini would tell us whether the bundle is universally portable or only Claude-portable.
- **Multi-turn validator feedback:** production supports retry with feedback; we ran single-shot. The 4/4 candidate suggests retries would push the rate higher.
- **Whether 69% beat-match → human "ships it"** correlation holds. The classifier judges blind tempo; a human reader may still feel one of the 50% candidates as on-character. Worth eyeballing the candidates manually as a sanity layer.

## Artifacts

- Test card: `cards/trezor-2026-05-19.json`
- Bundle subagent corpus: `research/bundle-test-corpus.md`
- Bundle classifier output: `research/bundle-test-classifications.json`
- Production generator output: `research/trezor-production-generator.json`
- This comparison: `research/bundle-vs-production-generator-test.md`
