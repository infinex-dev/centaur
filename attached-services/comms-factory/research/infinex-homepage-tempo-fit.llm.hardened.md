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
| H01 | hero | "Change the way you crypto." | commanding | unknown (conf=0.75, FAIL: Off-spec drive: Passion activated by exhortative behavioural transformation framing.; The imperative 'Change the way you…' is a rallying-cry shape — it carries Passion (urgency, behavioural transformation appeal) which is off-spec. It does not carry a Sustained factual press before a decisive landing. No main-rotation tempo fits cleanly; the nearest reserve would be Overpowering (full-conviction-with-emotion), which is out of rotation. Classifying unknown.) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H02 | value_prop | "Unified portfolio." | commanding | commanding (conf=0.72, PASS; Two-word label with no ornament, no emotional hook. Operates as a decisive institutional descriptor — the Pressing setup (what it is) landing with Punching brevity. Consistent with Commanding's 'locked, decisive, no ornament' feel.) | **MATCH** |
| H03 | value_prop | "Multi-provider trading." | commanding | commanding (conf=0.70, PASS; Noun-phrase label. Concise, institutional. Pressing → Punching motor — states the fact and stops. No emotional or aspiration framing.) | **MATCH** |
| H04 | value_prop | "Serious Opsec." | commanding | commanding (conf=0.70, PASS; Same sparse noun-phrase pattern. 'Serious' adds mild Pressing weight before 'Opsec' lands as the Punching close. No off-spec drive.) | **MATCH** |
| H05 | cta | "Get Infinex" | commanding | commanding (conf=0.72, PASS; Short imperative CTA. Pressing into Punching — a command without urgency theatre. Consistent with Commanding's 'ruler issuing a position' feel.) | **MATCH** |
| H06 | section_head | "See everything we've shipped, and everything that's coming up" | irradiant | unknown (conf=0.68, FAIL: Reserve tempo: reads as Self-contained (out-of-rotation). Lacks the Floating → Flicking motor required for Irradiant.; Reads as Self-contained — a neutral informational invitation with no vision pull, no Floating ascent, no Flicking release into future warmth. Self-contained is an out-of-rotation reserve tempo. No main-rotation tempo fits the shape of this line.) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H07 | section_head | "Explore key features" | commanding | unknown (conf=0.75, FAIL: Reserve tempo: reads as Self-contained. No Pressing → Punching Commanding motor present.; Wayfinding imperative with no factual anchor. The motor is a light Gliding → Dabbing — smooth approach with soft touch. That is Self-contained, not Commanding. Self-contained is out of rotation.) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H08 | feature_description | "Passkey-first, gas-abstracted wallet with support for 20+ chains." | practical | unknown (conf=0.72, FAIL: Reserve tempo: reads as Self-contained not Practical. No Wringing → Slashing arc — no tradeoff, no 'the hard part was' texture.; Attribute list with no reasoning arc. The motor is Gliding → Dabbing — smooth delivery of information without the Wringing tension of Practical. Self-contained reserve tempo. No main-rotation tempo fits.) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H09 | feature_description | "Swap. Perps. Earn. Predict. Multi-provider. Multi-chain." | commanding | commanding (conf=0.82, PASS; Staccato list — each period is a Punching closure. The accumulation presses, the final pair ('Multi-provider. Multi-chain.') punches out with institutional weight. Classic Commanding shape without ornament.) | **MATCH** |
| H10 | feature_description | "More than view-only. Import or connect existing wallets and take control." | practical | unknown (conf=0.65, FAIL: Reserve tempo (Self-contained) and mild off-spec Passion drive in 'take control' empowerment framing.; The contrast 'More than view-only' sets up a light contrast without the tension of Practical's Wringing motor. 'Take control' is an aspiration nudge. Overall Self-contained with a faint Passion echo. No main-rotation tempo fits cleanly.) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H11 | feature_description | "Connect securely to any dapp and take your account with you." | practical | unknown (conf=0.67, FAIL: Reserve tempo: Self-contained. No Wringing → Slashing Practical motor. Mild Passion in 'take your account with you'.; Smooth benefit statement. Gliding → Dabbing motor — no sustained pressure, no carved answer. Self-contained out-of-rotation reserve. The freedom framing ('take your account with you') is Passion-adjacent.) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H12 | feature_description | "Passkey to Ledger to Safe. Choose the Opsec to suit your spec." | off-spec | commanding (conf=0.76, PASS; First clause presses across a spectrum; second clause punches with a decisive imperative. Locked, no emotional pull, factual. Classic Commanding Pressing → Punching shape.) | **OFF-SPEC** (declared as not-in-character; classifier should NOT match a main tempo) — but classifier saw commanding (false positive) |
| H13 | feature_description | "Switch to Infinex and earn crates and cashback on every trade." | off-spec | unknown (conf=0.72, FAIL: Off-spec drive: Passion activated by incentive/reward urgency framing ('Switch… earn… every trade').; Incentive-call shape — 'Switch and earn' is promotional urgency. Passion drive is active (reward framing, behavioural switch imperative). No main-rotation tempo accommodates this shape without the incentive framing being stripped.) | **OFF-SPEC** (declared as not-in-character; classifier should NOT match a main tempo) — classifier agreed (unknown) |
| H14 | positioning | "One super app." | off-spec | unknown (conf=0.60, FAIL: Reserve tempo: Self-contained. 'Super app' is category-aspiration framing with no factual Pressing anchor.; 'Super app' is a marketing category claim — confident-light, no factual anchor, no motor arc. Closest reserve tempo is Self-contained. Does not carry the factual press of Commanding or the reasoning of Practical.) | **OFF-SPEC** (declared as not-in-character; classifier should NOT match a main tempo) — classifier agreed (unknown) |
| H15 | feature_description | "Trade perps in-app with up to 40x leverage" | commanding | unknown (conf=0.70, FAIL: Reserve tempo: Self-contained. No Pressing → Punching Commanding motor — reads as a spec bullet, not a declaration.; Attribute-spec sentence. Gliding → Dabbing motor — smooth delivery of a single feature fact with no buildup or decisive punch. Self-contained reserve tempo. Not Commanding.) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H16 | partner_credit | "Powered by Hyperliquid" | sociable | unknown (conf=0.65, FAIL: Reserve tempo: Self-contained passive attribution badge. Sociable requires active relational language.; Passive attribution phrase — 'Powered by X' is a badge/label with no relational warmth or motor arc. Self-contained reserve tempo. Sociable requires active relational framing ('Working with', 'Built with', 'Thanks to').) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H17 | partner_credit | "Powered by Polymarket" | sociable | unknown (conf=0.65, FAIL: Reserve tempo: Self-contained passive badge. Not Sociable — no active partner-relationship framing.; Same pattern as H16. Passive attribution with no relational motor. Self-contained out-of-rotation reserve.) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H18 | trust_line | "Your keys, secured by Turnkey" | sociable | unknown (conf=0.62, FAIL: Reserve tempo: Self-contained trust badge. Mild Passion-adjacent framing in 'Your keys' ownership appeal. Not Sociable.; Trust-badge with passive attribution. 'Your keys' ownership framing edges toward Passion (autonomy/empowerment appeal). No active Sociable relational motor. Self-contained reserve tempo.) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H19 | value_prop | "Phishing resistant security" | commanding | commanding (conf=0.71, PASS; Noun-phrase label — no ornament, no motor excess. Pressing (category: security) → Punching (specific claim: phishing-resistant). Consistent with Commanding's sparse institutional shape.) | **MATCH** |
| H20 | value_prop | "See what privileges you're granting" | practical | unknown (conf=0.68, FAIL: Reserve tempo: Self-contained UI instruction. No Wringing → Slashing Practical reasoning arc.; Short instructional imperative — smooth delivery of a UI action prompt. No Wringing tension, no carved answer, no tradeoff reasoning. Self-contained out-of-rotation reserve tempo.) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |

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
  - Matches (declared = classified, in-character): 6
  - Mismatches (in-character but wrong tempo for the job): 0
  - Unknowns (off-character entirely): 11
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
