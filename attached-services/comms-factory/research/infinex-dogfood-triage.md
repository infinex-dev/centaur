# Infinex App Dogfood — Triage

Date: 2026-05-15

Companion to `research/infinex-app-dogfood-handover.md`. This document is the **working triage list** for a team session. The handover narrates the dogfood findings; this doc reduces them to a concrete row-per-issue inventory with severity, type, evidence, suggested fix, and a "decision needed" column so colleagues can flip through and call **fix / sunset / defer / clarify** per item.

If you only have 5 minutes, read the [Executive cut](#executive-cut) and the [Decisions to make before tactical fixes](#decisions-to-make-before-tactical-fixes) sections.

## How to use this doc

1. **Decisions first.** A lot of these items hinge on product-level choices (is Craterun dead? is the airdrops surface sunsetting? what's the imported-wallet trade execution model?). The [Decisions](#decisions-to-make-before-tactical-fixes) section enumerates them. Make those calls in the meeting; many tactical rows resolve automatically once a parent decision is made.
2. **Severity-ordered first pass.** The [Executive cut](#executive-cut) lists every P0 and P1 in one place. Use it to scope a "now" workstream.
3. **Area-by-area second pass.** The per-area tables are the full inventory. Area owners (Web, App, Onboarding, Earn, Switch, Perps, Deposits, Settings) should review their section in detail.
4. **Per row, decide one of:**
   - **FIX** — agree it's broken, assign owner + sprint.
   - **DEFER** — agree it's a real issue but lower than what we're shipping.
   - **SUNSET** — kill the surface entirely rather than fix it.
   - **CLARIFY** — needs a product/legal/engineering answer before we can act.
   - **NOT A BUG** — current behavior is intentional; close + capture rationale.

## Legend

**Severity**

| Tag | Meaning |
|---|---|
| P0 | Ship-blocker: security/safety, trust break, critical dead-end on a core flow. Fix now. |
| P1 | High impact: blocks or seriously degrades a core task, damages credibility, hits frequently. Fix this sprint or next. |
| P2 | Moderate friction: real quality issue but not blocking. Schedule. |
| P3 | Polish: nits, individual copy/affordance issues. Batch into housekeeping. |

**Type**

| Tag | Meaning |
|---|---|
| SEC | Security / safety |
| BUG | Functional bug — feature doesn't work as user expects |
| UX | UX / friction — works, but painful |
| COPY | Tone-of-voice / copy — wrong register or off-brand |
| IA | Information architecture — wrong placement, missing surface, unclear hierarchy |
| DEAD | Dead-end / broken flow — user gets stuck |
| RES | Stale content / residue from a past campaign or product phase |

Evidence timestamps refer to `Platform Dogfood/transcripts/infinex-dogfood.elevenlabs.timestamped.md`.

## Executive cut

### P0 — ship-blockers (3)

| ID | Issue | Type | Area |
|---|---|---|---|
| DF-001 | Seed phrase / private key input shown in clear text on import | SEC | Wallet Import |
| DF-002 | Imported wallets cannot access HYPE / Hyperliquid; copy blames the wallet | BUG + DEAD | Switch / Perps |
| DF-003 | Sending to own Infinex address errors instead of auto-routing to Move | DEAD + UX | Send |

### P1 — high-impact (22)

| ID | Issue | Type | Area |
|---|---|---|---|
| DF-010 | Stale "Infinex Sale" surface on default dashboard for new users | RES | Dashboard |
| DF-011 | "Airdrops" surface implies active program — none currently running | RES + COPY | Dashboard |
| DF-012 | "Craterun" still occupies top-level marketing nav despite being inactive | RES | Marketing |
| DF-013 | Earn page surfaces 0.66% SNX yield — damages credibility | RES | Earn |
| DF-020 | Perps silently defaults to Lighter without venue labeling | BUG + IA | Perps |
| DF-021 | "Popular markets" appear hardcoded, not signal-driven | BUG | Perps |
| DF-022 | No venue filter/toggle on Perps discovery (Lighter / Hyperliquid / Synthetix) | IA + UX | Perps |
| DF-023 | Perps copy out of date (provider list); contains marketing in product copy | RES + COPY | Perps |
| DF-030 | Switch source wallet defaults to one wallet — user can't see all balances | UX | Switch |
| DF-031 | No default destination wallet; user must reselect every time | UX | Switch |
| DF-040 | Bitcoin / non-EVM deposit support buried — major product advantage hidden | IA | Deposit |
| DF-041 | Each network row lacks a direct copy button; multi-click address copy | UX | Deposit |
| DF-042 | "This address may change" warning ambiguous; dynamic-address risk unclear | COPY + CLARIFY | Deposit |
| DF-050 | Gas Account discovered too late; not in onboarding | UX + IA | Gas Account |
| DF-051 | "Learn More" on Gas Account routes to generic network costs, not gas account | BUG | Gas Account |
| DF-060 | Wallet import flow excessively long; conceptual interruptions before task | UX | Onboarding |
| DF-061 | Passkey explanation is a wall of prose before the user sees the UI it describes | UX | Onboarding |
| DF-070 | Unstarring tokens requires page refresh — optimistic UI missing | BUG | Dashboard |
| DF-071 | No asset discovery surface separate from portfolio holdings | IA | Cross-cutting |
| DF-072 | Token search lags / doesn't surface non-top-1000 tokens | BUG | Search |
| DF-080 | Recovery email flow contains "Infinex, a crypto super app" marketing copy | COPY | Recovery |
| DF-081 | Imported-wallet onboarding sells "superpowers" instead of describing the task | COPY | Wallet Import |

The remaining ~50 P2/P3 items are in the per-area tables below.

## Decisions to make before tactical fixes

These are product-level calls. Many tactical rows below will be invalidated by these decisions, so resolve them first.

| # | Decision | Owner | Why it gates tactical work |
|---|---|---|---|
| D-01 | Sunset / archive / hide list: Craterun, Infinex Sale, Airdrops, Yaprun, Points, Badges, App Brand, Patrons-gating-on-Labs-cards | Product | Resolves DF-010, DF-011, DF-012, DF-014, DF-015, DF-076, DF-077, DF-078 in one decision |
| D-02 | What is the intended execution model for imported wallets + Hyperliquid/HYPE? Is direct trade possible, or is the answer "auto-move into Infinex wallet first"? | Eng + Product | DF-002 cannot be specced until this is decided |
| D-03 | Should Send always auto-route to Move when destination is owned? Or surface a "switch flow" affordance and keep the error? | Product | DF-003 |
| D-04 | Is Perps venue (Lighter / Hyperliquid / Synthetix) a first-class user-facing dimension? Filterable? Or platform-routed? | Product | DF-020, DF-022, DF-024 |
| D-05 | What signal drives Perps "Popular Markets"? Static hardcode is unacceptable; need a real rule | Product + Data | DF-021 |
| D-06 | Can the Perps Terms-of-Use modal be collapsed legally? | Legal | DF-025 |
| D-07 | Dynamic deposit address behavior — does an old address still work after the address rotates? | Eng | DF-042 — copy can't be written until answered |
| D-08 | Pinned-asset list for the Deposit surface — which non-EVM assets get top placement? | Product | DF-040 |
| D-09 | User-facing explanation of EIP-7702 backed addresses — do we explain, hide, or rename? | Product + Design | DF-043 |
| D-10 | SNX / sUSD earn opportunities — actively run? threshold-display? remove? | Product | DF-013 |
| D-11 | Asset discovery surface — build a dedicated asset/token page like CoinGecko, or stay portfolio-only? | Product | DF-071 |
| D-12 | News pipeline — automate from release events, fully manual, or sunset the surface? | Marketing + Comms-Factory | DF-016 |
| D-13 | New onboarding sequence — who scopes the multi-step intro (gas, passkey, security, wallets)? | Product + Design | DF-050, DF-060, DF-061, DF-074 |
| D-14 | Do we keep the "Patron" / "Labs" gating distinction, or collapse to "available / coming soon"? | Product | DF-014 |
| D-15 | Voice/tone of utility copy — sign-off on the rule "no marketing copy inside utility/security/trading flows" so designers have backing | Brand + Product | All COPY-typed rows below |

---

## By area

Each table is sortable by severity. P0/P1 rows are repeated from the executive cut for completeness.

### Marketing site

| ID | Sev | Type | Issue | Evidence | Suggested fix | Decision |
|---|---|---|---|---|---|---|
| DF-012 | P1 | RES | Craterun still occupies top-level marketing nav; described as "kind of dead" | `00:03:00` "we should also take this off the main page because this is kind of dead" | Demote to features/perps/switch sub-nav, or remove | D-01 |
| DF-015 | P1 | RES | Mantle in supported networks despite imminent de-listing | `00:01:00` "We're about to delist Mantle, so that shouldn't be there" | Remove from networks list when delist ships | CLARIFY: delist ETA |
| DF-016 | P1 | RES | News section last updated "fucking ages ago" | `00:01:00` | Wire releases pipeline to news; or sunset the surface | D-12 |
| DF-090 | P2 | COPY | "Change the way you crypto" hero doesn't fit unified-portfolio thesis | `00:00:00` "doesn't feel right to me… doesn't fit our current new unified portfolio" | Rewrite around "one account across chains and venues" | FIX (after brand-factory sign-off) |
| DF-091 | P2 | IA | Homepage tab-styled elements aren't clickable; affordance confusion | `00:00:00` "These look like tabs that I can click on. At the moment, I can't" | Make interactive or restyle as static | FIX |
| DF-092 | P2 | IA | "Features" link behavior unclear (release log? feature list? not obvious) | `00:00:00` "Features. Uh, that's feature releases, right? Is it not? No it's not" | Rename or restructure IA | FIX |
| DF-093 | P2 | COPY | Site over-indexes on feature-proof rather than focused positioning | `00:01:00` "we were really over-indexing on this, 'we've got so much stuff'" | Editorial pass: lead with thesis, not list | DEFER until D-12 + brand voice locked |
| DF-094 | P2 | UX | "Get Infinex" CTA unclear | `00:00:00` "What does that mean? Use Infinex?" | Rename to action verb that names the next step | FIX |
| DF-095 | P2 | RES | INX page reads as sale-era residue — utility-now framing missing | `00:02:00` "This was kind of needed for the sale. I don't necessarily know if we need this now" | Audit + strip sale-era content; lead with current INX utility | CLARIFY: current token utility framing |
| DF-096 | P2 | IA | INX section sits awkwardly between homepage modules; redundant when user is already on Infinex.xyz | `00:02:00` "this is confusing because we're already on the Infinex page" | IA pass on homepage module order | FIX (after D-01) |
| DF-097 | P3 | BUG | Support chat widget takes "forever" to load | `00:04:00` "That took forever to load" | Lazy-load fix or async indicator | FIX |

### Onboarding / Passkeys / Wallet Import

| ID | Sev | Type | Issue | Evidence | Suggested fix | Decision |
|---|---|---|---|---|---|---|
| DF-001 | **P0** | SEC | Seed phrase / private key input shown in clear text | `00:07:00`–`00:09:00` "blanks it out, whereas this shows it in clear text. That's my first number one. I really don't like that" | Mask by default; explicit reveal control; handle paste/clipboard/screenshot | FIX immediately |
| DF-060 | P1 | UX | Import flow excessively long; "lengthy" | `00:11:00` "that felt really lengthy" | Time-to-first-usable-account instrumentation; separate essential steps from optional education | D-13 |
| DF-061 | P1 | UX | Passkey explanation is a wall of prose before user sees the passkey UI | `00:04:00`–`00:05:00` "This feels silly to me because I don't know anything about passkeys. I just want to import a wallet" | Replace prose block with contextual annotation on the actual passkey browser UI (highlights + arrows) | FIX |
| DF-081 | P1 | COPY | "Give your wallet Infinex superpowers" / "Import to unlock seamless trading" — marketing copy in a task flow | `00:06:00` "I don't know what that means" / "Is that the kind of term we use?" | Replace with task language: "Import an external wallet" | FIX (per D-15) |
| DF-062 | P2 | COPY | "Name your seed phrase. Give your seed phrase a name…" repetitive and unnatural | `00:09:00`–`00:10:00` "I don't like this verbiage at all" | "Name this wallet" / "This name is only visible to you" | FIX |
| DF-063 | P2 | COPY | "Hang tight" / "Nice one!" too casual for a security-flow register | `00:10:00` "very opinionated" | "Scanning wallet activity." / "Wallet imported." | FIX (per D-15) |
| DF-064 | P2 | UX | Passkey explainer is too-technical multi-device guidance presented too early | `00:05:00` "this is ultra specific" | Move to a "Learn more" expand or defer to when user hits a multi-device case | FIX |
| DF-065 | P2 | UX | No annotated visual guidance (arrows pointing at where to click during passkey creation) | `00:05:00` "we should be annotating this with little arrows" | Guided UI overlay on the passkey browser modal | FIX |
| DF-066 | P3 | UX | Gradient styling in import flow inconsistent with rest of product | `00:10:00` "this weird gradient that we are using, which I don't think we use anywhere else" | Design-system audit; remove ad-hoc gradient | FIX |
| DF-067 | P3 | COPY | "Non-custodial, cross-chain, easy recovery" — accuracy of this trio in 2026 | `00:11:00` "Is that true anymore?" | Re-validate with product/security; rewrite if drifted | CLARIFY |

### Dashboard / Home / Nav

| ID | Sev | Type | Issue | Evidence | Suggested fix | Decision |
|---|---|---|---|---|---|---|
| DF-010 | P1 | RES | "Infinex Sale" still on default dashboard for new users | `00:11:00` "completely irrelevant to me. I'm a new user. I can't do anything with the Infinex sale, so that's dead" | Remove from default homepage / nav unless an active reason exists | D-01 |
| DF-011 | P1 | RES + COPY | Airdrops surface implies an active program — there isn't one | `00:12:00`–`00:13:00` "we're not really doing any airdrops anymore… maybe we should fucking sunset this" | Hide or sunset; or repurpose for actual claim flows when live | D-01 |
| DF-070 | P1 | BUG | Unstar requires page refresh — no optimistic UI | `00:11:00` + `00:42:00` "When I click unstar, it doesn't unstar" / "I have to refresh the page" | Optimistic UI on star/unstar | FIX |
| DF-014 | P2 | IA | Labs/Patron gating language inconsistent with actual access ("Available to patrons" but Private Send works) | `00:11:30`–`00:13:00` "it says available to patrons, but I can use private send. That's confusing" | Audit Labs cards; pick one taxonomy: "Available / Patron only / Early access" | D-14 |
| DF-075 | P2 | UX | Crates popup competes for attention even when user has no crates to open | `00:21:30`–`00:22:30` "should pop up if people are already trading… new thing that drops in if people have crates" | Trigger Crates UI by real available-crates state, not always-on | FIX |
| DF-076 | P2 | COPY | Vouchers surface mixes feature-explanation with feature-advertising | `00:22:00`–`00:23:30` "explaining the feature and advertising the feature at the same time. Stop selling it to me through the UI" | Editorial split: vouchers page explains; promo modules live elsewhere if at all | FIX (per D-15) |
| DF-077 | P2 | COPY | Crates incentive copy inaccurate ("Trade Perps to start earning crates" — Switch also earns) | `00:23:00`–`00:24:00` "That's not true. It's also Switch" | "Use Infinex to start earning crates" or rule-accurate variant | FIX |
| DF-098 | P3 | IA | Duplicate Vouchers link (two entry points to the same place) | `00:23:00` "This takes me to the same place" | Remove duplicate | FIX |
| DF-099 | P3 | UX | Crates sound effect feels orphaned without sonic context | `00:22:00` "This sound thing feels weird because there's no sound going on at the moment" | Decide on sonic system or remove | CLARIFY |

### Earn / Yield

| ID | Sev | Type | Issue | Evidence | Suggested fix | Decision |
|---|---|---|---|---|---|---|
| DF-013 | P1 | RES | 0.66% SNX earn opportunity surfaced — damages credibility | `00:13:30`–`00:14:00` "That's nothing. We need to take that off the page" | Minimum yield display threshold rule; or curated editorial layer | D-10 |
| DF-100 | P2 | UX | Earn described as "a mess" — opportunity dump, not intent-led | `00:13:30`–`00:14:00` "It's a mess" | Reframe around "what do you want to earn yield on?" — asset-first selector (SOL/ETH/BTC/stables) | FIX |
| DF-101 | P2 | COPY | "Liquid staking" mis-labels what are actually yield-bearing assets | `00:14:00`–`00:15:00` "They're yield-bearing actually. That's the term we all use" | Rename surface to "Yield-bearing assets"; add explainer | FIX |
| DF-102 | P2 | UX | Earn requires manual chain selection instead of asset-intent input | `00:14:00`–`00:15:00` "rather than I have to think, okay, Sol, go here" | Intent-led picker: pick asset → show all venues/chains | FIX |
| DF-103 | P3 | UX | No "What is a yield-bearing asset?" learn-more affordance | `00:14:00` "there should be a little button that you click that explains how yield-bearing assets work" | Add tooltip / expand block | FIX |
| DF-104 | (positive) | — | Buy-on-yield-asset prefills Switch correctly — keep this pattern | `00:15:00` "I really like that as a feature" | Preserve; extend to other surfaces | KEEP |

### Switch / Swidge

| ID | Sev | Type | Issue | Evidence | Suggested fix | Decision |
|---|---|---|---|---|---|---|
| DF-002 | **P0** | BUG + DEAD | Imported wallets cannot route into HYPE; copy blames the wallet | `00:19:00`–`00:21:00` "truly one of the worst features… we don't support it in Infinex" | If direct execution impossible, one-click move into Infinex wallet; never blame the wallet | D-02 |
| DF-030 | P1 | UX | Source wallet defaults to one wallet; user doesn't know where funds are | `00:16:00`–`00:18:00` "I don't know where my funds are. I want an All option" | "All wallets" view; or auto-select wallet that has the balance | FIX (after D-02) |
| DF-031 | P1 | UX | No default destination wallet; reselect every time | `00:17:00` "should default to a default wallet that I can set in settings somewhere. I shouldn't have to select it every time" | Setting + sensible default | FIX |
| DF-110 | P2 | UX | Switch from-field doesn't collapse / can't toggle wallet via the from control | `00:16:00`–`00:17:00` "this should collapse and when you click the thing, you should be able to toggle like which wallet you're using here" | Interaction redesign on from-field | FIX |
| DF-111 | P2 | IA | Switch / Earn "Buy" buttons look visually similar but do different things | `00:16:00` "this and this look a little bit too similar" | Visual differentiation; or unify behavior | FIX |
| DF-112 | P2 | UX | Solana priority-fee setting reads as chain-agnostic — easy to misread | `00:17:00`–`00:18:00` "Maybe this should be a Solana logo to make it clear that it's Solana" | Chain badge / chain icon on chain-specific controls | FIX |
| DF-113 | P3 | UX | No comparison/mashup chart for source-vs-destination asset price | `00:18:00`–`00:20:30` "I'd like to see a mashup chart… INX vs Hype" | Comparison toggle in Switch chart panel | DEFER |
| DF-114 | P3 | COPY | Naming: "Switch" vs "Swap" — suggestion to rename | `00:16:00` "somebody suggested we should call that swap" | Naming review with brand | CLARIFY |

### Perps

| ID | Sev | Type | Issue | Evidence | Suggested fix | Decision |
|---|---|---|---|---|---|---|
| DF-020 | P1 | BUG + IA | Perps silently defaults to Lighter without venue labeling | `00:25:30`–`00:29:30` "The fact that this is Lighter is confusing… haven't even been told where these markets are" | Venue label visible on every market row; explicit venue picker before launch | D-04 |
| DF-021 | P1 | BUG | "Popular markets" appears hardcoded, not live-fed | `00:26:00` "I don't think these are actually like popular markets that are being live fed, and there's no reason why they shouldn't be" | Real signal (volume / OI / spread) driving rankings | D-05 |
| DF-022 | P1 | IA + UX | No filter/toggle for Hyperliquid / Lighter / Synthetix in Perps discovery | `00:27:00` "popular markets Lighter, popular markets Synthetix, popular markets Hyperliquid… toggle on and off" | Venue filter chips; multi-venue grouping | D-04 |
| DF-023 | P1 | RES + COPY | Perps intro out of date ("powered by Hyperliquid and Lighter now"); contains marketing in product copy ("at a glance", "seamless on desktop and mobile") | `00:24:00`–`00:25:30` "I hate this fucking phrase 'at a glance'" | Update venue list; remove marketing phrases | FIX (per D-15) |
| DF-024 | P2 | UX | Searching for an asset (e.g. BTC) doesn't show cross-venue results | `00:28:00`–`00:29:00` "I should be able to see Lighter BTC, Synthetix BTC, and Hyperliquid BTC… price, OI, volume" | Unified search with venue-grouped result rows | D-04 |
| DF-025 | P2 | UX | Terms-of-Use modal is "gnarly" on Perps entry | `00:25:00`–`00:26:00` "massive terms of use thing. Ooft, that is gnarly UX" | Legal review — collapse to single acceptance if possible | D-06 |

### Send / Move

| ID | Sev | Type | Issue | Evidence | Suggested fix | Decision |
|---|---|---|---|---|---|---|
| DF-003 | **P0** | DEAD + UX | Sending to own Infinex address errors instead of auto-routing to Move | `00:37:00`–`00:38:30` "horrendous… why have you let me get this far? You can't send to your own Infinex" | Detect owned-destination → convert flow to Move; switch CTA to "Move within your Infinex account" | D-03 |
| DF-120 | P2 | UX | Send flow feels slow generally | `00:38:00` "It's also taking for fucking ever" | Latency audit on send-validation pipeline | FIX |

### Deposit

| ID | Sev | Type | Issue | Evidence | Suggested fix | Decision |
|---|---|---|---|---|---|---|
| DF-040 | P1 | IA | Bitcoin / non-EVM deposit support buried — discovered "very late and very low" | `00:33:00`–`00:34:00` "This is the first time I've seen that I can hold Bitcoin in Infinex" | Pin BTC, ETH, SOL, and major non-EVM assets at top of deposit picker | D-08 |
| DF-041 | P1 | UX | Network rows lack direct copy buttons; Hyperliquid address copy is multi-click | `00:33:00`–`00:36:30` "every single one of these should have a copy symbol" | Copy button on every network row; collapse Hyperliquid HyperEVM vs Hypercore disambiguation into the row | FIX |
| DF-042 | P1 | COPY + CLARIFY | "This address may change" warning ambiguous — what happens to funds sent to old address? | `00:34:00`–`00:35:00` "what happens if the address changes and a user sends to an old address" | Copy must reflect actual behavior (old-still-works vs not) — engineering answer required first | D-07 |
| DF-043 | P2 | IA | EIP-7702 address-type icon unexplained / cryptic | `00:32:00`–`00:34:00` "This symbol here means that it's a 7702 address. That doesn't make any sense to me" | Replace protocol-number symbol with plain-language tooltip ("Smart account address") or rename | D-09 |
| DF-130 | P2 | UX | Deposit-page tour design diverges visually from rest of product | `00:32:00` "where are we getting this design from? It's so different to everything else" | Design-system audit on the tour component | FIX |
| DF-131 | P2 | IA | Two separate wallet-import flows in Deposit area — confusing duplication | `00:32:00` "we've got two different wallet flows" | Unify; one canonical wallet-import path | FIX |
| DF-132 | P3 | UX | Standalone QR-code button on each row feels redundant when copy is right there | `00:36:00` "I don't understand why we even need that button" | Combine: address row reveals QR on click OR collapse to a single copy/QR control | FIX |

### Gas Account

| ID | Sev | Type | Issue | Evidence | Suggested fix | Decision |
|---|---|---|---|---|---|---|
| DF-050 | P1 | UX + IA | Gas Account discovered too late; not introduced in onboarding | `00:38:30`–`00:40:30` "I think onboarding should have introduced it earlier" | Add gas-account step to new-account onboarding flow (what / why / top-up / extension behavior) | D-13 |
| DF-051 | P1 | BUG | "Learn More" on Gas Account routes to generic network-costs page, not gas-account doc | `00:39:00`–`00:40:00` "absolutely fuck all here about the gas account" | Fix link target | FIX |
| DF-140 | P2 | COPY | Gas-account explanation copy reads awkwardly: "Infinex passes on network costs without additional fees" | `00:38:00`–`00:39:00` "This is weird verbiage" | Editorial pass: name the mechanic plainly | FIX |
| DF-141 | (positive) | — | Top-up flow itself is "actually pretty clean" — preserve | `00:39:30`–`00:40:30` "actually pretty clean" | Keep | KEEP |

### Portfolio / Recovery

| ID | Sev | Type | Issue | Evidence | Suggested fix | Decision |
|---|---|---|---|---|---|---|
| DF-080 | P1 | COPY | Recovery email flow contains "Infinex, a crypto super app" + "Enjoy the seamless experience you love" | `00:30:00`–`00:31:30` "marketing copy inside product copy" | Strip slogan; use plain product/security language | FIX (per D-15) |
| DF-150 | P2 | UX | Passkey-signing demanded before email entry — order feels wrong | `00:30:00`–`00:31:30` "I should enter my email address" | Reorder: email → OTP → passkey-sign-to-finalize | FIX |

### Settings / Customization / Asset discovery

| ID | Sev | Type | Issue | Evidence | Suggested fix | Decision |
|---|---|---|---|---|---|---|
| DF-071 | P1 | IA | No asset discovery surface separate from portfolio holdings | `00:42:30`–`00:45:00` "portfolio is fine, but it's the difference between what I have and what exists" | Dedicated asset/token page (price, volume, OI, related markets) — CoinGecko-like | D-11 |
| DF-072 | P1 | BUG | Token search slow + doesn't surface non-top-1000 tokens; user falls back to CoinGecko | `00:43:00`–`00:44:00` "I have to go on CoinGecko… not in the top thousand" | Search-index expansion; faster results | FIX (after D-11 scope) |
| DF-160 | P2 | IA | Settings exposes "App Brand" — unclear what this is | `00:42:00` "the app brand should not even be a thing that we have anywhere" | Hide or remove | D-01 |
| DF-161 | P2 | IA | Settings exposes "Points" / "Badges" — unclear what these refer to | `00:42:00` "What points? What badges?" | Hide if inactive; or label clearly with current program | D-01 |
| DF-162 | P2 | IA | "Support networks" toggle confusing when networks are supposedly abstracted | `00:42:00` "Support networks feels weird. Why do I even need this?" | Re-evaluate; either explain or hide | CLARIFY |
| DF-163 | P2 | UX | NEAR asset visibility toggled off in default settings — unclear why | `00:41:00` "I don't know why NEAR is turned off. Maybe it's not the real NEAR" | Audit asset visibility defaults | CLARIFY |
| DF-164 | P3 | UX | Avatar / contact color picker changes color without user control | `00:41:00`–`00:42:00` "why does it keep changing color? I don't get it" | Persistent user selection; deterministic | FIX |
| DF-165 | P3 | UX | No centralized place to manage starred tokens after unstarring | `00:42:00` "there's not like a place for me to have the star tokens anymore" | Settings sub-page or favorites surface | FIX |

### Cross-cutting tone-of-voice

Many P2 COPY rows above stem from one root pattern: **marketing copy is leaking into utility, security, and trading flows.** Decision D-15 governs the entire cluster. Words/phrases flagged directly by Opaque in the session, for fast reference in editorial passes:

| Avoid | Prefer |
|---|---|
| superpowers | (just describe the action) |
| seamless / seamlessly | (omit or describe what actually happens) |
| hang tight | scanning / importing / loading |
| nice one! | imported / done / complete |
| at a glance | (omit) |
| crypto super app | Infinex |
| change the way you crypto | (state actual product thesis) |
| enjoy the experience you love | (omit) |
| unlock (as marketing filler) | (use the literal action verb) |

Rule (verbatim from handover): **If the user is trying to complete a financial / security / trading task, do not sell them the product. Help them complete the task.**

---

## Suggested workstreams

These are sprint-shaped buckets. They assume the [Decisions](#decisions-to-make-before-tactical-fixes) get answered in the same triage session, since most tactical fixes depend on them.

### Now (this sprint)

Ship-blocker + cheap-to-fix-given-decision items.

- **P0 cluster.** DF-001 (mask secret inputs), DF-002 (imported wallet HYPE route), DF-003 (send-to-self → Move).
- **Stale-residue purge after D-01.** DF-010, DF-011, DF-012, DF-014, DF-015, DF-076, DF-077 (Sale, Airdrops, Craterun, Patrons gating, Mantle, Vouchers ad copy, Crates incentive line).
- **Copy rewrite pass after D-15 sign-off.** DF-081 (import sell copy), DF-080 (recovery marketing), DF-023 (Perps marketing in product copy), DF-063 (hang tight/nice one).
- **Earn credibility.** DF-013 (kill 0.66% SNX surfacing) once D-10 lands.
- **Optimistic UI on star.** DF-070.
- **Deposit copy buttons.** DF-041.
- **Gas Account learn-more link target.** DF-051.

### Next (within 2 sprints)

Higher-effort but well-scoped once decisions are made.

- **Onboarding redesign** (D-13): DF-050, DF-060, DF-061, DF-074, DF-064, DF-065, DF-150.
- **Perps venue model** (D-04, D-05): DF-020, DF-021, DF-022, DF-024.
- **Switch flow redesign**: DF-030, DF-031, DF-110, DF-111, DF-112.
- **Deposit IA**: DF-040 (pinned assets per D-08), DF-042 (dynamic-address copy per D-07), DF-043 (7702 icon per D-09), DF-131 (unify wallet-import flows).
- **Earn intent flow**: DF-100, DF-101, DF-102, DF-103.

### Later / Defer / Discuss

Lower priority or pending bigger product calls.

- **Asset discovery surface** (D-11): DF-071, DF-072.
- **Marketing site overhaul**: DF-090, DF-091, DF-092, DF-093, DF-094, DF-095, DF-096 — pending D-12 (news pipeline) and brand-factory voice lock.
- **Comparison chart in Switch**: DF-113.
- **Settings cleanup**: DF-160, DF-161, DF-162, DF-163, DF-164, DF-165.
- **Perps Terms modal collapse**: DF-025 (D-06).
- **Naming review** Switch vs Swap: DF-114.
- **Crates sonic system**: DF-099.

---

## Colleague-sharing note

This is intentionally blunt because the dogfood session was blunt. The point isn't to call out individuals — it's that **systemic patterns** have shown up in the product that we can now fix together:

1. **Old campaign residue** is still occupying default user surfaces (Sale, Craterun, Airdrops, Mantle, Yaprun, Points, Badges, App Brand).
2. **Marketing copy is bleeding into utility / security / trading flows**, where it costs trust instead of building it.
3. **Implementation details** (7702 icons, venue choice on Perps, dynamic deposit addresses) are leaking out to users without translation.
4. **Core Infinex primitives** (gas account, non-EVM deposit support, the Move concept) are buried or discovered too late.
5. **Two ship-blocker bugs** (DF-001 / DF-002 / DF-003) touch security and the central "one account / any venue" thesis directly.

The product itself has strong primitives. The work is to make the interface act like it knows that.

This document, the [handover](infinex-app-dogfood-handover.md), the [audit](infinex-dogfood-audit.md), and the [raw transcript](../../infinex-xyz/Platform Dogfood/transcripts/infinex-dogfood.elevenlabs.timestamped.md) are the supporting evidence — bring whichever you need to the meeting.
