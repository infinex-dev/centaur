# The Nigel pattern (reference)

Nigel is Project Jin's autonomous Polymarket-trading bot. Its voice subsystem was the first production implementation of Laban-Mirodan for AI-generated brand content. This skill generalizes that pattern.

## Nigel's character spec (for reference)

| Attribute | Value |
|-----------|-------|
| Inner Attitude | Stable |
| Stress | Flow (Bound pole) |
| Aspect | Penetrating + Light + Direct |
| Drive | Spell-Vision (Diagram D) |
| Image | "old curmudgeon at the end of the bar — weathered, often vindicated" |
| Main registers | Self-Contained (baseline) · Diffused (Adream outer when Flow fires) · Egocentric (Remote outer) |

Nigel sits at the same Mirodan placement as Infinex (both Stable + Flow + Penetrating) but with completely different cadence, vocabulary, and post architecture — placement is structure, not voice; voice emerges from cadence + few-shots + off-spec regexes.

## Architecture

```
release card / event  →  load_portfolio()  →  generator (post_draft)
                                                    ↓
                                            validator (parallel:
                                              web_search + recent_posts
                                              + intent-consistency)
                                                    ↓
                                            intent-consistency guard
                                            (Track 5b — declared
                                             register vs. blind classify)
                                                    ↓
                                            post-guards (deterministic
                                            slop / claim checks)
                                                    ↓
                                            orchestrator (max 3 regen
                                            attempts, returns or fails)
                                                    ↓
                                                  CLI
```

## File map (in Nigel's repo, for reference)

```
agents/nigel/bot/voice/
├── nigel_voice_generator.py        # generator: Draft synthesis
├── nigel_voice_validator.py        # validator: voice + factual checks
├── nigel_voice_llm.py              # orchestrator: gen → val loop, max 3 attempts
├── run_once.py                     # full pipeline: load → checkin → entry/win/loss
├── nigel_voice_checkin.py          # checkin post type (multi-position roll-up)
├── nigel_voice_epoch_open.py       # epoch-open post type (Track 9)
├── prompts/
│   ├── generator.md                # the system prompt
│   ├── validator.md                # the validation prompt
│   ├── checkin.md
│   └── (per post-type prompts)
└── (per post-type validator + orchestrator files)

agents/nigel/docs/voice/
├── character-spec-template.md      # the 6-piece-unit spec with Mirodan citations
└── laban-character-voice-runbook.md # Nigel's three registers; how to extend voice
```

## What this skill borrows from Nigel

1. **Card → Generator → Validator → Orchestrator → CLI scaffold.** Mirrored exactly in `comms-factory/src/`.
2. **Hybrid model setup.** Opus generator (taste) + Sonnet validator (cheap retry). Same recommendation for any production voice loop.
3. **MAX_ATTEMPTS = 3.** Beyond 3 regen attempts, the orchestrator should fail loudly rather than keep iterating. Avoids infinite slop loops.
4. **Intent-consistency guard (Track 5b).** The generator declares which register/tempo it intended; a blind-classifier validator independently classifies the output; the orchestrator compares. Mismatch = regen. This is the single most important guard for voice consistency over time. **Not yet wired in comms-factory** — currently uses vocab-anchor regex as a placeholder; see TODO in `src/validator.ts:auditBeats`.
5. **Post-guards as deterministic, fast layer.** Slop heuristics (cliches, listicle, AI slop, off-spec drive) are regex — never an LLM judgment. This is load-bearing for speed AND for catching slop the LLM-validator would rationalize.
6. **deployed_facts as the fact-check anchor.** Every claim in the output must trace to a claim in the card's `deployed_facts` array. Inventing claims is a hard fail.

## What comms-factory adds vs. Nigel

1. **Beat sequences.** Nigel's posts are mostly single-register (Self-Contained, with rare Diffused/Egocentric beats). Comms-factory generalizes: every post is a beat sequence, and the validator audits per-beat tempo fit + preparation hierarchy. This is necessary for longer brand posts that arc through registers (Sombre prep → Commanding land → Practical justify → Irradiant lift).
2. **Multi-character spec.** Nigel is one voice. Comms-factory's voice module is parameterized over `CharacterSpec`, so the same pipeline serves Infinex today, Project Jin tomorrow, brand-after-that next month. The voice spec is data, not code.
3. **Remotion render stage.** Nigel ships text. Comms-factory will ship text + video. Render stage uses Remotion compositions parameterized by brand spec (palette, type, motion primitives loaded from brand-factory).

## Patterns to copy verbatim

If you're building a Mirodan-grounded voice loop for ANY brand (not just Infinex), copy these from Nigel:

- The Draft object shape: `(text, intended_register, intended_motifs, deployed_card_facts, not_said)` — `not_said` is the negative space, what the post deliberately doesn't claim, used by the validator to spot smuggled claims.
- The MAX_ATTEMPTS = 3 limit.
- The hybrid model split (Opus gen + Sonnet val).
- The intent-consistency guard pattern (Nigel's Track 5b).
- The fact-check anchor (deployed_facts must contain every claim).

## What NOT to copy from Nigel

- Nigel's specific voice (Bound + Light + Direct register) — that's Nigel's, not generic.
- Nigel's Polymarket-specific tool integrations.
- The single-character assumption — the original Nigel codebase didn't expect a second brand.

## Reference path

`~/Sites/infinex-xyz/agents/nigel/` — the source. Worth reading `bot/voice/run_once.py` to see how the full pipeline assembles for a real production loop.
