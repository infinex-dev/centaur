# Hyperliquid `spotMetaAndAssetCtxs` returns misaligned arrays — silent label corruption

**Status:** confirmed against live mainnet API, 2026-05-20
**Severity:** silent data corruption — wrong token labels on right volume numbers
**Affects:** any downstream tool that positionally zips the two arrays in the response. Includes HypeWatch.io, several LLM-driven analytics agents, and (until today) our own fact-grounder.

---

## TL;DR

`POST https://api.hyperliquid.xyz/info {"type":"spotMetaAndAssetCtxs"}` returns two arrays in one envelope: `meta.universe` (spot pairs, 298 entries) and `ctxs` (live price/volume readings, 336 entries). They look parallel. They are not parallel — `ctxs` includes ~38 non-spot entries interleaved with the spot ones, and shares only `ctx.coin → universe[i].name` as a stable join key. The first ~70 positions happen to align, then they drift, then every position after that is wearing someone else's volume.

If you `ctxs[i].dayNtlVlm` against `universe[i]`, you get the right numbers attached to the wrong tokens. Concretely: HYPE/USDC's $98M of real volume gets labeled as WOW/USDC, UBTC/USDC's $27M gets labeled NEKO/USDC, UZEC/USDC's $8M gets labeled QQQ/USDC, and so on down the list.

Real bug. Reproducible in one Python script. HypeWatch is publishing the wrong answer right now.

---

## Reproducing it

```bash
curl -s -X POST https://api.hyperliquid.xyz/info \
  -H 'Content-Type: application/json' \
  -d '{"type":"spotMetaAndAssetCtxs"}' > spot.json

python3 -c "
import json
d = json.load(open('spot.json'))
meta, ctxs = d[0], d[1]
universe = meta['universe']

print('universe.length =', len(universe))      # 298 spot pairs
print('ctxs.length     =', len(ctxs))          # 336 entries — 38 extras

# How many positions actually align?
aligned = sum(1 for i in range(len(universe)) if i < len(ctxs)
              and universe[i]['name'] == ctxs[i].get('coin'))
print(f'positions where universe[i].name == ctxs[i].coin: {aligned} of {len(universe)}')
"
```

Output:

```
universe.length = 298
ctxs.length     = 336
positions where universe[i].name == ctxs[i].coin: 71 of 298
```

71 of 298 — the first stretch aligns, the rest drifts. Anyone who eyeballs the API response and assumes parallel arrays falls into the trap on the very first iteration that crosses the drift boundary, and then every entry after that is wrong.

---

## The wrong vs right outputs, side by side

Same API response. Left column is the buggy positional zip (what our fact-grounder produced, what HypeWatch publishes, what shows up in every LLM that's scraped a Hyperliquid analytics tool). Right column is the correct join.

```
WRONG (positional zip)                 RIGHT (join by ctx.coin → universe.name)
─────────────────────────────          ──────────────────────────────────────────
WOW/USDC:    24h vol $98.60M           HYPE/USDC:   24h vol $98.60M  (Hyperliquid)
NEKO/USDC:   24h vol $26.99M           UBTC/USDC:   24h vol $26.99M  (Unit Bitcoin)
QQQ/USDC:    24h vol  $8.44M           UZEC/USDC:   24h vol  $8.44M  (Unit Zcash)
QUANT/USDC:  24h vol  $4.22M           UETH/USDC:   24h vol  $4.22M  (Unit Ethereum)
NBT/USDC:    24h vol  $4.08M           USDH/USDC:   24h vol  $4.08M  (USDH)
BUDDY/USDC:  24h vol  $2.85M           USOL/USDC:   24h vol  $2.85M  (Unit Solana)
PURR/USDC:   24h vol  $2.32M           PURR/USDC:   24h vol  $2.32M
RUB/USDC:    24h vol  $1.77M           USDT0/USDC:  24h vol  $1.77M  (USDT0)
FI/USDC:     24h vol  $1.66M           HYPE/USDH:   24h vol  $1.66M
KHYPE/USDC:  24h vol  $1.51M           UETH/USDH:   24h vol  $1.51M
```

Only PURR survives the bug — because `PURR/USDC` is the only **canonical** spot pair, so `universe[i].name` is the literal pair name (`"PURR/USDC"`) rather than the `@N` placeholder that every other pair carries. PURR needs no lookup, so the wrong join can't break it.

WOW, NEKO, QQQ are **real, separate Hyperliquid spot tokens with $0 actual daily volume**. They exist (indices 98, 190, 426 in `meta.tokens`) but they're long-tail HIP-1 deployments — they're not BTC/ETH/HYPE in disguise. The bug just glued them onto the wrong volume numbers.

---

## The fix

In code, change positional indexing into key-based lookup:

```ts
// Before (buggy positional zip):
const vol = parseFloat(ctxs[i]?.dayNtlVlm ?? "0");

// After (join by stable key):
const ctxByCoin = new Map(ctxs.map(c => [c.coin, c]));
const vol = parseFloat(ctxByCoin.get(universe[i].name)?.dayNtlVlm ?? "0");
```

That's it. The whole bug is one line.

---

## Who else has this bug

### HypeWatch.io (confirmed)

`https://www.hypewatch.io/launches` publishes a "Top Tokens by 24h Volume" table. As of 2026-05-20, the top three rows are:

| # | Token | Price | 24h Vol |
|---|---|---|---|
| 98 | WOW | $48.39 | $97.7M |
| 190 | NEKO | $77,190 | $26.9M |
| 426 | QQQ | $585.99 | $8.4M |

These are HYPE's price (~$48.5), UBTC's price (~$77,200), and UZEC's price (~$586). The token names and indices are real (WOW=98, NEKO=190, QQQ=426 in `meta.tokens`) — but the prices and volumes attached are from completely different pairs. Same positional-zip bug.

The server-rendered HTML literally contains the wrong data:

```
"name":"WOW", "index":98, "price":48.3925, "volume24h":97734084
"name":"NEKO","index":190,"price":77190.5, "volume24h":26947888
"name":"QQQ", "index":426,"price":585.99,  "volume24h":8433426
```

### LLM training data (likely)

Any LLM whose training data includes scrapes of HypeWatch (or similar analytics tools) has the wrong association burned in. We saw this across multiple unrelated sessions and agents — they all confidently report WOW/NEKO/QQQ as Hyperliquid's top spot markets when prompted, because that's what the contaminated public sources say. This makes the bug self-reinforcing: any new tool built with LLM assistance inherits the wrong join unless someone explicitly catches it.

### Probably others

Any aggregator that consumes `spotMetaAndAssetCtxs` and emits pair-level analytics is suspect until proven otherwise. Worth grep-checking before relying on any third-party HL spot data.

---

## Why this is structural, not "just a junior dev mistake"

Three independent codebases hit the same bug independently. The reason is in the API's shape:

1. **Same envelope returns two arrays** — `[meta, ctxs]`. Looks like "here's the catalog, here's the live readings." Implies positional alignment.
2. **First ~70 positions actually do align**, so any quick spot-check during development passes. The drift only matters once you look at the top of the volume distribution, which is where everyone ends up looking.
3. **Volumes are real** — the numbers are correct, just attached to wrong labels. So "magnitude looks right" checks pass.
4. **The join key (`ctx.coin → universe[i].name`) is only obvious if you read the API docs carefully** or notice the length mismatch. Many devs don't print lengths when integrating; they iterate and ship.
5. **The penalty for getting it wrong is silent** — no error, no warning, just plausible-looking output with wrong labels. The wrong output is undetectable without an external source of truth (the live frontend, or a different API endpoint).

Combine all five and you get an API trap that produces predictable wrong answers across independent implementations. The same data shape exists elsewhere in DeFi — Polymarket's `markets[]` + `outcomes[]`, Pendle's pool metadata + APY readings, every Solana indexer's `accounts[]` + `balances[]`. The lesson generalizes: **never positionally zip two arrays from an external API; always join by a stable key.**

---

## Verification path

If you want to sanity-check this yourself in 60 seconds:

```bash
# 1. Top spot pair by volume per the API
curl -s -X POST https://api.hyperliquid.xyz/info \
  -H 'Content-Type: application/json' \
  -d '{"type":"spotMetaAndAssetCtxs"}' | python3 -c "
import json, sys
d = json.load(sys.stdin)
meta, ctxs = d[0], d[1]
toks = {t['index']: t['name'] for t in meta['tokens']}
ctxMap = {c['coin']: c for c in ctxs}
ranked = []
for u in meta['universe']:
    name = f\"{toks[u['tokens'][0]]}/{toks[u['tokens'][1]]}\"
    vol = float(ctxMap.get(u['name'], {}).get('dayNtlVlm', 0))
    ranked.append((name, vol))
for name, vol in sorted(ranked, key=lambda x: -x[1])[:5]:
    print(f'  {name}: \${vol/1e6:.2f}M')
"

# 2. Cross-check the frontend
open https://app.hyperliquid.xyz/trade
# (volumes in the spot table should match the API ranking — they do)

# 3. Cross-check HypeWatch (should NOT match)
open https://www.hypewatch.io/launches
# (top row says WOW — that's the bug)
```

---

## Closing note

This bug burned ~3 hours of an investigation today because the wrong answer is self-consistent (real numbers, real token names, just glued together wrong) and is published by a respected community tracker, which made it look like a "second source confirming." The convergence wasn't evidence; it was three systems falling into the same trap. The fact that an LLM agent kept producing the wrong answer wasn't a hallucination — it was running buggy join code with high confidence.

Worth reporting upstream to Hyperliquid as an API ergonomics issue. The fix on their side is small (return one envelope where ctx is attached to its pair, or document the join key prominently). Until then, anyone reading `spotMetaAndAssetCtxs` should join by `coin → name`, never by position, and add a regression test that asserts the top spot pair is HYPE/USDC.
