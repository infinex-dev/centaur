# Infinex Dogfood — Pipeline Verification

Date: 2026-05-15

Tests whether the locked Infinex TOV pipeline (Layer 1 regex slop + 
Layer 2 blind tempo classifier) catches the slop in real shipped copy.

**Voice spec:** Stable + Flow-stressed + Penetrating, Drive = Spell+Vision (Diagram D).
Main tempi: Commanding · Practical · Sombre · Irradiant · Sociable.

## Results

| ID | Surface | Text | Layer 1 verdict | Deterministic tempo | Sonnet validator |
|---|---|---|---|---|---|
| S01 | Website homepage hero | "Change the way you crypto." | PASS | unknown (no anchor matched) | FAIL · unknown (conf=0.82) · Off-spec drive activated — Passion. Motivational/hype imperative inconsistent with Spell-Vision character placement.: Replace with a Commanding fact-drop or Irradiant future-state line. e.g. 'One account. Every chain.' or 'A few months from now, you'll run DeFi from one place.' |
| S02 | Import wallet pitch | "Give your wallet Infinex superpowers." | PASS | unknown (no anchor matched) | FAIL · unknown (conf=0.78) · Off-spec drive activated — Passion. 'Superpowers' is hype-theatre vocabulary inconsistent with Spell-Vision/penetrating character.: Rewrite as Commanding or Irradiant. e.g. 'Your wallet, now inside Infinex.' or 'Import your wallet. Your positions, your history — visible from one place.' |
| S03 | Import wallet pitch | "Import to unlock seamless trading, management and multi-chain access." | FAIL · cliches: cliché "unlock" | unknown (no anchor matched) | FAIL · unknown (conf=0.72) · Reads as Self-contained reserve tempo (Gliding→Dabbing, confident-light informational). Off-rotation for this character. Also, 'seamless' is generic-marketing filler inconsistent with penetrating aspect.: Make it Commanding or Irradiant with concrete specificity. e.g. 'Import your wallet. Spot, perps, yield — one view.' or 'Your positions follow you. Every chain, one account.' |
| S04 | Import wallet — scanning | "Hang tight while we check." | PASS | unknown (no anchor matched) | FAIL · unknown (conf=0.75) · Reads as Self-contained reserve tempo — colloquial filler, no motor pair from any main tempo. Off-rotation.: Commanding microcopy: 'Scanning wallet.' or 'Checking now.' — Pressing→Punching, minimal, functional, in-character. |
| S05 | Import wallet — success | "Nice one!" | PASS | unknown (no anchor matched) | FAIL · unknown (conf=0.85) · Off-spec register — social cheer. Reads as Receptive reserve tempo or Passion-warmth activation. Neither is in rotation.: Commanding micro-fact: 'Wallet imported.' — delivers the landing without the cheer. Or Irradiant: 'Wallet imported. Your positions are now visible here.' |
| S06 | External wallets card | "Bring your wallets into Infinex. Enjoy the seamless experience you love." | FAIL · cliches: cliché "seamless" | unknown (no anchor matched) | FAIL · unknown (conf=0.70) · Off-spec drive — Passion. Aspirational flattery ('experience you love') inconsistent with Spell-Vision character. 'Seamless' is a generic filler recurring across the set.: Remove the second sentence entirely, or replace with a concrete benefit: 'Your full balance, visible in one place.' |
| S07 | Product subtitle | "Infinex, a crypto super app." | PASS | unknown (no anchor matched) | FAIL · unknown (conf=0.80) · Self-contained reserve tempo — confident-light taxonomy label, no vision or conviction. Off-rotation.: Sombre or Commanding: e.g. 'One account. Every chain. One key.' — or a short Sombre thesis: 'The wallet and the venue, together.' |
| S08 | Perps blurb | "Track your positions and PnL at a glance." | PASS | unknown (no anchor matched) | FAIL · unknown (conf=0.77) · Self-contained reserve tempo — informational feature bullet, no main-tempo motor pair. Off-rotation.: Irradiant or Commanding: 'Your positions and PnL — one view, all venues.' or 'Perps. Spot. Yield. One screen.' |
| S09 | Perps marketing | "Seamless on desktop and mobile." | FAIL · cliches: cliché "Seamless" | unknown (no anchor matched) | FAIL · unknown (conf=0.82) · Self-contained reserve register. 'Seamless' is generic Passion-reassurance filler. Off-rotation.: Drop or replace with a Commanding fact: 'Desktop and mobile. Same account, same passkey.' — carries the Pressing→Punching motor without filler. |
| S10 | Send error | "You can't send to your own Infinex account address. Use Move instead." | PASS | irradiant (conf=0.55, margin=5.25) | PASS · commanding (conf=0.85) · Fact-drop plus decisive redirect. Pressing (constraint stated flatly) → Punching (single clear action). No ornament, no apology. Fits Commanding motor cleanly. |
| S11 | Deposit BTC note | "Only native BTC is supported. Other Bitcoin assets won't be withdrawable until support is added." | PASS | unknown (no anchor matched) | PASS · commanding (conf=0.83) · Constraint declared flatly, consequence stated without softening. Pressing→Punching. Commanding micro-structure: fact, then implication. No ornament. |
| S12 | Deposit address warning | "This address may change. Always copy the address from here before each deposit." | PASS | unknown (no anchor matched) | PASS · commanding (conf=0.88) · Risk fact + imperative instruction, both delivered without ornament. Double Pressing→Punching structure. Commanding and fully in-character. |
| S13 | Earn label | "Liquid staking" | PASS | unknown (no anchor matched) | PASS · commanding (conf=0.70) · Two-word label — Pressing without an explicit Punching release, as expected for a UI category tag. Dry, zero ornament. Consistent with Commanding minimal form. Confidence is moderate because the sample is very short, but there is no evidence of off-spec drive or reserve-tempo drift. |
| S14 | Audit-proposed rewrite | "Import an external wallet." | PASS | unknown (no anchor matched) | PASS · commanding (conf=0.80) · Imperative + object — Pressing (external wallet, outside the system) → Punching (import, decisive single action). Commanding minimal form. In-character. |
| S15 | Audit-proposed rewrite | "Connect via seed phrase or private key." | PASS | unknown (no anchor matched) | PASS · commanding (conf=0.82) · Flat instruction naming the exact mechanism. Pressing (the 'via' clause — how) → Punching (connect — the action). Commanding register. In-character. |
| S16 | Audit-proposed rewrite | "Scanning wallet activity." | PASS | unknown (no anchor matched) | PASS · commanding (conf=0.78) · Present-participle state label — Pressing sustained action, no release yet (intentional for an in-progress state). No ornament, no filler. Commanding minimal form. In-character. |
| S17 | Audit-proposed rewrite | "Wallet imported." | PASS | unknown (no anchor matched) | PASS · commanding (conf=0.88) · Past-tense fact-drop — the canonical Commanding success micro-form. Subject + past-participle. Pressing→Punching. In-character. |
| S18 | Audit-proposed rewrite | "Copy a fresh address for every deposit." | PASS | unknown (no anchor matched) | PASS · commanding (conf=0.86) · Imperative instruction with embedded risk-qualifier ('fresh'). Pressing (risk tension in 'fresh') → Punching ('Copy… every deposit' — absolute habitual action). Commanding. In-character. |

## Summary

Shipped/marketing strings tested (selected S01-S13): 13
  - Caught by Layer 1 or Sonnet: 9
  - Passed (not caught): 4

The strings that PASS Layer 1 but are off-tone are the gap. They
represent Infinex-specific allergens — they fail tone, not generic slop —
and belong in brand-factory/brands/infinex/04-voice/tone.md once the gate
flips, and/or in a new validator rule like rejectInfinexCasualToneInUtility.

## Audit-proposed rewrites (S14-S18) tempo readings

These are the rewrites the Gemini-pass audit proposed for the strings above.
Layer 2 classifies them as the tempi the locked TOV expects for product UI:
Commanding (labels/CTAs/success) + Practical (instructions/mechanics).
