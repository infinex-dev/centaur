# Infinex brand-vocab archive (pre-Laban-pure)

## What this is

This is the brand-vocabulary content that was stripped from `src/voice/infinex.ts` on **2026-05-28** when the voice spec was rewritten to be **Laban-pure** (movement-quality only, no operator-prose). Each entry below shows the `feel`, `opening_shapes`, `vocab_anchor`, `signoff_moves`, `example_lines`, and `lining` fields that used to live on each tempo in the voice spec.

**Source commit:** `4598e40` ("Lock Infinex voice with Want, 5 tempi, validation criterion") — the state of `src/voice/infinex.ts` immediately before the 2026-05-28 Laban-pure refactor.

## What this is NOT

- **NOT load-bearing.** Nothing in the codebase reads this file. The voice spec at `src/voice/infinex.ts` no longer contains these fields.
- **NOT canonical.** This is operator-derived prose written before the Laban-pure principle was established. The `feel` lines, the `opening_shapes` templates, and the `example_lines` are operator-coined brand vocabulary, not Mirodan canon.
- **NOT the voice itself.** The locked Infinex voice is now in `src/voice/infinex.ts`: factor_shape + canonical_shorthand + motor pair per tempo, plus the brand-objective layer (super_objective, character_image, structural_traits, historical_lore, validation_criterion). Anything you see below is one layer down from the spec — closer to "brand samples / writing references" than to "voice definition."

## Why it was stripped

Per the architectural rule established 2026-05-28 (see `memory/voice-spec-laban-pure.md`):

> Voice spec files contain **only Laban/Mirodan movement quality**. Brand-specific lexicon belongs one layer down — in objective examples, per-card scene inputs, or `brands/<brand>/04-voice/samples/`.

The fields below mixed two layers:
- **Layer 1 (movement quality)** — what a tempo IS in canonical Mirodan terms. Locked. Brand-agnostic.
- **Layer 2 (brand vocabulary)** — what licensed phrases the Infinex character uses to express the tempo. Brand-specific. Belongs at the brand-samples layer, not in the framework spec.

The Bridge.xyz contamination audit (`research/audit-of-bridge-audit-2026-05-28.md`) showed how Layer-2 content in the voice spec became a gravitational source for caption contamination — Sombre's `vocab_anchor: ["section by section", "load-bearing"]` and `opening_shapes: ["The wall between <A> and <B> has been load-bearing for <duration>"]` directly seeded the "wall" metaphor that overran 28/30 candidates across the Bridge run.

## Where this content should live

If/when `brands/infinex/04-voice/samples/` is created (per `CLAUDE.md`: "brand-factory owns voice samples, comms-factory consumes them"), this content is a candidate to migrate there as **sample reference material**, not as load-bearing spec. Treat each `example_lines` block as one sample document per tempo.

Specifically:
- `example_lines` arrays → could become `samples/<tempo>/<sample-name>.md` files
- `opening_shapes` → could feed a brand-writer style guide
- `vocab_anchor` → could feed brand-specific lexicon notes (but flag: these contributed to the Bridge contamination; treat with caution)
- `feel` → operator-prose; archive for historical reference only
- `lining` → useful as Mirodan §7.1 worked examples per tempo

If the samples directory never materializes, this file is just an archive — discoverable in case future operators want to know what was stripped and why.

---

## The stripped content

### Main tempi (5)

#### commanding

```
inner_combo: "Stable · Strong/Direct"
feel: "Sustained pressure into decisive landing. Locked, decisive, no ornament. The institutional drop. Reads as a ruler issuing a position."
opening_shapes: [
  "Today: <fact>.",
  "<fact> is live.",
  "We've <verb>ed <noun>.",
]
vocab_anchor: ["live", "today", "shipped", "open", "ready", "now available"]
signoff_moves: [
  "<destination url>",
  "<no signoff — the fact ended it>",
]
example_lines: [
  "Today: spot Hyperliquid is live in Infinex. Same account, same passkey, the orderbook where your portfolio already lives.",
  "Private Send beta is live for all users. Send crypto. Without exposing your financial history.",
]
lining: "Certainty earned before the announcement. The drop is calm because the work is done — the banker-trailblazer has known this would ship since before the reader knew to want it. The Outer is the position; the Lining is the absence of performance."
```

#### practical

```
inner_combo: "Stable · Strong/Flexible"
feel: "Working through complexity into a carved answer. Comfortable with tradeoffs, willing to take you through the reasoning. Karpathy's essay mode. Long-form."
opening_shapes: [
  "Here's what's interesting about <X>:",
  "We keep coming back to <Y>.",
  "<fact>, and it's worth being precise about what changed.",
]
vocab_anchor: [
  "tradeoff", "the actual question is", "this only makes sense once you",
  "we held it back until", "the hard part was", "what doesn't exist:",
]
signoff_moves: [
  "<open question list>",
  "<single declarative — the line they will quote>",
]
example_lines: [
  "Spot was harder than perps. The orderbook semantics had to feel native, not bolted on. We held it back until that was true.",
  "Yield aggregators have existed for a while. Strategies that auto-rebalance have existed. What didn't exist: a vault where the agent making the decisions can see your full portfolio and where you can read why it made each move.",
]
lining: "The patience of someone who has earned the right to be slow. The Outer is essay-mode reasoning through tradeoffs; the Lining is 'I will not perform precision — I will be precise, and you will read at my speed.' No anxiety about losing the reader."
```

#### sombre

> NOTE: This entry contains the "wall" / "load-bearing" / "section by section" content that drove the Bridge.xyz contamination. See `research/audit-of-bridge-audit-2026-05-28.md`. If migrating to samples/, flag this as high-risk for re-contamination — it is the gravitational source.

```
inner_combo: "Adream outer · Strong/Bound"   ← NOTE: "Adream outer" was incorrect; Adream is an Inner Attitude
feel: "Weight-of-conviction. Slow. Carries gravity. Used when the thesis lands with effort — 'we know this is coming and it's a lot.' Werle/Duke energy. Pairs with Commanding as the Pressing prep before a Punching release."
opening_shapes: [
  "<X> used to be <Y>.",
  "We don't think <Y> survives.",
  "There's a version of <domain> coming where <Z>.",
  "The wall between <A> and <B> has been load-bearing for <duration>.",
]
vocab_anchor: [
  "used to", "becomes", "stops being", "the gap between",
  "section by section", "load-bearing", "another section",
]
signoff_moves: [
  "<single image-line, not a CTA>",
  "<one declarative the post settles into>",
]
example_lines: [
  "The wallet and the venue used to be separate things. We've been taking that wall down section by section.",
  "Adding a new chain used to be its own thread. There won't be a follow-up thread explaining how it works. The dropdown is the announcement.",
  "Yield used to be a screen of APYs you'd squint at for thirty seconds and then guess.",
]
lining: "The trailblazer's awareness that this was once unthinkable. The Outer names a wall coming down; the Lining is 'the old wall used to keep me out too — I remember when this couldn't have been said.' Weight without nostalgia."
```

#### irradiant

```
inner_combo: "Adream outer · Light/Free"   ← NOTE: "Adream outer" was incorrect
feel: "Sustained lightness into buoyant release. Vision-pulled, generous. The future-warmth beat. Future-tense agent thesis lands here. The 50% default mood — most of Infinex's voice lives here."
opening_shapes: [
  "A few months from now, <future-state>.",
  "What this lets you do:",
  "In a couple of years you won't <thing-you-currently-do>.",
  "Your agent now <verb>s.",
]
vocab_anchor: [
  "agent", "your own", "without thinking about it", "stop thinking about which",
  "won't remember", "one step closer", "the move we're making",
]
signoff_moves: [
  "<short, gestural, optimistic>",
  "<that's the move we're making>",
  "<one-line future-state image>",
]
example_lines: [
  "A few months from now, you (or your agent) will mostly use one app. You won't think about which chain your coins are on.",
  "Your agent now picks your yield strategy. You set the constraints — max risk, allowed venues, how often to touch it — and it goes.",
  "In a couple of years you won't remember which chain your assets were on when you made a trade.",
]
lining: "The patient gardener. The Outer is the buoyant future-state image; the Lining is 'I'm not selling you the future — I've been planting it. This is the part where some of it comes up.' Optimism that already happened, only the reader hasn't caught up yet."
```

#### sociable

```
inner_combo: "Remote outer · Direct/Free"
feel: "Smooth approach with light social touch. Partner credit, ecosystem warmth. Used when the launch genuinely depends on a partner, or when Infinex is acknowledging being part of a larger thing."
opening_shapes: [
  "Working with <@partner>, <fact>.",
  "<fact>. Thanks to <@partner> for <contribution>.",
  "Built with <@partner_1>, <@partner_2>, and others — <result>.",
]
vocab_anchor: ["working with", "together", "alongside", "thanks to", "built with", "we partnered with"]
signoff_moves: [
  "<credit/thanks to partner>",
  "<no link, the credit is the close>",
]
example_lines: [
  "Working with @HyperliquidX, spot trading is now native inside Infinex. One passkey, one account, the orderbook just shows up.",
  "Built across @aave, @MorphoLabs, @pendle_fi, @maple_finance, and others — strategies that route across protocols rather than picking one.",
]
lining: "Recognition that the work is bigger than one company. The Outer is partner credit; the Lining is 'we are doing this together because it cannot be done alone, and that is dignified, not regrettable.' Gratitude without obligation."
```

### Beat-only tempi (7)

#### self-contained

```
inner_combo: "Stable · Light/Direct"
feel: "Confident-light. Doesn't push. Says the obvious well. Karpathy's resting register — but for Infinex this is a BEAT not a baseline. Used for one-off informational drops where vision and conviction aren't needed."
opening_shapes: ["Something to note:", "Quick one:", "<label>:"]
vocab_anchor: ["imo", "fwiw", "small thing"]
signoff_moves: ["<TLDR>", "<no signoff>"]
example_lines: [
  "Small thing: scheduled maintenance window for the perps engine, Sunday 02:00 UTC, ~10 min downtime expected.",
]
lining: "The comfort of not making every announcement load-bearing. The Outer is the small informational drop; the Lining is 'not everything has to mean something — some of it is just maintenance, and that's fine.' Discipline of refusing to inflate."
```

#### receptive

```
inner_combo: "Stable · Light/Flexible"
feel: "Open, generous, willing to incorporate. The 'we hear you' beat. Used after a community correction or in response to specific feedback."
opening_shapes: ["You've been telling us <X>.", "You asked for <Y>."]
vocab_anchor: ["we hear you", "you were right", "you've been telling us"]
signoff_moves: ["<small commitment>", "<tell us what's next>"]
example_lines: [
  "You've been telling us yield management was where Infinex felt thin. AI-augmented yield vaults are live.",
]
lining: "Leadership-from-incorporation. The Outer is 'we hear you'; the Lining is 'I was right to listen, you were right to push, the work absorbs both' — no defensiveness, no self-deprecation. The credit goes outward without weakening the position."
```

#### overpowering

```
inner_combo: "Adream outer · Strong/Free"   ← NOTE: "Adream outer" was incorrect
feel: "Full-conviction-with-emotion. Vision-pulled with emotional weight visible. Quote-worthy. Risks reading manifesto-y — use sparingly."
opening_shapes: ["We've been saying this for years and <X>.", "Here's the thing nobody else is willing to call:"]
vocab_anchor: ["nobody else", "for years", "we said", "going to keep doing this"]
signoff_moves: ["<a declarative the reader can quote>"]
example_lines: [
  "We said wallet-and-exchange would collapse into one surface and nobody was going to like it. Spot Hyperliquid is live in Infinex.",
]
lining: "Conviction earned from years of being early. The Outer is the manifesto-grade declarative; the Lining is 'we said this for years — we're not going to perform self-effacement now that it's coming true.' Quote-worthy because the cost of being right was real."
```

#### diffused

```
inner_combo: "Adream outer · Light/Bound"   ← NOTE: "Adream outer" was incorrect
feel: "Quiet vision-arrival. Used for post-launch reflection — the mood after the boat actually crosses the river. Not the launch itself; the day after."
opening_shapes: ["It turns out <X>.", "We noticed <Y>."]
vocab_anchor: ["turns out", "noticed", "settled", "found", "ended up"]
signoff_moves: ["<no signoff — the observation is the close>"]
example_lines: [
  "It turns out the audit layer is the part that makes the AI feel like a tool rather than a black box.",
]
lining: "The surprise the trailblazer still allows herself. The Outer is the post-launch reflection; the Lining is 'I built this and even I didn't know it would feel like this' — wonder permitted only after the work is shipped, never before."
```

#### egocentric

```
inner_combo: "Remote outer · Direct/Bound"
feel: "Cold position-take. 'We don't care, we're right.' Used to draw a line in the sand — once a quarter at most. Risks reading mean."
opening_shapes: ["<single declarative — no preamble>"]
vocab_anchor: ["abstract nouns, no warmth"]
signoff_moves: ["<none — the post ends mid-thought>"]
example_lines: [
  "Yield without an agent is a hobby.",
]
lining: "The discipline of refusing the genre. The Outer is the cold line-in-sand; the Lining is 'I will not pretend the bad thing is the good thing — the line stays where it is.' Contempt earned and then cooled into discipline, never bouffon-rage."
```

#### altruistic

```
inner_combo: "Remote outer · Flexible/Free"
feel: "Warm-distant. Architect speaking to future inhabitants of a building still being finished. 'For you' framing."
opening_shapes: ["We've been building <X> so <you> can <Y>."]
vocab_anchor: ["for", "so that", "so you can stop", "you wouldn't have to"]
signoff_moves: ["<hand-off to reader>", "<that's the entire flow>"]
example_lines: [
  "We've been building Swidge so you can switch into a new L2 without thinking about how. MegaETH is the latest one in.",
]
lining: "The architect speaking past her own finishing. The Outer is the for-you hand-off; the Lining is 'you don't have to thank me for this — you have to use it.' Warmth without ego, the work transferred outward."
```

#### unsociable

```
inner_combo: "Remote outer · Flexible/Bound"
feel: "Withdrawal-as-discipline. Doesn't argue the discourse, just leaves it. Sharper than Egocentric because it acknowledges the noise exists. Best paired with a separate Sociable post the same day."
opening_shapes: ["While the timeline argues about <X>, <Y>."]
vocab_anchor: ["meanwhile", "elsewhere", "we'll be over here"]
signoff_moves: ["<the post is the signoff>"]
example_lines: [
  "While the timeline debates which L2 has the best meta-narrative, Swidge now bridges into MegaETH from any chain. We'll see you when you actually want to use it.",
]
lining: "The refusal to argue downstream of the work. The Outer is the withdrawal-as-discipline; the Lining is 'the discourse is downstream of the work — I'm staying upstream.' Sharper than Egocentric because it acknowledges the noise exists, then declines."
```

---

## Recovery

If something here ever needs to be restored to the voice spec, ask first: is the field locked-canon (movement quality, factor names, motor pairs) or operator-prose (feel descriptions, brand metaphors, sample lines)? The first goes back in `src/voice/infinex.ts`; the second goes to `brands/infinex/04-voice/samples/` or stays archived.

Full file pre-refactor: `git show 4598e40:src/voice/infinex.ts`
