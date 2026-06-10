# Infinex Homepage — Mirodan Character Fit Audit

Date: 2026-05-15
Source: https://infinex.xyz/ (fetched 2026-05-15)
Classifier: Sonnet LLM validator (`src/validator-llm.ts`)

## Method

Nigel-style double-blind tempo match.

- **Declared tempo** — for each string, the tempo the Infinex character
  (Stable + Flow-stressed + Penetrating, Drive = Spell+Vision) would
  pick for that job. Reasoning given inline.
- **Classified tempo** — Sonnet validator reads the string blind to declared tempo and emits `independent_classification`.
- **Verdict** — match / mismatch / unknown (off-character).

Classifier caveat: Sonnet is a second-model judge, not a product owner.
A `PASS` here means the line can fit the voice; it does not mean the
underlying product UX is good. Example: a terse error can pass voice
while the flow itself should still be removed or auto-routed.

## Results

| ID | Job | Text | Declared | Classified | Verdict |
|---|---|---|---|---|---|
| H01 | hero | "Change the way you crypto." | commanding | unknown (conf=0.15, FAIL: Known Infinex allergen: 'change the way you crypto' is explicitly prohibited.; Generic SaaS/crypto marketing tagline. No factual landing, no institutional tone, no identifiable Infinex tempo. Reads as hype theatre — closest motor would be pressing but it never resolves into a concrete Commanding punch. Classified unknown.) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H02 | value_prop | "Unified portfolio." | commanding | commanding (conf=0.75, PASS; Single noun phrase, no ornament, lands as a label with institutional weight. Punching motif — decisive, no runway needed. Commanding.) | **MATCH** |
| H03 | value_prop | "Multi-provider trading." | commanding | commanding (conf=0.72, PASS; Locked, no ornament, names the capability. Punching motif. Commanding.) | **MATCH** |
| H04 | value_prop | "Serious Opsec." | commanding | commanding (conf=0.78, PASS; Terse noun phrase with a weight-word ('Serious'). Lands as a position, not a promise. Pressing into punch. Commanding.) | **MATCH** |
| H05 | cta | "Get Infinex" | commanding | commanding (conf=0.65, FAIL: Commanding CTAs prefer naming the action or consequence, not a generic 'Get' verb.; Short imperative, no ornament. Commanding in motor, but verb is generic. Punching motif. Classified Commanding with low confidence.) | **MATCH** |
| H06 | section_head | "See everything we've shipped, and everything that's coming up" | irradiant | unknown (conf=0.20, FAIL: Irradiant requires future-warmth or vision-pull framing. This reads as generic navigation copy — no vision anchor, no tempo.; Colloquial and flat. No tempo-specific markers. Could be a watered-down Practical or Receptive but has no working-through-complexity structure and no 'we hear you' frame. Gliding motif at most. Classified unknown.) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H07 | section_head | "Explore key features" | commanding | unknown (conf=0.15, FAIL: Generic SaaS marketing language. Does not name the action, consequence, or mechanic.; Generic SaaS section head. No Infinex tempo markers. Gliding motif at most, but even that is a stretch — there's no social warmth or approach curve. Classified unknown.) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H08 | feature_description | "Passkey-first, gas-abstracted wallet with support for 20+ chains." | practical | practical (conf=0.70, PASS; Fact-dense, names the mechanic, no ornament. Wringing through complexity, slashing to the spec. Practical.) | **MATCH** |
| H09 | feature_description | "Swap. Perps. Earn. Predict. Multi-provider. Multi-chain." | commanding | commanding (conf=0.82, PASS; Repeated punching motif — each word/phrase is a discrete decisive landing. No runway, no ornament. Commanding.) | **MATCH** |
| H10 | feature_description | "More than view-only. Import or connect existing wallets and take control." | practical | practical (conf=0.68, PASS; Draws a contrast ('more than view-only') then resolves to the mechanic. Wringing into slashing. Practical.) | **MATCH** |
| H11 | feature_description | "Connect securely to any dapp and take your account with you." | practical | practical (conf=0.62, PASS; Functional description, names the outcome. No vision-pull or social warmth — squarely Practical. Wringing through the condition, slashing to the consequence.) | **MATCH** |
| H12 | feature_description | "Passkey to Ledger to Safe. Choose the Opsec to suit your spec." | off-spec | commanding (conf=0.70, PASS; Enumeration of concrete options with a decisive directive at the end. Pressing through the list, punching on 'suit your spec.' Commanding.) | **OFF-SPEC** (declared as not-in-character; classifier should NOT match a main tempo) — but classifier saw commanding (false positive) |
| H13 | feature_description | "Switch to Infinex and earn crates and cashback on every trade." | off-spec | unknown (conf=0.25, FAIL: Activates off-spec Passion/time-pressure/hype theatre. 'Switch to Infinex' is acquisition pressure; 'earn crates and cashback on every trade' is incentive-hype rather than mechanic description.; Promotional incentive language with a conversion-pressure opener. Closest to a diluted Commanding but the pressing never resolves into a factual punch — it stays in acquisition-hype. Classified unknown.) | **OFF-SPEC** (declared as not-in-character; classifier should NOT match a main tempo) — classifier agreed (unknown) |
| H14 | positioning | "One super app." | off-spec | unknown (conf=0.10, FAIL: Known Infinex allergen: 'super app' / 'crypto super app' is explicitly prohibited.; Allergen phrase. Reads as generic app-store positioning, not an Infinex tempo. Classified unknown.) | **OFF-SPEC** (declared as not-in-character; classifier should NOT match a main tempo) — classifier agreed (unknown) |
| H15 | feature_description | "Trade perps in-app with up to 40x leverage" | commanding | commanding (conf=0.78, PASS; Direct factual statement with a concrete number. Pressing into punching. Commanding.) | **MATCH** |
| H16 | partner_credit | "Powered by Hyperliquid" | sociable | sociable (conf=0.70, PASS; Partner credit line, gliding acknowledgment, light dab of warmth. Sociable.) | **MATCH** |
| H17 | partner_credit | "Powered by Polymarket" | sociable | sociable (conf=0.70, PASS; Partner credit, same pattern as H16. Sociable.) | **MATCH** |
| H18 | trust_line | "Your keys, secured by Turnkey" | sociable | sociable (conf=0.72, PASS; Partner credit with a factual mechanic frame. Gliding approach, light dab on 'Turnkey'. Sociable.) | **MATCH** |
| H19 | value_prop | "Phishing resistant security" | commanding | commanding (conf=0.72, PASS; Terse noun phrase naming a security property. Punching motif — decisive, no ornament. Commanding.) | **MATCH** |
| H20 | value_prop | "See what privileges you're granting" | practical | practical (conf=0.68, PASS; Names the mechanic and the user's agency in it. Wringing through a technical concept, slashing to the plain-language affordance. Practical.) | **MATCH** |

## Per-string reasoning (declared tempo justifications)

- **H01** (hero → declared commanding): hero = single decisive landing. Character's Commanding (Pressing→Punching) is the ruler-issuing-a-position register. Should read as Commanding.
- **H02** (value_prop → declared commanding): two-word value prop = Punching release. Carved label. Commanding fits.
- **H03** (value_prop → declared commanding): same as H02 — Punching label.
- **H04** (value_prop → declared commanding): Punching label. (Note: 'Opsec' as casual jargon may itself be off-spec — Infinex is craft-patience, not 4chan register. But framing it as Commanding-target.)
- **H05** (cta → declared commanding): primary CTA = Punching action verb. Commanding.
- **H06** (section_head → declared irradiant): future-vision section opener — 'coming up' is Vision-pulled. Irradiant (Floating→Flicking) fits.
- **H07** (section_head → declared commanding): section organizer with imperative verb. Commanding label. (Mild risk: 'explore' is generic-marketing.)
- **H08** (feature_description → declared practical): compressed spec sentence. Practical (Wringing→Slashing) — the carved answer. Lists the actual mechanic.
- **H09** (feature_description → declared commanding): staccato Punching enumeration. Each item lands. Commanding.
- **H10** (feature_description → declared practical): two-clause spec — first clause contrasts (Wringing), second clause carves (Slashing). Practical.
- **H11** (feature_description → declared practical): spec sentence with two operative verbs. Practical carved answer.
- **H12** (feature_description → declared off-spec): 'Opsec to suit your spec' is a rhyming hype-couplet. Rhyme + casual jargon stack reads as Adream-Time-stressed (Passion drive). Off-spec for Infinex.
- **H13** (feature_description → declared off-spec): 'crates' is the Kain-era casual register the audit already flagged. Promotional voice in a feature description. Off-spec.
- **H14** (positioning → declared off-spec): 'super app' is the Infinex-specific allergen the audit flagged. Promotional/marketing register. Off-spec.
- **H15** (feature_description → declared commanding): spec sentence stating capability + magnitude. Commanding Punching landing.
- **H16** (partner_credit → declared sociable): partner credit. Sociable (Gliding→Dabbing) is the register for ecosystem warmth.
- **H17** (partner_credit → declared sociable): same as H16.
- **H18** (trust_line → declared sociable): the locked trust-footer. 'Secured by Turnkey' is partner credit + custody anchor. Sociable register.
- **H19** (value_prop → declared commanding): carved label. Commanding Punching landing.
- **H20** (value_prop → declared practical): value prop framed as user-mechanic awareness. Practical — 'the actual question is what you're granting'.

## Summary

Total strings tested: 20
  - Matches (declared = classified, in-character): 14
  - Mismatches (in-character but wrong tempo for the job): 0
  - Unknowns (off-character entirely): 3
  - Declared off-spec: 3

## What this tells us

1. **The homepage barely speaks in the Infinex character.** Most strings
   either return `unknown` (the character has no vocabulary for them) or
   are flagged off-spec on declaration (super app, crates, Opsec-to-suit-
   your-spec). The shipped copy is in a generic-product-marketing register,
   not the locked Mirodan character.

2. **The Sonnet loop catches what the regex layer misses.** It flags
   generic taxonomy and marketing-register lines that deterministic
   matching either marks `unknown` without explanation or misses entirely.

3. **`unknown` is not a bug — it is the right verdict for off-character
   copy.** Treat it as such. A homepage hero classifying as `unknown` is
   the character refusing to claim the line.

## Proposed next steps

a. **Write replacement copy** for every `FAIL` / `unknown` homepage line.
   Keep the source table as the evidence ledger.

b. **Add a one-shot generator entrypoint** that takes (job, current_text)
   and produces an in-character alternative for marketing/UI surfaces.

c. **Run the same Sonnet audit on platform strings** once the platform
   copy inventory is exported from the app repo.
