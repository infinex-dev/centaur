# Infinex utility corpus

Harvested 2026-05-18 from existing audits + a live grep of the platform repo.

## Sources

- `research/infinex-dogfood-pipeline.md` — shipped utility strings (S01-S13).
- `research/infinex-dogfood-triage.md` — evidence quotes from the dogfood transcript.
- `research/infinex-app-dogfood-handover.md` — long-form audit notes.
- `~/Sites/infinex-xyz/platform/apps/mobile/src/i18n/locales/en.json` — full mobile i18n.
- `~/Sites/infinex-xyz/platform/apps/web-app/src/...` — web-app callouts, banners, empty states.
- `~/Sites/infinex-xyz/platform/apps/recovery-app/src/...` and `apps/wallet-recovery-app/src/...` — recovery flows.
- `~/Sites/infinex-xyz/platform/packages/web-shared/src/components/...` — shared empty states.
- `~/Sites/infinex-xyz/platform/packages/connect-web-shared/src/services/` — connect inline alerts.

Grep patterns: `<Callout`, `<EmptyState`, `<Heading>`, `<CalloutBanner`, `placeholder=`, `ToastQueue.add('error'`, `showAlert?.(`, `title:`, `description:`.

ID range: IU001-IU099.

## Copy units

### Login / signup utility (mobile)

| # | Kind | Source | Text |
|---|---|---|---|
| IU001 | screen_title | apps/mobile/src/i18n/locales/en.json login.title | "Login" |
| IU002 | placeholder | apps/mobile/src/i18n/locales/en.json login.usernamePlaceholder | "Enter username" |
| IU003 | screen_title | apps/mobile/src/i18n/locales/en.json createAccount.title | "Choose a username" |
| IU004 | placeholder | apps/mobile/src/i18n/locales/en.json createAccount.usernamePlaceholder | "Your username" |
| IU005 | button | apps/mobile/src/i18n/locales/en.json createAccount.button | "Create an account" |
| IU006 | inflight | apps/mobile/src/i18n/locales/en.json createAccount.creating | "Creating…" |
| IU007 | legal_inline | apps/mobile/src/i18n/locales/en.json createAccount.legalText | "By continuing, you agree with Infinex" |
| IU008 | legal_link | apps/mobile/src/i18n/locales/en.json createAccount.termsOfUse | "Terms of Use" |
| IU009 | legal_link | apps/mobile/src/i18n/locales/en.json createAccount.privacyPolicy | "Privacy Policy." |
| IU010 | screen_title | apps/mobile/src/i18n/locales/en.json useAnotherAccount.title | "Use another account" |
| IU011 | screen_title | apps/mobile/src/i18n/locales/en.json loginWithUsername.title | "Log in with username" |
| IU012 | help_blurb | apps/mobile/src/i18n/locales/en.json loginWithUsername.description | "Some early Infinex users may have signed up with a passkey that requires their username to log in. If you're having trouble logging in, enter your Infinex username and try again." |

### Welcome screen (utility framing)

| # | Kind | Source | Text |
|---|---|---|---|
| IU013 | button | apps/mobile/src/i18n/locales/en.json welcome.loginButton | "Log in" |
| IU014 | divider | apps/mobile/src/i18n/locales/en.json welcome.or | "OR" |
| IU015 | label | apps/mobile/src/i18n/locales/en.json welcome.welcomeBack | "Welcome back" |
| IU016 | button | apps/mobile/src/i18n/locales/en.json welcome.useAnotherAccount | "Use another account" |
| IU017 | button | apps/mobile/src/i18n/locales/en.json welcome.forgetAllUsers | "Forget all users" |
| IU018 | button | apps/mobile/src/i18n/locales/en.json welcome.importWallet | "Import Wallet" |

### Navigation

| # | Kind | Source | Text |
|---|---|---|---|
| IU019 | nav_tab | apps/mobile/src/i18n/locales/en.json navigation.tabs.portfolio | "Portfolio" |
| IU020 | nav_tab | apps/mobile/src/i18n/locales/en.json navigation.tabs.perps | "Perps" |
| IU021 | nav_tab | apps/mobile/src/i18n/locales/en.json navigation.tabs.swidge | "Swidge" |
| IU022 | nav_tab | apps/mobile/src/i18n/locales/en.json navigation.tabs.labs | "Labs" |
| IU023 | nav_tab | apps/mobile/src/i18n/locales/en.json navigation.tabs.home | "Home" |
| IU024 | nav_tab | apps/mobile/src/i18n/locales/en.json navigation.tabs.searchDapps | "Search Dapps" |
| IU025 | nav_tab | apps/mobile/src/i18n/locales/en.json navigation.tabs.activity | "Activity" |
| IU026 | nav_tab | apps/mobile/src/i18n/locales/en.json navigation.tabs.earn | "Earn" |
| IU027 | nav_tab | apps/mobile/src/i18n/locales/en.json navigation.tabs.airdrops | "Airdrops" |

### Wallet import flow (shipped, dogfood-flagged casual register)

| # | Kind | Source | Text |
|---|---|---|---|
| IU028 | inflight | research/infinex-dogfood-pipeline.md S04 | "Hang tight while we check." |
| IU029 | success | research/infinex-dogfood-pipeline.md S05 | "Nice one!" |
| IU030 | rename_label | research/infinex-dogfood-triage.md DF-062 | "Name your seed phrase." |
| IU031 | rename_help | research/infinex-dogfood-triage.md DF-062 | "Give your seed phrase a name…" |
| IU032 | rename_label | research/infinex-dogfood-triage.md DF-062 | "Name your imported wallet." |
| IU033 | rename_help | research/infinex-dogfood-triage.md DF-062 | "Give your imported wallet a name to use it." |
| IU034 | trust_blurb | research/infinex-dogfood-triage.md DF-067 | "Non-custodial, cross-chain, easy recovery" |

### Transaction approval (connect-app + mobile sheet)

| # | Kind | Source | Text |
|---|---|---|---|
| IU035 | screen_title | apps/mobile/src/i18n/locales/en.json transactionApproval.title | "Connection request" |
| IU036 | section_label | apps/mobile/src/i18n/locales/en.json transactionApproval.labels.signingRequest | "Signing Request" |
| IU037 | section_label | apps/mobile/src/i18n/locales/en.json transactionApproval.labels.transactionRequest | "Transaction Request" |
| IU038 | label | apps/mobile/src/i18n/locales/en.json transactionApproval.labels.unknownDapp | "Unknown Dapp" |
| IU039 | label | apps/mobile/src/i18n/locales/en.json transactionApproval.labels.verifiedSite | "{{hostname}} is a verified site" |
| IU040 | label | apps/mobile/src/i18n/locales/en.json transactionApproval.labels.infinexWallet | "Infinex wallet" |
| IU041 | label | apps/mobile/src/i18n/locales/en.json transactionApproval.labels.networkCost | "Network Cost" |
| IU042 | label | apps/mobile/src/i18n/locales/en.json transactionApproval.labels.unknownAsset | "Unknown asset" |
| IU043 | section_label | apps/mobile/src/i18n/locales/en.json transactionApproval.terms.estimatedWalletChanges | "Estimated wallet changes" |
| IU044 | label | apps/mobile/src/i18n/locales/en.json transactionApproval.terms.programsAndAccounts | "Programs & Accounts" |
| IU045 | inline_label | apps/mobile/src/i18n/locales/en.json transactionApproval.sponsorshipModes.account | "Gas account" |
| IU046 | inline_label | apps/mobile/src/i18n/locales/en.json transactionApproval.sponsorshipModes.sponsored | "Sponsored" |
| IU047 | button | apps/mobile/src/i18n/locales/en.json transactionApproval.buttons.approve | "Approve" |
| IU048 | inflight | apps/mobile/src/i18n/locales/en.json transactionApproval.buttons.approving | "Approving…" |
| IU049 | button | apps/mobile/src/i18n/locales/en.json transactionApproval.buttons.reject | "Reject" |
| IU050 | button | apps/mobile/src/i18n/locales/en.json transactionApproval.buttons.proceed | "Proceed" |
| IU051 | button | apps/mobile/src/i18n/locales/en.json transactionApproval.buttons.sign | "Sign" |
| IU052 | button | apps/mobile/src/i18n/locales/en.json transactionApproval.buttons.topUp | "Top up" |
| IU053 | button | apps/mobile/src/i18n/locales/en.json transactionApproval.buttons.swidge | "Swidge" |
| IU054 | inflight | apps/mobile/src/i18n/locales/en.json transactionApproval.messages.loadingSigningRequestDetails | "Loading signing request details…" |

### Inline alerts (connect-web-shared service banners)

| # | Kind | Source | Text |
|---|---|---|---|
| IU055 | toast_success | packages/connect-web-shared/src/services/evmRpcHandler.ts:226 | "Message signed." |
| IU056 | banner_inflight | packages/connect-web-shared/src/services/evmRpcHandler.ts:327 | "Sending transaction..." |
| IU057 | banner_success | packages/connect-web-shared/src/services/evmRpcHandler.ts:363 | "Transaction broadcasted." |
| IU058 | toast_success | packages/connect-web-shared/src/services/evmRpcHandler.ts:429 | "Switched to {chainName}" |

### Manage-asset / portfolio utility (mobile)

| # | Kind | Source | Text |
|---|---|---|---|
| IU059 | screen_title | apps/mobile/src/i18n/locales/en.json manageAssets.title | "Manage asset visibility" |
| IU060 | placeholder | apps/mobile/src/i18n/locales/en.json manageAssets.searchPlaceholder | "Search asset name or ticker" |
| IU061 | empty_search | apps/mobile/src/i18n/locales/en.json manageAssets.emptySearch | "No assets found. Try a new search." |
| IU062 | empty_assets | apps/mobile/src/i18n/locales/en.json manageAssets.emptyAssets | "You don't have any assets yet" |

### Feedback flow

| # | Kind | Source | Text |
|---|---|---|---|
| IU063 | screen_title | apps/mobile/src/i18n/locales/en.json feedback.title | "Share feedback" |
| IU064 | placeholder | apps/mobile/src/i18n/locales/en.json feedback.messagePlaceholder | "Tell us what you think…" |
| IU065 | help_hint | apps/mobile/src/i18n/locales/en.json feedback.fileSizeHint | "Images and videos, max 25MB each" |
| IU066 | inflight | apps/mobile/src/i18n/locales/en.json feedback.submitting | "Submitting…" |
| IU067 | success_title | apps/mobile/src/i18n/locales/en.json feedback.successTitle | "Thanks for your feedback!" |
| IU068 | success_blurb | apps/mobile/src/i18n/locales/en.json feedback.successMessage | "We appreciate you taking the time to help us improve." |
| IU069 | inflight | apps/mobile/src/i18n/locales/en.json feedback.uploadProgress | "Uploading files ({{current}}/{{total}})…" |
| IU070 | button | apps/mobile/src/i18n/locales/en.json feedback.shareButton | "Share feedback" |

### Empty states (web-app + web-shared)

| # | Kind | Source | Text |
|---|---|---|---|
| IU071 | empty_heading | packages/web-shared/src/components/swidge/.../DestinationAddressContent.tsx | "No recents yet" |
| IU072 | empty_blurb | packages/web-shared/src/components/swidge/.../DestinationAddressContent.tsx | "Recent addresses you send to will appear here." |
| IU073 | empty_heading | packages/web-shared/src/components/send/stronger/components/SendSearchResultList.tsx | "No contacts found" |
| IU074 | empty_blurb | packages/web-shared/src/components/send/stronger/components/SendSearchResultList.tsx | "Try searching by full name or enter a valid wallet address" |
| IU075 | empty_blurb | apps/web-app/src/pages/app/sale/_components/cards/EntitiesSection.tsx | "You don't have any entities yet." |
| IU076 | empty_blurb | apps/wallet-recovery-app/src/app/routes/recovery/_components/WalletsList.tsx | "No wallets found." |

### Deposit utility callouts

| # | Kind | Source | Text |
|---|---|---|---|
| IU077 | deposit_help | research/infinex-dogfood-pipeline.md S11 | "Only native BTC is supported. Other Bitcoin assets won't be withdrawable until support is added." |
| IU078 | help_label | apps/web-app/src/pages/app/vault/chain-assets/_components/NoFundsState.tsx | "Deposit to get started" |
| IU079 | help_blurb | apps/web-app/src/pages/app/vault/chain-assets/_components/NoFundsState.tsx | "Use this address to deposit supported tokens and collectibles on {chainName}" |
| IU080 | help_blurb | apps/web-app/src/pages/app/vault/chain-assets/_components/NoFundsState.tsx | "Allow a few minutes for processing" |
| IU081 | callout_blurb | apps/web-app/src/components/features/deposit/components/EvmAddressWarning.tsx | "Double-check your deposit address as they are not all the same across EVM networks." |
| IU082 | callout_blurb | apps/web-app/src/components/features/deposit/routes/ListRoute/ListRouteWalletsV2.tsx | "Currently, only the below networks are supported for imported wallets." |
| IU083 | a11y_label | apps/web-app/src/components/features/deposit/routes/HyperliquidSelectionRoute.tsx | "Not supported yet." |
| IU084 | helper_blurb | apps/web-app/src/components/features/deposit/routes/HyperliquidSelectionRoute.tsx | "Use your Infinex Wallet instead." |

### Settings / manage wallets callouts (web)

| # | Kind | Source | Text |
|---|---|---|---|
| IU085 | callout_blurb | apps/web-app/src/pages/app/settings/security/_components/TwoFactorAuthentication.tsx | "To add two-factor authentication, add an email first." |
| IU086 | callout_blurb | apps/web-app/src/components/features/funds-recovery/FundsRecoveryWalletAddresses.tsx | "To add recovery addresses, add an authentication method first." |
| IU087 | callout_blurb | apps/web-app/src/components/features/funds-recovery/ConfirmAddressDialog.tsx | "Once added this address cannot be changed." |
| IU088 | callout_blurb | apps/web-app/src/pages/app/settings/manage-wallets/multi-sig-wallets/[multiSigWalletId]/index.tsx | "Multi-sig wallets require multiple approvals to sign transactions. Some features aren't available yet — more support is coming." |
| IU089 | callout_blurb | apps/web-app/src/pages/app/settings/manage-wallets/external-signing-devices/[deviceId]/index.tsx | "Your hardware wallet stays in control of signing. Some features, including Swidge, aren't available yet — more support is coming." |
| IU090 | callout_blurb | apps/web-app/src/pages/app/settings/preferences/patron-balances/index.tsx | "You don't currently hold any locked Patron NFTs. These settings will become available when you acquire this asset." |
| IU091 | callout_blurb | apps/web-app/src/pages/app/settings/funds-recovery/_components/FundsRecoveryPrompt.tsx | "Please enter a Funds Recovery Address for {type} in Recovery addresses below." |
| IU092 | settings_subtitle | apps/web-app/src/pages/app/settings/funds-recovery/_components/FundsRecoveryAddresses.tsx | "This is the address where your funds will be returned if you initiate the funds recovery process." |
| IU093 | settings_subtitle | apps/web-app/src/pages/app/settings/funds-recovery/_components/FundsRecoveryAuthentication.tsx | "When connected, this account or wallet will be able to initiate the funds recovery process." |

### Crates / vouchers / redemption utility

| # | Kind | Source | Text |
|---|---|---|---|
| IU094 | callout_blurb | apps/web-app/src/pages/app/crates/redeem/components/RedemptionReview.tsx | "Your redeemed INX will be redeemed to the wallet the payment is made from." |
| IU095 | callout_blurb | apps/web-app/src/pages/app/crates/redeem/components/RedemptionDisableReasonCallout.tsx | "Please wait for it to complete before redeeming more." |

### Recovery / withdraw

| # | Kind | Source | Text |
|---|---|---|---|
| IU096 | preflight_help | apps/wallet-recovery-app/src/app/routes/recovery/_components/WalletsList.tsx | "Once recovery has been started you'll no longer be able to access your Infinex account." |
| IU097 | callout_blurb | apps/recovery-app/src/pages/recovery/withdraw-wizard/_components/WithdrawWizard.tsx | "Your account is on an old version. Your funds will be recovered on Base." |
| IU098 | screen_title | apps/wallet-recovery-app/src/app/routes/index.tsx | "Infinex Wallet Recovery" |

### Earn

| # | Kind | Source | Text |
|---|---|---|---|
| IU099 | section_label | research/infinex-dogfood-pipeline.md S13 | "Liquid staking" |

## Notes

- Dogfood-flagged casual register lives in IU028 ("Hang tight while we check.") and IU029 ("Nice one!") — kept verbatim because that is the shipped state. The triage rows DF-063 and DF-081 already mark them for rewrite.
- "Liquid staking" (IU099) is the shipped Earn surface label; the dogfood team flagged this as the wrong noun (the assets are yield-bearing, not liquid-stakes) but the string still ships.
- The mobile i18n bundle uses "Swidge" as the brand-internal name for swap/bridge across all surfaces (IU021, IU053). It surfaces user-side, not internal.
- "Patron Early Access" / patron-gating language (IU067, IU068) is captured here even though it is gating copy — the dogfood team flagged this as a known confusing surface (decision D-14 in triage).

## Sample count: 99 units
