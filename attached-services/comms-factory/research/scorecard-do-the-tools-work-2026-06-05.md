# Do the tools actually support the comms pipeline? — scorecard (2026-06-05)

The session's secondary goal. Honest, tool-by-tool, with the prescription.

## Headline
The **Actor (generator) is the strong part** — it produces copy you'll bring. The surrounding machinery needed work: the grounder fails *silently*, the validator config had drifted and lacked a format gate, the Director was serial+uncached, the orchestrator silently dropped failed channels, and the review surface hid its own reasoning. Most is now **fixed (package 1, verified)** or **specced (packages 2–3)**. Net trajectory: from "produces good prose I reshape and verify by hand" → "produces a drop-in, format-checked, observable, one-button-PR'd launch."

## Tool-by-tool

**Grounder — powerful fact-finder, two SILENT failure modes (the dangerous kind):**
- `--discover` silently fell back to `main` and emitted a confident **false negative** ("bridge.xyz not built / it's planned") for a feature you'd shipped the night before.
- `fetchRef` can't fetch a shipped-**then-deleted** branch → it can't ground a just-launched feature at all.
- The fact-request back-edge was **dark in the harness path** (not wired) — now wired + crash-hardened (pkg1).
- Real saves: it surfaced **Swapper** (= your "swap of finance") and that **EUR is coming-soon** (more current than we were).
- **Verdict:** keep it, but **always verify the ref it actually grounded** — never trust a discover-fallback result. The failure is invisible unless you check.

**Validator — works, earned its keep.** Caught the em-dash and the carousel-numbering issue. Two notes: its em-dash rule had drifted to **zero-tolerance** (vs the documented `>2/280`) — which turned out aligned with your "never use em-dashes" call; and the **carousel-numbering false-positive** (ordinals read as claims) is **fixed** (pkg1, verified). Gap: it has **no format/structure rule** — that's the format-gate (pkg2 Part A).

**Actor (generator) — the strong part.** "Let's bring it." But **format-blind**: no house template, emits prose I reshaped into the changelog by hand. Fix: actor-fills-template + format-gate (pkg2 Part A).

**Director — verdicts fine; perf was the problem.** 35 audits run **serially** (~35 min) and **uncached** (paid the rubric prefix 35×). Fixed (pkg1: cache + pre-warm-then-fan-out + concurrency cap + skip dead copy; verdicts byte-identical). Its reasons were **hidden in the review UI** (pkg3).

**Orchestrator — zero-pass channels silently dropped.** A channel where every candidate failed got no retry and no signal. Fixed (pkg1: observable `channel_regeneration_targeted` + once-per-channel cap + final-attempt guard).

**Harness (review surface) — you couldn't see or trust the run.** Reasons without the failing text, no hover reason, "+N" not expandable, no declared beats, "superseded" unexplained, the Director cell echoing the regex reason. All specced (pkg3).

## Meta-method (reusable, named)
- **Trust-but-verify the tools.** I re-ran Codex's suite myself (247 pass) and adversarially reviewed each unit (0 blockers) — didn't rubber-stamp "passed."
- **Adversarial-hardening workflows for specs** (draft → refute → revise) caught real defects *before* Codex: reframed the retry unit, caught two compile blockers + a CI landmine in the perf unit.
- **Earmark the cohort, not n=1** (the changelog template).
- **Verify the ref** the grounder used (the silent-fallback lesson).
- **Human vouches from head; machine grounds.** You supplied the spell-vision / forward-vector the present-state grounder structurally can't.

## The honest bottom line (your original question)
**Right now the pipeline can't run unattended** — you personally caught the EUR error, the "wallet you specify" error, the silently-dropped carousel, and the format mismatch. That **validates your instinct** to be in the loop. But every gap was named and fixable, and packages 1–3 close them. After them, the pipeline earns more trust: grounded facts (ref-verified), format-compliant output, an observable review surface, and a one-button PR. It becomes a strong **co-pilot with you on the gate** — not an unattended autopilot. And per your own lock (ship-gate is human), that's the *correct* end state, not a limitation.
