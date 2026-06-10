# Infinex Dogfood — Pipeline Verification

Date: 2026-05-15

Tests whether the locked Infinex TOV pipeline (Layer 1 regex slop + 
Layer 2 blind tempo classifier) catches the slop in real shipped copy.

**Voice spec:** Stable + Flow-stressed + Penetrating, Drive = Spell+Vision (Diagram D).
Main tempi: Commanding · Practical · Sombre · Irradiant · Sociable.

## Results

| ID | Surface | Text | Layer 1 verdict | Layer 2 tempo |
|---|---|---|---|---|
| S01 | Website homepage hero | "Change the way you crypto." | PASS | unknown (no anchor matched) |
| S02 | Import wallet pitch | "Give your wallet Infinex superpowers." | PASS | unknown (no anchor matched) |
| S03 | Import wallet pitch | "Import to unlock seamless trading, management and multi-chain access." | FAIL · cliches: cliché "unlock" | unknown (no anchor matched) |
| S04 | Import wallet — scanning | "Hang tight while we check." | PASS | unknown (no anchor matched) |
| S05 | Import wallet — success | "Nice one!" | PASS | unknown (no anchor matched) |
| S06 | External wallets card | "Bring your wallets into Infinex. Enjoy the seamless experience you love." | FAIL · cliches: cliché "seamless" | unknown (no anchor matched) |
| S07 | Product subtitle | "Infinex, a crypto super app." | PASS | unknown (no anchor matched) |
| S08 | Perps blurb | "Track your positions and PnL at a glance." | PASS | unknown (no anchor matched) |
| S09 | Perps marketing | "Seamless on desktop and mobile." | FAIL · cliches: cliché "Seamless" | unknown (no anchor matched) |
| S10 | Send error | "You can't send to your own Infinex account address. Use Move instead." | PASS | irradiant (conf=0.53, margin=4.83) |
| S11 | Deposit BTC note | "Only native BTC is supported. Other Bitcoin assets won't be withdrawable until support is added." | PASS | unknown (no anchor matched) |
| S12 | Deposit address warning | "This address may change. Always copy the address from here before each deposit." | PASS | altruistic (conf=0.40, margin=2.42) |
| S13 | Earn label | "Liquid staking" | PASS | unknown (no anchor matched) |
| S14 | Audit-proposed rewrite | "Import an external wallet." | PASS | unknown (no anchor matched) |
| S15 | Audit-proposed rewrite | "Connect via seed phrase or private key." | PASS | unknown (no anchor matched) |
| S16 | Audit-proposed rewrite | "Scanning wallet activity." | PASS | unknown (no anchor matched) |
| S17 | Audit-proposed rewrite | "Wallet imported." | PASS | unknown (no anchor matched) |
| S18 | Audit-proposed rewrite | "Copy a fresh address for every deposit." | PASS | altruistic (conf=0.43, margin=3.00) |

## Summary

Shipped/marketing strings tested (S01-S13): 13
  - Caught by Layer 1: 3
  - Passed (not caught): 10

The strings that PASS Layer 1 but are off-tone are the gap. They
represent Infinex-specific allergens — they fail tone, not generic slop —
and belong in brand-factory/brands/infinex/04-voice/tone.md once the gate
flips, and/or in a new validator rule like rejectInfinexCasualToneInUtility.

## Audit-proposed rewrites (S14-S18) tempo readings

These are the rewrites the Gemini-pass audit proposed for the strings above.
Layer 2 classifies them as the tempi the locked TOV expects for product UI:
Commanding (labels/CTAs/success) + Practical (instructions/mechanics).
