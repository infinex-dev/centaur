# Infinex Dogfood — Pipeline Verification

Date: 2026-05-15

Tests whether the locked Infinex TOV pipeline (Layer 1 regex slop + 
Layer 2 blind tempo classifier) catches the slop in real shipped copy.

**Voice spec:** Stable + Flow-stressed + Penetrating, Drive = Spell+Vision (Diagram D).
Main tempi: Commanding · Practical · Sombre · Irradiant · Sociable.

## Results

| ID | Surface | Text | Layer 1 verdict | Deterministic tempo | Sonnet validator |
|---|---|---|---|---|---|
| S01 | Website homepage hero | "Change the way you crypto." | PASS | unknown (no anchor matched) | FAIL · unknown (conf=0.85) · Known Infinex allergen — explicitly listed as forbidden copy.: Replace with a concrete thesis or product fact in irradiant or commanding tempo. E.g. 'One account. Every chain.' or 'A few months from now, you won't think about which app to open.' |
| S02 | Import wallet pitch | "Give your wallet Infinex superpowers." | PASS | unknown (no anchor matched) | FAIL · unknown (conf=0.72) · Known Infinex allergen: 'superpowers' is explicitly banned from product UI copy.: State the actual outcome of importing. E.g. 'Bring your existing wallet into Infinex.' or 'Same wallet. One passkey.' |
| S03 | Import wallet pitch | "Import to unlock seamless trading, management and multi-chain access." | FAIL · cliches: cliché "unlock" | unknown (no anchor matched) | FAIL · unknown (conf=0.88) · Known Infinex allergens: 'unlock' (hype theatre) and 'seamless' are both explicitly prohibited in product UI copy.: Drop both words. Name the action: 'Trade from the same account you already have.' |
| S04 | Import wallet — scanning | "Hang tight while we check." | PASS | unknown (no anchor matched) | FAIL · unknown (conf=0.82) · Known Infinex allergen: 'hang tight' is explicitly prohibited in wallet, security, deposit, and account flows. Casual loading language on a wallet-scanning surface fails the preferred Commanding posture for task UI.: Scanning wallet… / Checking… / Verifying wallet address. |
| S05 | Import wallet — success | "Nice one!" | PASS | unknown (no anchor matched) | FAIL · unknown (conf=0.85) · Known Infinex allergen in product UI — 'nice one' is explicitly prohibited. Casual loading/success language on a wallet/security flow also fails voice.: Wallet imported. or Import complete. |
| S06 | External wallets card | "Bring your wallets into Infinex. Enjoy the seamless experience you love." | FAIL · cliches: cliché "seamless" | unknown (no anchor matched) | FAIL · unknown (conf=0.90) · Known Infinex allergens: 'seamless' and 'enjoy the experience you love' are both explicitly prohibited. Also violates the rule against advertising the product inside the product UI instead of naming the action, consequence, or mechanic.: Remove entirely. Replace with a plain-language consequence statement, e.g. 'Your balances appear alongside everything else in Infinex.' |
| S07 | Product subtitle | "Infinex, a crypto super app." | PASS | unknown (no anchor matched) | FAIL · unknown (conf=0.90) · Known Infinex allergen: 'crypto super app' is explicitly prohibited product UI language. It advertises the product inside the product instead of naming an action, consequence, or mechanic.: Remove 'crypto super app' entirely. Use a plain declarative that names what the product does, e.g. 'One account. Every chain.' or 'Trade, save, send. One passkey.' |
| S08 | Perps blurb | "Track your positions and PnL at a glance." | PASS | unknown (no anchor matched) | FAIL · unknown (conf=0.82) · Known Infinex allergen: 'at a glance' is explicitly prohibited in product UI copy.: Your positions and PnL, live. — or — Open positions. Realised PnL. One screen. |
| S09 | Perps marketing | "Seamless on desktop and mobile." | FAIL · cliches: cliché "Seamless" | unknown (no anchor matched) | FAIL · unknown (conf=0.85) · Known Infinex allergen: 'seamless / seamlessly' is explicitly prohibited in product copy.: Works on desktop and mobile. — or — Desktop and mobile. Same account, same passkey. |
| S10 | Send error | "You can't send to your own Infinex account address. Use Move instead." | PASS | irradiant (conf=0.53, margin=4.83) | PASS · commanding (conf=0.82) · Clean, dry error message. Names the constraint and redirects to the correct action. No allergens, no hype, no unsupported claims. |
| S11 | Deposit BTC note | "Only native BTC is supported. Other Bitcoin assets won't be withdrawable until support is added." | PASS | unknown (no anchor matched) | PASS · practical (conf=0.72) · Dry, precise constraint statement. No allergens, no hype, no unsupported claims. Correctly limits scope without over-explaining. Fits product UI posture well. |
| S12 | Deposit address warning | "This address may change. Always copy the address from here before each deposit." | PASS | altruistic (conf=0.40, margin=2.42) | PASS · unknown (conf=0.82) · Dry, precise warning copy — no allergens, no unsupported claims, no voice failure. Tells the user exactly what to do and why in minimal words. |
| S13 | Earn label | "Liquid staking" | PASS | unknown (no anchor matched) | PASS · unknown (conf=0.95) · Bare taxonomy label — no voice claims, no allergens, no factual assertions. Appropriate dry label for an Earn surface. |
| S14 | Audit-proposed rewrite | "Import an external wallet." | PASS | unknown (no anchor matched) | PASS · unknown (conf=0.82) · Short label/CTA. Plain action language, no allergens, no unsupported claims. Dry and direct — correct posture for a UI affordance. |
| S15 | Audit-proposed rewrite | "Connect via seed phrase or private key." | PASS | unknown (no anchor matched) | PASS · commanding (conf=0.72) · Short, dry imperative label naming the action and mechanic plainly — no allergens, no hype, no unsupported claims. Fits Infinex product UI posture. |
| S16 | Audit-proposed rewrite | "Scanning wallet activity." | PASS | unknown (no anchor matched) | PASS · unknown (conf=0.62) · Short, dry, task-descriptive label. No allergens, no hype, no unsupported claims. Fits Commanding/Practical product UI posture for an in-progress state. |
| S17 | Audit-proposed rewrite | "Wallet imported." | PASS | unknown (no anchor matched) | PASS · commanding (conf=0.82) · Clean, minimal success state. No allergens, no hype, no unsupported claims. Dry commanding posture — names the outcome, nothing more. Fits Infinex product UI standards. |
| S18 | Audit-proposed rewrite | "Copy a fresh address for every deposit." | PASS | altruistic (conf=0.43, margin=3.00) | PASS · commanding (conf=0.82) · Dry, action-first imperative. No allergens, no unsupported claims, no plumbing exposed. Fits Infinex product UI posture cleanly. |

## Summary

Shipped/marketing strings tested (S01-S13): 13
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
