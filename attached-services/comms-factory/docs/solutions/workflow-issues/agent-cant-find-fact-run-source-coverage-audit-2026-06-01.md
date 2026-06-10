---
module: fact-grounder
date: 2026-06-01
problem_type: workflow_issue
component: development_workflow
severity: high
applies_when: "An agent (grounder, researcher, retrieval tool) 'can't find' a fact you're confident exists, and you're tempted to fix the first thing that looks wrong."
tags: [debugging-methodology, fact-grounder, source-coverage, retrieval, over-specialization, postmortem]
---

# Agent can't find a fact: run a source-coverage audit before iterative plumbing fixes

## Context

Diagnosing "the grounder won't surface Collector Crypt's Pokemon/One Piece/sports-card breakdown" took ~10 turns and 6+ nested fixes, each discovered reactively only after the previous one unblocked the next:

1. discovery searched the analogy (`lighter`) not the subject → LLM subject extraction
2. `fetchRef` used SSH origin → failed headless → silent fallback to `main` → HTTPS fetch
3. grep skipped `*.md` → docs never searched → `.md` in default globs
4. grep was case-sensitive + a comma-joined glob matched nothing → tolerant split + `-i`
5. chatty requirements docs crowded the research doc out of the 20-result cap → per-file cap
6. the research doc opened, but the census (offset ~7.5k) was guillotined by a 4000-char result cap → per-tool read cap
7. **the deepest one: the live partner API was never called at all** — live-API grounding was hardcoded for Hyperliquid only (recipe in the prompt + a 3-host allowlist), so every new partner started dark.

Every fix was real, but they were found one symptom at a time. The operator's ask: get to these conclusions **sooner**.

## Guidance

**When an agent can't find a fact, do a source-coverage audit FIRST — before patching the one path you happen to be looking at.** A fact lives in one or more *channels*; for each channel verify two things, in order:

1. **Reach** — is the agent actually consulting this channel? (Not "could it," but "did it, this run" — check the trace.)
2. **Capability** — even when consulted, can the tool physically return the data? Tool limits silently bound recall: file-type globs, truncation/result caps, allowlists, case sensitivity, auth.

For a fact-grounder, the channels are: **branch code · branch docs (`.md`) · partner live API · partner website/rendered page · on-chain/raw data.** Enumerate them, then for each ask reach + capability. The two questions that would have collapsed this session:

- **"Is there a live API for this, and is the agent calling it?"** — the source of truth was a live API that was 100% dark (allowlist-blocked + no general instruction to call it). *This is the highest-leverage single check.* Live API > doc snapshot > prose.
- **"What file types / how many chars does the retrieval tool actually return?"** — `.md` was excluded by default globs; the doc that *was* opened was truncated before the payload. Both are capability limits, invisible unless you look at the tool config, not the output.

**Meta-signal:** when fixes pile up sequentially on one feature, stop and ask *"am I special-casing, or generalizing?"* The Hyperliquid recipe was the tell — it worked for one partner and taught the agent nothing transferable. See [[methodology-integration-code-is-the-recipe]].

## Why This Matters

Sequential symptom-debugging has wall-clock cost O(layers) — each fix needs a full run + human turn to reveal the next. A coverage audit is O(1): one pass enumerates all channels and their reach/capability, surfacing "API never called" and "`.md` not searched" in turn 1–2 instead of turn 7. The failures here were also **silent** — runs reported success with facts grounded off the wrong stratum or missing the payload — so "it returned some facts" is never evidence of coverage. The audit replaces "is this path working?" with "is every path that could hold the answer both reached and capable?"

## When to Apply

- Any "the agent can't find X that I know exists" report (retrieval, grounding, search, RAG).
- Before the *second* plumbing fix on the same missing-data symptom — if you're about to patch fix #2, you've earned the audit.
- When onboarding a new integration/partner/source: pre-flight the coverage map so the first run isn't the thing that discovers the API is unreachable.

## Examples

**Reactive (what happened — ~10 turns):**
> miss → patch query extraction → re-run → miss → patch fetch transport → re-run → miss → add `.md` glob → re-run → miss → fix glob/case → re-run → miss → per-file cap → re-run → miss → read cap → re-run → "wait, is it even calling the API?" → generalize.

**Coverage audit (what to do — ~1 turn). Print the table, fill every cell from the trace + tool config:**

| Channel | Reached this run? | Capable of returning it? |
|---|---|---|
| branch code | grep ran? | globs/case/caps OK? |
| branch docs (`.md`) | grep ran over `.md`? | `.md` in default globs? result/read caps big enough? |
| **partner live API** | **any `fetch_json_api` call?** | **host allowlisted/in-code? auth? told to call it?** |
| partner website | rendered-page fetched? | does the page actually expose the datum? |
| on-chain / raw | queried? | aggregation feasible in a few calls? |

Any **"no" in the Reached column for a channel that plausibly holds the answer is the bug** — and it's found before writing a single patch. Here, the `partner live API` row was "no / no" and would have pointed straight at the deepest fix on turn 1.

(Captured 2026-06-01. Related: [[grounder-discovery-subject-not-keyword]], [[feedback-build-for-the-lazy-brief]], [[methodology-integration-code-is-the-recipe]]. Spec for the fix: `docs/superpowers/specs/2026-06-01-generalized-partner-api-grounding-design.md`.)
