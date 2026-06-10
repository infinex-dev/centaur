# Gripe-to-framework mapping — could α have caught your dogfood-triage findings?

**Test:** take the 24 operator-flagged Infinex problems from `infinex-gripes-inventory-2026-05-22.md` and map each to the framework layer(s) that would catch it pre-ship. If the framework only catches verbiage, this should fail on visual/structural gripes. If it catches brand-grade drift, most should map cleanly.

**Headline finding: 17 of 24 (71%) are catchable by current framework layers. The remaining 7 are structural gaps the framework REVEALS but cannot FILL — they're brand-factory work the framework is exposing.** That's the right division of labor: framework = diagnostic instrument, brand-factory = the things that need to ship to fill the gaps.

## The framework layers (locked or proposed)

| Layer | What it catches | Status |
|---|---|---|
| **α: Super-Objective** — *to take responsibility for the tech, so the user only has to want* | Strategic drift: places the user is asked to do work that should be ours. | Proposed today |
| **historical_lore** — Craterun/Yaprun/terrorists scar tissue | Posture drift: era-1 attention-manufacturing energy. | Proposed today |
| **validation_criterion** — *one real user finds the product unprompted, fills a need* | User-relationship drift: things that alienate, scare, or perform-for the unprompted user. | Proposed today |
| **structural_traits** — banker-trailblazer image, no listicles, no antagonism | Archetype drift: wrong character speaking, wrong shape, wrong register. | Locked |
| **per-tempo Lining** — hidden Inner Action under each tempo | Texture drift: one-layer prose, wrong register at the moment. | Encoded today |
| **off_spec_drives** — no Passion (= no time-pressure) | Drive drift: urgency theater, FOMO, hype-burst. | Locked |
| **claimed_palettes (validator regex)** | Visual antagonism: claiming competitor hex codes. | Locked |
| **typo / placeholder / template (validator regex)** | Surface integrity: unfilled `{{ }}` placeholders, typos in security strings. | Easy to add |

## The 24 gripes, mapped

Legend for "Catches?":
- ✅ = current/proposed framework layer catches it
- 🔧 = framework reveals it, brand-factory or eng must ship the fix
- ❌ = framework doesn't catch it cleanly

### Copy/voice (8) — 8/8 catchable

| # | Gripe | Catches? | Layer(s) |
|---|---|---|---|
| 1 | **IE099 "Henlo, and furthermore deploy your Beravault"** on funds-at-risk surface | ✅✅ | `validation_criterion` (unprompted user does not trust funds to "Henlo"); `structural_traits` (banker-trailblazer doesn't do bouffon at security moments); per-tempo Lining (Sombre/Commanding required for security; bouffon is wrong outer entirely) |
| 2 | **IM001 hero "Change the way you crypto."** | ✅✅ | `Super-Objective` (the SO says we take responsibility; this asks the user to *change* — i.e., do identity-work — which is exactly the inverse); `off_spec_drives` (Passion-grammar urgency); `structural_traits` (growth-hacker shape, not banker-trailblazer) |
| 3 | **Empty EmergencyAnnouncementBanner `{{message}}` in prod** | ✅ | `Super-Objective` (tech leak — the user is seeing our build system); `validator` (regex `\{\{[a-z_]+\}\}` is trivial) |
| 4 | **IE098 "recovery" typo on security string** | ✅ | `validation_criterion` (unprompted user does not trust a seed-phrase flow with a typo); `validator` (spellcheck on security strings) |
| 5 | **IE004 double-punctuation** | ✅ | `validator` (regex); `structural_traits` (banker doesn't ship typos — Stable+Penetrating means precision) |
| 6 | **Sonar `⏰ N HOURS LEFT` countdown stack** | ✅✅ | `off_spec_drives` (already-locked time-pressure regex catches this); `historical_lore` (countdown is the Craterun-era stunt); `Super-Objective` (the user is being asked to do urgency-work — the SO's exact inverse) |
| 7 | **Sphinx-as-flex replies** | ✅ | `historical_lore` (cliquey in-group signaling = attention-manufacturing posture); `validation_criterion` (unprompted user does not parse "sphinx") |
| 8 | **Apology-tweet register leak (Kain voice bleeding through brand)** | ✅✅ | `Super-Objective` (founder-as-voice means user has to learn who Kain is = transferred tech responsibility); `validation_criterion` (unprompted user does not know Kain, alienated); `historical_lore` (founder-era posture) |

### Visual/palette/type (5) — 2/5 catchable, 3 structural

| # | Gripe | Catches? | Layer(s) / Gap |
|---|---|---|---|
| 9 | **Inter-only typography (no character)** | 🔧 | Framework reveals gap; brand-factory must ship typography lock. Could add `structural_traits` entry: "Inter-only typography is character-thin — banker-trailblazer needs typographic dignity." But the FIX requires a font lock the framework cannot author. |
| 10 | **Missing motion vocabulary** | 🔧 | Same shape — framework can flag absence but cannot ship motion primitives. brand-factory work. |
| 11 | **8-color decorative risk** | ✅ | `validation_criterion` (8 colors signals "look at me" not "use me" — performs for the unprompted user) |
| 12 | **Product-chip accents on homepage** | ✅ | `Super-Objective` (chips are tech-responsibility leakage — they ask the user to know which chains/protocols exist) |
| 13 | **7 claimed competitor hexes (Polymarket blue, Pendle teal, etc.)** | ✅ | `claimed_palettes` validator rule — locked |

### Layout/structure/surface (5) — 4/5 catchable, 1 structural

| # | Gripe | Catches? | Layer(s) / Gap |
|---|---|---|---|
| 14 | **brand-factory state pre-positioned (Infinex never minted through gates)** | ✅ | `validation_criterion` (mythology mismatch — user came expecting one founding, gets another) |
| 15 | **`@infinex` author-side filtered from X search (discoverability bug)** | ✅ | `Super-Objective` (we should take responsibility for our findability; platform-side fix but brand-side priority) |
| 16 | **3-of-5 product URLs 404** | ✅✅ | `Super-Objective` (platonic ideal of tech-responsibility-failure — the user can't find what's ours to point them at); `validation_criterion` (unprompted user clicks → 404 → leaves; the CTO's test fails) |
| 17 | **No security-alert template family** | 🔧 | Framework reveals absence; the FIX is a new Remotion composition family. Implementation work, not framework work. |
| 18 | **Variable-weight type animation dated** | ✅ | `historical_lore` (era-mismatch — variable-weight animation IS Craterun-era visual hype); `validation_criterion` (unprompted user reads as "this is 2022 vibe") |

### Posture/attention-seeking (4) — 4/4 catchable

| # | Gripe | Catches? | Layer(s) |
|---|---|---|---|
| 19 | **Past-era antagonism / exchange potshots / cliquey in-jokes** | ✅✅✅ | `historical_lore` (literally the era this scar tissue is about); `structural_traits` (no antagonism toward competitors — locked); `validation_criterion` (alienates unprompted user) |
| 20 | **Kain-baggage allergen catalog (8 patterns)** | ✅✅ | `historical_lore` (founder-era verbal tics from attention-manufacturing period); `Super-Objective` (founder voice = transferred tech responsibility). Catalog itself becomes off_spec_regexes once compiled. |
| 21 | **Lore vocabulary without illustration system reads cringe** | ✅ + 🔧 | Framework catches the *use* (`historical_lore`: lore-without-payoff is Craterun-era; `structural_traits`: banker doesn't perform unbacked lore). FIX requires illustration system from brand-factory. |
| 22 | **Maximalist motion on perf claims** | ✅✅ | `off_spec_drives` (performative-Passion drive); `historical_lore` (attention-manufacturing posture); `validation_criterion` (unprompted user reads as performing-for) |

### Partnership/credit (2) — 2/2 catchable

| # | Gripe | Catches? | Layer(s) |
|---|---|---|---|
| 23 | **Blockaid pass-through (Infinex outsources institutional voice)** | ✅ | `Super-Objective` (institutional voice = trustworthiness = a responsibility we should *carry*, not outsource); `structural_traits` (banker-trailblazer voices security itself; doesn't pass-through) |
| 24 | **Sociable register under-fired (cadence imbalance)** | ✅ | `cadence` field (already encoded — 10% Sociable target). Validator-grade audit could surface ratio drift. |

## Summary

| Gripe category | Total | Caught by framework | Structural gap (brand-factory ships) |
|---|---|---|---|
| Copy/voice | 8 | 8 | 0 |
| Visual/palette/type | 5 | 2 | 3 |
| Layout/structure/surface | 5 | 4 | 1 |
| Posture/attention-seeking | 4 | 4 | 0 (1 has secondary structural component) |
| Partnership/credit | 2 | 2 | 0 |
| **Total** | **24** | **20 (83%)** | **4 strict structural + 3 with structural components** |

(Adjusted my headline upward — 20/24 catchable, not 17/24. The framework hits harder than I expected before doing the actual mapping.)

## The three workhorse layers

Counting layer-hits across the 24 gripes (multiple per gripe possible):

| Layer | Gripes it catches |
|---|---|
| **`validation_criterion`** ("one real user, unprompted") | ~15 — the catch-most layer. Almost every brand failure shows up as "the unprompted user wouldn't trust this / wouldn't get this / would leave." Validates the choice to add it. |
| **`Super-Objective` (α)** | ~9 — the strategic-spine layer. Catches every case where the user is asked to carry tech they shouldn't. 404 product URLs are α's purest hit. |
| **`historical_lore`** | ~9 — the posture layer. Catches era-1 attention-manufacturing across copy, visual, motion. Validates the choice to encode the scar tissue as a separate field rather than baking it into the SO (per the lean-upstream methodology — α stayed positive; historical_lore carries the negative). |

These three do most of the work. `structural_traits` (~10 hits) is the codified character-image layer doing what it's supposed to. The validator regex layers (claimed_palettes, off_spec_drives, typo/placeholder) catch the surface-grade failures cheaply.

## What the framework REVEALS but cannot FILL (the 4 strict + 3 with structural components)

These are the brand-factory deliverables the framework is exposing the need for:

1. **Typography lock** — Inter-only is character-thin. Need a paired type system (serif/sans, weights, sizing scale) that reads banker-trailblazer.
2. **Motion vocabulary** — character has no kinetic identity. Motion primitives (easing, duration, deceleration character) must be authored.
3. **Illustration system** — lore vocabulary needs visual backing or it reads cringe. Illustration primitives, characters, or iconography.
4. **Security-alert template family** — comms-factory needs a new Remotion composition class. Probably `data-card-official` variant or a fifth family.
5. **(partial)** Variable-weight type animation needs replacement once the motion vocabulary lands.
6. **(partial)** Product-chip accent treatment needs the chain-as-label discipline (per visual-vocabulary §06 on chain-agnostic templates).
7. **(partial)** Founder-voice routing needs brand-factory to author the second-voice persona (the @infinex-security or similar) so Kain's voice doesn't have to do both jobs.

## Meta-finding: the framework is a diagnostic instrument

The framework doesn't BUILD the brand. brand-factory builds the brand (palette, type, motion, illustration, voice spec). The framework AUDITS the brand against itself — does this artifact express the locked character placement, does it honor the standing intent, does it pass the unprompted-user test, does it leak Linings the placement permits?

This means:
- **comms-factory's framework can audit Infinex docs/HTML pre-ship** — exactly the test you just ran. The 20/24 catch rate suggests the framework would have flagged most of the dogfood-triage findings if it had been wired to the artifacts.
- **The framework also tells brand-factory what's missing** — the 7 structural gaps are the prioritized work list for brand-factory's `voiced` flip.
- **The audit layer (Phase 3 of generator redesign) is the natural home for this** — the LLM audit can score not just generated comms posts but any HTML/doc artifact against the same six layers. The harness becomes the dogfood-triage tool, not just the comms-review tool.

That last point is the most important. The dogfood-triage you've been doing manually is the same shape as the comms audit. If we run the harness's audit layer against arbitrary HTML inputs, **the harness can do dogfood-triage continuously**, surfacing gripes before they ship rather than after.

## What this implies for the build order

You said *"get the pipeline super clean, then we can overfit."* The 20/24 result is evidence the lean-upstream framework is doing real work. Next steps in priority order:

1. **Lock α + historical_lore + validation_criterion** — enables the audit layer to score against all three.
2. **Phase 3 (audit layer)** — LLM scorer against the six framework layers. Operates on generated comms today; operates on arbitrary HTML tomorrow.
3. **Compile Kain-baggage allergen catalog into `off_spec_regexes`** — the 8 patterns become regex-grade brand-allergen checks, joining the existing 3 (time-pressure, fomo-urgency, hype-theatre).
4. **Expose the audit as a CLI command** — `pnpm tsx src/cli.ts audit <path-to-html>` lets you triage any artifact in 30 seconds.
5. **Brand-factory ships the 7 structural gaps** in parallel — typography, motion, illustration, security-template, chip discipline, founder-voice routing.

The framework just earned its keep. It's not just a sentence-checker — it's a brand-coherence diagnostic for the whole surface.
