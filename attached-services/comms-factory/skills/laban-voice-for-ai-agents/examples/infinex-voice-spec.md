# Infinex — locked voice spec (worked example)

This is the spec that came out of the 3-move workflow for Infinex. It is the canonical worked example for this skill. Drop into a new project as `src/voice/infinex.ts` to see the full TypeScript form.

## Move 1 output — placement

| Attribute | Value | Why |
|-----------|-------|-----|
| Character image | "the shipwright building the boat to the new continent" / "the cartographer of the agent future" / "the quiet architect" | All three are operator-pitched candidates — operator to lock one |
| Inner Attitude | **Stable** | Ships products (perps frontend, swap aggregator, MCP server) — vision is grounded in delivered infrastructure |
| Stress | **Flow** (Bound pole) | Voice yields emotionally in moments ("we got the sale wrong"), not time-pressured |
| Aspect | **Penetrating** | Thinking-focused — Karpathy-of-crypto-agents register, intellectually probing |
| Drive primary | Spell | Operator: "Infinex is not passionate, it's Spell. Flow-stressed Stable has Spell." |
| Drive secondary | Doing | Stable's formative pair is Spell / Doing |
| Drive introvert | Passion | Hidden lining in Diagram D |
| Drive extravert | Vision | Future-tense agent-thesis posts are the visible projection |
| Drive axis | Spell→Vision (Diagram D — Stable + Flow + Penetrating) | Resting Spell projects through Vision |
| Off-spec visible Drive | Passion | Time-pressure, urgency theatre, FOMO foreground Passion — off-spec as surface |

Mirodan precedents for this placement: **the Duke** (Measure for Measure — a ruler who watches from disguise) and **Werle** (Wild Duck — businessman whose competence is real but who carries weight underneath).

## Move 2 output — tempi rotation + cadence

| Tempo | Inner combo | Motor pair | Role |
|-------|------------|-----------|------|
| **Irradiant** | Adream outer · Light/Free | Floating → Flicking | **45%** — vision-pulled default mood |
| **Commanding** | Stable · Strong/Direct | Pressing → Punching | **22%** — decisive ship-day announcements |
| **Sombre** | Adream outer · Strong/Bound | Pressing → Punching (bound) | **18%** — weight-of-conviction openers |
| **Sociable** | Remote outer · Direct/Free | Gliding → Dabbing | **10%** — partner credit, ecosystem warmth |
| **Practical** | Stable · Strong/Flexible | Wringing → Slashing | **5%** — rare thesis essay |

Beat-only (toolkit, ~once a quarter): Self-Contained, Receptive, Overpowering, Diffused, Egocentric, Altruistic, Unsociable.

## Move 3 output — beat sequences + off-spec rules

### Beat sequences per release-card kind

| Kind | Beat sequence | Why |
|------|--------------|-----|
| `launch-tier` | Sombre → Commanding → Practical → Irradiant | Pressing prep → Punching release → Wringing/Slashing justify → Floating/Flicking lift |
| `data-card-official` | Sombre → Commanding → Irradiant | Short arc: prep → land → lift |
| `data-card-wry` | Irradiant → Commanding | Future-state opener with dry fact close |
| `split` | Practical → Commanding → Irradiant | Explain split semantically → land → future-state |

### Off-spec regexes

```typescript
[
  {
    name: "time-pressure",
    re: /\b(act\s+(?:now|fast)|hurry|last\s+chance|don't\s+miss|limited\s+time|today\s+only|right\s+now)\b/i,
    reason: "foregrounds Passion as visible projection — off-spec for Infinex's Spell→Vision axis",
  },
  {
    name: "fomo-urgency",
    re: /\b(FOMO|missing\s+out|don't\s+sleep\s+on|catch\s+up\s+before|before\s+everyone\s+else)\b/i,
    reason: "FOMO markers — off-spec",
  },
  {
    name: "hype-theatre",
    re: /\b(buckle\s+up|let's\s+go!?|wagmi|gm\s+gm|massive\s+update|huge\s+news|crazy\s+news)\b/i,
    reason: "hype-theatre vocab — Passion-drive activator",
  },
]
```

## Worked sample: launch-tier post

Card: `Spot Hyperliquid is now live in Infinex`. Beats: Sombre → Commanding → Practical → Irradiant.

```
[Sombre · Pressing prep]
The wallet and the venue used to be separate things.
We've been taking that wall down section by section.

[Commanding · Punching release — fed by Sombre's Pressing prep]
Today: spot Hyperliquid is live in Infinex.
Same account, same passkey, orderbook where your portfolio already lives.

[Practical · Wringing → Slashing]
Spot was harder than perps. The orderbook semantics had to feel native, not bolted on.
We held it back until that was true.

[Irradiant · Floating → Flicking close]
A few months from now, you (or your agent) will route through this without thinking about it.
That's the move we're making.
```

The Sombre opening *prepares* the Commanding's Punching by pre-pressing the same motor. Practical works through the tradeoff explicitly. Irradiant lifts to future-state. Four beats, four motors, one character.

## What this spec rejects

The validator should fail any post containing:
- Cliches (game-changer, unlock, paradigm, seamless, etc.)
- AI-slop vocabulary (innovative, cutting-edge, revolutionary, thrilled to)
- Time-pressure / Passion-drive markers (act now, hurry, FOMO, wagmi, let's go)
- Listicle openers (N reasons, why X matters)
- Antagonism toward named competitors (coinbase + slow, metamask + clunky)
- Claimed competitor palettes (#2E5CFF Polymarket, #AB9FF2 Phantom, etc.)
- Em-dash spam (> 2 per 280 chars)

Beat-sequence audit additionally fails:
- Cold Quick-action openers without Sustained prep (Punching without Pressing → degrades to Press)
- Paragraphs whose tempo doesn't match the declared beat (vocab-anchor check; intent-consistency-vs-blind-classify TODO via Sonnet call)

## Cadence note

The 45/22/18/10/5 distribution is approximate and currently aspirational — Wave 1.5 data shows Infinex's actual recent posts mix all over. The spec is the target shape, not the historical shape. Validator does not enforce cadence at the post level (that's a meta-statistic), but the generator's prompt nudges toward it.

## Source

This spec was produced through approximately 8 conversation moves in `comms-factory` development on 2026-05-12, with the following corrections from operator feedback:

1. **Move 4 correction:** Initial proposal of "Self-Contained as baseline" was wrong — operator pointed out Infinex doesn't rest at Stable home; it lives in Flow-stress beats. Cadence inverted.
2. **Move 5 correction:** Operator identified Drive lock — "Infinex is not Passion, it's Spell." This ruled out Adream Space-stressed Radiating (mixes Spell+Passion) and locked Stable + Flow Diagram D.
3. **Move 6 correction:** Operator pointed out tempi shift WITHIN a single post, not one-tempo-per-post. Post architecture switched from "single-tempo monolith" to "beat sequence." Working Action preparation hierarchy became load-bearing.

Future operators using this skill should aim to arrive at an equivalent spec in 3 moves total, with the operator's answers to the Move 1-3 interview questions doing the work that these 8 conversation moves did.
