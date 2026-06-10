# Infinex App Dogfood Handover

Date: 2026-05-15

Purpose: summarize the website/platform dogfood session so product, design, frontend, brand, and comms can review the actual app issues without needing to watch the full recording first.

This document is about the **actual website/app dogfood**, not the comms-factory generator/validator loop.

## Source Material

Primary source:

- Original audio: `/Users/opaque/Sites/infinex-xyz/Platform Dogfood/Infinex Dogfood.wav`
- ElevenLabs transcript: `/Users/opaque/Sites/infinex-xyz/Platform Dogfood/transcripts/infinex-dogfood.elevenlabs.timestamped.md`
- Raw word-level transcript JSON: `/Users/opaque/Sites/infinex-xyz/Platform Dogfood/transcripts/infinex-dogfood.elevenlabs.raw.json`

Derived material:

- Gemini first pass: broad UX/copy/platform audit.
- Gemini second pass: targeted correction after it missed later-product issues.
- Repo audit summary: `research/infinex-dogfood-audit.md`.

The transcript remains the source of truth. Gemini was useful for synthesis, but its output should not override direct evidence from the recording.

## Executive Summary

The dogfood session found a consistent pattern: Infinex has strong product primitives, but the app often makes users fight the interface, read marketing copy during utility tasks, or interpret implementation details that should be abstracted away.

The highest-risk issues are not cosmetic:

- Secret inputs are exposed in clear text during wallet import.
- Imported wallets hit a hard block when trying to access HYPE/Hyperliquid routes.
- Sending to an owned Infinex address errors instead of becoming a Move.
- Core deposit assets and copy actions are buried behind multi-click flows.
- Stale campaigns remain prominent in app navigation and settings.
- Product UI repeatedly sells the user on Infinex while they are already trying to use it.

The strongest product direction from the session:

> Infinex should feel like quiet, competent crypto infrastructure. The app should name actions, consequences, and mechanics. It should not advertise itself inside utility flows.

## Priority Findings

### P0 — Sensitive input visibility

Evidence:

- `09:00-10:00`: When importing a seed/private key, Opaque compares the flow to MetaMask/Rabby, where sensitive input is masked. Infinex shows it in clear text. Direct quote/paraphrase: "That's my first number one. I really don't like that."

Problem:

- Shoulder-surfing and screen-share risk during one of the most sensitive flows in the product.
- Immediate trust break for crypto-native users.

Action:

- Mask private key and seed phrase fields by default.
- Add explicit reveal control.
- Consider paste handling, screenshots, and clipboard warnings.

Acceptance criteria:

- A pasted private key or seed phrase is never visible by default.
- User must explicitly choose to reveal it.

### P0 — Imported wallets cannot access HYPE/Hyperliquid correctly

Evidence:

- `19:00-21:30`: When using an imported wallet, the user cannot route into HYPE. Opaque flags this as "truly one of the worst features" and "one of the worst parts about the flow."
- `21:00-22:00`: The app says "This wallet doesn't support Hype." Opaque's point: the wallet does support it elsewhere; Infinex does not support it in this flow.

Problem:

- Breaks the "one account / all assets / venue abstraction" thesis.
- User has a clear intent: buy HYPE or move into Hyperliquid. The app blocks them without a useful path.

Action:

- Investigate execution model for imported wallets and Hyperliquid/HYPE.
- If direct execution is impossible, provide a one-click route to move/prepare funds into the right Infinex wallet/account.
- Do not phrase the block as if the user's wallet is inherently incapable.

Acceptance criteria:

- User can buy/trade HYPE from imported-wallet balances, or gets a clear one-click path to complete the trade.
- No dead-end copy that blames the wallet incorrectly.

### P0 — Send-to-self should auto-route to Move

Evidence:

- `37:00-38:30`: User pastes their own Infinex address into Send. App returns: "You can't send to your own Infinex account address. Use Move instead." Opaque calls this "horrendous" and asks why the app cannot route it automatically.

Problem:

- User intent is valid. The app understands the destination is owned but makes the user change flows manually.
- This exposes internal routing distinctions that Infinex should abstract away.

Action:

- If destination address belongs to the user's Infinex account, convert Send into Move automatically.
- Change button/action state from Send/Review to Move where appropriate.

Acceptance criteria:

- User entering their own address does not hit a blocking error.
- UI explains the route only if needed: "Moving within your Infinex account."

## Website Findings

### Homepage hero is not landing

Evidence:

- `00:00-01:00`: "Change the way you crypto doesn't feel right to me."
- Opaque specifically questioned whether this still fits the new Infinex product framing: unified portfolio, multi-provider trading, serious OpSec.

Problem:

- Headline reads like generic crypto marketing rather than a concrete product thesis.
- Does not tell a first-time user what Infinex replaces or what it lets them do.

Action:

- Rewrite homepage hero around the actual product mechanic.
- Suggested direction: one account across chains, wallets, venues, and products.

Example rewrite directions:

- "One account for every chain and venue."
- "Trade across onchain venues from one Infinex account."
- "Your portfolio, connected to the venues you already use."

### Website feels static / non-interactive

Evidence:

- `00:00-01:00`: User expected some homepage elements to be clickable because they look like tabs, but they are not.

Problem:

- Website creates affordance confusion.
- Visitors may expect exploration but find static proof blocks.

Action:

- Audit visual affordances: if something looks like a tab/control, make it interactive or restyle it as static.

### News looks stale

Evidence:

- `01:00-02:00`: "Our last news was fucking ages ago." Opaque points to needing automation and pipeline support.

Problem:

- Stale news makes the product look inactive.

Action:

- Wire feature releases/comms pipeline into website updates.
- Either make news current or remove the "latest news" posture.

### Craterun should not be top-level

Evidence:

- `03:00-03:30`: Craterun "is kind of dead" and should not be top-line. Opaque suggests it might belong under features/perps/switch, if anywhere.

Problem:

- Dead or inactive campaigns occupy primary navigation.

Action:

- Product decision: remove, archive, or demote.

### INX/token page may be sale-era residue

Evidence:

- `02:00-03:00`: Opaque questions whether the current token page was needed for the sale but is still needed now.

Problem:

- Page may still be structured around historical sale information instead of current token utility.

Action:

- Review INX page for current user job: holding benefits, how to buy, token utility, current status.
- Strip sale-era content that no longer serves users.

## Onboarding / Passkeys

### Passkey education is too textual and too early

Evidence:

- `04:55-06:00`: User tries to import a wallet but is stopped by "An important note on passkeys." Opaque: "This feels silly to me because I don't know anything about passkeys. I just want to import a wallet."
- `05:00-06:00`: Opaque suggests annotated UI: highlight + arrows pointing to actual browser/passkey UI.

Problem:

- The flow interrupts the user's task with a wall of explanation.
- The explanation is too specific and abstract before the user sees the UI it describes.

Action:

- Replace large explanatory block with contextual annotation on the actual passkey step.
- Use guided UI highlights/arrows rather than prose.

Acceptance criteria:

- User understands where to click during passkey creation without reading a long note first.

### Security prompts feel front-loaded

Evidence:

- `30:00-32:00`: During recovery email setup, Opaque is asked to sign with passkey before entering/confirming the email and describes the flow as "muchness."

Problem:

- Security friction appears before the user understands the task sequence.

Action:

- Consider email entry -> OTP verification -> passkey sign to finalize.
- Explain why passkey signing is needed at the moment it becomes relevant.

## Wallet Import

### Import copy is marketing copy inside a task flow

Evidence:

- `06:00-06:45`: "Give your wallet Infinex superpowers" and "Import to unlock seamless trading..." are challenged directly. Opaque asks whether "superpowers" fits the new voice and says "I don't know what that means."

Problem:

- User already knows they want to import. The app should help them do it, not sell the concept.

Action:

- Replace marketing with task language.

Suggested replacements:

- "Import an external wallet."
- "Connect via seed phrase or private key."
- "Manage external wallets from Infinex."

### Wallet naming copy is awkward

Evidence:

- `09:00-10:30`: "Name your seed phrase. Give your seed phrase a name..." and "Name your imported wallet. Give your imported wallet a name to use it." Opaque says, "I don't like this verbiage at all."

Problem:

- Copy is repetitive and unnatural.

Action:

- Simplify to:
  - "Name this wallet."
  - "This name is only visible to you."

### Loading/success copy is too familiar

Evidence:

- `10:00-11:00`: "Hang tight" and "Nice one!" are called "very opinionated" and off-register.

Problem:

- Casual tone in wallet/security flows reduces trust.

Action:

- Replace with:
  - "Scanning wallet activity."
  - "Wallet imported."
  - "Import complete."

### Import flow feels too long

Evidence:

- `11:00-12:00`: "Well, taken on me a long time to get in, to be honest."

Problem:

- New user onboarding/import flow has too many conceptual interruptions.

Action:

- Instrument time-to-first-usable-account.
- Separate essential steps from optional education.

## Home / Navigation / Stale Modules

### Infinex Sale should not be present for a new user

Evidence:

- `11:00-12:00`: "Infinex sale. This shouldn't be here anymore. This is completely irrelevant to me. I'm a new user. I can't do anything with the Infinex sale, so that's dead."

Action:

- Remove from default homepage/navigation unless product has a current active reason.

### Labs / Patron gating is confusing

Evidence:

- `11:30-13:00`: Opaque questions "become a patron" incentives in the current phase. "Available to patrons" but user can use Private Send.

Problem:

- Gating language and actual availability appear inconsistent.

Action:

- Audit Labs cards for real access state.
- Clarify "available to patrons" vs "available to everyone" vs "early access."

### Airdrops should likely be hidden or sunset

Evidence:

- `12:30-13:30`: Airdrops copy says connect wallet/social accounts and participate to qualify. Opaque: "we're not really doing any airdrops anymore" and "this should be toggled off."

Problem:

- Creates false expectation of current airdrop activity.

Action:

- Product decision: hide, archive, or repurpose for actual claim flows later.

## Earn / Yield

### Earn is described as "a mess"

Evidence:

- `13:30-14:00`: Opaque reaches Earn and says "It's a mess."

Problem:

- The surface appears to be a dump of opportunities rather than an intent-led product.

Action:

- Reframe around user intent: "What do you want to earn yield on?"
- Asset-first selector: SOL, ETH, BTC, stablecoins, etc.

### Low-yield SNX opportunity damages credibility

Evidence:

- `13:30-14:00`: "Deposit SNX and earn 0.66 APY. That's nothing. We need to take that off the page."

Problem:

- Low-quality opportunities make the product feel uncurated.

Action:

- Define minimum display thresholds or editorial/product rules for surfacing opportunities.

### "Liquid staking" is not the right label

Evidence:

- `14:00-15:00`: Opaque: "They're yield-bearing assets actually. They're not even liquid staking... It's yield-bearing. That's the term that we all use."

Action:

- Rename where appropriate to "Yield-bearing assets."
- Add explainer for yield-bearing assets.

### One thing that worked: Buy prefill

Evidence:

- `15:00-16:00`: Clicking Buy on a yield asset takes user into Switch with asset prefilled. Opaque: "I really like that as a feature."

Action:

- Preserve this pattern. Extend it where possible.

## Switch / Swidge

### Source wallet selection should default to intent, not a specific wallet

Evidence:

- `16:00-18:00`: Opaque does not know where funds are and wants an "All" option. Current flow defaults to Infinex wallet.

Problem:

- User has fragmented funds across wallets. App expects them to know where liquidity is.

Action:

- Add "All wallets" source view.
- Let user filter by wallet when needed.
- Auto-select the wallet that actually has the required asset/balance.

### Destination wallet defaults need thought

Evidence:

- `17:00-18:00`: Opaque wants default destination to main wallet or user-configured default, with ability to choose another wallet.

Action:

- Add default wallet setting or sensible default.

### Relative price comparison would be useful

Evidence:

- `18:00-20:30`: Opaque wants merged chart / relative chart for INX vs HYPE or asset pair comparison.

Problem:

- Current side-by-side daily performance is useful but incomplete for trade decision.

Action:

- Consider comparison chart toggle for source/destination assets.

## Crates / Vouchers

### Crates should appear when relevant

Evidence:

- `21:30-22:30`: Crates are "fine" but should pop up when users have crates to open, not occupy attention when irrelevant.

Action:

- Trigger Crates UI based on actual available crates/activity.

### Vouchers are both explained and advertised

Evidence:

- `22:00-23:30`: Opaque says the UI keeps "explaining the feature and advertising the feature at the same time" and "Stop selling it to me through the UI."

Problem:

- Product copy lacks discipline: it blends explanation with promotion.

Action:

- Vouchers page should explain mechanics plainly.
- Remove discount-pitch copy unless the surface is explicitly promotional.

### Crates incentive copy is inaccurate

Evidence:

- `23:00-24:00`: "Trade Perps to start earning crates. That's not true. It's also Switch."

Action:

- Rewrite to "Use Infinex to start earning crates" or "Swap or trade perps to earn crates", depending on actual rules.

## Perps

### Perps intro copy is outdated and too market-y

Evidence:

- `24:00-25:30`: "Powered by Hyperliquid and Lighter now, so this is out of date."
- "Track your positions and PnL at a glance" triggers strong dislike: "I hate this fucking phrase, 'at a glance.'"
- "Seamless on desktop and mobile" is called marketing copy inside product copy.

Action:

- Update venue list: Hyperliquid, Lighter, Synthetix if accurate.
- Remove "at a glance" and "seamless."
- Replace with actual product mechanics.

### Venue routing is confusing

Evidence:

- `25:30-29:30`: User clicks a popular market and is taken into Lighter without clear venue labeling. Opaque repeatedly questions why it defaults to Lighter instead of Hyperliquid.

Problem:

- Serious traders need to know which venue they are entering.
- If Infinex supports multiple venues, discovery should expose venue as a first-class dimension.

Action:

- Popular markets should be grouped or tagged by venue.
- Add filters/toggles: Hyperliquid, Lighter, Synthetix.
- Searching BTC should show BTC markets across venues with price, OI, volume, funding, etc.

Acceptance criteria:

- User can choose or filter venues before launching.
- No silent venue default.

### Terms of Use gate is heavy

Evidence:

- `25:00-26:00`: User hits a large terms modal and calls it "gnarly UX."

Action:

- Review legal requirements.
- Collapse if possible into a single clear acceptance flow.

## Portfolio / Recovery

### Recovery copy contains product marketing

Evidence:

- `30:00-31:30`: Recovery email flow includes "Infinex, a crypto super app." Opaque says again this is marketing copy inside product copy.

Action:

- Remove brand slogan from transactional/security emails and recovery UI.

### Passkey signing before email entry felt wrong

Evidence:

- `30:00-31:30`: Opaque expected to enter email first, then sign.

Action:

- Revisit flow order.

## Deposits

### Deposit flow hides major non-EVM assets too deep

Evidence:

- `33:00-34:00`: "This is the first time I've seen that I can hold Bitcoin in Infinex. That feels very late and very low." Similar comments for Cardano/Dogecoin.

Problem:

- A major product advantage is buried.

Action:

- Pin or promote BTC, ETH, SOL, and major supported non-EVM assets.
- Consider explicit "Bring your Bitcoin/Cardano/Dogecoin into Infinex" messaging where appropriate.

### EIP-7702 icon is unclear

Evidence:

- `33:00-34:00`: "This symbol here means that it's a 7702 address. That doesn't make any sense to me."

Action:

- Replace protocol-number icon/meaning with plain-language affordance or tooltip.

### Network rows need direct copy buttons

Evidence:

- `34:00-36:30`: Opaque repeatedly says every row should have a copy button. Hyperliquid copy path is called out as too many clicks.

Problem:

- Getting a deposit address should not require drilling into each network/environment.

Action:

- Add direct copy affordance to network rows.
- For ambiguous networks like Hyperliquid, separate HyperEVM vs Hypercore clearly.

### Dynamic address risk needs a clear answer

Evidence:

- `34:00-35:00`: Opaque asks what happens if the address changes and a user sends to an old address.

Action:

- Engineering/product must answer this.
- Copy should reflect actual behavior:
  - If old address still works, say so.
  - If not, make risk prominent.

Suggested copy:

- "Copy a fresh address for every deposit."
- "Send only native BTC to this address."

## Gas Account

### Gas account is discovered too late

Evidence:

- `38:30-40:30`: Opaque finds Gas Account late and says onboarding should have introduced it earlier.

Problem:

- Gas abstraction is a core product primitive but is not taught upfront.

Action:

- Add onboarding step:
  - what gas account is
  - how to top it up
  - when it is used
  - how extension gas behavior works

### Learn More points to wrong concept

Evidence:

- `39:00-40:00`: Opaque clicks Learn More expecting gas account explanation and gets generic network costs. "There's absolutely fuck all here about the gas account."

Action:

- Link to gas-account-specific docs/help.

### Top-up flow itself is relatively clean

Evidence:

- `39:30-40:30`: Opaque describes the top-up flow as "actually pretty clean."

Action:

- Preserve top-up mechanics while improving discovery/explanation.

## Settings / Customization / Asset Discovery

### Avatar/customization should be user-selectable

Evidence:

- `41:00-42:00`: Opaque wants to pick icon/avatar and color. Notes confusing color changes.

Action:

- Review avatar customization state and persistence.

### Starred-token state lags

Evidence:

- `41:00-43:30`: Unstarring requires refresh or delayed update.

Action:

- Add optimistic UI update.

### Dead toggles in homepage customization

Evidence:

- `42:00-43:00`: Opaque sees app brand, points, badges, etc. "What points? What badges?"

Problem:

- Settings expose stale/dead concepts.

Action:

- Remove or hide Yaprun/Points/Badges/App Brand if not active.

### Asset discovery gap

Evidence:

- `42:30-45:00`: Opaque distinguishes portfolio ("what I have") from asset discovery ("what exists"). Some assets do not appear quickly or at all.

Action:

- Consider asset discovery page/search separate from portfolio holdings.
- Review indexing/top-1000 behavior and fallback sources.

## Tone Of Voice Findings From The App

This was one of the clearest threads in the session.

Product UI should not sound like campaign copy. In utility surfaces, the app should name:

- the action
- the consequence
- the mechanic
- the risk
- the next step

Words/phrases flagged directly or by synthesis:

- superpowers
- seamless / seamlessly
- hang tight
- nice one
- at a glance
- crypto super app
- change the way you crypto
- enjoy the experience you love
- unlock, when used as marketing filler

Preferred language:

- Import
- Deposit
- Withdraw
- Move
- Route
- Sign
- Select wallet
- Select market
- Copy address
- Yield-bearing assets
- Venue

Rule of thumb:

> If the user is trying to complete a financial/security/trading task, do not sell them the product. Help them complete the task.

## Useful Copy Rewrites

| Current | Better Direction |
|---|---|
| Change the way you crypto. | State the actual product thesis: one account across chains/venues. |
| Give your wallet Infinex superpowers. | Import an external wallet. |
| Import to unlock seamless trading, management and multi-chain access. | Connect via seed phrase or private key. |
| Hang tight while we check. | Scanning wallet activity. |
| Nice one! | Wallet imported. |
| Bring your wallets into Infinex. Enjoy the seamless experience you love. | Manage external wallets from Infinex. |
| Infinex, a crypto super app. | Infinex. |
| Track your positions and PnL at a glance. | Track positions and PnL. |
| Seamless on desktop and mobile. | Remove, or state actual account/device behavior. |
| You can't send to your own Infinex account address. Use Move instead. | Remove the error; route to Move. |
| Only native BTC is supported. Other Bitcoin assets won't be withdrawable until support is added. | Send only native BTC to this address. |
| This address may change. Always copy the address from here before each deposit. | Copy a fresh address for every deposit. |

## Product Decisions Needed

- Are Craterun, Sale, Airdrops, Yaprun, Points, Badges, and App Brand dead, archived, or temporarily hidden?
- What is the intended execution model for imported wallets and HYPE/Hyperliquid?
- Should Send always auto-route to Move when the destination is an owned Infinex address?
- Which venues should appear in Perps discovery and what ranking signal drives "popular"?
- Can Perps legal acceptance be collapsed without legal risk?
- What happens if a user sends to an old dynamic deposit address?
- Which non-EVM assets should be pinned in deposits?
- What is the correct user-facing explanation for 7702-backed addresses, if any?
- What is the current status of SNX/sUSD earn opportunities?
- What is the intended current role of Patrons/Labs gating?

## Suggested Workstreams

### Now

- Mask private key / seed phrase inputs.
- Fix or route imported-wallet HYPE blockage.
- Auto-route Send-to-self into Move.
- Remove stale Sale/Airdrops/Craterun surfaces from default user workspace unless explicitly active.
- Remove product-marketing copy from wallet import, recovery, perps intro, and deposit flows.

### Next

- Redesign Switch wallet source picker around All Wallets / wallet filters.
- Redesign Perps market discovery around venue filters and visible routing.
- Add direct copy buttons to deposit network rows.
- Pin major assets in deposit discovery.
- Add gas account onboarding and docs link.

### Later

- Build asset discovery separate from portfolio.
- Add comparison chart in Switch for source/destination assets.
- Clean up avatar/home customization.
- Rework homepage hero and website IA after product decisions on stale campaigns.

## Notes For Sharing

This handover is intentionally blunt because the dogfood session was blunt. The goal is not to criticize individual contributors. The pattern is systemic:

- product surfaces have accumulated old campaign residue,
- utility flows have inherited marketing copy,
- implementation details are leaking to users,
- and some core Infinex primitives are under-explained or discovered too late.

The product itself has strong primitives. The work is to make the interface act like it knows that.
