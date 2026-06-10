# Pi / Codex Notes

Date: 2026-05-15

## What Pi Is

Pi is an agent harness for coding work. It is not a model. It is a terminal/UI layer that can route work to model providers, expose tools, run commands, edit files, and support extensions.

People saying "use Pi with Codex" usually mean one of two things:

- Use OpenAI/Codex models through Pi as the harness.
- Use the `pi-codex` extension so a Pi session can ask Codex to review, rescue, or sanity-check work.

Useful references:

- Pi repo: https://github.com/earendil-works/pi
- Pi package index: https://pi.dev/
- `pi-codex`: https://pi.dev/packages/pi-codex

## Why It Might Matter

Pi could be useful if we want one configurable workspace that can route cheap tasks to cheaper models and reserve stronger models for high-risk implementation or review.

Likely good fits:

- Cheap research loops.
- Multi-provider experiments.
- Codex-as-reviewer from another agent shell.
- Long-running repo audits where the harness matters more than the exact model.

Poor fits right now:

- Anything blocking comms-factory's current ship path.
- Replacing the release-card -> generator -> validator -> orchestrator -> renderer pattern.
- Solving brand/spec uncertainty. Pi cannot replace brand-factory decisions.

## Current Recommendation

Do not introduce Pi into comms-factory yet.

For the Hyperliquid Spot launch work, keep the path simple:

1. Research the actual surfaced Hyperliquid spot markets and source facts.
2. Encode only verified claims in the release card's `deployed_facts`.
3. Generate tweet/video copy through the existing generator.
4. Let the validator reject unsupported claims and off-register language.
5. Render via Remotion using repo tokens/stubs until brand-factory's Infinex spec is locked.

Revisit Pi only if we need a cheaper standing research harness or a multi-provider agent workflow.
