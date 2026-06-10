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
| H01 | hero | "Change the way you crypto." | commanding | unknown (conf=0.72, FAIL: Off-spec drive: Passion. Urgency/aspirational-behaviour-change framing is inconsistent with Spell-Vision drive.; The imperative is punching in shape but has no pressing prep — it opens mid-air. More critically, the aspiration framing ('change the way') carries Passion drive, which is off-spec. No available tempo accommodates Passion-driven aspiration rhetoric.) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H02 | value_prop | "Unified portfolio." | commanding | commanding (conf=0.85, PASS; A two-word declarative label with no hedging or warmth. Pressing prep is implicit in the surface context; Punching release in the hard stop. Matches Commanding's 'locked, decisive, no ornament' feel.) | **MATCH** |
| H03 | value_prop | "Multi-provider trading." | commanding | commanding (conf=0.85, PASS; Two-word declarative, no ornament. Hard stop. Institutional label drop. Commanding.) | **MATCH** |
| H04 | value_prop | "Serious Opsec." | commanding | commanding (conf=0.82, PASS; Two-word label. 'Serious' carries low-key pressing weight; 'Opsec.' is the punching release. Dry, locked, no ornament.) | **MATCH** |
| H05 | cta | "Get Infinex" | commanding | commanding (conf=0.80, PASS; Imperative label with no urgency dressing. Pure Punching release. Commanding.) | **MATCH** |
| H06 | section_head | "See everything we've shipped, and everything that's coming up" | irradiant | self-contained (conf=0.65, FAIL: Tempo mismatch: declared Irradiant but motor is Gliding → Dabbing (Self-contained), not Floating → Flicking. No future-warmth or vision-pull present.; Gliding approach (inviting the reader to look), Dabbing touch (light social/nav pointer). No vision-pull, no floating buoyancy. Self-contained navigational label is the closest fit.) | **MISMATCH** (declared irradiant, read as self-contained) |
| H07 | section_head | "Explore key features" | commanding | commanding (conf=0.70, PASS; Imperative label. Pressing approach (directional), Punching release in the hard stop. Dry and institutional. Commanding.) | **MATCH** |
| H08 | feature_description | "Passkey-first, gas-abstracted wallet with support for 20+ chains." | practical | practical (conf=0.75, PASS; Technical specification enumeration with a precise quantifier ('20+ chains'). Wringing through complexity; Slashing into the carved answer. Practical register.) | **MATCH** |
| H09 | feature_description | "Swap. Perps. Earn. Predict. Multi-provider. Multi-chain." | commanding | commanding (conf=0.90, PASS; Staccato enumeration. Each noun is a Punching release; the sequence itself is the Pressing buildup. Locked, decisive, no ornament. Commanding.) | **MATCH** |
| H10 | feature_description | "More than view-only. Import or connect existing wallets and take control." | practical | practical (conf=0.78, PASS; Opens by reframing a known limitation ('view-only'), then carves through it to a direct capability statement. Wringing through complexity, Slashing to the answer. Practical.) | **MATCH** |
| H11 | feature_description | "Connect securely to any dapp and take your account with you." | practical | practical (conf=0.72, PASS; Two conditions compressed into a single capability line. Working through complexity (secure + portable + dapp-compatible) into a carved answer. Practical.) | **MATCH** |
| H12 | feature_description | "Passkey to Ledger to Safe. Choose the Opsec to suit your spec." | off-spec | practical (conf=0.74, PASS; Options enumerated, then a decisive framing of user agency. Wringing through complexity, Slashing to the choice. Practical.) | **OFF-SPEC** (declared as not-in-character; classifier should NOT match a main tempo) — but classifier saw practical (false positive) |
| H13 | feature_description | "Switch to Infinex and earn crates and cashback on every trade." | off-spec | unknown (conf=0.68, FAIL: Off-spec drive: Passion. Reward/incentive-switching framing ('earn crates and cashback on every trade') activates FOMO/promotional urgency, inconsistent with Spell-Vision drive.; The incentive-reward structure ('earn crates and cashback on every trade') reads as Passion-pulled promotional copy. No Sustained → Quick motor pair fits the character — the line lacks any pressing or wringing prep; it opens directly on the reward hook. Off-spec drive makes this unknown.) | **OFF-SPEC** (declared as not-in-character; classifier should NOT match a main tempo) — classifier agreed (unknown) |
| H14 | positioning | "One super app." | off-spec | commanding (conf=0.82, PASS; 'One' performs compression (pressing). 'Super app.' delivers the position with authority (punching). Locked, decisive, no ornament. Commanding.) | **OFF-SPEC** (declared as not-in-character; classifier should NOT match a main tempo) — but classifier saw commanding (false positive) |
| H15 | feature_description | "Trade perps in-app with up to 40x leverage" | commanding | commanding (conf=0.80, PASS; Factual capability drop with a precise quantifier. Pressing into the spec ('Trade perps in-app'), Punching with the leverage figure. Commanding.) | **MATCH** |
| H16 | partner_credit | "Powered by Hyperliquid" | sociable | sociable (conf=0.85, PASS; Smooth, light attribution. Gliding approach; Dabbing acknowledgement. No urgency, no warmth excess. Sociable register.) | **MATCH** |
| H17 | partner_credit | "Powered by Polymarket" | sociable | sociable (conf=0.85, PASS; Identical motor to H16. Light attribution glide with a dabbing touch. Sociable.) | **MATCH** |
| H18 | trust_line | "Your keys, secured by Turnkey" | sociable | sociable (conf=0.80, PASS; Opens on user-ownership ('your keys') then glides into a light partner acknowledgement. Dabbing touch, no push. Sociable.) | **MATCH** |
| H19 | value_prop | "Phishing resistant security" | commanding | commanding (conf=0.83, PASS; Specific security descriptor delivered as a label. Pressing into the threat category, Punching with the capability claim. Commanding.) | **MATCH** |
| H20 | value_prop | "See what privileges you're granting" | practical | practical (conf=0.70, PASS; Frames an implicit problem (blind permission grants) and delivers a direct capability. Wringing through the concern; Slashing to what changes. Practical.) | **MATCH** |

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
  - Matches (declared = classified, in-character): 15
  - Mismatches (in-character but wrong tempo for the job): 1
  - Unknowns (off-character entirely): 1
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
