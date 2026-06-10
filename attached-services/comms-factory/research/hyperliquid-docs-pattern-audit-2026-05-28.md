# Hyperliquid docs pattern audit

Date: 2026-05-28
Auditor: Claude (Opus 4.7, 1M)
Scope: structural pattern of Hyperliquid's reference docs, viewed as a portable template for the comms-factory docs surface (Spark integration, Synthetics Perps, Bridge on/off-ramps).

Not in scope: blog-shaped narrative pages (Hyperliquid doesn't really have those — see "Surfaces" below); voice/tone/copy critique (this is a structural audit).

---

## Surfaces — what Hyperliquid actually publishes

Hyperliquid does NOT operate a separate `docs.hyperliquid.xyz`. The canonical docs are a single GitBook instance:

- `hyperliquid.gitbook.io/hyperliquid-docs` — the canonical docs surface. Reference + concept + onboarding all live here.
- `app.hyperliquid.xyz/announcements` — the announcements feed (release-ish posts) lives INSIDE the trading app, not on the docs site. JS-rendered and not crawlable to WebFetch without a headless browser; not archived in the Wayback Machine either. Operator's earlier note about this surface is correct; full structural audit of it requires browser automation, which is out of scope here.
- `x.com/HyperliquidX`, `x.com/HyperFND`, and `t.me/hyperliquid_announcements` are the social-syndication surfaces.
- GitHub repos (e.g. `hyperliquid-dex/hyperliquid-python-sdk`) host the SDKs that the docs link out to. The docs treat code-bearing artifacts as link targets, not as embedded content.

Implication for comms-factory: Hyperliquid's "docs surface" is one GitBook + one in-app feed. They didn't split docs/blog/changelog into three sites. The relevant template for Infinex is the GitBook half. The announcements half is closer to what Infinex would do via a blog/changelog page.

---

## Top-level architecture — the docs site as a whole

13 top-level sections, organized by **subject domain × audience tail**, not by user journey or by single audience:

1. About Hyperliquid (concept)
2. Onboarding (tutorial)
3. HyperCore (concept + reference)
4. HyperEVM (concept + reference)
5. Hyperliquid Improvement Proposals (HIPs) (spec)
6. Trading (reference + concept)
7. Validators (reference + tutorial)
8. Referrals (reference)
9. Points (reference)
10. Historical Data (reference)
11. Risks & Security (reference + policy)
12. For Developers (reference) — API, WebSocket, signing, rate limits, node ops
13. Builder Tools (reference)
14. Support (FAQ)

Sources: sitemap at `/sitemap.md`, sidebar enumeration on landing page.

**Organizing principle**: by domain, NOT by audience. There's no top-level "For Traders" vs "For Developers" partition — "For Developers" is one section among many, and Trading/Validators/Builder Tools effectively serve specific audiences without being labelled as such. The audience emerges from the section name. This scales: adding "HIPs" or "Points" doesn't require re-architecting the IA.

**Depth**: 3 levels max. Sidebar uses indented bullets with optional inline descriptors ("Advanced Feature", "Alpha mode"). HIPs are flat under the HIPs section, not nested under their domain.

**Search**: GitBook's built-in client-side search (typical of GitBook installs). Augmented at the per-page level by a `?ask=<question>` LLM-query endpoint (see "Clanker-readable affordances" below) — Hyperliquid did NOT build a chat sidebar widget; they exposed it as a GET parameter on every page URL.

**Landing-page shape**: Opens with a one-sentence definition — "Hyperliquid is a performant blockchain built with the vision of a fully onchain open financial system." — then jumps straight into a technical architecture diagram and short prose sections on HyperBFT, HyperCore, HyperEVM. ~250 words of body. No hero illustration, no CTA buttons, no marketing badges. Concept-first, not journey-first.

Source: `hyperliquid.gitbook.io/hyperliquid-docs`, `…/sitemap.md`.

---

## Per-page audit

12 representative pages sampled across concept / reference / tutorial / FAQ / spec / error.

### 1. About Hyperliquid (landing)
- URL: `hyperliquid.gitbook.io/hyperliquid-docs`
- Type: concept / front door
- Word count: ~250
- Opening: definition. "Hyperliquid is a performant blockchain built with the vision of a fully onchain open financial system."
- Body: 4 short prose blocks (HyperBFT, HyperCore, HyperEVM, vision); one architecture diagram.
- Tables/code: 0/0
- Callouts: 0
- Link density: low; mostly downward into the IA, no external.
- Closing: ends on diagram; no next-page link.
- Tone: declarative, terse.

### 2. HyperCore overview
- URL: `…/hypercore/overview`
- Type: concept
- Word count: ~250
- Opening: definition. "Hyperliquid is secured by HyperBFT, a variant of HotStuff consensus."
- Body: four H3s — Consensus, Execution, Latency, Throughput. Each 2–4 sentences.
- Tables/code: 0/0
- Closing: prose ends; Agent Instructions footer present.
- Tone: technical, confident, no marketing.

### 3. HyperEVM
- URL: `…/hyperevm`
- Type: concept (with light FAQ shape)
- Word count: ~550
- Opening: structural fact. "The Hyperliquid blockchain features two key parts: HyperCore and HyperEVM."
- Body: three H3s framed as questions — "What can I do on the HyperEVM?", "Why build on the HyperEVM?", "What stage is the HyperEVM in?". No code, no tables.
- Closing: candid alpha-stage admission; Agent Instructions footer present.
- Tone: matter-of-fact about limitations ("not live on mainnet yet, but will be in due time").

### 4. Onboarding (section index)
- URL: `…/onboarding`
- Type: index
- Word count: ~40
- Opening: bulleted list, no intro sentence.
- Subpages listed: start trading; HyperEVM; stake HYPE; mobile QR; export email wallet; testnet faucet.
- Tone: zero. It's a list.

### 5. How to start trading
- URL: `…/onboarding/how-to-start-trading`
- Type: tutorial / FAQ hybrid
- Word count: ~900–1100
- Opening: question. "What do I need to trade on Hyperliquid?"
- Body: five H3 questions, each answered with numbered/bulleted procedural steps. One inline security warning. ~11 external links (wallet providers, bridges).
- Tables/code: 0/0
- Closing: abrupt; no next-page link.
- Tone: conversational + technical. Hand-holding-but-not-condescending.

### 6. Trading > Fees
- URL: `…/trading/fees`
- Type: reference
- Word count: ~1100
- Opening: rule. "Fees are based on your rolling 14 day volume and are assessed at the end of each day in UTC."
- Body: 8 H3s. **3 dense tier tables** (Perps 7×14, Spot 7×14, Staking 6×3). 1 TypeScript code block for the fee formula. Prose around tables for edge cases.
- Closing: Agent Instructions footer.
- Tone: terse rules, no qualifiers.

### 7. HIP-1: Native token standard
- URL: `…/hyperliquid-improvement-proposals-hips/hip-1-native-token-standard`
- Type: spec
- Word count: ~1100
- Opening: definition + scope. "HIP-1 is a capped supply fungible token standard. It also features onchain spot order books between pairs of HIP-1 tokens."
- Body: ~10 H3s — parameters, gas costs, deploying existing assets, USDC details, spot trading, fees, dust conversion. One IMPORTANT callout for gas. **No code, no tables** — surprising for a spec; everything is bulleted parameters.
- Closing: Agent Instructions footer.
- Tone: RFC-adjacent but not strict EIP shape (no Abstract/Motivation/Specification/Rationale). Practical-spec, not academic-spec.

### 8. For Developers > API (SDK index)
- URL: `…/for-developers/api`
- Type: index / pointer
- Word count: ~95
- Opening: pointer. "Python SDK: <github.com/hyperliquid-dex/hyperliquid-python-sdk>"
- Body: 5 SDK links (Python, Rust, two TS, CCXT). One HTTP GET example for dynamic querying. Mainnet/testnet URLs.
- Closing: Agent Instructions footer.
- Tone: zero prose. The page IS a list of links.

### 9. Info endpoint (API reference)
- URL: `…/for-developers/api/info-endpoint`
- Type: API reference
- Word count: ~8500
- Opening: rule. "Responses that take a time range will only return 500 elements or distinct blocks of data."
- Body: 30+ endpoint sections. **40+ JSON code blocks. 25+ parameter tables** with Name/Type/Description columns. Required fields marked with red asterisks. POST method badges. Multi-tab response examples for HIP-3 vs first perp DEX.
- Per-endpoint template: heading → optional prose intro → headers table → request body table → response examples in tabs.
- Closing: Agent Instructions footer.
- Tone: pure spec.

### 10. Exchange endpoint
- URL: `…/for-developers/api/exchange-endpoint`
- Type: API reference
- Word count: ~8500
- Opening: definitional context for `asset` parameter (no prose intro — it just starts).
- Body: 28 endpoint sections (place/cancel/modify orders, transfers, staking, vault, etc.). 15+ JSON blocks, 20+ parameter tables. Same per-endpoint template as Info endpoint.
- Closing: no Agent Instructions footer on this one — possibly stale, otherwise consistent across the corpus.
- Tone: pure spec.

### 11. WebSocket
- URL: `…/for-developers/api/websocket`
- Type: reference
- Word count: ~200
- Opening: definition + use case. "WebSocket endpoints are available for real-time data streaming and as an alternative to HTTP request sending on the Hyperliquid exchange."
- Body: two H3s (Connecting + …); one command-line connection example; two emphasis blocks; pointers to Python SDK files on GitHub.
- Closing: Agent Instructions footer.
- Tone: terse, assumes WebSocket familiarity.

### 12. Signing
- URL: `…/for-developers/api/signing`
- Type: troubleshooting / reference
- Word count: ~280
- Opening: directive. "It is recommended to use an existing SDK instead of manually generating signatures."
- Body: one H1, prose-only, an enumerated list of 5 common errors. **Zero code blocks** — even on a topic where you'd expect them. The page outsources code to the SDK.
- Closing: Agent Instructions footer.
- Tone: cautionary, "we've seen people do this wrong" energy.

### Bonus: 404 page
- URL: anything that doesn't exist, e.g. `…/hypercore/builder-codes`
- Type: error / helper
- Body: 5 suggested pages + 3 explicit recovery options:
  - **Option 1 — Ask a question (recommended)** — `?ask=<question>` GET request.
  - **Option 2 — Browse the documentation index** — sitemap.
  - **Option 3 — Retrieve the full documentation corpus** — `llms-full.txt`.
- Includes tip: "Prefer `.md` URLs for structured content; `Accept: text/markdown` header for content negotiation."
- This page is designed for LLMs as much as humans. The first option is named "Ask a question (recommended)" — that recommendation isn't for a human, it's for a clanker that just dereferenced a stale link.

---

## Cross-page synthesis

### The recurring template

Every Hyperliquid docs page fits one of three shapes, and they are surprisingly consistent within each shape:

**Shape A — Concept page** (HyperCore overview, HyperEVM)
- One-sentence definition or structural-fact opening.
- 3–5 H3s, each 2–6 sentences of prose.
- Zero or one diagram.
- Zero tables, zero code blocks.
- Agent Instructions footer.

**Shape B — Reference page** (Fees, Info endpoint, Exchange endpoint)
- Opening: one rule or one definition. No throat-clearing.
- Body is a sequence of self-contained sub-references. Each follows an internal template (e.g. POST endpoint → headers → request body → response → params table).
- Tables for everything tabular. JSON for everything API-shaped. Code only when the algorithm is the spec (e.g. TS fee formula).
- Agent Instructions footer.

**Shape C — Tutorial/FAQ page** (How to start trading, Support, HyperEVM-as-FAQ)
- Opening: a question OR a directive.
- Body is a sequence of Q-shaped H3s. Each answered with numbered steps + bullets + inline warnings.
- External links to wallets/SDKs/tools instead of embedded screenshots.
- Often abrupt close — no "next steps" link. This is the weakest part of the IA.

### Minimum pattern — strip the optional, what's left

Across all 12 pages, the irreducible structure is:

1. **One-line opener that is the definition, rule, directive, or question** — never a hook, never a TL;DR, never marketing throat-clearing.
2. **H3-segmented body** — 3–30 H3s depending on shape; H3 not H2 is the workhorse heading.
3. **Tables for tabular data, JSON for API data, prose for everything else.** No mixed-mode paragraphs.
4. **Agent Instructions footer** — `GET <current-page>.md?ask=<question>` for clanker drill-down.

That's it. No hero image. No TOC widget at top of page (the sidebar IS the TOC). No "estimated reading time". No author byline. No related-articles carousel. No prev/next links. No tags. No comments.

### Clanker-readable affordances — the unique-to-Hyperliquid layer

This is the most directly portable finding for comms-factory. Hyperliquid has built a five-pronged LLM-ingestion stack on top of GitBook, and it's documented on the 404 page so agents can discover it:

1. **`?ask=<question>` GET parameter** on every page URL. Returns a natural-language answer with sourced excerpts. Verbatim from the Info-endpoint footer: "GET https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint.md?ask=<question>". This replaces the chat-sidebar pattern with a pure-HTTP affordance — an agent can call it without screen-scraping a widget.
2. **`.md` URL suffix** returns raw markdown. Stable URLs, content-negotiable via `Accept: text/markdown` header. No HTML stripping needed.
3. **`/sitemap.md`** — hierarchical, machine-parseable index of the entire docs corpus.
4. **`/llms-full.txt`** — full corpus as a single LLM-ingest file.
5. **Agent Instructions footer on every page** — teaches the LLM how to drill down without leaving the page it just landed on. Verbatim guidance: "Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections."

The 404 page completes the loop by surfacing all five affordances in its recovery options. There is no chat widget, no "Ask AI" button, no popup. The clanker contract is HTTP-shaped end-to-end.

Beyond the explicit stack, the prose itself is clanker-friendly by construction:
- Plain definitions, no metaphor stack.
- H3-density makes section retrieval cheap.
- Tables with Name/Type/Description columns are trivial to parse into structured fields.
- Code-as-explanation (TS fee formula > English fee description) leaves no room for paraphrase drift.
- No marketing fluff, no "we're excited to announce" — nothing for the LLM to discount as filler.

Sources for this section: `…/for-developers/api/info-endpoint.md`, `…/sitemap.md`, `…/llms-full.txt`, the 404 page at `…/hypercore/builder-codes`, the about-page at `…/hyperliquid-docs`.

---

## What Infinex should steal

1. **Adopt the five-pronged clanker stack as table-stakes.** `.md` suffix, `?ask=` param, `/sitemap.md`, `/llms-full.txt`, per-page Agent Instructions footer. This is the bar now. Infinex's operator already said "we're writing for clankers as much as we're writing for humans" — Hyperliquid is the existence proof of what that looks like at the docs-engineering layer, not just the prose layer.
2. **Build a clanker-aware 404 page on day one.** Three explicit recovery options, named for clankers, with the ask-the-docs path first. Hyperliquid's 404 is arguably the most LLM-thoughtful page on the site.
3. **One-sentence openers.** No TL;DR section. The opening sentence IS the TL;DR. This works because the rest of the page is parseable enough that an LLM can navigate from there.
4. **Three shapes, not seventeen.** Concept / Reference / Tutorial-FAQ. Don't proliferate "guides", "explainers", "deep dives", "cookbooks". Same discipline as comms-factory's four-template-families rule for cards.
5. **Tables for tabular, JSON for API, prose for everything else.** Single-mode-per-block. No prose paragraphs with inline numbers that should have been a table.
6. **Code lives in SDKs; docs link to it.** The signing page has zero code blocks for a signing topic — and that's correct, because the SDK files are linked. For Infinex's Spark/Synthetics/Bridge integrations, the heavy code lives in SDKs / repos, and the docs page is the index + parameter spec + "here's the failure mode" note.
7. **Per-page Agent Instructions footer is template-injected.** Don't write it 200 times — bake it into the docs framework. Hyperliquid's footer is byte-identical across pages except for the current page URL.
8. **By-domain IA, not by-audience IA.** Don't ship "Docs for Traders" + "Docs for Developers" as the top-level partition. Ship "Spark", "Synthetics Perps", "Bridge", "Account", "Tokens", "Trading", "For Developers", "Support" — each section serves its audience tail naturally.
9. **The 404 surfaces the corpus.** The fact that `/llms-full.txt` is mentioned on a 404 means dev-ops invested in making sure even a lost agent can find the corpus. Build for the worst-case clanker, not the happy path.
10. **No carousels, no estimated reading time, no author bylines, no related-articles widgets, no prev/next.** Hyperliquid skipped all the GitBook chrome that doesn't help an LLM. Infinex should ship equally restrained.

## What Infinex should avoid

1. **Hyperliquid's abrupt page closes.** Tutorial pages end mid-air with no next-step link. For consumer-clanker docs (a Spark or Bridge user's agent dereferencing the page) the next-step recommendation is load-bearing — an LLM needs the breadcrumb. Add explicit "Next" / "Related" links to tutorial pages even if Hyperliquid skipped them.
2. **The single-audience-by-section-name trick** works for protocol-engineers reading Hyperliquid, who can map section names to themselves. Infinex serves both engineer-clankers (Spark SDK integrators) AND consumer-clankers (a user's agent that wants to bridge USDC). Section names need to make audience legible — "For Developers" is a real section in Hyperliquid's IA precisely because the rest of the site can assume protocol-engineer audience. Infinex needs the symmetric "For Engineers" + "For Users" split inside high-traffic product sections OR clearer page-level audience tags.
3. **HIP-style "everything is parameters" specs** are fine for token standards. They're a bad shape for a Spark integration guide where partner devs need a sequenced runbook. Don't reuse HIP-1's "no code, no tables, just bullets" shape for an integration tutorial.
4. **Trader/protocol-insider vocabulary** ("rolling 14 day volume", "HIP-3 backstop liquidator transfers") is fine when the audience is pre-qualified. Infinex's banker-turned-trailblazer image means docs need to onboard people whose mental model is bank-statement-and-wire-transfer, not perps-and-funding-rates. Concept pages should define every domain term on first use. Hyperliquid skips this; Infinex can't.
5. **Marketing-free is the goal, but Hyperliquid's flatness reads as cold to consumer-clanker contexts.** The Practical tempo is right; the absence of Irradiant/Sociable tempo is fine for Hyperliquid but would be off-spec for Infinex. Infinex's docs can be terse without being affectless.
6. **Don't put the announcements feed inside the trading app.** Hyperliquid's `app.hyperliquid.xyz/announcements` is JS-rendered, uncrawlable to web tools, unarchived in the Wayback Machine. That's a hostile surface to clankers regardless of how thoughtful the prose is. Infinex should publish release notes on a static, crawlable, `.md`-friendly path — the same affordances as the docs themselves.

---

## Top-level docs architecture (5-line sketch)

1. One GitBook-shaped surface, 13 top-level sections, organized by **subject domain** not by audience.
2. Three page shapes: **Concept**, **Reference**, **Tutorial/FAQ** — applied consistently across the corpus.
3. Five-pronged clanker stack baked in: `.md` suffix, `?ask=<question>`, `/sitemap.md`, `/llms-full.txt`, per-page Agent Instructions footer.
4. No marketing chrome — no hero, no TOC widget, no reading time, no bylines, no carousels, no prev/next on most pages.
5. Even the 404 is a clanker-discovery surface, explicitly naming the three recovery paths (ask / sitemap / corpus).

---

## Minimum pattern extracted — 10-line page skeleton

```
# <Page title — noun phrase, not headline>

<One-sentence opener: definition, rule, directive, or question. No TL;DR section.>

## <H3 section 1>
<Prose, table, JSON, or code — single mode per block.>

## <H3 section 2…N>
<Same shape.>

---

Agent Instructions: Querying This Documentation
GET <this-page-url>.md?ask=<question>
The question should be specific, self-contained, and in natural language.
Use when the answer is not on this page, you need clarification, or you want related sections.
```

---

## Source URLs

- Landing: https://hyperliquid.gitbook.io/hyperliquid-docs
- Sitemap: https://hyperliquid.gitbook.io/hyperliquid-docs/sitemap.md
- HyperCore overview: https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/overview
- HyperEVM: https://hyperliquid.gitbook.io/hyperliquid-docs/hyperevm
- Onboarding index: https://hyperliquid.gitbook.io/hyperliquid-docs/onboarding
- How to start trading: https://hyperliquid.gitbook.io/hyperliquid-docs/onboarding/how-to-start-trading
- Trading > Fees: https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees
- HIP-1: https://hyperliquid.gitbook.io/hyperliquid-docs/hyperliquid-improvement-proposals-hips/hip-1-native-token-standard
- For Developers > API (index): https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
- Info endpoint: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint
- Exchange endpoint: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint
- WebSocket: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket
- Signing: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/signing
- Historical data: https://hyperliquid.gitbook.io/hyperliquid-docs/historical-data
- Support: https://hyperliquid.gitbook.io/hyperliquid-docs/support
- 404 helper (live example): https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/builder-codes
- Announcements (uncrawlable, scope-noted): https://app.hyperliquid.xyz/announcements
- llms-full.txt: https://hyperliquid.gitbook.io/hyperliquid-docs/llms-full.txt
