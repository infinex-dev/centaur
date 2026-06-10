# Operator review triage — run 01KT5FTD (2026-06-03)

Source: operator notes on 18/42 candidates (`~/Downloads/operator-review-01KT5FTD.json`), against Director 42/42 pass.
Flow mapping recovered from actor prompts: **attempts 1–3 = inwards-out, attempts 4–6 = outwards-in** (not labeled on candidates — logging gap, fix below).

## Bucket 1 — Card/grounder function (the structural problems)

**1.1 Fact-hole → invention. No back-edge to the grounder.**
- Blog claimed Curve/Jupiter comparisons instead of Swidge (20+ providers) — card was HL-spot-specific, so the Actor filled the hole from training data.
- "HyperBFT consensus" name-dropping — LLM proving knowledge, provenance = training data, not card.
- Previous Infinex AMM product unnamed — Actor lacked the fact, wrote around it.
- **Fix:** fact-request back-edge. Actor (at table-work) and Director (at audit) can emit `fact_requests[]`; grounder answers; regenerate. Card stops being one-shot. Operator: "the actor should definitely be able to request more facts from the grounder... it shouldn't be constrained artificially."

**1.2 Derived numbers carry no basis.**
- "24 markets" is an editorial cut (markets >$100k daily vol), not a raw fact — there are many more markets. Copy inherited the cut as truth, and copy *count* claims are weaker than *named* markets anyway.
- **Fix:** grounder records basis/qualifier on derived numbers (`24 (markets >$100k 24h vol; total is higher)`); generation prefers naming entities over counting them.

**1.3 Feature-state-at-ship metadata missing.**
- Unified account ships WITH spot, but copy says "the unified account you already use" — assumes the reader has it. Same shape as the 7702 wallet launch (account upgrade narrative).
- **Fix:** card carries per-referenced-feature state: `new | existing | changing-at-ship`. Grounder research task: HL docs on the unified-account change.

**1.4 Internal register leaking outward.**
- "Spot V1" — it's *our* v1 implementation, not "Hyperliquid Spot V1"; version tags are changelog parlance, banned in tweets/outward channels.
- "Default market is PURR, used for testing" — internal detail, no user value. (Separate product note: default should be highest-volume market.)
- **Fix:** card carries outward product name; validator/Director treat version-tag register as channel-dependent.

**1.5 Wrapped-asset hole (subtle, important).**
- "No bridge. No wrapper." — but all HL spot assets ARE wrapped (UBTC/UETH/USOL are Unit-wrapped). The card lists the U-assets but never states they're wrapped, so the Director's narrow "contradicts the card" standard wasn't technically met. The hole is upstream: grounder never surfaced what U-assets are.
- Open question to answer in card: is HL CLOB matching onchain or offchain-settled? Needs a sourced answer, not an assumption.

## Bucket 2 — Director misses (sycophancy evidence beyond the battery)

- Near-slop read carefully and passed: "the volume is real", "the floor is already occupied", "already qualifies", "useful but not an order book", "Not a swap. Not an AMM. A real orderbook."
- Unsupported specifics (Curve/Jupiter) fall inside even the narrow "invents unsupported claims" standard — missed.
- Blog audited as a single read; should ALSO audit per-beat/paragraph so one slop paragraph can't hide in a passing whole.
- Audience question never asked: "over-indexing on 'live'... who is the audience here?" — Director has no reader-model check.
- Global gap: "the parts are there, but the whole is not." The Director as built is a *legality* gate (placement/canon/fact), not a *quality* gate. A perfect legality gate still passes joyless copy. Decide whether quality belongs in the Director or in a distinct rank/kill stage.

## Bucket 3 — Mechanical fixes

- **Validator rule (with tests):** x-thread tweet 1 must not contain a link (X algo penalty). Links go in a later tweet.
- x-thread rendering: review surfaces must show tweet boundaries (structured_json), not flattened canonical text.
- Persist `flow` on candidates (inwards-out / outwards-in) — currently only recoverable by grepping actor prompts.
- Already-found gate holes (previous session): beat-only tempo as primary read must fail `infinex_fit.legal`; re-scope actor-memory.ts:371 "do not call the tempo itself disallowed" to primary tempi only.

## Operator's framing constraint

Judging Sonnet output for slop is partially moot — production won't run generation on Sonnet. The durable findings are the *structural* ones (Bucket 1) and the *gate* ones (Bucket 2); register-level slop will shift with the model, the missing back-edge and dead gates won't.
