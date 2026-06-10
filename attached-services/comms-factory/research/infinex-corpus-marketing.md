# Infinex marketing corpus

Harvested 2026-05-18 from existing audits + a live grep of the public-website repo.

## Sources

- `research/infinex-homepage-tempo-fit.md` — verbatim shipped homepage strings (H01-H20).
- `research/infinex-dogfood-pipeline.md` — shipped operational/marketing strings (S01-S13).
- `research/infinex-app-dogfood-handover.md` — long-form audit, in-line quoted copy.
- `~/Sites/infinex-xyz/platform/apps/public-website/src/app/(site)/_components/` — live JSX grep.

ID range: IM001-IM099.

## Copy units

### Homepage hero — infinex.xyz/

| # | Kind | Source | Text |
|---|---|---|---|
| IM001 | hero | apps/public-website/src/app/(site)/_components/hero/index.tsx:53 | "Change the way you crypto." |
| IM002 | value_prop | apps/public-website/src/app/(site)/_components/hero/index.tsx:57 | "Unified portfolio." |
| IM003 | value_prop | apps/public-website/src/app/(site)/_components/hero/index.tsx:60 | "Multi-provider trading." |
| IM004 | value_prop | apps/public-website/src/app/(site)/_components/hero/index.tsx:63 | "Serious Opsec." |
| IM005 | cta | apps/public-website/src/app/(site)/_components/hero/index.tsx:70 | "Get Infinex" |
| IM006 | trust_line | apps/public-website/src/app/(site)/_components/hero/index.tsx:79 | "Infinex is secured by" |
| IM007 | roadmap_card_title | apps/public-website/src/app/(site)/_components/hero/index.tsx:112 | "Infinex Roadmap" |
| IM008 | roadmap_card_blurb | apps/public-website/src/app/(site)/_components/hero/index.tsx:116 | "See everything we've shipped, and everything that's coming up" |

### Feature switcher — infinex.xyz/

| # | Kind | Source | Text |
|---|---|---|---|
| IM009 | section_head | research/infinex-homepage-tempo-fit.md H07 | "Explore key features" |
| IM010 | feature_title | apps/public-website/src/app/(site)/_components/feature-switcher/data.ts:34 | "Self-custody wallet" |
| IM011 | feature_subtitle | apps/public-website/src/app/(site)/_components/feature-switcher/data.ts:38 | "Passkey-first, gas-abstracted wallet with support for 20+ chains." |
| IM012 | feature_title | apps/public-website/src/app/(site)/_components/feature-switcher/data.ts:48 | "Multi-provider trading" |
| IM013 | feature_subtitle | apps/public-website/src/app/(site)/_components/feature-switcher/data.ts:51 | "Swap. Perps. Earn. Predict. Multi-provider. Multi-chain." |
| IM014 | feature_title | apps/public-website/src/app/(site)/_components/feature-switcher/data.ts:61 | "Unified portfolio" |
| IM015 | feature_subtitle | apps/public-website/src/app/(site)/_components/feature-switcher/data.ts:64 | "More than view-only. Import or connect existing wallets and take control." |
| IM016 | feature_title | apps/public-website/src/app/(site)/_components/feature-switcher/data.ts:77 | "Browser extension" |
| IM017 | feature_subtitle | apps/public-website/src/app/(site)/_components/feature-switcher/data.ts:78 | "Connect securely to any dapp and take your account with you." |
| IM018 | feature_title | apps/public-website/src/app/(site)/_components/feature-switcher/data.ts:92 | "Serious Opsec" |
| IM019 | feature_subtitle | apps/public-website/src/app/(site)/_components/feature-switcher/data.ts:94 | "Passkey to Ledger to Safe. Choose the Opsec to suit your spec." |
| IM020 | feature_title | apps/public-website/src/app/(site)/_components/feature-switcher/data.ts:115 | "Rewards and cashback" |
| IM021 | feature_subtitle | apps/public-website/src/app/(site)/_components/feature-switcher/data.ts:116 | "Switch to Infinex and earn crates and cashback on every trade." |

### Feature cards alt — infinex.xyz/

| # | Kind | Source | Text |
|---|---|---|---|
| IM022 | feature_kicker | apps/public-website/src/app/(site)/_components/feature-card-alt/data.ts:27 | "Swap & Bridge" |
| IM023 | feature_headline | apps/public-website/src/app/(site)/_components/feature-card-alt/data.ts:28 | "Swap any token, any chain." |
| IM024 | feature_caption | apps/public-website/src/app/(site)/_components/feature-card-alt/data.ts:31 | "25+ direct integrations" |
| IM025 | feature_kicker | apps/public-website/src/app/(site)/_components/feature-card-alt/data.ts:34 | "Perpetual Futures" |
| IM026 | feature_headline | apps/public-website/src/app/(site)/_components/feature-card-alt/data.ts:35 | "Trade perps in-app with up to 40x leverage" |
| IM027 | feature_caption | apps/public-website/src/app/(site)/_components/feature-card-alt/data.ts:37 | "Powered by Hyperliquid" |
| IM028 | feature_kicker | apps/public-website/src/app/(site)/_components/feature-card-alt/data.ts:41 | "Earn & Yield" |
| IM029 | feature_headline | apps/public-website/src/app/(site)/_components/feature-card-alt/data.ts:42 | "Earn passive yield on your assets" |
| IM030 | feature_caption | apps/public-website/src/app/(site)/_components/feature-card-alt/data.ts:43 | "Earn yield on ETH, SOL, and stablecoins" |
| IM031 | feature_kicker | apps/public-website/src/app/(site)/_components/feature-card-alt/data.ts:49 | "Wallet Extension" |
| IM032 | feature_headline | apps/public-website/src/app/(site)/_components/feature-card-alt/data.ts:51 | "Connect to all your favorite dapps" |
| IM033 | feature_caption | apps/public-website/src/app/(site)/_components/feature-card-alt/data.ts:52 | "Download now for your browser" |
| IM034 | feature_kicker | apps/public-website/src/app/(site)/_components/feature-card-alt/data.ts:58 | "NFTs" |
| IM035 | feature_kicker_secondary | apps/public-website/src/app/(site)/_components/feature-card-alt/data.ts:59 | "Early Access" |
| IM036 | feature_headline | apps/public-website/src/app/(site)/_components/feature-card-alt/data.ts:61 | "Collect and trade NFTs in one place" |
| IM037 | feature_caption | apps/public-website/src/app/(site)/_components/feature-card-alt/data.ts:62 | "Trade on OpenSea, Magic Eden, and Blur" |
| IM038 | feature_kicker | apps/public-website/src/app/(site)/_components/feature-card-alt/data.ts:68 | "Prediction Markets" |
| IM039 | feature_headline | apps/public-website/src/app/(site)/_components/feature-card-alt/data.ts:71 | "Pick winners on prediction markets" |
| IM040 | feature_caption | apps/public-website/src/app/(site)/_components/feature-card-alt/data.ts:73 | "Powered by Polymarket" |

### Security detail tiles — infinex.xyz/

| # | Kind | Source | Text |
|---|---|---|---|
| IM041 | section_head | apps/public-website/src/app/(site)/_components/TitleWithTiles.tsx:113 | "The security detail" |
| IM042 | tile_title | apps/public-website/src/app/(site)/_components/TitleWithTiles.tsx:19 | "Self custody" |
| IM043 | tile_tagline | apps/public-website/src/app/(site)/_components/TitleWithTiles.tsx:20 | "Your keys, secured by Turnkey" |
| IM044 | tile_title | apps/public-website/src/app/(site)/_components/TitleWithTiles.tsx:25 | "Passkeys" |
| IM045 | tile_tagline | apps/public-website/src/app/(site)/_components/TitleWithTiles.tsx:26 | "Phishing resistant security" |
| IM046 | tile_title | apps/public-website/src/app/(site)/_components/TitleWithTiles.tsx:31 | "Recovery" |
| IM047 | tile_tagline | apps/public-website/src/app/(site)/_components/TitleWithTiles.tsx:32 | "Simple recovery when needed" |
| IM048 | tile_title | apps/public-website/src/app/(site)/_components/TitleWithTiles.tsx:37 | "Clear signing" |
| IM049 | tile_tagline | apps/public-website/src/app/(site)/_components/TitleWithTiles.tsx:38 | "See what privileges you're granting" |
| IM050 | tile_title | apps/public-website/src/app/(site)/_components/TitleWithTiles.tsx:43 | "Vaults" |
| IM051 | tile_tagline | apps/public-website/src/app/(site)/_components/TitleWithTiles.tsx:44 | "Onchain vaults for maximum control" |
| IM052 | tile_title | apps/public-website/src/app/(site)/_components/TitleWithTiles.tsx:49 | "2FA" |
| IM053 | tile_tagline | apps/public-website/src/app/(site)/_components/TitleWithTiles.tsx:50 | "An additional layer of protection" |

### Positioning / cross-section copy

| # | Kind | Source | Text |
|---|---|---|---|
| IM054 | product_tagline | research/infinex-dogfood-pipeline.md S07 | "Infinex, a crypto super app." |
| IM055 | positioning | research/infinex-homepage-tempo-fit.md H14 | "One super app." |

### Import-wallet marketing copy (in-product but campaign-style)

| # | Kind | Source | Text |
|---|---|---|---|
| IM056 | import_pitch_hero | research/infinex-dogfood-pipeline.md S02 | "Give your wallet Infinex superpowers." |
| IM057 | import_pitch_blurb | research/infinex-dogfood-pipeline.md S03 | "Import to unlock seamless trading, management and multi-chain access." |
| IM058 | external_wallets_card | research/infinex-dogfood-pipeline.md S06 | "Bring your wallets into Infinex. Enjoy the seamless experience you love." |

### Perps marketing copy (in-product but campaign-style)

| # | Kind | Source | Text |
|---|---|---|---|
| IM059 | perps_value_prop | research/infinex-dogfood-pipeline.md S08 | "Track your positions and PnL at a glance." |
| IM060 | perps_value_prop | research/infinex-dogfood-pipeline.md S09 | "Seamless on desktop and mobile." |

### Mobile-app welcome / signup marketing

| # | Kind | Source | Text |
|---|---|---|---|
| IM061 | welcome_title | apps/mobile/src/i18n/locales/en.json welcome.title | "Welcome" |
| IM062 | welcome_subtitle | apps/mobile/src/i18n/locales/en.json welcome.passkeyIntro | "Your Infinex Account is secured with a passkey – a safer replacement for passwords." |
| IM063 | welcome_create | apps/mobile/src/i18n/locales/en.json welcome.createAccountButton | "Create an account" |
| IM064 | welcome_import | apps/mobile/src/i18n/locales/en.json welcome.importExistingWallet | "Import an existing wallet" |
| IM065 | welcome_signup | apps/mobile/src/i18n/locales/en.json welcome.signUpAt | "Sign up at infinex.xyz" |
| IM066 | welcome_no_account | apps/mobile/src/i18n/locales/en.json welcome.noAccount | "Don't have an account?" |
| IM067 | patron_gate_title | apps/mobile/src/i18n/locales/en.json patronGate.title | "Patron Early Access" |
| IM068 | patron_gate_desc | apps/mobile/src/i18n/locales/en.json patronGate.description | "The Infinex App is currently available to Patrons only. Try logging in with a Patron account." |

### Funds-recovery value-prop (vault explainer surface)

| # | Kind | Source | Text |
|---|---|---|---|
| IM069 | vault_card_title | apps/web-app/src/pages/app/vault/_components/VaultExplainer.tsx | "Onchain recovery" |
| IM070 | vault_card_blurb | apps/web-app/src/pages/app/vault/_components/VaultExplainer.tsx | "Funds recovery doesn't require the Infinex platform." |

## Notes

- The pre-dogfood-fix in-product strings (IM056–IM060) sit on the boundary between marketing and utility. They render inside a product flow but use campaign register; the dogfood handover flags them as cross-contamination and a comms-factory writeup target. They are kept in MARKETING because the register, not the surface, governs them.
- "Get Infinex" CTA (IM005) was flagged in the dogfood transcript as unclear ("What does that mean? Use Infinex?") — kept as-is because that is the shipped string.
- The "Roadmap" section header (IM007) and the Roadmap teaser (IM008) sit between marketing and IA — captured because both surface as load-bearing first-touch copy.

## Sample count: 70 units
