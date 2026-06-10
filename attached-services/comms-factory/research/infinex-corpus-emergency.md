# Infinex emergency corpus

Harvested 2026-05-18 from existing audits + a live grep of the platform repo for emergency surfaces: scam blocks, transaction warnings, fund-loss callouts, refusals, error toasts, and recovery prompts.

## Sources

- `research/infinex-dogfood-triage.md` — P0/P1 security-flagged rows + evidence quotes.
- `research/infinex-app-dogfood-handover.md` — long-form audit notes.
- `~/Sites/infinex-xyz/platform/apps/connect-app/src/pages/authorize/` — transaction-signing modal copy.
- `~/Sites/infinex-xyz/platform/apps/extension/src/entrypoints/ui/views/AuthorizeDapp/` — extension malicious-dapp screens.
- `~/Sites/infinex-xyz/platform/apps/web-app/src/components/layouts/components/` — top-level banners (DisabledUser, Emergency, VersionMismatch).
- `~/Sites/infinex-xyz/platform/apps/web-app/src/components/features/deprecation/` — chain-deprecation banners.
- `~/Sites/infinex-xyz/platform/apps/web-app/src/pages/app/vault/chain-assets/_components/` — funds-at-risk warnings.
- `~/Sites/infinex-xyz/platform/apps/web-app/src/components/features/deposit/` — deposit fund-loss warnings.
- `~/Sites/infinex-xyz/platform/apps/web-app/src/pages/app/perps/` and `apps/perps-app/src/exchanges/hyperliquid/errors.ts` — trading risk + liquidation copy.
- `~/Sites/infinex-xyz/platform/apps/recovery-app/src/...` — recovery-flow risk warnings.
- `~/Sites/infinex-xyz/platform/apps/public-website/src/app/(site-with-query-client)/status/page.tsx` — system status / outage copy.

Grep patterns: `malicious`, `phishing`, `scam`, `flagged`, `blocked`, `loss of funds`, `not supported`, `cannot`, `at risk`, `liquidation`, `disabled`, `tone="caution"`, `tone="critical"`, `<MaliciousTransactionCard`, `ToastQueue.add('error'`, `showAlert?.(...error)`.

ID range: IE001-IE099.

## Copy units

### Malicious-transaction surfaces (connect-app)

| # | Kind | Source | Text |
|---|---|---|---|
| IE001 | card_title | apps/connect-app/src/pages/authorize/components/MaliciousTransactionCard.tsx:30 | "Malicious transaction detected" |
| IE002 | partner_credit | apps/connect-app/src/pages/authorize/components/MaliciousTransactionCard.tsx:34 | "Powered by" |
| IE003 | modal_title | apps/connect-app/src/pages/authorize/components/MaliciousTransactionDetails.tsx:24 | "Malicious Transaction" |
| IE004 | modal_body | apps/connect-app/src/pages/authorize/components/MaliciousTransactionDetails.tsx:29 | "This transaction was flagged as malicious by Blockaid. {description}." |
| IE005 | footer_link | apps/connect-app/src/pages/authorize/components/MaliciousTransactionDetails.tsx:35 | "Learn more about Blockaid" |
| IE006 | inline_fallback | apps/connect-app/src/pages/authorize/components/helpers/signingRequestHelpers.ts | "This transaction has been flagged as malicious." |
| IE007 | toast_inline | apps/mobile/src/i18n/locales/en.json transactionApproval.messages.flaggedAsMalicious | "This transaction has been flagged as malicious." |

### Malicious-dapp surfaces (extension)

| # | Kind | Source | Text |
|---|---|---|---|
| IE008 | screen_title | apps/extension/src/entrypoints/ui/views/AuthorizeDapp/components/MaliciousDappDetails.tsx:25 | "Connection request blocked" |
| IE009 | card_subtext | apps/extension/src/entrypoints/ui/views/AuthorizeDapp/MaliciousApp.tsx:97 | "connection request blocked" |
| IE010 | callout_body | apps/extension/src/entrypoints/ui/views/AuthorizeDapp/components/MaliciousDappDetails.tsx:30 | "This website has been flagged as malicious by Blockaid. Always do your own research before proceeding." |
| IE011 | callout_label | apps/extension/src/entrypoints/ui/views/AuthorizeDapp/components/MaliciousDappDetails.tsx:37 | "Potential risks found:" |
| IE012 | inline_label | apps/extension/src/entrypoints/ui/views/AuthorizeDapp/MaliciousApp.tsx:116 | "Malicious dapp detected" |
| IE013 | inline_summary | apps/extension/src/entrypoints/ui/views/AuthorizeDapp/MaliciousApp.tsx:121 | "Potential risks include phishing attacks and fake tokens or scams" |
| IE014 | inline_fallback | apps/extension/src/entrypoints/background/.../extensionAdapters.ts | "This dapp has been flagged as malicious" |
| IE015 | button | apps/extension/src/entrypoints/ui/views/AuthorizeDapp/MaliciousApp.tsx:149 | "Close" |

### Attack-type descriptions (Blockaid-driven, surfaced verbatim)

| # | Kind | Source | Text |
|---|---|---|---|
| IE016 | attack_type | apps/extension/src/entrypoints/ui/views/AuthorizeDapp/MaliciousApp.tsx:36 | "Signature Farming - Stealing transaction signatures" |
| IE017 | attack_type | apps/extension/src/entrypoints/ui/views/AuthorizeDapp/MaliciousApp.tsx:38 | "Approval Farming - Stealing token approvals" |
| IE018 | attack_type | apps/extension/src/entrypoints/ui/views/AuthorizeDapp/MaliciousApp.tsx:39 | "NFT Theft - Stealing all your NFTs" |
| IE019 | attack_type | apps/extension/src/entrypoints/ui/views/AuthorizeDapp/MaliciousApp.tsx:40 | "Transfer Farming - Draining your tokens" |
| IE020 | attack_type | apps/extension/src/entrypoints/ui/views/AuthorizeDapp/MaliciousApp.tsx:41 | "Transfer From Farming - Unauthorized transfers" |
| IE021 | attack_type | apps/extension/src/entrypoints/ui/views/AuthorizeDapp/MaliciousApp.tsx:42 | "ETH Theft - Stealing your native currency" |
| IE022 | attack_type | apps/extension/src/entrypoints/ui/views/AuthorizeDapp/MaliciousApp.tsx:43 | "OpenSea Exploit - Stealing via Seaport" |
| IE023 | attack_type | apps/extension/src/entrypoints/ui/views/AuthorizeDapp/MaliciousApp.tsx:44 | "Blur Exploit - Stealing via Blur marketplace" |
| IE024 | attack_type | apps/extension/src/entrypoints/ui/views/AuthorizeDapp/MaliciousApp.tsx:45 | "Permit Exploit - Stealing via permit signatures" |
| IE025 | attack_type | apps/extension/src/entrypoints/ui/views/AuthorizeDapp/MaliciousApp.tsx:46 | "Seed Phrase Theft - Attempting to steal your recovery phrase" |
| IE026 | attack_type | apps/extension/src/entrypoints/ui/views/AuthorizeDapp/MaliciousApp.tsx:49 | "Malicious Network - Connected to known attack servers" |
| IE027 | attack_type | apps/extension/src/entrypoints/ui/views/AuthorizeDapp/MaliciousApp.tsx:50 | "Malicious Code - Contains known malicious scripts" |
| IE028 | attack_type | apps/extension/src/entrypoints/ui/views/AuthorizeDapp/MaliciousApp.tsx:51 | "Investment Scam - Fake investment scheme" |
| IE029 | attack_type | apps/extension/src/entrypoints/ui/views/AuthorizeDapp/MaliciousApp.tsx:52 | "Other Malicious Activity" |
| IE030 | attack_type | apps/extension/src/entrypoints/ui/views/AuthorizeDapp/MaliciousApp.tsx:69 | "Detected as malicious site" |

### Top-level emergency banners (web-app layout)

| # | Kind | Source | Text |
|---|---|---|---|
| IE031 | banner_disabled | apps/web-app/src/components/layouts/components/DisabledUserBanner.tsx:22 | "Your account has been disabled. You have limited access to your account and it has been placed in send-only mode." |
| IE032 | banner_version | apps/web-app/src/components/layouts/components/VersionMismatchBanner.tsx:29 | "It looks like you're using an old version of the app, refresh to update." |
| IE033 | banner_emergency | apps/web-app/src/components/layouts/components/EmergencyAnnouncementBanner.tsx | "{{message}}" (operator-driven via feature flag — no shipped default) |

### System status / outage page

| # | Kind | Source | Text |
|---|---|---|---|
| IE034 | status_title | apps/public-website/src/app/(site-with-query-client)/status/page.tsx:88 | "We'll be back soon" |
| IE035 | status_body | apps/public-website/src/app/(site-with-query-client)/status/page.tsx:89 | "We're making some updates and will be back online soon. Your funds remain safe." |
| IE036 | status_body | apps/public-website/src/app/(site-with-query-client)/status/page.tsx:97 | "One of our upstream providers is offline for maintenance but they'll be back online soon. Your funds remain safe." |
| IE037 | status_title | apps/public-website/src/app/(site-with-query-client)/status/page.tsx:104 | "Temporarily unavailable" |
| IE038 | status_body | apps/public-website/src/app/(site-with-query-client)/status/page.tsx:105 | "We're experiencing technical issues and have temporarily disabled the app while we investigate. Your funds remain safe." |

### Loss-of-funds warnings (deposit / vault)

| # | Kind | Source | Text |
|---|---|---|---|
| IE039 | callout_heading | apps/web-app/src/components/features/deposit/routes/HyperliquidSelectionRoute.tsx:79 | "Make sure you deposit to the correct network or it could result in loss of funds" |
| IE040 | callout_body | apps/web-app/src/components/features/deposit/routes/HyperliquidSelectionRoute.tsx:85 | "Please read our support article for more information." |
| IE041 | callout_heading | apps/web-app/src/pages/app/vault/chain-assets/_components/VaultAssetsAtRiskWarning.tsx:30 | "Your assets are at risk" |
| IE042 | callout_body | apps/web-app/src/pages/app/vault/chain-assets/_components/VaultAssetsAtRiskWarning.tsx:31 | "Please set up funds recovery to ensure your assets can be recovered in case you lose access to your account. Without a recovery address, your assets are unrecoverable." |
| IE043 | callout_heading | apps/web-app/src/pages/app/vault/chain-assets/_components/NetworkSetupRequired.tsx:11 | "Recovery setup required" |
| IE044 | callout_body | apps/web-app/src/pages/app/vault/chain-assets/_components/NetworkSetupRequired.tsx:14 | "Please set up funds recovery to ensure your assets can be recovered in the case that you lose access to your account. Without a recovery address, your assets are unrecoverable." |
| IE045 | callout_heading | apps/web-app/src/pages/app/vault/chain-assets/_components/NetworkDeploymentRequired.tsx:108 | "Funds recovery" |
| IE046 | callout_body | apps/web-app/src/pages/app/vault/chain-assets/_components/NetworkDeploymentRequired.tsx:109 | "Ensure that you control the above funds recovery address on the Berachain network before deploying your vault. If you do not control this address, your funds in this vault will not be recoverable." |
| IE047 | hint | apps/web-app/src/pages/app/vault/chain-assets/_components/NoFundsState.tsx:83 | "To avoid loss of funds, see which assets we support" |

### Send refusal copy

| # | Kind | Source | Text |
|---|---|---|---|
| IE048 | refusal | research/infinex-dogfood-pipeline.md S10 | "You can't send to your own Infinex account address. Use Move instead." |

### Deposit dynamic-address warning

| # | Kind | Source | Text |
|---|---|---|---|
| IE049 | warning | research/infinex-dogfood-pipeline.md S12 | "This address may change. Always copy the address from here before each deposit." |

### Passkey safety / verification

| # | Kind | Source | Text |
|---|---|---|---|
| IE050 | callout_heading | apps/web-app/src/components/features/deposit/components/DepositAddressPasskeyGuard.tsx:29 | "Verify your passkey" |
| IE051 | callout_body | apps/web-app/src/components/features/deposit/components/DepositAddressPasskeyGuard.tsx:31 | "Verify your passkey works correctly before depositing. This ensures you can access your funds." |

### Recovery-flow risk warnings

| # | Kind | Source | Text |
|---|---|---|---|
| IE052 | callout_heading | apps/recovery-app/src/pages/recovery/withdraw-wizard/_components/WithdrawWarningNotice.tsx:14 | "Read before proceeding" |
| IE053 | callout_body | apps/recovery-app/src/pages/recovery/withdraw-wizard/_components/WithdrawWarningNotice.tsx:17 | "We have detected the use of a smart contract account which means it may not be deployed across all networks." |
| IE054 | callout_body | apps/recovery-app/src/pages/recovery/withdraw-wizard/_components/WithdrawWarningNotice.tsx:21 | "Please confirm you have access to this address on the {network} network before proceeding." |
| IE055 | callout_body | apps/recovery-app/src/components/banner/DeactivationWarningBanner.tsx | "Please note that recovering funds will deactivate the associated Infinex Account. However, the account won't be deleted and funds recovery will still be available. If you have any questions, please open a ticket at our Help & Support Centre." |
| IE056 | preflight_help | apps/wallet-recovery-app/src/app/routes/recovery/_components/WalletsList.tsx | "Once recovery has been started you'll no longer be able to access your Infinex account." |

### Deposit fund-safety hints

| # | Kind | Source | Text |
|---|---|---|---|
| IE057 | callout_body | apps/web-app/src/components/features/deposit/components/EvmAddressWarning.tsx | "Double-check your deposit address as they are not all the same across EVM networks." |

### Chain deprecation banners

| # | Kind | Source | Text |
|---|---|---|---|
| IE058 | callout_heading | apps/web-app/src/components/features/deprecation/ChainDeprecationBanner.tsx:67 | "Action required: Move your assets" |
| IE059 | callout_body | apps/web-app/src/components/features/deprecation/ChainDeprecationBanner.tsx:70 | "{chains} is/are being deprecated. Move your assets to a supported chain using Swidge before {deadline}. Your wallet keys remain yours — you can always access funds directly." |
| IE060 | asset_page_callout | apps/web-app/src/pages/app/asset/[id]/AssetDetailsPage.tsx | "Chain being deprecated" |
| IE061 | asset_page_body | apps/web-app/src/pages/app/asset/[id]/AssetDetailsPage.tsx | "This asset is on {chains}, which is being deprecated. Move your assets to a supported chain using Swidge. Your wallet keys remain yours — you can always access funds directly." |

### Asset trust warnings

| # | Kind | Source | Text |
|---|---|---|---|
| IE062 | callout_body | apps/web-app/src/pages/app/asset/[id]/AssetDetailsPage.tsx | "This token is not verified. Only interact with tokens you trust." |

### Maintenance / unavailable surfaces

| # | Kind | Source | Text |
|---|---|---|---|
| IE063 | callout_heading | apps/web-app/src/pages/app/swidge/root/components/notices/SwidgeMaintenanceNotice.tsx:8 | "Swidge is under maintenance" |
| IE064 | callout_body | apps/web-app/src/pages/app/swidge/root/components/notices/SwidgeMaintenanceNotice.tsx:9 | "Swidge is temporarily unavailable while we perform maintenance. Your funds remain safe. Please check back soon." |
| IE065 | callout_body | apps/web-app/src/pages/app/airdrops/index.tsx | "We're making some upgrades to our Airdrop system and have briefly paused claims. Check back soon!" |
| IE066 | callout_body | apps/web-app/src/pages/app/crates/redeem/components/RedemptionDisableReasonCallout.tsx | "Voucher redemption is paused" |
| IE067 | callout_heading | apps/web-app/src/pages/app/crates/redeem/components/RedemptionDisableReasonCallout.tsx | "Voucher redemption in review" |
| IE068 | callout_body | apps/web-app/src/pages/app/crates/redeem/components/RedemptionDisableReasonCallout.tsx | "One of your previous voucher redemptions has had an error and is currently under review. Please wait for us to resolve it before starting another redemption, or Contact Support" |

### Rate-limit / connectivity refusals

| # | Kind | Source | Text |
|---|---|---|---|
| IE069 | banner_body | apps/web-app/src/pages/app/perps/PerpsPage.tsx | "You're being rate limited by Hyperliquid and we cannot load your data. Please close unused perps windows, wait a few mins and refresh." |
| IE070 | banner_body | apps/perps-app/src/exchanges/hyperliquid/rateLimit.ts | "You're being rate limited by Hyperliquid and we cannot load your data. Close unused perps windows, wait a few minutes, then try again." |

### Trading risk + liquidation warnings (perps-app)

| # | Kind | Source | Text |
|---|---|---|---|
| IE071 | error_heading | apps/perps-app/src/exchanges/hyperliquid/errors.ts:98 | "High Liquidation Risk" |
| IE072 | error_body | apps/perps-app/src/exchanges/hyperliquid/errors.ts:99 | "This order would put you at risk of immediate liquidation. Reduce size or leverage." |
| IE073 | error_heading | apps/perps-app/src/exchanges/hyperliquid/errors.ts:20 | "Insufficient Margin" |
| IE074 | error_body | apps/perps-app/src/exchanges/hyperliquid/errors.ts:22 | "Insufficient margin for this order. Reduce size or add funds." |
| IE075 | error_heading | apps/perps-app/src/exchanges/hyperliquid/errors.ts:91 | "Leverage Too High" |
| IE076 | error_body | apps/perps-app/src/exchanges/hyperliquid/errors.ts:93 | "Maximum leverage for this market is {n}x." |
| IE077 | error_heading | apps/perps-app/src/exchanges/hyperliquid/errors.ts:116 | "Trading Not Activated" |
| IE078 | error_body | apps/perps-app/src/exchanges/hyperliquid/errors.ts:118 | "Please activate trading to place orders. Click \"Activate Trading\" to continue." |
| IE079 | error_heading | apps/perps-app/src/exchanges/hyperliquid/errors.ts:128 | "Signature Rejected" |
| IE080 | error_body | apps/perps-app/src/exchanges/hyperliquid/errors.ts:129 | "Please approve the transaction in your wallet to continue." |
| IE081 | error_heading | apps/perps-app/src/exchanges/hyperliquid/errors.ts:133 | "Trading Session Expired" |
| IE082 | error_body | apps/perps-app/src/exchanges/hyperliquid/errors.ts:134 | "Your trading session has expired. Please re-activate trading." |
| IE083 | error_heading | apps/perps-app/src/exchanges/hyperliquid/errors.ts:178 | "Something's not right" |
| IE084 | risk_disclaimer | apps/perps-app/src/lib/disclaimers/index.ts | "You acknowledge that you have read and understood the above disclaimer and accept the risks of interacting with permissionless markets deployed by this deployer." |

### Insufficient-gas refusal (connect-app)

| # | Kind | Source | Text |
|---|---|---|---|
| IE085 | callout_body | apps/connect-app/src/pages/authorize/components/GasDetailsSection/InsufficientFundsWarning.tsx:56 | "Please top up your gas account to continue." |
| IE086 | callout_body | apps/connect-app/src/pages/authorize/components/GasDetailsSection/InsufficientFundsWarning.tsx:59 | "Not enough {token} for gas." |
| IE087 | callout_body | apps/mobile/src/i18n/locales/en.json transactionApproval.messages.insufficientGasNative | "Not enough {{symbol}} for gas. Swidge to top up." |

### Generic transaction-failure copy

| # | Kind | Source | Text |
|---|---|---|---|
| IE088 | toast_body | apps/mobile/src/i18n/locales/en.json transactionApproval.messages.transactionFailed | "Transaction failed" |
| IE089 | toast_body | apps/mobile/src/i18n/locales/en.json transactionApproval.messages.userRejectedRequest | "User rejected the request" |
| IE090 | toast_body | apps/mobile/src/i18n/locales/en.json transactionApproval.messages.websocketConfirmationTimeout | "Websocket confirmation timeout" |
| IE091 | toast_body | apps/mobile/src/i18n/locales/en.json transactionApproval.messages.defaultApprovalError | "Approval failed. Please try again." |
| IE092 | inline_alert | packages/connect-web-shared/src/services/evmRpcHandler.ts:238 | "Something went wrong, please try again" |
| IE093 | inline_alert | packages/connect-web-shared/src/services/evmRpcHandler.ts:413 | "{chain} is not supported" |
| IE094 | toast_title | apps/web-app/src/app/router.tsx | "Something went wrong" |
| IE095 | toast_body | apps/web-app/src/app/router.tsx | "An unexpected error occurred. Please try reloading the page." |
| IE096 | toast_title | apps/extension/src/entrypoints/ui/core/queryHookFactory.ts | "Session Expired" |
| IE097 | toast_body | apps/extension/src/entrypoints/ui/core/queryHookFactory.ts | "Please sign in again to continue" |

### Recovery / enable-recovery banner (extension)

| # | Kind | Source | Text |
|---|---|---|---|
| IE098 | banner_body | apps/extension/src/entrypoints/ui/components/Banners/CustomBanners/EnableRecoveryBanner.tsx:35 | "To ensure you can recovery your full portfolio from your Infinex wallet, enable recovery with a verified email address." |

### Funds-recovery deployment confirmation

| # | Kind | Source | Text |
|---|---|---|---|
| IE099 | screen_label | apps/web-app/src/pages/app/vault/chain-assets/_components/NetworkDeploymentRequired.tsx:90 | "Henlo, and furthermore deploy your Beravault" |

## Notes — sample-quality flags

These ship today but contain issues that the user should know about when comparing voice against Phantom:

- **IE098 (typo):** "To ensure you can **recovery** your full portfolio…" — should be "recover". The string ships from the extension recovery banner.
- **IE099 (bouffon tone in security flow):** "Henlo, and furthermore deploy your Beravault" — this is the actual shipped label on the Berachain vault deployment screen, which is a funds-at-risk surface (the callout immediately below it is IE045/IE046). The Bera-meme register here directly violates the dogfood handover's stated rule "if the user is trying to complete a financial/security/trading task, do not sell them the product." It is also off-character for the locked Mirodan/Laban placement (Stable + Flow + Penetrating + Spell-Vision). Captured verbatim because it is the shipped string.
- **IE004 (template fragility):** "This transaction was flagged as malicious by Blockaid. {description}." — the period after `{description}` will produce double-punctuation if `description` already ends in one. Minor.
- **IE033 (no default):** `EmergencyAnnouncementBanner` renders only operator-supplied text via a feature flag; there is no committed/shipped default emergency line in the repo. If the operator never sets the flag, no banner ever fires. Captured here because it is the load-bearing real-emergency surface — and it is, today, an empty shell.

## Notes — coverage gaps

What we expected to find but did not, for a wallet/exchange product of this size:

- **No "For your safety" register at all.** Phantom uses that exact phrase (or a variant) across roughly half of its scam/refusal surfaces. Infinex's malicious-dapp/transaction surfaces (IE001–IE015) borrow their *entire* voice from Blockaid — every malicious surface says "Blockaid flagged this," not "Infinex blocked this." There is no Infinex-authored security register.
- **No sanctioned-region / OFAC refusal copy.** Phantom shows a clear country-block screen; nothing analogous was found in the platform repo.
- **No anti-phishing pre-connect copy.** The malicious-dapp screen fires only after Blockaid scores the site. There is no proactive "double-check the URL" / "phishing is real" educational layer in the app itself.
- **No seed-phrase warning copy.** Phantom's "Phantom will never ask you for your recovery phrase" line is famous; Infinex has nothing equivalent shipped (passkey-first reduces the surface, but recovery and imported wallets still touch seed material — and the dogfood transcript DF-001 shows secrets are shipped *unmasked*, which is the opposite of the Phantom posture).
- **No social-engineering refusal.** No "Infinex Support will never DM you first" / "we will never ask for X" line.
- **No address-replacement / clipboard-swap warning.** Common attack, no shipped surface for it.
- **No high-value send confirmation.** No "you're about to send $X to a never-seen-before address — confirm" register; the dogfood transcript actually flags the *opposite* problem (you cannot send to *your own* address without an error, DF-003).
- **Refusal voice is borrowed, not authored.** Every refusal in the corpus reads as either a system-error toast ("Something went wrong"), a legal-defensive note ("Your funds remain safe"), or a Blockaid pass-through. There is no "security guy" persona — no one is speaking *for Infinex* when a user is about to lose money. Phantom has that persona; this corpus shows Infinex does not.

## Sample count: 99 units
