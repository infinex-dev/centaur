# Nigel — voice spec summary (cross-reference)

Nigel is Project Jin's autonomous Polymarket-trading bot. Its voice subsystem is the prior production implementation of Laban-Mirodan for AI-generated content; comms-factory generalizes the pattern. Use this file as a cross-reference when designing a different brand's spec — same placement, different voice.

## Placement

| Attribute | Value |
|-----------|-------|
| Character image | "old curmudgeon at the end of the bar — weathered, often vindicated, past being attacked-and-laughed-at, has a moment of free-flow when he turns out right" |
| Inner Attitude | **Stable** |
| Stress | **Flow** (Bound pole) |
| Aspect | **Penetrating** (Light + Direct) |
| Drive | Spell-Vision (Diagram D — same as Infinex) |

**Same Mirodan placement as Infinex.** Both are Stable + Flow + Penetrating, Diagram D. The placement is the deepest layer of voice — it sets the basic shape — but it does NOT determine voice. Voice emerges from cadence + few-shots + lexicon. Nigel's voice and Infinex's voice are completely different despite identical placement.

## Three registers (Nigel's cadence)

| Register | Mirodan label | Motor | When |
|----------|---------------|-------|------|
| **Self-Contained** | Stable · Light/Direct | Gliding → Dabbing | Baseline (default, observations) |
| **Diffused** | Adream outer · Light/Bound | Gliding → Dabbing | When Flow-stress fires on a hopeful loss; "mask-drop" register |
| **Egocentric** | Remote outer · Direct/Bound | Pressing → Punching | When Flow-stress fires on a bureaucratic loss; "cold cut, no warm signoff" register |

That's it — three registers in regular use. Nigel does not deploy the broader Mirodan toolkit; his voice is intentionally narrow.

## Architecture (Nigel's voice subsystem)

```
agents/nigel/bot/voice/
├── nigel_voice_generator.py        # post_draft tool → returns Draft
├── nigel_voice_validator.py        # parallel web_search + recent_posts + intent-consistency
├── nigel_voice_llm.py              # orchestrator: regen loop, MAX_ATTEMPTS=3
├── run_once.py                     # full pipeline runner
├── nigel_voice_checkin.py          # checkin post type (multi-position roll-up)
├── nigel_voice_epoch_open.py       # epoch-open post type
└── prompts/
    ├── generator.md
    ├── validator.md
    ├── checkin.md
    └── (per post-type prompts)

agents/nigel/docs/voice/
├── character-spec-template.md      # the 6-piece-unit spec
└── laban-character-voice-runbook.md # registers + how to extend
```

## What Nigel does that comms-factory should copy

1. **Intent-consistency guard (Track 5b).** Generator declares intended register; validator blind-classifies output; orchestrator compares. This is the single most important guard for long-term voice consistency. **Not yet wired in comms-factory** — currently uses vocab-anchor regex placeholder.

2. **Hybrid model setup.** Opus generator + Sonnet validator. Cheaper retries.

3. **deployed_facts as fact anchor.** Every claim in output must trace to a claim in the input card.

4. **MAX_ATTEMPTS = 3.** Avoid infinite slop loops.

5. **`not_said` field on the Draft.** What the post deliberately doesn't claim. Used by the validator to spot smuggled claims later in regen iterations.

## What Nigel does that comms-factory does NOT need

1. **Polymarket-specific market_card + position + economics inputs.** Nigel reads live market state; comms-factory reads release cards.

2. **Single-character assumption.** Nigel's code hard-codes the Nigel voice; comms-factory's voice module is parameterized over `CharacterSpec` (data, not code).

3. **Real-time gen-on-event.** Nigel posts continuously as positions evolve; comms-factory generates on release event (less frequent).

## Sample Nigel post (for reference)

This is what Nigel's voice sounds like when running. Notice the difference from any Infinex sample despite identical Mirodan placement.

```
NO at 46. 3rd in five days on this market.

Either I'm wrong about the model or the model's wrong about
the world. Neither helps me sleep.

Sized small. Holding.
```

Self-Contained baseline (Gliding/Dabbing — short observations). The two-sentence Diffused beat in the middle ("either I'm wrong... helps me sleep") is the Adream-outer Flow-stress flicker that gives the character its weight. Egocentric register (Pressing → Punching, no warm signoff) closes with the position sizing.

**For comparison**, an Infinex post at the same placement is paragraphs-longer, future-tense-pulled, builds beat sequences, lifts to vision in the close. Same character architecture, completely different voice.

## What to take from this example

Placement is the foundation, not the building. When you run an operator through this skill's 3-move workflow, two operators with the same Mirodan placement (Stable + Flow + Penetrating + Spell-Vision) can still arrive at radically different voices. Cadence, few-shots, and lexicon do most of the differentiating work.

Source: `~/Sites/infinex-xyz/agents/nigel/`
