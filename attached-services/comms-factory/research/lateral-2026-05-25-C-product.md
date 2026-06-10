# Lateral C — what could be sold here

**Date:** 2026-05-25
**Framing:** comms-factory is internal Infinex tooling today. If it were spun out, what would it BE? Formed from CODE + RESEARCH only.

---

## What's actually been built (stripped of comms framing)

- **Deterministic regex slop validator** (~750 LOC, fully tested) — clichés, listicle voice, antagonism, AI-slop, em-dash density, six claimed competitor palettes, time-pressure markers.
- **Two-call voice generator** running Stanislavski/Mirodan actor table-work (Super-Objective → Through-Action → Obstacle → Lining → BeatPlan with transitive verbs) *before* drafting. No other voice-prompt setup I've seen separates inner-work from drafting.
- **v2 Laban-Mirodan classifier** (711 LOC) grading prose on a 24-tempo / 6-inner-attitude / 4-aspect / 3-stress taxonomy with mechanical drive derivation. Already used as gold-standard judge across 5+ voiced characters (Infinex, Nigel, Cream, Phantom, ProjectJin).
- **Portable skill** taking any brand from "we want a voice" → locked six-piece-unit spec in a ~4-question structured interview. Cold-validated against known-answer test cases.
- **Fact-grounder agent** (Sonnet + 8 tools) preventing hallucinated partner names, leverage caps, numbers.
- **Comparative brand recon** across Phantom, Polymarket, Pendle, Hyperliquid, Berachain, Monad — including the Phantom-multi-voice / Infinex-single-voice cast-architecture finding and a 9-trap visual antipattern catalogue.
- **Diagnostic framework** catching 20/24 brand-coherence gripes mechanically on arbitrary product surfaces (UI strings, docs, error modals, landing pages). Layer-attributed.

The pattern: this is **not a copywriting tool**. It is a *measurement instrument for character coherence* with a generator and a slop-gate bolted on the same spine.

---

## 1 — Six product ideas, ranked

1. **Coherence (verb).** Brand-coherence diagnostic SaaS. Crawl a brand's surface (landing + in-product strings + recent X + docs), classify every artifact on the Mirodan grid, surface drift against the locked placement. Quarterly report + always-on dashboard. *#1: moat is operationalized — a classifier nobody else has, run as a service.*
2. **Voice-Lock.** Onboarding service + recurring license: 1-3 sessions ending in a locked `CharacterSpec` JSON, generator prompt, validator suite, classifier-graded baseline. Fixed-fee install, then runtime license.
3. **Slop-Gate API.** Deterministic validator alone, MCP/REST endpoint. Paste copy → rule-level fails in <100ms, no LLM in the loop. *Lowest-friction wedge.*
4. **Release-to-Post.** Full pipeline as SaaS. Most obvious shape; weakest moat without the voice layer underneath.
5. **The Mirodan Skill Pack.** Sell the methodology — `laban-voice-for-ai-agents` as a Claude/Cursor/Copilot skill. One-time + updates. Cheap, viral, builds funnel for #1.
6. **Crypto-Comms Quarterly.** Paid newsletter scoring public brands on the Mirodan grid each quarter. Costs nothing — the classifier already produces the analyses.

---

## 2 — Who buys each, with WTP

| # | Buyer persona | Annual WTP |
|---|---|---|
| **Coherence** | Series-B → Series-D crypto/fintech/AI startups whose founder personally tweeted "our voice is drifting" in the last 90 days. Owner is a brand/design-systems lead who just lost an argument with a growth-marketing hire over the homepage. Lido, Across, MetaMask post-rebrand, Mercury, Ramp, Modern Treasury — wherever brand IS the moat. | **$24-60k/yr** + $15-30k install |
| **Voice-Lock** | (a) Founders 6 months out from Series-B who know their copy reads as slop but can't say why; (b) brand consultancies (Pentagram / Koto / Manual tier) licensing methodology to upsell clients. | **$25-75k install** + $1-3k/mo runtime; **$50k/yr** unlimited-client methodology license for consultancies |
| **Slop-Gate** | Content-marketing teams at 100-1000-person companies writing >50 pieces/quarter. Devrel teams who hate their own copy. Crypto-Twitter ghostwriters for hire. | **$49-$499/mo** + $0.001/call API |
| **Release-to-Post** | Crypto teams with frequent ship cadence and no comms hire — perp DEXes, L2s, infra protocols. ~200 logos in crypto. | **$200-1500/mo**, GitHub-connected |
| **Skill Pack** | Independent designers, prompt engineers, AI-curious copywriters, in-house brand leads. Cursor/Claude Code/Raycast user base. | **$99-299 one-time**, $19/mo updates |
| **Quarterly** | Trung Phan / Packy McCormick / Tooze-class subscribers. Crypto founders, VC associates, designers who want to look smart. | **$25-50/mo** — better as leadgen than revenue |

---

## 3 — The moat for Coherence

A competitor with GPT-4 + a Figma file in 3 months ships an "AI brand-voice checker" that prompts a model with "is this on-brand for X?" That tool already exists in five Show HN posts. It is not Coherence. What can't be reproduced in 3 months:

1. **The taxonomy.** Mirodan's 24-tempo / 6-inner / 4-aspect / 3-stress synthesis with mechanical drive derivation is not on the public internet in any usable form. It exists as a 1997 PhD, ~50MB scanned PDF, in theatre archives. The operator has spent months extracting it, finding the failure modes ("Stable+Space-stressed doesn't exist; the operator means Penetrating"), and encoding factor-coherence enforcement. A clone wouldn't know to enforce the rule.
2. **The two-call generator pattern.** That drafting *without* upstream actor table-work produces dynamically-correct, dramatically-inert slop is itself a finding from the Bridge.xyz postmortem on 2026-05-22. A clone would build a single-call generator and ship the same slop they're trying to gate.
3. **Cross-brand calibration.** Five+ characters and 9 third-party brand surfaces all graded on the same instrument — that's the comparability moat. New entrants re-judge each brand against fresh subjective rubrics and have no cross-brand comparability.
4. **The diagnostic-vs-builder split.** The framework catches 20/24 gripes mechanically while *revealing* the 4 it can't as structural gaps (typography, motion, illustration, template families). That layering requires compounded methodology across multiple brands.

The moat is **methodology compounding + research investment**, not code. Anyone could rewrite the validator in a week. Nobody can re-derive the 24-cell grid + factor-coherence rules + failure-mode catalogue without a year of work.

---

## 4 — What gets sold first

**Service, not tool.** Sell **Voice-Lock** as a fixed-price 3-week engagement ending in a locked CharacterSpec + generator + validator + classifier baseline. Charge $50-75k.

Why service-first: the methodology IS the deliverable. Brands buying a "voice tool" expect to operate it; brands buying a *voice installation* expect an artifact and a runtime license. Same dollars, cleaner mental model — and the artifact framing funds the runtime license naturally. Three engagements at $50k tell you whether WTP is real before a year on per-seat SaaS infra. Engagements generate the case studies that sell Coherence ("We ran the Mirodan diagnostic against [Brand X] and found their homepage 60% off-character with their tweets") — leadgen flywheel. Skill Pack and Quarterly fall out as free marketing.

Coherence is sold second, to engagement alumni first. Slop-Gate third — the cheap wedge. Selling tool-first is the trap: the release-event pipeline shape reads as obvious automation; without the voice-lock underneath, it's a thin wrapper on Claude.

---

## 5 — The risk it stays a tool

Three traps, increasing severity:

**Trap 1 — Infinex-shaped pipeline.** Cards today are `data-card-official` / `launch-tier` / `split` — crypto-launch shapes. A non-crypto buyer doesn't have "spot perps live on Base" events to wrap. Cards must generalize to comms-events (campaign, announcement, response, thought-leadership) or the product is unsalable outside the niche.

**Trap 2 — The operator IS the product.** Methodology compounding lives in the operator's head. The skill captures some, memory captures more, code captures executable bits — but the call on which Mirodan cell matches which brand, when to push back on a gut answer ("Stable+Space-stressed doesn't exist") — those are still operator-led. Without productizing operator judgment into an engagement playbook a junior consultant can run, the company is a consulting practice that doesn't scale past one person. The bigger version of the trap that kills most agency spinouts.

**Trap 3 — Internal forever.** Most likely outcome: operator ships great Infinex comms, tool gets internal love, nobody packages it, a competitor with worse craft but better SaaS UX wins the category. The work compounds inside Infinex and produces zero capturable value outside.

---

## 6 — Pricing shape

**Hybrid: fixed-fee service + per-brand runtime license + metered API wedge.**

| Surface | Price | Justification |
|---|---|---|
| Voice-Lock install | **$50-75k** one-time | Fixed-fee anchors WTP, generates artifact, funds runtime |
| Per-brand runtime | **$2-5k/mo** | Generator + validator + classifier dashboard, one brand |
| Coherence audits | **$24-60k/yr** | Recurring, retention-aligned, sold to installed brands first |
| Slop-Gate API | **$0.001/call**, $49-499/mo | Wedge, expands to runtime |
| Skill Pack | **$99-299 one-time**, $19/mo | Long tail, viral, evangelism |
| Quarterly | **$25-50/mo** | Pays nothing real, pays everything in distribution |

Per-seat is the wrong shape. Brand voice is a *per-brand* artifact — same locked CharacterSpec consumed by 50 marketers and 10 designers at one company; seat-counting loses the deal. Brand-of-the-month is also wrong — pricing should align with the artifact being *locked* and re-tuned, not refreshed. Closest analogue is Figma-for-design-systems (per-org, per-locked-asset), not Notion-per-seat. Runtime license is where leverage compounds: installations are expensive but rare; runtime is 80% margin, recurring. Coherence audits become automatic upsell to installed brands six months in. Slop-Gate is the only pure-metered surface — wedge, not revenue engine.

---

## Closing

Don't sell the pipeline. Sell what the pipeline *measures*. The pipeline is replaceable; the measurement instrument and the methodology that calibrated it are not. What's been built is closer to a *brand-coherence diagnostic startup* than to a copywriting tool, and the instinct to dogfood it on Phantom and Polymarket (not just Infinex) is the right one — that's what proved the instrument generalizes.

One-line pitch: **"We grade your brand's coherence on the same instrument we use on your competitors. The grade is mechanical, the methodology is from a 1997 theatre PhD, and the validator catches the slop your prompt can't."**
