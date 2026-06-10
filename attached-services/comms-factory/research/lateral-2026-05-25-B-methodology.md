# Methodology audit — what the operator is actually building

*Form-of-the-work report. Read the shape, not the comms domain.*

The comms-factory repo looks, on paper, like a brand-voice generator for Infinex. That's not what it is. The comms surface is the *scaffold*; the load-bearing artifact is the **methodology** by which a fuzzy taste-driven domain is rendered into a deterministic, auditable, mechanically-validatable pipeline. The operator is treating brand voice as a software-engineering problem with an answer key.

## 1. The method

**Name it: the Anchor-Classifier Pipeline** (or, longer: Mechanical-Verifier-Anchored Taste Compilation).

The shape, visible across `src/card.ts`, `src/voice/types.ts`, `src/validator.ts`, `scripts/classify-corpus.ts`, and the harness:

1. Take an *academic framework* with its own internal grammar (here: Veronica Mirodan's 1997 PhD synthesis of Laban Movement Analysis). Chosen because outputs are mechanically derivable from inputs, not vibes.
2. Encode the framework's primitives (Inner Attitude, Stress, Aspect, Drive, Tempo, Working Action) as TypeScript types with declared illegal combinations (`AVAILABLE_STRESSES`, `OUTER_PROJECTIONS`).
3. Build a **classifier** (`scripts/classify-corpus.ts` v2) that places arbitrary artifacts onto the framework. Canonized as "the gold standard" — never substitute a fresh LLM judge.
4. Lock a placement for the target subject (Infinex = Stable + Flow + Penetrating + Spell-Vision) through **out-of-placement diagnostic** sampling — adjacent-cell A/B testing, not abstract operator preference elicitation.
5. Split the pipeline into **deterministic upstream, judgment downstream**: regex-grade slop checks first, then framework-derived audits (off-spec drive regex, preparation-hierarchy motor check), then LLM judges last — and only on what survived regex.
6. Add an **operator-in-the-loop harness** whose only job is to bring each stage to ≥80% agreement, then retire. Training-data infrastructure, not product.

Single conviction underlying all of it: **taste is compilable, if you can find a framework that separates "is" from "is not" with the rigor a compiler separates valid from invalid syntax.**

## 2. What this is an instance of

This is **eval-driven development** ported into a domain where evals are usually considered impossible. Three converging patterns:

- **Compiler-as-style-guide** — `rustfmt`, `gofmt`, `eslint`, `mypy --strict`. Taste preferences as a tool that refuses bad output rather than asking the writer to remember the rule.
- **Adversarial dual-model architecture** (GAN generator/discriminator, constitutional-AI critic loop) — generator and validator must be *separate processes*. The pipeline contract enforces this religiously: "if a single model both writes AND audits its own output, it rationalizes slop."
- **Test-driven specification capture** — no rule is real until it has positive and negative tests (`src/__tests__/validator.test.ts`). The character spec at `src/voice/infinex.ts` is shaped so every claim is mechanically checkable.

One-line framing: **this is property-based testing for prose.** The framework defines invariants (Drive ≠ Passion, Quick Action requires Sustained prep, Stable can't be Time-stressed); the generator produces samples; the classifier checks invariants. Same shape as Hypothesis or QuickCheck — generate-then-shrink under a deterministic predicate — paragraphs instead of integers.

## 3. Transfer surfaces

Six concrete domains where the same apparatus drops in cleanly:

1. **Founder-led product orgs with a house voice that drifts under headcount growth** — Stripe, Linear, Vercel, Notion. The CEO is the brand; 200 people can't have the CEO review everything. Classify the founder's existing corpus, derive the placement, lock the spec, gate marketing/docs/sales against it. The ≥80%-then-retire harness pattern is the exact shape for "train the team, then trust them."

2. **Sales engineering at high-volume B2B SaaS.** Outbound and proposals are where AI-slop loses deals. Drive-derivation grammar maps onto "feels like a vendor / a peer / a consultant." Regex slop catches + classifier tonal placement = ~70% of the QA a BDR manager does manually.

3. **Pharma and regulated-industry claim governance.** The `deployed_facts[]` + `not_said[]` + `auditUnsupportedClaims` machinery is *exactly* the shape FDA promotional-review wants. Substitute "FDA-cleared indications" for `deployed_facts` and you have the same machine — more rigorous than what most regulated-industry comms tools ship today.

4. **Open-source documentation review at scale** — Kubernetes, Rust, Postgres. Large doc surfaces with variable contributor voice. The split between brand-agnostic slop and voice-specific guidance maps onto "technically correct but doesn't sound like Postgres docs." The classifier solves the maintainer-bandwidth problem.

5. **Litigation briefs and legal writing.** A judge's tolerance for register and a firm's voice are taste-objects with mechanical violations (purple prose, weak adverbs, passive in operative sentences). Off-spec-regex + per-Lining patterns translate directly. Different framework (Toulmin argumentation, not Mirodan), same apparatus.

6. **Character-locked agents that produce user-facing text** — trading bots (Nigel, already wired the same way), customer-support agents, in-app coaches, AI tutors. Any agent with a brand identity needs this shape, because self-auditing generators silently drift.

## 4. The most durable artifact

If 80% of this repo had to die, what I'd keep is **the methodology memory files** (`methodology-*.md` in `/Users/opaque/.claude/projects/.../memory/`) plus **`src/voice/types.ts`** and **`scripts/classify-corpus.ts`**.

Defense: Remotion compositions don't exist yet. The harness is explicitly temporary. The Infinex voice spec is one instantiation, not the framework. Regex slop rules are useful but cheaply re-derivable. Generator code will be rewritten when models change.

What is *not* re-derivable:

- The `methodology-*` memos — `actor-table-work-before-drafting`, `lean-upstream-fat-downstream`, `framework-as-diagnostic-instrument`, `out-of-placement-diagnostic`, `inside-out-interview`, `cadence-by-observation`, `skill-cold-test`, `voice-audit-spec-precedence`, `verifier-is-gold-standard`. Each names a portable technique that took a real session of operator pain to surface.
- `src/voice/types.ts` — the **compiled grammar** the methodology memos describe. Operator research rendered as callable API. Re-deriving from scratch is weeks of Mirodan reading.
- `scripts/classify-corpus.ts` v2 — the only thing in the system canonized as ground truth. The methodology memos describe *how* to use a classifier; this file *is* the classifier.

Everything else is scaffolding. The methodology memos plus `voice/types.ts` plus the classifier are the IP. The pipeline pattern itself is recoverable from the memos.

## 5. The unnamed technique

The operator has named many techniques. All catalogued. The one I see them USING constantly but haven't written down as portable methodology:

**Build the auditor before the generator.** Or: **the classifier must exist before the spec is allowed to lock.**

Evidence:
- `scripts/classify-corpus.ts` predates and outlives the generator. The classifier is canonical; candidates are checked against it.
- The harness exists to bring each *stage* (especially the classifier-as-judge) to operator-agreement before the *generator* is trusted.
- Validator regex rules each ship with positive AND negative tests before going live.
- Voice specs are derived by running the classifier *cold against a corpus first* and reading placement out, not by asking the operator to declare placement. Both `methodology-inside-out-interview` and `methodology-skill-cold-test` depend on the classifier already existing.
- The harness "≥80% agreement" metric is agreement *against the classifier as ground truth*, not against generator confidence.

This inverts the conventional ML pipeline order. Standard sequence: build model, then evaluate. Operator's sequence: build evaluator, then build everything that needs evaluating, in priority order. It's why brand-factory is gated on `voiced` status (= classifier agrees) and why Remotion is deferred until then.

This technique is the *parent* of `verifier-is-gold-standard` (which is about consistency between brands) and the parent of `methodology-skill-cold-test` (which depends on a known answer the classifier produces). Both named memos are downstream applications of the unnamed-but-omnipresent ordering rule.

Portable name: **Evaluator-First Pipeline Construction**, or **Discriminator-Anchored Development**. The technique: in any creative/generative project where output quality is contested, build the discriminator first. Lock its judgments. Then build generators aimed at it, each stage gated on discriminator agreement. The discriminator becomes the project's permanent anchor; everything else is scaffolding around it.

This is the one most worth porting because it explains why this brand-voice pipeline doesn't suffer the usual taste-pipeline failure mode (no agreement on what "good" is, so the team argues forever). The operator solved that meta-problem before solving the comms problem. They built the agreement before they built the artifact.
