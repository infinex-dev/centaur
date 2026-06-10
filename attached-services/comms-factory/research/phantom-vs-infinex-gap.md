# Phantom vs Infinex — Laban / Mirodan gap analysis

> **⚠ INTERIM — pre-corrected-taxonomy (2026-05-18).** This synthesis was written from classifier output that used a **broken enum** (missing `adream` + `remote` from `inner_attitude`, missing `radiating` + `enclosing` from `aspect`, allowed illegal "weight stress"). The **structural findings hold** — Phantom multi-projection vs Infinex single-voice, Blockaid outsourcing, IE099 wrong-register intrusion, founder-voice bleed — but the **specific percentages will shift** when re-classification with the corrected taxonomy lands. The Phantom-as-multi-voice framing in particular is being revisited: smoke-test of the corrected classifier reads Phantom's homepage hero as **Adream Diagram D (Overpowering, Passion→Vision)**, suggesting Phantom may actually be **one Adream character with multiple Outer Action Attitudes** rather than four separate "people." Validate against the re-classified data before treating any single number as canon. See `scripts/classify-corpus.ts` (v2 rewrite) + `skills/laban-voice-for-ai-agents/references/drive-mapping.md` (canonical 24-cell table) for the corrected framework.

**Date:** 2026-05-18
**Method:** Same Laban classifier (Sonnet 4.6, scripts/classify-corpus.ts) run against 9 surfaces (4 Phantom + 5 Infinex). Trait percentages derived from per-axis category counts. See [phantom-vs-infinex-radar.html](phantom-vs-infinex-radar.html) for the interactive radar.

## TL;DR

1. **Phantom is multi-voice.** Four distinct "people" run different surfaces (marketing guy, ops guy, cultural guy, security guy). The founder is kept off the brand account.
2. **Infinex is single-voice.** Founder voice (Kain at the keyboard) bleeds through the brand account, the blog, the apology, the Sonar sale tweets. One person trying to play every part.
3. **Both anchor on Stable + Penetrating where legible.** That's the through-line both brands share. The differences are in *which drive carries which surface*.
4. **Infinex's locked spec (Stable + Flow + Penetrating + Spell-Vision) only really lives in the blog.** Everywhere else, the shipped voice reads as Stable + Penetrating + Doing — structurally indistinguishable from Phantom's marketing and operations surfaces.

## The "person" model (cast comparison)

| Role | Phantom | Infinex |
|---|---|---|
| **Marketing guy** | Homepage hero, get-started, social proof — Stable + Penetrating + Doing with Spell-Vision lift for hero band ("The money app that'll take you places"). | Same role, same shape — Stable + Penetrating + Doing. "Change the way you crypto" lands as **Passion-leaning**, not Spell-Vision. Marketing reality ≠ marketing aspiration. |
| **Ops / utility guy** | App chrome, settings, navigation, store listings. Mostly characterless on purpose (243 app samples, 89% classify as unknown). Character only appears at promo banners + friction modals. | Login, settings, transaction labels, deposit flows. Similar chrome-discipline shape (53/99 utility samples classify as unknown). Has character where it matters (refusals like IE048). |
| **Cultural guy** | Tweets — market-pulse / time-stress / Passion-Doing companion. *"Zcash up 70% 🤯"*, *"S&P500 up 12% since it went live"*. Folksy lowercase replies. Founder kept off-account. | NO dedicated cultural-guy persona. Founder voice plays this role — *"We call this a skill-horizon"*, *"I've been waiting for years for this"*. **Sphinx-as-flex** instead of shitposter-as-equal. Same structural slot, different posture. |
| **Security guy** | Scam-block modal — *"For your safety, Phantom has blocked this request."* Aragorn-at-the-gate, Stable + Commanding, Doing. Calm, third-party-cited (Blowfish), paternal-protective, no scare vocabulary. | **Mixed**. Has correct shape *when it fires* (IE048 *"You can't send to your own Infinex account address. Use Move instead"* → Logan Roy / Commanding; IE098 *"To ensure you can recovery your full portfolio..."* → Tywin Lannister / Commanding). But undermined by: (a) IE099 *"Henlo, and furthermore deploy your Beravault"* on a funds-at-risk surface; (b) Blockaid pass-through — institutional voice belongs to Blockaid, Infinex is the messenger; (c) EmergencyAnnouncementBanner ships with **no default copy** — every emergency is improvised. |
| **Founder voice (brand-account)** | Off the brand account. Founder posts from personal handle. | All over the brand account — apology tweet *"We got the sale wrong"*, Sonar sale tweets, Yaprun pause blog post, even funds-at-risk app surfaces (IE099). |
| **Thesis voice (longform)** | Phantomblog has a dedicated longform register (founder voice surfacing for funding announcement + product post; Crypto101 articles in tutorial register from a different staff member). | infinex.xyz/news is split across № N product-update series + founder-thesis longform (Superapp Thesis, Governance Retake). Same register as the tweets — single voice. |

## Trait radar (per-axis percentages)

Open `research/phantom-vs-infinex-radar.html` for the interactive version. Text snapshot:

| Surface | %Stable | %Near | %Pen | %Circ | %Doing | %Spell+Vision | %Passion/Time | %Cm+So+Aa | n |
|---|---|---|---|---|---|---|---|---|---|
| Phantom website | 49 | 16 | 47 | 29 | **61** | 39 | 25 | 34 | 89 |
| Phantom tweets | 18 | 29 | 35 | 29 | 25 | 18 | **49** | 27 | 55 |
| Phantom app-adjacent | **52** | 16 | 43 | 28 | 60 | 32 | 16 | 33 | 92 |
| Phantom app | 7 | 2 | 8 | 2 | 26 | 2 | 3 | 5 | 243 |
| **Infinex marketing** | 44 | 9 | 37 | 19 | **66** | 30 | 16 | 26 | 70 |
| **Infinex utility** | 33 | 10 | 26 | 20 | 48 | 14 | 21 | 22 | 99 |
| **Infinex emergency** | 31 | 8 | 47 | 16 | 60 | 15 | 27 | **53** | 99 |
| **Infinex tweets** | 50 | 12 | **69** | 15 | 37 | 48 | 48 | **62** | 52 |
| **Infinex blog** | 68 | 3 | 60 | 18 | 45 | **57** | 33 | 50 | 60 |
| *INFINEX LOCKED (target)* | *100* | *0* | *100* | *0* | *0* | *100* | *0* | *60* |  |

**Readings:**

- **Infinex marketing ≈ Phantom marketing**: Same shape on every axis (~45/40/65/30). The brand's marketing surface fires as consumer-fintech-Doing, not as the locked Werle/Spell-Vision target.
- **Infinex tweets are the highest-Penetrating surface in either brand (69%)** — that's the founder thesis writing in compressed form. Holds Stable + Penetrating strongly while also carrying 48% Passion/Time (the Sonar urgency + the apology weight).
- **Infinex blog has the highest Spell+Vision share of any surface (57%)** — the founder longform is where the locked spec actually lives. 60 samples vs 268 Infinex marketing+utility+emergency = the smallest-volume surface is the one staying on-spec.
- **Phantom app is structurally invisible** (max 26% on any axis) — chrome discipline is real. Infinex utility partially follows (lots of unknowns) but with more leaks of character into UI strings.
- **Infinex emergency has the second-highest decisive-tempi share (53% Cm+So+Aa)**, behind only Infinex tweets — when the emergency surface fires, the right tempo cluster IS active. The failure mode is leakage (IE099 sociable-passion intrusion), not capability absence.

## The two gaps stacked

### Gap 1 — Cast gap (Phantom has 4 voices; Infinex has 1)

Phantom routes registers to different "people":
- Marketing guy speaks at the front door
- Ops guy goes silent in the chrome
- Cultural guy plays in tweets (market-pulse)
- Security guy takes the wheel in friction

Infinex routes everything through the founder voice:
- Same person writes the homepage hero, the Sonar sale tweets, the apology, the Yaprun pause blog post, and (occasionally) sneaks into the in-product banner (IE099).
- The cast architecture isn't there. There's no "Infinex security correspondent" or "Infinex cultural account" — there's just Kain at the keyboard.

This isn't necessarily *bad*. Single-voice has its own discipline (Apple under Steve Jobs, Stripe under Patrick Collison). But it costs founder bandwidth and it limits how many surfaces you can cover credibly.

### Gap 2 — Fidelity gap (Infinex's one voice doesn't reliably hit the locked spec)

The locked Infinex spec is **Stable + Flow + Penetrating + Spell-Vision** (Werle, no Passion, no Time-pressure).

Shipped reality:

- **Blog (founder thesis)**: 57% Spell-Vision — closest to locked, but still 45% Doing mixed in
- **Tweets**: 48% Spell-Vision AND 48% Passion/Time — the Sonar urgency and the apology weight pull off-spec consistently
- **Marketing**: only 30% Spell-Vision, 66% Doing — same shape as Phantom marketing, not the locked Werle
- **Utility, emergency**: Spell-Vision share drops to 14-15%, Doing dominates (48-60%)

The locked spec lives in the blog. Everywhere else, the shipped voice is Stable + Penetrating + Doing — same as Phantom's operating voice. **The brand has been auditing against the blog/thesis voice as if it were the product voice, but the product voice has always been something else.**

## Killer samples — side by side

### Phantom security guy at full extension

> *"Domain found on blocklists maintained by: Blowfish. This website is very likely to be a scam. If you believe this is a mistake, please contact them."*

> *"For your safety, Phantom has blocked this request."*

Stacked register: Awake-Acute (forensic, third-party-cited) → Stable Commanding (Aragorn-at-the-gate, paternal-protective). Doing drive throughout. No scare vocabulary. No exclamation marks. No all-caps. Quiet authority. **This is what we mean by "the security guy."**

### Infinex doing the security voice WELL (proves capability)

> *"You can't send to your own Infinex account address. Use Move instead."* (IE048, Logan Roy anchor — Stable + Penetrating + Commanding)

> *"To ensure you can recovery your full portfolio from your Infinex wallet, enable recovery with a verified email"* (IE098, Tywin Lannister anchor — but shipped with a typo)

These read as institutional, settled, refusal-without-explanation. The locked-Infinex character does the security register cleanly when it shows up.

### Infinex doing the security voice BADLY (the visible failure)

> *"Henlo, and furthermore deploy your Beravault"* (IE099)

Classified: Near + Flow-free + Circumscribing + Passion-Doing → Sociable. Anthony Bourdain / CT-meme anchor. **On a funds-at-risk surface (vault deployment).** This is the cultural guy / shitposter voice intruding where the security guy belongs.

### The empty seat

> `{{message}}` — EmergencyAnnouncementBanner (IE033). No shipped default. Every emergency announcement is improvised by whoever's at the keyboard at the moment.

In Phantom's world this slot would have a default written by the security correspondent. In Infinex's world it's a blank waiting for the founder to type into it under pressure.

## Specific failures the dogfood triage already flagged + what classification confirms

- **DF-001** (secret inputs shown in cleartext on import) — no shipped masking copy anywhere in the platform repo. The security-guy voice doesn't speak here at all.
- **DF-003** (send-to-self error) — refusal exists as IE048 in the correct register, but no recovery copy alongside. Half a security-guy moment.
- **IE098 typo** ("recovery" should be "recover") — security-voice copy that *ships* but doesn't get proof-read like marketing copy does.
- **IE004 template** — `"…by Blockaid. {description}."` will double-punctuate when description ends in a period.

## What this implies — strategic options

The user's question was *"where are we falling down vs Phantom OG."* Answers, in order of leverage:

### Option A — Hire / commission a security correspondent character

Define a `SECURITY_VOICE` `CharacterSpec` alongside `INFINEX_VOICE`. Same skeleton, different placement:

- Inner: Stable (locked)
- Stress: Space-direct or Time-bound (not Flow)
- Aspect: Penetrating (locked)
- Drive: **Doing + Spell** (action + patient-protector). NOT Spell-Vision. The "Aragorn at the gate" anchor.
- Main tempi: Commanding, Awake-Acute, Sombre — narrower rotation than the marketing 5.
- Structural traits: third-party-cited where applicable, no scare vocabulary, no exclamation marks, no founder voice intrusion, always provides recovery path.

Audit every emergency surface against this spec, not the marketing spec.

### Option B — Lock the EmergencyAnnouncementBanner default + the missing P0 surfaces

The empty slot at IE033 is a load-bearing gap. Write a `default_emergency_announcement` template + write security-correspondent voice for the dogfood-flagged P0 surfaces (DF-001 secret-input masking, address-swap warning, sanctioned-region screen, high-value send confirmation, anti-phishing education). These are 10-20 strings of copy total — small effort, large surface-area improvement.

### Option C — Accept the cast gap; double down on single-voice

Don't add characters. Instead: limit Infinex to surfaces the founder voice can credibly cover, and let Blockaid / partners speak in the friction surfaces. This is a valid strategic choice (and matches Linear / Pendle's posture). The cost: any surface Infinex needs to staff itself becomes founder bandwidth, and IE099-style register failures become more likely under load.

### Option D — Acknowledge the fidelity gap; relock the spec

The locked spec (Spell-Vision Werle) describes the blog voice, not the marketing voice or the product voice. Two paths:

- **Tighten shipped copy toward the locked spec** — explicit work to make marketing read more like the blog. Costly.
- **Relock the spec to match shipped reality** — accept that Infinex's actual voice is Stable + Penetrating + Doing-with-Vision-and-Spell-mixed; relock around that, and reserve pure Spell-Vision for hero / thesis moments. Cheaper, but admits the original lock was aspirational.

### Recommended ordering

1. **Option B** first (it's 10-20 strings + filling the EmergencyAnnouncementBanner default). High leverage, low effort, fixes IE099-class failures.
2. **Option A** second — commission the security-correspondent CharacterSpec + add to comms-factory's voice registry alongside `INFINEX_VOICE`, `CREAM_VOICE`, etc. Use it to audit emergency surfaces specifically.
3. **Option D** as a separate strategic conversation — the fidelity-gap finding deserves its own decision, not bundled with the cast-gap fix.
4. **Option C** is the path of doing nothing; if you take it, take it knowingly.

## Methodology notes

- All classifications via `scripts/classify-corpus.ts`, Sonnet 4.6, system prompt teaches the Mirodan framework with 5 worked literary anchors. Same prompt run against all 9 surfaces — apples-to-apples.
- Trait percentages computed by `scripts/render-laban-radar.py`. The 8th axis (Commanding+Sombre+Awake-Acute tempi) is a composite — the "decisive-weight" cluster where friction voice lives. Can be split into 3 axes if the composite is unhelpful.
- Sample counts: Phantom 479 (W89 + T55 + AA92 + APP243), Infinex 380 (M70 + U99 + E99 + T52 + B60). Total 859 classifications.
- Unknown classifications are kept in the denominator — an "unknown" sample means "this string is too short/generic to read a placement," which is itself a meaningful signal (chrome surfaces produce lots of unknowns; this is the truth about those surfaces).

## Files produced

- `research/phantom-corpus-{website,tweets,app-adjacent,app}.md` — Phantom corpora (479 samples)
- `research/infinex-corpus-{marketing,utility,emergency,tweets,blog}.md` — Infinex corpora (380 samples)
- `research/phantom-classifications-*.json` + `research/infinex-classifications-*.json` — per-surface classifications
- `research/phantom-laban-coherence.md` — Phantom-only coherence analysis
- `research/infinex-laban-coherence.md` — Infinex-only coherence analysis
- `research/phantom-vs-infinex-radar.html` — interactive radar (open in browser)
- `scripts/classify-corpus.ts` — reusable Laban classifier (works for any brand)
- `scripts/analyze-laban-coherence.py` — reusable coherence analyzer
- `scripts/render-laban-radar.py` — reusable radar visualization
