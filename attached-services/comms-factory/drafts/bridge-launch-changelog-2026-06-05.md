---
# internal: changelog № 63 (tracking only, not published)
title: Bank deposits come to Infinex
date: 2026-06-05
subtitle: >-
  Fund your Infinex account straight from your bank. Send US dollars by ACH or
  wire, and they arrive as USDC on Base.
published: false
pinned: false
category: changelogs
coverImage:
  src: <designer-cover-url>
  alt: Fund Infinex from your bank, arriving as USDC on Base
  height: 640
  width: 1280
typefullyUrl: <x-thread-typefully-url>
---

### Fund Infinex straight from your bank

{% cloud-image src="<designer-cover-url>" alt="Bank deposits come to Infinex, USD in and USDC on Base" height=640 width=1280 /%}

Your bank account and your Infinex wallet used to be two separate places, with an exchange in the middle. Not anymore. You can now send US dollars straight from your own bank account, and they arrive in your Infinex account as USDC on Base.

It's powered by Bridge.xyz, the stablecoin-infrastructure company Stripe acquired. Send dollars by ACH or wire the way you already move money; they convert to USDC automatically and land on-chain, one to one. Infinex doesn't add a fee.

---

### A permanent account in your name

When you choose Bank transfer in the deposit dialog, you're issued a US account number and routing number in your name. It's permanent and reusable: fund it once, fund it again next month, same details every time. Once your USDC is on Base, it's ready to move across Infinex.

{% toggle title="How to set it up" defaultOpen=false %}
Open Deposit, choose Bank transfer, and verify your identity once (handled by Bridge). It usually takes a few minutes, and up to one business day. Then pick USD bank transfer to see your deposit details and send.
{% /toggle %}

{% toggle title="What it doesn't do yet" defaultOpen=false %}
- US dollars to start.
- Deposits only. Sending dollars back out to a bank isn't part of this release.
- Your main Infinex account, not vaults or imported wallets.
- Available where Bridge can operate; some regions are restricted by its compliance rules.
{% /toggle %}

---

### Coming up
- **EUR bank transfers (SEPA)** in the weeks ahead.
- **Spot on Hyperliquid**, so the dollars you bring in have somewhere new to go.
- More currencies and rails to follow.

For more, see the [Infinex Roadmap](https://infinex.xyz/roadmap).
