# Infinex Dogfood Audit

Date: 2026-05-15

Primary evidence:

- `/Users/opaque/Sites/infinex-xyz/Platform Dogfood/transcripts/infinex-dogfood.elevenlabs.timestamped.md`
- `/Users/opaque/Sites/infinex-xyz/Platform Dogfood/transcripts/infinex-dogfood.elevenlabs.raw.json`

Derived from:

- Opaque's 45m03s website/platform dogfood recording.
- Gemini pass 1 and targeted pass 2.

This is a working audit, not a product decision log. Treat the transcript as the source of truth.

## Readout

- Marketing copy is leaking into utility flows. Product UI should stop selling the user the product while they are already using it.
- Sensitive-input handling is a P0 trust issue. Private key and seed phrase fields should be masked by default.
- Imported-wallet routing is a P0 product issue. The user should not hit "This wallet doesn't support HYPE" when the wallet itself can support the asset elsewhere.
- "Send to self" should not dead-end. If the destination is the user's own Infinex address, route the intent to Move.
- Deposit UX hides core assets and takes too many clicks. BTC, ETH, SOL, ADA, DOGE, Hyperliquid/HyperEVM routes need faster discovery and direct copy affordances.
- Technical implementation details are surfacing as user-facing concepts. EIP-7702, Hypercore/HyperEVM, dynamic addresses, and gas abstraction need plain-language affordances.
- Stale campaigns are still in the workspace. Craterun, Infinex Sale, Airdrops, Yaprun, Points, and Badges need explicit keep/archive/remove decisions.
- Earn needs intent-first IA. "Liquid staking" is inaccurate where the product means yield-bearing assets.
- Perps venue selection is under-explained. Users need to choose or filter venues rather than being silently defaulted to Lighter.
- Onboarding should be a guided series, not isolated walls of copy inside passkey/import/gas flows.

## Source Ledger

| Timestamp | Surface | Evidence | Problem | Severity |
|---|---|---|---|---|
| 00:00-00:01 | Website homepage | "Change the way you crypto doesn't feel right to me." | Generic marketing headline, not current product truth. | P2 |
| 03:00-03:30 | Website nav | Craterun is "kind of dead" and "doesn't need to be top line." | Dead/stale campaign in primary IA. | P1 |
| 04:55-06:30 | Passkeys/import | "This feels silly... I don't know anything about passkeys." | Passkey education is too textual and not contextual. | P1 |
| 06:00-06:45 | Import wallet | "Superpowers?" / "I don't know what that means." | Marketing copy in a task flow. | P1 |
| 09:00-10:00 | Import private key/seed phrase | Other wallets blank/mask input; Infinex shows clear text. "That's my first number one." | Sensitive input exposed. | P0 |
| 10:00-11:00 | Import completion | "Hang tight?" / "Nice one!" / "I don't like this verbiage at all." | Casual tone degrades trust. | P2 |
| 11:00-13:30 | Home/nav/Labs/Airdrops | Infinex Sale is dead; Airdrops should maybe be sunset/toggled off. | Stale modules remain prominent. | P1 |
| 13:30-15:30 | Earn | SNX 0.66% APY is "nothing"; "Liquid staking" should be "yield-bearing assets." | Uncurated low-quality yield and inaccurate terminology. | P2 |
| 16:00-18:00 | Switch | Wants "All" wallets, wallet filtering, and default wallet settings. | Wallet abstraction is not complete enough for fragmented balances. | P1 |
| 19:00-21:30 | Switch/HYPE | Imported wallets cannot trade HYPE; "one of the worst parts about the flow." | Hard product block against a core user job. | P0 |
| 21:30-23:30 | Crates/Vouchers | UI explains and advertises feature at the same time. "Stop selling it to me through the UI." | Product copy lacks discipline between explanation and promotion. | P2 |
| 24:00-29:30 | Perps | "At a glance" and "seamless" are marketing phrases; Lighter default is confusing; venues should be selectable/filterable. | Venue routing and product copy are under-specified. | P1 |
| 30:00-32:30 | Recovery/import wallet | "Crypto super app" and "seamless experience" inside product flows. | Brand copy contaminates security/account setup. | P1 |
| 33:00-36:30 | Deposits | 7702 icon unclear; BTC appears too late; every network should expose a copy button. | Deposit discovery and copy flow are too slow and technical. | P1 |
| 37:00-38:30 | Send/Move | Sending to own address blocks with "Use Move instead." "This is horrendous." | The system exposes routing burden to user. | P0 |
| 38:30-40:30 | Gas account | Learn More has "absolutely fuck all" about gas account; top-up flow itself is clean. | Good flow with poor onboarding/docs entry. | P1 |
| 41:00-45:00 | Settings/home/assets | Star updates lag; app brand should not surface; "What points?"; asset discovery gaps. | Stale settings, state lag, weak asset discovery. | P2 |

## Platform Backlog

| Priority | Workstream | Change | Acceptance Criteria |
|---|---|---|---|
| P0 | Security UX | Mask private key and seed phrase fields by default, with explicit reveal control. | Pasted/imported secrets are never visible by default. |
| P0 | Trading/routing | Resolve imported-wallet HYPE blockage. | User can buy/trade HYPE from imported-wallet balances, or gets a one-click route to move/prepare funds. |
| P0 | Send/Move | Auto-route sends to owned Infinex addresses into Move. | User entering their own address does not see a blocking error. |
| P1 | Product copy | Remove "superpowers", "seamless", "hang tight", "nice one", "at a glance", and "crypto super app" from product flows. | Utility flows use task-language only. |
| P1 | Navigation | Remove/demote stale campaigns from primary surfaces. | Craterun, Sale, Airdrops, Yaprun, Points, Badges are removed, archived, or hidden behind explicit product decisions. |
| P1 | Switch | Add All Wallets / wallet filter / sensible default wallet behavior. | User can source funds without remembering which wallet holds them. |
| P1 | Perps | Make venue visible and selectable/filterable before routing. | Popular markets identify venue; users can filter Lighter/Hyperliquid/Synthetix. |
| P1 | Deposits | Pin core assets and add direct copy controls. | BTC/ETH/SOL and major non-EVM assets are discoverable early; network rows expose copy affordances. |
| P1 | Gas account | Build a gas-account-specific explainer/onboarding step. | Learn More explains gas account, top-up, refunds/non-refunds, and extension behavior. |
| P2 | Earn | Rename/reframe yield surfaces. | "Yield-bearing assets" replaces inaccurate liquid-staking language where appropriate. |
| P2 | Crates/Vouchers | Separate explanation from promotion. | Feature pages explain mechanics without sales copy. |
| P2 | State | Fix optimistic UI for star/unstar. | Unstarred assets disappear or update immediately without refresh. |

## TOV Rules

The Infinex TOV is locked. See locked specs:

- **Drive:** Stable + Flow-stressed + Penetrating, Diagram D (Spell-Vision; no Passion). See `memory/infinex-drive-spell-not-passion.md`.
- **Tempi rotation:** Commanding · Practical · Sombre · Irradiant · Sociable. See `memory/infinex-5-tempi-locked.md`.

Product UI lives in **Commanding** and **Practical** tempi. The remaining three (Sombre, Irradiant, Sociable) belong to launch comms and announcements, not to utility flows.

- **Commanding** (Pressing → Punching) — labels, primary CTAs, success states. "Import an external wallet." "Wallet imported." Decisive landings, no flourish.
- **Practical** (Wringing → Slashing) — instructions, mechanics, edge-case copy. "Scanning wallet activity." "Copy a fresh address for every deposit." Working through complexity into a carved answer.

Drive constraints inherited from the lock:

- **No time-pressure language.** "Now", "today", "act fast", "last chance" carry Passion. Infinex is Spell-Vision; future-tense and craft-patience are native.
- **No marketing register in utility flows.** The Drive precludes urgency theater; the tempi that fire in product UI (Commanding + Practical) preclude promotional voice. "Superpowers" / "crypto super app" / "at a glance" are off-tempo before they are off-brand.
- **Penetrating Space, not vague.** Address the user directly — "Connect via seed phrase or private key" — not "you'll experience" or "enjoy the experience you love".

The rewrites in the next section embody Commanding + Practical tempi by design.

Use more (Commanding + Practical vocabulary):

- Import, Deposit, Withdraw, Move, Route, Sign, Select wallet, Select market, Copy address, Yield-bearing, Venue.

Avoid (already caught by comms-factory's brand-agnostic validator):

- Seamless, seamlessly, unlock, game-changer, leverage (verb), next-gen, paradigm, empower — `rejectCliches`.
- "Thrilled to", "stay tuned", innovative, cutting-edge, revolutionary — `rejectAIslop`.

Avoid (Infinex-specific allergens — candidate additions to brand-factory's `tone.md` when it lands, and/or a new `rejectInfinexCasualToneInUtility` validator rule):

- Superpowers
- Hang tight
- Nice one
- At a glance
- Crypto super app
- Change the way you crypto
- Enjoy the experience you love
- Seamlessly used to describe internal behavior — even when accurate, prefer "route automatically" or "handle behind the scenes"

Rule of thumb: if a sentence could appear on a competitor's marketing page, it does not belong in an Infinex product flow.

## Copy Rewrites

| Current | Replacement |
|---|---|
| Give your wallet Infinex superpowers. | Import an external wallet. |
| Import to unlock seamless trading, management and multi-chain access. | Connect via seed phrase or private key. |
| Hang tight while we check. | Scanning wallet activity. |
| Nice one! | Wallet imported. |
| Bring your wallets into Infinex. Enjoy the seamless experience you love. | Manage external wallets from Infinex. |
| Infinex, a crypto super app. | Infinex |
| Track your positions and PnL at a glance. | Track positions and PnL. |
| Seamless on desktop and mobile. | Remove. |
| You can't send to your own Infinex account address. Use Move instead. | Remove the error. Route to Move. |
| Only native BTC is supported. Other Bitcoin assets won't be withdrawable until support is added. | Send only native BTC to this address. |
| This address may change. Always copy the address from here before each deposit. | Copy a fresh address for every deposit. |

## Website Work

The transcript has less website evidence than platform evidence. Keep website changes evidence-led:

- Rework the homepage hero away from "Change the way you crypto."
- Remove or demote Craterun from top-level nav unless product decides it is active again.
- Review the INX/token page for sale-era content that no longer serves current users.
- Automate/news-pipeline work is relevant because the site currently looks stale when news is old.

## Relationship To Comms-Factory

This audit applies the locked Infinex TOV (Drive: Spell-Vision, no Passion; tempi: Commanding · Practical · Sombre · Irradiant · Sociable) to product UI. It does not redefine the TOV — the spec lives in the memory files cited above and will land in `brand-factory/brands/infinex/04-voice/tone.md` when that gate flips.

How the audit feeds the pipeline:

- **Validator already catches** seamless/seamlessly, unlock, game-changer, leverage (verb), thrilled-to, stay-tuned, innovative, cutting-edge, revolutionary. The dogfood transcript adds no new brand-agnostic rules.
- **Infinex-specific allergens** (superpowers, hang tight, nice one, at a glance, crypto super app, "change the way you crypto") are candidates for brand-factory's tone.md and/or a future Infinex-aware validator rule. They are too brand-bound for the brand-agnostic layer.
- **Launch comms** (the actual comms-factory output) must avoid the same allergens AND honor the Drive lock — no urgency theater, no "now/today" as time-pressure. Past Infinex copy violated this; the new TOV does not.
- **Product UI rules** (this audit) are platform's responsibility to enforce, not comms-factory's. Comms-factory's validator stays scoped to shipped comms artifacts.

## Open Product Questions

- Are Craterun, Airdrops, Sale, Yaprun, Points, and Badges dead, archived, or temporarily hidden?
- What is the intended execution model for imported wallets and HYPE/Hyperliquid?
- Should Send always auto-route to Move when the destination is an owned Infinex address?
- Which venues should appear in Perps market discovery, and what ranking signal should drive "popular"?
- What happens if a user sends to an old dynamic deposit address?
- Which non-EVM assets should be pinned in deposit discovery?
- What is the correct user-facing name for 7702-backed addresses, if any?
