# Infinex Dogfood — Pipeline Verification

Date: 2026-05-15

Tests whether the locked Infinex TOV pipeline (Layer 1 regex slop + 
Layer 2 blind tempo classifier) catches the slop in real shipped copy.

**Voice spec:** Stable + Flow-stressed + Penetrating, Drive = Spell+Vision (Diagram D).
Main tempi: Commanding · Practical · Sombre · Irradiant · Sociable.

## Results

| ID | Surface | Text | Layer 1 verdict | Deterministic tempo | Sonnet validator |
|---|---|---|---|---|---|
| S01 | Website homepage hero | "Change the way you crypto." | PASS | unknown (no anchor matched) | FAIL · unknown (conf=0.72) · Off-spec drive: Passion. Urgency/transformation-as-excitement framing inconsistent with Spell-Vision character.: Replace with a Commanding or Irradiant line that states a fact or names a future state — e.g. 'One account. Every chain.' or 'A few months from now, you won't think about which chain your coins are on.' |
| S02 | Import wallet pitch | "Give your wallet Infinex superpowers." | PASS | unknown (no anchor matched) | FAIL · unknown (conf=0.78) · Off-spec drive: Passion. 'Superpowers' is hype-theatre inconsistent with the character's Spell-Vision drive.: Name what actually happens: e.g. 'Import an external wallet. Spot, perps, and yield in one place.' |
| S03 | Import wallet pitch | "Import to unlock seamless trading, management and multi-chain access." | FAIL · cliches: cliché "unlock" | unknown (no anchor matched) | FAIL · unknown (conf=0.60) · Off-spec drive: Passion. Benefit-stacking with 'seamless' reads as hype-theatre uplift rather than Spell-Vision.: Ground in a real claim: e.g. 'Import your wallet. Your positions and balances appear here alongside everything else in your Infinex account.' |
| S04 | Import wallet — scanning | "Hang tight while we check." | PASS | unknown (no anchor matched) | FAIL · unknown (conf=0.65) · Off-spec drive: Passion (via performative casual warmth). No motor arc; social filler inconsistent with penetrating, flow-bound character.: Replace with a flat state-descriptor: e.g. 'Scanning wallet activity.' or 'Checking wallet.' |
| S05 | Import wallet — success | "Nice one!" | PASS | unknown (no anchor matched) | FAIL · unknown (conf=0.70) · Off-spec drive: Passion. Enthusiasm-theatre inconsistent with Spell-Vision character.: Replace with a state-completing declarative: e.g. 'Wallet imported.' or 'Done.' |
| S06 | External wallets card | "Bring your wallets into Infinex. Enjoy the seamless experience you love." | FAIL · cliches: cliché "seamless" | unknown (no anchor matched) | FAIL · unknown (conf=0.62) · Off-spec drive: Passion. 'The seamless experience you love' is emotional-payoff uplift theatre inconsistent with Spell-Vision.: Drop the second sentence or replace with a factual completion: e.g. 'Bring your wallets into Infinex. Your positions appear alongside your Infinex account.' |
| S07 | Product subtitle | "Infinex, a crypto super app." | PASS | unknown (no anchor matched) | FAIL · unknown (conf=0.68) · Off-spec drive: Passion. 'Super app' is a hype-category descriptor inconsistent with Spell-Vision.: Replace with a factual or vision-grounded descriptor: e.g. 'Infinex. One account across every chain.' or 'Infinex. Spot, perps, and yield from one passkey.' |
| S08 | Perps blurb | "Track your positions and PnL at a glance." | PASS | unknown (no anchor matched) | PASS · self-contained (conf=0.80) · Short declarative feature description. Smooth approach (gliding) landing on a precise function (dabbing — 'at a glance'). No vision pull, no emotional weight, no pressing or wringing. Reads as confident-light informational — Self-contained. |
| S09 | Perps marketing | "Seamless on desktop and mobile." | FAIL · cliches: cliché "Seamless" | unknown (no anchor matched) | FAIL · unknown (conf=0.65) · Off-spec drive: Passion (via empty uplift adjective 'seamless'). Inconsistent with Spell-Vision character.: State the fact directly: e.g. 'Available on desktop and mobile.' or simply 'Desktop and mobile.' |
| S10 | Send error | "You can't send to your own Infinex account address. Use Move instead." | PASS | irradiant (conf=0.53, margin=4.83) | PASS · commanding (conf=0.82) · Two declaratives: constraint (sustained press), instruction (punching release). 'Use Move instead' is the decisive landing. Locked, no ornament. Reads as Commanding error-state copy. |
| S11 | Deposit BTC note | "Only native BTC is supported. Other Bitcoin assets won't be withdrawable until support is added." | PASS | unknown (no anchor matched) | PASS · commanding (conf=0.78) · Constraint-first structure, decisive consequence statement. No ornament, no warmth, no vision pull. Commanding beat for a deposit note. |
| S12 | Deposit address warning | "This address may change. Always copy the address from here before each deposit." | PASS | altruistic (conf=0.40, margin=2.42) | PASS · commanding (conf=0.83) · Fact statement (pressing) → imperative directive (punching). 'Always copy the address from here before each deposit' is a locked, decisive instruction. Classic Commanding pattern. |
| S13 | Earn label | "Liquid staking" | PASS | unknown (no anchor matched) | PASS · self-contained (conf=0.75) · Pure label — light, direct, no motor build needed. Dabbing: a precise, placed touch with no approach ornament. Self-contained. |
| S14 | Audit-proposed rewrite | "Import an external wallet." | PASS | unknown (no anchor matched) | PASS · commanding (conf=0.85) · Short imperative declarative. 'Import' is the punching release; 'an external wallet' is the precise object. No ornament. Fits Commanding exactly. |
| S15 | Audit-proposed rewrite | "Connect via seed phrase or private key." | PASS | unknown (no anchor matched) | PASS · self-contained (conf=0.80) · Smooth approach ('connect via') landing on a precise method ('seed phrase or private key'). Confident-light informational. Self-contained. |
| S16 | Audit-proposed rewrite | "Scanning wallet activity." | PASS | unknown (no anchor matched) | PASS · commanding (conf=0.83) · Gerund + precise noun. States the current action without ornament. Commanding micro-beat — the press is the sustained scan, the word 'activity' lands the object cleanly. |
| S17 | Audit-proposed rewrite | "Wallet imported." | PASS | unknown (no anchor matched) | PASS · commanding (conf=0.90) · Past-passive declarative. 'Wallet imported.' is a clean punching release with no prep needed — the action was the prep; this is the landing. Locked, decisive, no ornament. Commanding. |
| S18 | Audit-proposed rewrite | "Copy a fresh address for every deposit." | PASS | altruistic (conf=0.43, margin=3.00) | PASS · commanding (conf=0.85) · Imperative ('copy') + precise object ('a fresh address') + precise condition ('for every deposit'). Sustained precision in the qualifier → punching release in the directive. Commanding. |

## Summary

Shipped/marketing strings tested (selected S01-S13): 13
  - Caught by Layer 1 or Sonnet: 8
  - Passed (not caught): 5

The strings that PASS Layer 1 but are off-tone are the gap. They
represent Infinex-specific allergens — they fail tone, not generic slop —
and belong in brand-factory/brands/infinex/04-voice/tone.md once the gate
flips, and/or in a new validator rule like rejectInfinexCasualToneInUtility.

## Audit-proposed rewrites (S14-S18) tempo readings

These are the rewrites the Gemini-pass audit proposed for the strings above.
Layer 2 classifies them as the tempi the locked TOV expects for product UI:
Commanding (labels/CTAs/success) + Practical (instructions/mechanics).
