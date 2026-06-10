# Installing the laban-voice-for-ai-agents skill

This skill lives in `comms-factory/skills/laban-voice-for-ai-agents/`. To make it available to agents (Claude Code, Codex, or other Skills-compatible agents):

## For Claude Code

```bash
# Copy or symlink into your user skills dir:
ln -s /Users/opaque/.superset/projects/comms-factory/skills/laban-voice-for-ai-agents \
      ~/.claude/skills/laban-voice-for-ai-agents

# Verify it loads:
ls ~/.claude/skills/laban-voice-for-ai-agents/SKILL.md
```

Then any Claude Code session that mentions "Laban", "Mirodan", "voice spec", "tempo", or related triggers will auto-load it via the Skill tool.

## For Codex / OpenAI tooling

Codex reads skills from `~/.codex/skills/`. Same pattern:

```bash
ln -s /Users/opaque/.superset/projects/comms-factory/skills/laban-voice-for-ai-agents \
      ~/.codex/skills/laban-voice-for-ai-agents
```

## For other agentskills-compatible tools

The format follows the agentskills.io standard: a directory containing `SKILL.md` + supporting files. Drop the directory into the agent's skills path or use:

```bash
npx skills add /Users/opaque/.superset/projects/comms-factory/skills/laban-voice-for-ai-agents
```

(via the `skills` CLI from vercel-labs — same tool we used to install Remotion's skill pack).

## Distributing as a zip

If you want to hand this to someone else or to an agent running in a different environment:

```bash
cd /Users/opaque/.superset/projects/comms-factory/skills
zip -r laban-voice-for-ai-agents.zip laban-voice-for-ai-agents
```

The recipient unzips it into their agent's skills directory.

## What's NOT in this skill

The 50MB Mirodan PhD PDF is too large to include. The skill includes a **synthesis** (`references/mirodan-master.md`, ~70KB, 462 lines of curated extracts with page citations). The full PDF is at `~/Downloads/Mirodan-PhD-1997-Vol2.pdf` on Infinex machines.

For external recipients, the PDF is available through the British Library catalogue (Mirodan, Veronica · "Yat Malmgren's movement psychology" · 1997 · University of London PhD). The synthesis here is sufficient for ~95% of voice-spec work.

## Running the generator/validator loop

After cloning the skill, the generator + validator code lives at `comms-factory/src/`. To run it:

```bash
cd /Users/opaque/.superset/projects/comms-factory
pnpm install                                    # one-time setup
tsx src/cli.ts tempi                            # list the 12 tempi
tsx src/cli.ts demo                             # run the Hyperliquid demo
tsx src/cli.ts validate "your text here"        # ad-hoc validation
tsx src/cli.ts generate data/demo-card.json     # full generation pass
```

Set `ANTHROPIC_API_KEY` to get live Anthropic-generated candidates. Without it the generator runs in stub mode using the few-shot library from each tempo — useful for testing the pipeline end-to-end.
