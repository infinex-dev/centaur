# Codex spec — Package 2 Part A: actor changelog template + format-compliance gate

**Context:** makes the comms pipeline emit a **drop-in house-format changelog** instead of freeform prose I reshape by hand. The launch copy is already shipped; this is a pipeline capability. (Part B — the PR-emission agent — is held for operator design review; design in `research/design-package2-pr-emission-2026-06-05.md`.)

## Ground rules for Codex
- **Working-tree discipline (do this):** if the tree is dirty when you start, commit it first as a checkpoint; when your work is done AND verification passes, commit your changes as ONE commit (e.g. `pkg2-A: actor changelog template + format-compliance gate`). Do NOT merge, push, or open a PR. This keeps each package an isolated, separately-verifiable commit.
- Repo is TypeScript (strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess). Run `pnpm test` and keep ALL existing tests green.
- **Every validator rule needs positive + negative tests** (repo rule).
- The validator's em-dash zero-tolerance is **intentional** — do not relax it.
- **format ≠ register.** This adds a structural FORMAT scaffold + a format gate. It must NOT stamp tempo/voice/Laban-motor on the channel — that would break the locked "channels = situation, not register" rule. Voice still emerges from table-work; the template is scaffolding only.
- Canonical template source: `research/changelog-template-2026-06-05.md` (Tier-1 universal + Tier-2 strong-convention hallmarks). Worked example: `drafts/bridge-launch-changelog-2026-06-05.md`.

## Build order: A1 then A2 (A2 gates A1's output).

## Unit A1 — Blog-channel changelog template (actor scaffold)
- **Files:** `src/actor-director.ts` (`CHANNEL_PROFILES` ~line 375; the actor assignment builder ~`buildActorAssignmentMessage`), `src/actor-memory.ts` (`channelGrammarBlock`). `[edit]`
- **Problem:** the `blog` channel profile is situation-only (`max_chars` + `reader_context`); the actor receives NO house format, so it emits freeform prose.
- **Change:** when channel is `blog` AND the card is a product update (`category` / kind indicates a changelog), inject the house changelog **FORMAT scaffold** into the actor's per-channel assignment: the frontmatter field set (`title`, `subtitle?`, `date`, `published`, `pinned`, `category: changelogs`, `coverImage`, `typefullyUrl?`) and the body skeleton (open with `### <heading>` + hero `{% cloud-image %}`; `---` dividers; `{% toggle %}` for minor items; end with `### Coming up` + roadmap link; ~300–450 words). The actor FILLS the scaffold via its table-work. Do not add tempo/register guidance — structure only.
- **Acceptance:** a blog-channel generation for a changelog card produces output WITH the frontmatter block + the body skeleton (heading → cloud-image, dividers, Coming-up), not a freeform paragraph.
- **Tests:** unit test that the assignment message for a blog/changelog card contains the template scaffold; a generation (stub mode) yields structure-bearing output.
- **Gotchas:** keep the existing `reader_context` / situation as-is; scope the scaffold to blog/changelog only (not x/web/etc.).

## Unit A2 — `auditChangelogFormat` validator rule (the format gate)
- **Files:** `src/validator.ts` (add the rule + wire into `validate()` for the blog channel), `src/__tests__/validator.test.ts`. `[edit + test]`
- **Problem:** the validator has only slop/claims/voice/movement rules — **no format/structure rule** — so nothing judges house-format compliance. (The "regex judges it" the operator expected was never built.)
- **Change:** add `auditChangelogFormat(text, { channel, card }): RuleFailure[]` that, for the blog/changelog channel, checks: a frontmatter block exists; `category: changelogs`; required frontmatter fields present (`title`, `date`, `coverImage`); body opens with a heading then a `{% cloud-image %}`; a `### Coming up` section with a roadmap link exists; Markdoc tags are balanced (`{% toggle %}`↔`{% /toggle %}`). Emit a specific `RuleFailure` per missing element. Wire it into `validate()` as a **hard gate for the blog channel only**.
- **Acceptance:** a properly-formatted changelog (e.g. `drafts/bridge-launch-changelog-2026-06-05.md` body) PASSES; a version missing `### Coming up`, missing frontmatter, or with `category: news` FAILS with a specific reason; a freeform-prose blog FAILS.
- **Tests (mandatory +/-):** positive — the keystone changelog passes; negatives — missing Coming-up fails, wrong category fails, freeform prose fails.
- **Gotchas:** scope to blog/changelog only (don't apply to x/web/in-product/modal); don't double-count; leave em-dash + all existing rules untouched.

## Verification
- `pnpm test` (incl. the new +/- tests) green; `pnpm typecheck` clean.
- Generate a blog changelog → confirm it carries frontmatter + skeleton + passes `auditChangelogFormat`.
- Confirm a freeform-prose blog now FAILS the gate.

> Post-implementation: verify independently (re-run suite + adversarial review of the diff against acceptance criteria) per `methodology-verify-implementer-output` — same as package 1.
