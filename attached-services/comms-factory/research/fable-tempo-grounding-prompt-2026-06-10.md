# Task for Fable — fix the "everything's commanding" tempo collapse, grounded from canon

You are working in the **comms-factory** repo (Infinex's automated comms pipeline). The generator is producing caption candidates that nearly all land in one tempo — **Commanding**. The locked voice has five named tempi and a placement that should produce *range*. We want to fix this, but I do not want you to trust our own spec or my diagnosis. Both may have drifted from the source framework. **Re-derive from canon first.**

## Prime directive: canon over our stuff

Treat everything in our codebase — `src/voice/infinex.ts`, the generator, my hypothesis below, every memory note — as **possibly-drifted secondary material**. The ground truth is the Mirodan / Laban primary source:

- `third_party/mirodan/mirodan-ch1-basic-concepts.md`
- `third_party/mirodan/mirodan-ch2-attitudes.md`  ← States/attitudes (two-factor combinations) live here
- `third_party/mirodan/mirodan-ch3-drives.md`     ← Drives (three-factor) live here
- `third_party/mirodan/mirodan-ch4-applications.md`
- `third_party/mirodan/GROUNDED-FINDINGS.md`      ← prior grounded corrections; read but still verify
- `third_party/mirodan/Mirodan-PhD-1997-Vol2.pdf` ← the PDF; consult directly when the MD is ambiguous
- `third_party/mirodan/laban-mirodan-reference-2026-04-28.md`
- The `skills/mirodan-grounding/SKILL.md` skill — invoke it; it encodes how to verify against this source set.

**Rule:** every framework claim you rely on (what a State is, which motion factors compose it, how tempo/effort *emerges* from inner work, what "Flow-stress" does to a Stable attitude) must be traceable to a specific line in those files. If our spec says X and canon says Y, canon wins and you flag the drift. Quote the canon passage when you assert something load-bearing.

> Known trap (verify it for yourself): Laban **Weight = trace of will / "Intending," not muscular force only.** Past work re-broke this from both directions. See GROUNDED-FINDINGS.md.

## The problem, concretely

Run the generator on a few release cards (the harness at `harness/`, or `pnpm tsx src/cli.ts generate cards/<id>.json`). Observe that candidates collapse to Commanding. We want output that moves *across the spec's range*, not camped in one register.

## Success / failure criteria (define "done" against these)

**Good output looks like:** tempo variety that honours the locked placement. The Infinex attitude is **Stable, Flow-stressed, Penetrating, Spell-Vision drive (Diagram D, no Passion)** — verify this against `src/voice/infinex.ts` AND against canon. Because the attitude is Stable but *stressed toward Flow*, the voice should be able to move out of pure-Stable register into the Flow-bearing states. The operator's framing (verify and correct it against canon — he may be using the taxonomy loosely):

- range across **Stable**, **Dream**, and **Remote** states rather than collapsing to one;
- **landing Dream-state tempi properly is the prize** — that's the Flow-stress the placement is built on, and it's what Commanding-collapse is failing to reach.

First, from canon, establish the real mapping: which of the five locked tempi (Commanding · Practical · Sombre · Irradiant · Sociable) sit in which State, whether the "four tempi per State" mental model is even correct, and what *causes* a tempo to emerge (the principle is: **tempo is emergent from the Deciding/working-action, never pre-assigned** — confirm this is canon, not our invention).

**Bad output (any of these means you've regressed, not fixed):**
- the Director starts failing *everything* (you traded one collapse for a rejection wall);
- still all-Commanding;
- output drifts **off-spec** (tempi that aren't in the locked placement);
- the **tone of voice** gets worse;
- the **verbiage / line-level craft** gets worse.

## My hypothesis — treat as REFUTABLE, not given

I traced the generator and believe four things bias Commanding. **Verify or refute each against canon + the actual code before acting on it.** If canon says my framing is wrong, discard it.

1. `src/generator.ts` ~706–712 — `buildBeatSequenceSection` hard-codes a tempo arc per post-kind, and **Commanding appears in every arc**, usually in the landing position. This looks like exactly the *pre-assignment* canon forbids.
2. `src/voice/infinex.ts:250` — `main_tempi` lists `commanding` first; fallback code does `.slice(0, N)` (generator.ts ~305, ~1471–1485) so "no signal" → Commanding. Meanwhile `cadence` (infinex.ts ~225–231) weights *irradiant 0.45, commanding 0.22* — the array order contradicts the cadence.
3. `src/generator.ts` ~1358–1365 vs ~1388–1398 — Stage A's prompt still asks the model to name a `tempo` even though the comment says "NO tempo field," and the parser then discards it. The model spends attention declaring (and defaulting to) a tempo that primes the final register.
4. No per-release `through_action` (inner cause). Without "what is this post *doing* to the reader," the model picks the safe authoritative register = Commanding.

Prior audit covering some of this: `research/generator-tempo-audit-2026-05-25.md`.

## Required workflow

1. **Ground.** Build your own from-canon model of: States and their motion-factor composition; what Flow-stress does to a Stable attitude; how effort/tempo *emerges* from working-action; the Spell-Vision drive. Cite sources.
2. **Audit for drift.** Compare `src/voice/infinex.ts` (tempi, cadence, placement) and the generator's tempo logic against your from-canon model. Name every drift.
3. **Adjudicate my hypothesis.** Accept/refute each of the four levers with a canon-grounded reason.
4. **Plan.** Write the fix plan: what changes, why, and how it makes tempo *emerge* rather than be assigned. Flag anything that touches the **locked** spec — those are higher-stakes and should be minimal and justified.
5. **Fix.** Implement.
6. **Prove it.** This is non-negotiable:
   - Grade tempo variety with the **gold-standard instrument**, `scripts/classify-corpus.ts` (the v2 classifier — full taxonomy). **Do NOT use a fresh LLM call as the judge** — only the classifier produces comparable grades. Show before/after tempo distributions.
   - Run the **Director** on the new candidates and report pass-rate before/after — prove you didn't trade collapse for a rejection wall.
   - Eyeball tone + line-craft on a sample and confirm neither degraded.
   - Run `pnpm vitest run` — all tests green. If you changed a validator rule, add tests (repo rule: no rule change without tests).

## Guardrails

- Don't widen the net so the Director rejects everything; don't push output off the locked placement; don't sand down the voice to hit a distribution number. The win is **emergent range that stays on-spec and reads well**, measured by the classifier and Director — not a forced tempo lottery.
- Minimal diff to the locked voice spec. If a fix requires changing locked values, justify it from canon explicitly.
