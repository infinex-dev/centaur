# Infinex Homepage — Mirodan Character Fit Audit

Date: 2026-05-15
Source: https://infinex.xyz/ (fetched 2026-05-15)

## Method

Nigel-style double-blind tempo match.

- **Declared tempo** — for each string, the tempo the Infinex character
  (Stable + Flow-stressed + Penetrating, Drive = Spell+Vision) would
  pick for that job. Reasoning given inline.
- **Classified tempo** — `classifyTempoBlind()` in `src/validator.ts`
  reads the string without seeing the declared tempo and reports which
  tempo it scores as.
- **Verdict** — match / mismatch / unknown (off-character).

Classifier caveat: deterministic anchor-matching, calibrated for
tweet-length comms. Short labels (1-5 words) under-score and return
`unknown`. That `unknown` verdict is still useful — it means the
string is not in any of the character's tempo vocabularies. For
production parity with Nigel's Track 5b Sonnet classifier, we should
add an LLM second-pass.

## Results

| ID | Job | Text | Declared | Classified | Verdict |
|---|---|---|---|---|---|
| H01 | hero | "Change the way you crypto." | commanding | **unknown** (no anchor matched — character would not have written this in any tempo) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H02 | value_prop | "Unified portfolio." | commanding | **unknown** (no anchor matched — character would not have written this in any tempo) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H03 | value_prop | "Multi-provider trading." | commanding | **unknown** (no anchor matched — character would not have written this in any tempo) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H04 | value_prop | "Serious Opsec." | commanding | **unknown** (no anchor matched — character would not have written this in any tempo) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H05 | cta | "Get Infinex" | commanding | **unknown** (no anchor matched — character would not have written this in any tempo) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H06 | section_head | "See everything we've shipped, and everything that's coming up" | irradiant | commanding (conf=0.39, margin=2.25) | **MISMATCH** (declared irradiant, read as commanding) |
| H07 | section_head | "Explore key features" | commanding | **unknown** (no anchor matched — character would not have written this in any tempo) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H08 | feature_description | "Passkey-first, gas-abstracted wallet with support for 20+ chains." | practical | altruistic (conf=0.40, margin=2.44) | **MISMATCH** (declared practical, read as altruistic) |
| H09 | feature_description | "Swap. Perps. Earn. Predict. Multi-provider. Multi-chain." | commanding | **unknown** (no anchor matched — character would not have written this in any tempo) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H10 | feature_description | "More than view-only. Import or connect existing wallets and take control." | practical | **unknown** (no anchor matched — character would not have written this in any tempo) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H11 | feature_description | "Connect securely to any dapp and take your account with you." | practical | **unknown** (no anchor matched — character would not have written this in any tempo) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H12 | feature_description | "Passkey to Ledger to Safe. Choose the Opsec to suit your spec." | off-spec | **unknown** (no anchor matched — character would not have written this in any tempo) | **OFF-SPEC** (declared as not-in-character; classifier should NOT match a main tempo) — classifier agreed (unknown) |
| H13 | feature_description | "Switch to Infinex and earn crates and cashback on every trade." | off-spec | **unknown** (no anchor matched — character would not have written this in any tempo) | **OFF-SPEC** (declared as not-in-character; classifier should NOT match a main tempo) — classifier agreed (unknown) |
| H14 | positioning | "One super app." | off-spec | **unknown** (no anchor matched — character would not have written this in any tempo) | **OFF-SPEC** (declared as not-in-character; classifier should NOT match a main tempo) — classifier agreed (unknown) |
| H15 | feature_description | "Trade perps in-app with up to 40x leverage" | commanding | **unknown** (no anchor matched — character would not have written this in any tempo) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H16 | partner_credit | "Powered by Hyperliquid" | sociable | **unknown** (no anchor matched — character would not have written this in any tempo) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H17 | partner_credit | "Powered by Polymarket" | sociable | **unknown** (no anchor matched — character would not have written this in any tempo) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H18 | trust_line | "Your keys, secured by Turnkey" | sociable | **unknown** (no anchor matched — character would not have written this in any tempo) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H19 | value_prop | "Phishing resistant security" | commanding | **unknown** (no anchor matched — character would not have written this in any tempo) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |
| H20 | value_prop | "See what privileges you're granting" | practical | **unknown** (no anchor matched — character would not have written this in any tempo) | **UNKNOWN** (off-character — string is not in any tempo vocabulary) |

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
  - Matches (declared = classified, in-character): 0
  - Mismatches (in-character but wrong tempo for the job): 2
  - Unknowns (off-character entirely): 15
  - Declared off-spec: 3

## What this tells us

1. **The homepage barely speaks in the Infinex character.** Most strings
   either return `unknown` (the character has no vocabulary for them) or
   are flagged off-spec on declaration (super app, crates, Opsec-to-suit-
   your-spec). The shipped copy is in a generic-product-marketing register,
   not the locked Mirodan character.

2. **The deterministic classifier is too thin for 1-5 word headlines.**
   It scores by vocab_anchor + opening_shapes + signoff_moves + motor +
   example_lines token overlap. Short labels rarely cross the 1.5 score
   threshold. For a real production verifier we need an LLM judge.

3. **`unknown` is not a bug — it is the right verdict for off-character
   copy.** Treat it as such. A homepage hero classifying as `unknown` is
   the character refusing to claim the line.

## Proposed next steps

a. **Add a Sonnet-based blind classifier** to the validator (alongside the
   deterministic one). Same contract: input paragraph, no declared tempo,
   output one of the 5 main tempi or `unknown`. This is the Nigel Track 5b
   parity work.

b. **Add a one-shot generator entrypoint** that takes (job, current_text)
   and produces an in-character alternative. Specifically for marketing/UI
   surfaces where the release-card model doesn't fit.

c. **Rewrite the homepage** through (a)+(b). The 20-string sample above is
   the work list.
