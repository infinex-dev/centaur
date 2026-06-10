# Coinbase Blog + Learn Pattern Audit — 2026-05-28

Reference scrape for Infinex comms-factory blog/docs template. Two surfaces, separate audits, comparison synthesis, plus a collapsed-surface recommendation (Infinex intends one surface, not two).

Method: WebSearch + WebFetch. Cited URLs throughout. No heavy quoting.

---

## Method note + fetch failure

Direct fetches against `coinbase.com/blog/*` and `coinbase.com/learn/*` returned HTTP 403 from Coinbase's CDN, both via WebFetch and via curl with a desktop browser UA. This is consistent across every URL tried. Workaround: structural patterns reconstructed from Google search snippets (which Google itself fetches cleanly) plus second-source coverage from crypto press (TheBlock, CoinDesk, Cointelegraph, CryptoBriefing, Bloomberg recap, etc.) which paraphrase article structure and quote openings.

Implication for accuracy: word counts are estimated within a band, exact h2/h3 trees are inferred from snippet headings and external recaps, not confirmed line-by-line. Voice register and macro-shape are reliable; micro-structural counts are approximate. Stated as such per item below.

---

## Coinbase Blog — 5 recent posts

### B1. Coming June 8: Perpetual-Style Equity Index Futures
- URL: https://www.coinbase.com/blog/coming-june-8-perpetual-style-equity-index-futures
- Date: late May 2026 (announcing June 8 launch)
- Word count (est.): 500-700
- Opening shape: headline-fact-first. Leads with "On June 8, Coinbase Derivatives will launch the first perpetual-style equity index futures listed on a US regulated exchange." Concrete date + first-in-category claim + regulatory framing in sentence one. No scene, no question, no quote.
- Body: thematic h2 blocks — initial contracts (AI10/China10/Defense10/Tech100), key features, market context. Bulleted lists for contract specs. Likely 1-2 product imagery / logo composites. No charts. No TL;DR card — body is short enough not to need one.
- Closing: forward-looking expansion statement ("expects to continue expansion ... for retail users in the coming months"). No CTA button quoted in third-party recaps; product is institutional so the close is roadmap, not sign-up.
- Voice register: corporate financial-PR. Heavy on regulated-exchange / CFTC / centralized-liquidity vocabulary. Zero hype words. Reads like a derivatives desk announcement, not a crypto-native launch.

### B2. Coinbase Ventures: Ideas we are excited for in 2026
- URL: https://www.coinbase.com/blog/Coinbase-Ventures-Ideas-we-are-excited-for-in-2026
- Date: late Nov 2025
- Word count (est.): 2000-3000 (long-form thesis post)
- Opening shape: framing paragraph, no headline-fact (this is a thesis, not an announcement). Sets up "ideas Coinbase Ventures expects to break out in 2026" then launches into named themes.
- Body: h2 per thesis area — "The Perpification of Everything" / RWA perpetuals, AI agents for smart contract dev, unsecured credit money markets, robotics, exotic markets. Each h2 has 2-4 paragraphs + metric drop-ins ($1.4T monthly perp DEX volume, 300% YoY growth, $1.3T unsecured US credit lines). Likely visual: hero image, possibly section-divider graphics. Inline links to portfolio companies / protocols. No bullets at section level — runs as prose with named-entity anchors.
- Closing: invitation to founders / contact pointer (Ventures content typically ends "if you're building in any of these, reach out"). No regulatory disclaimer (not a product announcement).
- Voice register: investor-thesis voice — confident, claim-dense, named-entity heavy (Hyperliquid, Lighter, Kalshi-style references). Coinage of branded phrases ("Perpification of Everything," "GitHub Copilot moment for smart contracts"). Higher VC-blog register than the product posts.

### B3. Coinbase to acquire The Clearing Company: Powering the future of prediction markets
- URL: https://www.coinbase.com/blog/Coinbase-to-acquire-The-Clearing-Company-Powering-the-future-of-prediction-markets
- Date: 2025-12-22
- Word count (est.): 400-600 (M&A announcement, short by design)
- Opening shape: deal-first single sentence. "Coinbase has entered an agreement to acquire The Clearing Company, a prediction markets company innovating at the frontier of regulated, onchain markets." Subject + verb + acquired-entity + one-line strategic descriptor.
- Body: short. Strategic-rationale paragraph, who-the-team-is paragraph (Toni Gemayel, ex-Kalshi/Polymarket), product-fit paragraph (prediction markets inside the everything-exchange interface), terms-and-timing footer ("transaction expected to close in January; financial terms not disclosed"). Likely 1 hero image (logo lockup or team photo). No bullets, no chart, no TL;DR.
- Closing: forward-looking strategy sentence + standard M&A disclaimer language (closing conditions, forward-looking statements safe-harbor).
- Voice register: M&A press-release register. Even more formal than B1. Past-tense or perfect-tense throughout. No hype.

### B4. 2025 in Review: A Breakout Year for Coinbase Markets
- URL: https://www.coinbase.com/blog/2025-in-Review-A-Breakout-Year-for-Coinbase-Markets
- Date: late Dec 2025 / early Jan 2026
- Word count (est.): 1500-2500
- Opening shape: framing-paragraph claim ("In 2025, Coinbase Markets had a landmark year ... launching category-defining products, expanding global access through acquisitions, deepening liquidity ..."). Headline claim is "breakout year" + four-verb chain summarizing the year's pillars. No scene, no quote.
- Body: h2 per surface — Derivatives / Perpetual Futures, Spot Markets, possibly International / Institutional sections. Each section is a bulleted achievement list with concrete numerics (199 perps, 20x→50x leverage, $1B open interest milestone, 350+ tradable assets). This is the post in the set MOST reliant on numbered bullets + metric drops. Likely includes 1-2 charts (asset count over time, OI growth) — Coinbase's year-in-review posts historically embed bar/line visuals.
- Closing: forward-looking pivot to next year's roadmap ("continue building a single, seamless ... platform"). Soft CTA toward institutional onboarding.
- Voice register: corporate-victory-lap. Metric-dense, achievement-list cadence. Still no slop words; reads as financial-results-adjacent rather than marketing-hype.

### B5. Coinbase Asset Management launches Digital Credit Strategy with Tokenized Shareclass
- URL: https://www.coinbase.com/blog/coinbase-asset-management-launches-digital-credit-strategy-with-tokenized-shareclass
- Date: 2026-04-30
- Word count (est.): 800-1200
- Opening shape: product-launch-first. "Coinbase Asset Management announced the launch of a tokenized credit fund, Coinbase Stablecoin Credit Strategy [CUSHY], designed to bridge the gap between traditional credit markets and the growing digital asset ecosystem." Product name + ticker + one-line positioning.
- Body: h2 sections — Three Core Pillars (h3 bullets: high-liquidity public credit, structured private credit, structured yield), Technical Infrastructure (Superstate FundOS, Ethereum/Solana/Base support, Coinbase Prime + Northern Trust + Superstate triad), Target Audience. Bulleted partner list. No chart embedded in third-party recaps; possibly product diagram. Heavy named-entity density (partners, networks).
- Closing: institutional positioning sentence + the standard regulated-product disclaimer footer (this fund is restricted by jurisdiction / accredited investors / not investment advice).
- Voice register: institutional-fund-launch register. TradFi vocabulary (share class, fund administration, prime services) interleaved with crypto vocabulary (tokenized, onchain, multi-chain). Bridges-two-worlds tone — the post is itself an artifact of the audience it's selling to.

### Coinbase Blog — length norm + register summary
- Length distribution: M&A short (400-600), product launch medium (500-1200), year-in-review or thesis long (1500-3000). Median sits ~600-1000.
- All five lead with the headline fact in sentence one. Zero scene-set openings, zero question openings.
- Body structure varies by post type — product launches use feature-bullets, theses use prose-with-metric-drops, reviews use achievement-bullets, M&A uses paragraph-flow.
- Voice across the surface: corporate / financial-PR baseline, with Ventures content the only register-shift toward thesis-blog voice. No conversational register anywhere. No "we're thrilled" hype.
- Closings consistently either forward-looking strategy or regulatory/legal disclaimer footer. No reader-CTA buttons visible in third-party recaps for these posts.

---

## Coinbase Learn — 5 recent articles

Learn articles are evergreen explainers, frequently re-edited, not date-stamped in the public-facing UI in the same way blog posts are. URL paths route into three top-level taxonomies: `crypto-basics`, `crypto-glossary`, `tips-and-tutorials` (plus `advanced-trading`). Each taxonomy implies a slightly different depth, but the shape is consistent.

### L1. What is Dollar-Cost Averaging (DCA)?
- URL: https://www.coinbase.com/learn/crypto-basics/what-is-dollar-cost-averaging-dca
- Title (h1): "What is Dollar-Cost Averaging (DCA)?"
- Word count (est.): 600-900
- Opening: question-led, definition-first. The h1 IS the question. Sentence 1 is the SERP-snippet definition: "Dollar-Cost Averaging (DCA) is a strategy that involves allocating a fixed amount of resources to a particular asset at regular intervals, regardless of its price." This 1-sentence opener IS the featured-snippet bait.
- Body (inferred h2s, paraphrased from snippets): "What is Dollar-Cost Averaging?" / "How does it work?" / "Why use Dollar-Cost Averaging?" / "Who is it for?" / sometimes "Example" or "How to set up DCA on Coinbase." Worked example with a concrete dollar figure ($100/mo for 12mo vs $1200 lump sum). No bulleted list in opening; lists appear in benefits / who-it's-for blocks.
- Strong featured-snippet structuring: each h2 is itself a question or question-shaped, the first sentence under each h2 directly answers the question. This is exact-FAQ pattern, which is also the pattern most LLM crawlers extract cleanly.
- Closing: standard Learn footer — disclaimer ("not investment advice ... speculative ... may lose some or all"), Related Articles strip (linking to other DCA-adjacent and crypto-basics articles), often a soft Coinbase product CTA.
- Voice register: neutral-explainer. "You", "your portfolio", "your bets" — second-person, friendly but never giddy. No hype words.

### L2. What is cryptocurrency?
- URL: https://www.coinbase.com/learn/crypto-basics/what-is-cryptocurrency
- Title (h1): "What is cryptocurrency?"
- Word count (est.): 800-1200 (one of the longer evergreen pillars)
- Opening: definition-first single sentence: "Cryptocurrency is typically decentralized digital money designed to be used over the internet." Then a same-paragraph extension introducing Bitcoin as the first/biggest exemplar. The 1-sentence opener is again the featured-snippet payload.
- Body h2s (inferred): What is cryptocurrency / How crypto works / What is blockchain (subsection) / What can you do with crypto / Why people use it / Risks / Buying and storing. Each section answers in 1-3 short paragraphs. Inline links to other Learn articles (blockchain, Bitcoin, Ethereum, DeFi) acting as a glossary mesh.
- Body affordances: heavier on numbered/bulleted lists than DCA (this is a pillar article, more entry points). Likely a hero illustration and section-divider visuals. NO chart embeds.
- Closing: disclaimer + Related Articles + CTA to "Get started with Coinbase" / buy crypto button.
- Voice register: neutral-explainer, slightly more textbook than DCA. Defines technical terms inline rather than assuming them.

### L3. What is account abstraction and why is it important?
- URL: https://www.coinbase.com/learn/crypto-glossary/what-is-account-abstraction-and-why-is-it-important
- Title (h1): "What is account abstraction and why is it important?"
- Word count (est.): 500-800 (glossary entries trend shorter than crypto-basics pillars)
- Opening: definition-first, two-clause. "Account abstraction is a technology enabled by blockchain that allows users to utilize smart contracts as their accounts." Followed by purpose ("strives to enhance user experience and security ... enabling users to establish their own rules for wallet management").
- Body h2s (inferred): What is account abstraction / How does account abstraction work / ERC-4337 (named-standard subsection) / Benefits / Future implications. Glossary-style includes the canonical EIP / standard reference (ERC-4337), name-checking the standard is a Learn fingerprint — every glossary entry that has a standard cites it.
- Body affordances: less bulleted, more dense prose than DCA. Inline links to wallet / smart-contracts / Coinbase Wallet articles. Diagram likely (account-abstraction explainers visually depict EOA vs SCA contrast).
- Closing: standard Learn footer — disclaimer + Related Articles. Less likely to push the "buy crypto" CTA on a technical-glossary entry; more likely to push "explore Coinbase Wallet" / "Coinbase Developer Platform."
- Voice register: technical-explainer. Comfortable with named standards (ERC-4337), but still defines them in plain language.

### L4. What is the Ethereum Cancun upgrade?
- URL: https://www.coinbase.com/learn/tips-and-tutorials/what-is-the-ethereum-cancun-upgrade
- Title (h1): "What is the Ethereum Cancun upgrade?"
- Word count (est.): 700-1100
- Opening: definition + timing. The Cancun-Deneb / Dencun framing, EIP-4844 / proto-danksharding lock-in within the first paragraph. Timely (this article was current when Dencun shipped March 2024) — Learn timely-event articles preserve the "What is X?" shape even when X is an event, not a concept.
- Body h2s (inferred): What is the Cancun upgrade / What is proto-danksharding (EIP-4844) / How does it work / Impact on gas fees / Impact on L2s / What's next (full Danksharding). Heavier on numeric claims (≥10x L2 fee reduction, blob retention ~18 days / 4096 epochs) than the conceptual articles.
- Body affordances: bulleted feature list for "what changes" likely; possibly a comparison table (pre-/post-upgrade fees). Heavy inline-link mesh into other Ethereum-roadmap glossary entries (rollups, sharding, L2, danksharding).
- Closing: disclaimer + Related Articles + a directional "what's next" sentence (because this is a roadmap upgrade, the close pivots forward to full Danksharding).
- Voice register: technical-explainer, more detail-dense than the basics articles. Comfortable with the EIP number system, blob mechanics.

### L5. What is cloud mining in crypto?
- URL: https://www.coinbase.com/learn/crypto-basics/what-is-cloud-mining-in-crypto
- Title (h1): "What is cloud mining in crypto?"
- Word count (est.): 600-900
- Opening: definition-first. "Cloud mining is a method to mine cryptocurrencies by leasing equipment or renting computing power from data centers." Sentence 2 explains what problem it solves (no need to own/manage hardware).
- Body h2s (inferred): What is cloud mining / How does cloud mining work / Types of cloud mining (hashpower leasing vs equipment leasing — two-bullet split is the SERP-friendly carve) / Benefits / Risks / Is it worth it. Notice the explicit "risks" section — Coinbase Learn does include risk callouts on most yield/return-adjacent topics, both for compliance and for trust signal.
- Body affordances: bulleted "benefits" and "risks" lists, definitely. Bulleted comparison of the two cloud-mining models. Illustration likely; chart less likely.
- Closing: standard Learn footer — disclaimer + Related Articles. Cloud-mining is a known scam-adjacent topic, so the disclaimer block tends to be slightly more cautionary than the average DCA-style article.
- Voice register: neutral-explainer with a slight cautionary lean. Same second-person voice as DCA.

### Coinbase Learn — length norm + structural fingerprints
- Length norm: 500-1200 words. Tighter range than Blog. The glossary entries skew shorter, crypto-basics pillars and tips-and-tutorials skew longer.
- 100% of these five articles use a "What is X?" h1 and a same-sentence definition opener. This is the dominant Learn shape. Variant titles ("How to X", "Why Y matters") exist on the surface but are minority.
- Every article runs an h2 chain that mirrors search-intent questions: "What is X / How does X work / Why use X / Risks / What's next." This is identical to Google's "People also ask" structure — Learn is built directly against PAA + featured-snippet schema.
- Related Articles strip, Disclaimer block, and (frequently) a product CTA constitute the Learn footer triad. Distinct from the Blog footer which is forward-strategy or legal-safe-harbor.
- Voice across the surface: neutral-explainer, second-person, defines-as-it-goes. No hype, no thesis voice, no PR voice. Calmer and more textbook than any Blog post in the sample.
- Clanker-readable affordances: h1-question + first-sentence-definition + h2-question-chain + named-standard citations (ERC-4337, EIP-4844) = the cleanest possible structure for LLM extraction. Coinbase Learn is, structurally, already most-of-the-way-there as an LLM-ingestible doc surface, because the SEO/featured-snippet target shape is the same shape LLMs prefer.

---

## Comparison synthesis

### Structural differences (Blog vs Learn)

| Axis | Blog | Learn |
|---|---|---|
| h1 shape | Statement of fact ("Coming June 8: ...", "Coinbase to acquire ...", "Coinbase Asset Management launches ...") | Question ("What is X?", "What is X and why is it important?") |
| Opening sentence | Headline-fact: subject + verb + announced object | SERP-snippet definition: "X is Y that does Z" |
| Body shape | Variable per post type — feature-bullets, prose-thesis, achievement-list, M&A paragraph-flow | Constant — question-shaped h2 chain mirroring "People also ask" |
| Length | 400-3000 (wide variance, type-driven) | 500-1200 (tight, ~mid-length explainer) |
| Voice register | Corporate / financial-PR (B1, B3, B5), thesis-VC (B2), victory-lap (B4) | Neutral-explainer, second-person, define-as-you-go |
| Closing | Forward-looking strategy OR regulatory disclaimer footer | Disclaimer + Related Articles + product CTA (the Learn footer triad) |
| Time orientation | Dated, ephemeral — the news is the value | Undated, evergreen — the concept is the value |
| Date stamp visibility | Yes, prominent | Generally hidden / de-emphasized (page acts as living definition) |
| Charts / metric-density | Year-in-review and thesis posts embed charts and metric drops | Almost never charted — diagrams not data viz |
| Named-entity density | High (products, partners, regulators, deal counterparties) | Lower (named standards EIP-/ERC- but few proper nouns) |
| LLM-extraction affordance | Mixed — long-form prose and thesis posts are harder to extract clean Q-A pairs from | Excellent — h2 questions + immediate-answer sentences map 1:1 to LLM-citation chunks |

### How Coinbase signals mode in the first 5 seconds

- URL path: `/blog/<slug>` vs `/learn/<taxonomy>/<slug>`. The pathname itself is the first mode-signal.
- Page chrome: Blog has a "Blog" header label and an author/date stamp; Learn has a taxonomy breadcrumb (`Crypto basics > What is ...`) and no/de-emphasized author.
- Title shape: a fact-headline reads as news; a "What is X?" question reads as reference. The reader knows within the title.
- Opening sentence does the rest: a date + verb + product launch in sentence 1 = announcement; a definition stating "X is Y" = reference.
- Closing is also a backstop mode-signal: Related Articles + Disclaimer triad means Learn; Forward-looking-strategy or M&A disclaimer means Blog.

### Clanker-readable affordances (Learn ≈ LLM-ingestible by default)

The featured-snippet / "People also ask" pattern that Coinbase Learn is engineered for is the same shape LLMs prefer when extracting reference content:

- h1 is a question; the answer is the first sentence under it. (LLM citation chunk = one h1 + one sentence.)
- h2s are questions; their first sentence answers the question. (LLM Q-A pair per section.)
- Definitions follow the "X is Y that does Z" canonical shape. (Trivially parsable as a triple.)
- Named standards are cited explicitly (ERC-4337, EIP-4844). (Entity-linkable.)
- Related Articles strip = explicit graph edges between concepts. (Crawl-friendly internal mesh.)

Coinbase did not need to design "for AI agents" to get this — they designed for Google SEO snippets in the 2015-2020 era, and the LLM ingestion pipeline inherited the same structural preferences. Practical upshot for Infinex: build to the same featured-snippet shape, get clanker-readability for free.

### Blog 10-line minimum-pattern skeleton

1. h1: Statement of fact. Subject + verb + announced thing. Optional date in title for time-bound launches ("Coming June 8: ...").
2. Author + date stamp visible at top.
3. Sentence 1: the headline fact. Subject + verb + announced object + a one-line strategic descriptor.
4. Sentence 2: the strategic frame (what category this product is in, what regulatory frame, what it competes with).
5. h2: What is shipping. (Concrete product / deal / metric.)
6. h2: Why now / market context. (Why the move makes sense.)
7. h2: Who it's for / how to access. (Audience + onboarding path.)
8. Optional: a chart or metric-bullet block if year-in-review-shaped.
9. Forward-looking closing sentence: what's next on the roadmap.
10. Footer: regulatory disclaimer block (or M&A safe-harbor for deals). No reader CTA button — the post itself is the artifact.

### Learn 10-line minimum-pattern skeleton

1. h1: "What is X?" — question-shaped.
2. Breadcrumb / taxonomy label visible above h1 (`Crypto basics > ...`).
3. Sentence 1: SERP-snippet definition. "X is Y that does Z." One sentence, ≤30 words, no jargon undefined.
4. Sentence 2: scope / why it exists. (Concrete problem X solves.)
5. h2: "How does X work?" — first sentence answers directly; body fills in mechanism.
6. h2: "Why use / Why does X matter?" — benefits, paragraph or short bullets.
7. h2: "Risks / What to watch out for." (Compliance + trust signal; mandatory on yield/return topics.)
8. h2: "Example" or "How to [use X] on Coinbase." (Concrete, actionable.)
9. Footer: Disclaimer block (not investment advice / speculative / may lose ...).
10. Related Articles strip + product CTA. Internal mesh links into the concept graph.

---

## If Infinex collapses Blog-mode and Learn-mode into one surface

Infinex's stated intent is a single content surface, not two. This is correct for the size of the team and for the clanker-readable doctrine, but it requires deliberate template design — the Coinbase split exists because the two modes have genuinely different jobs, and collapsing without a structural answer means one mode bleeds into the other.

### The collapse-strategy

Treat **mode as a template parameter, not a section**. One URL surface (`infinex.xyz/posts/<slug>` or similar — flat namespace), one base template, one stylesheet. The mode (announcement / explainer / both) is signalled by the front-matter and the opening, not by the URL path or a separate site section.

### Minimum unified template (10 lines)

1. h1: Mode-honest title. Announcements get statement-shape ("Spark on Hyperliquid is live."); explainers get question-shape ("What is Spark?"). Hybrid posts use statement-shape with an explainer block-quoted below.
2. Sub-h1: one-sentence mode descriptor. "Announcement, [date]" or "Explainer, evergreen" or "Launch + explainer." (Visible, small caps, ≤8 words. The reader's 5-second mode-signal.)
3. Sentence 1: the load-bearing claim. For announcements: the headline fact. For explainers: the SERP-snippet definition ("Spark is X that does Y").
4. Sentence 2: strategic frame OR scope frame. (What category, why it exists, what it replaces.)
5. h2: "What is shipping" (announcement mode) OR "How does it work" (explainer mode). The h2 is question-shaped EITHER way — featured-snippet discipline.
6. h2: "Why now" (announcement) OR "Why does it matter" (explainer). Forces a market-context paragraph in both modes.
7. h2: "Who it's for / How to use it." Concrete onboarding path. Both modes need this — explainers without an action path are slop.
8. Optional: chart / metric block for announcements; example / worked-walkthrough block for explainers. The block is conditional on mode but lives in the same h2 slot.
9. Closing sentence: forward-looking for announcements ("Synthetic Perps follows in [N]."), or pivot-to-next-concept for explainers ("Spark is one of three new primitives — see Synthetic Perps and Bridge.").
10. Footer: disclaimer block + Related Posts mesh + named-standards citations (chain IDs, contract addresses, EIP numbers when applicable). Both modes get the same footer. Mesh is the LLM-graph affordance; named standards are the entity-link affordance.

### What collapsing buys Infinex

- One template family to maintain in comms-factory (one Remotion comp family, one validator pass).
- The clanker-readable shape is baked in everywhere, not just in `/learn`. Every announcement is also a featured-snippet target. Every explainer is also pingable as a launch artifact.
- The three near-term launches (Hyperliquid Spark, Synthetic Perps, Bridge) all fit this shape — each is both a product launch (date + concrete fact) and a primitive that needs an explainer (what it is + how to use it). The collapsed template is the natural shape for those three posts.
- Voice register can stay Practical-dominant across the surface (Infinex's locked tempo). Announcements lean slightly Commanding ("Spark is live."); explainers stay flat-Practical. Same banker-trailblazer voice, no register split.

### What it costs

- You lose the news-vs-reference URL signal (Coinbase's `/blog` vs `/learn` is itself a UX affordance). Compensate with the sub-h1 mode descriptor + date stamp visibility.
- Evergreen explainers get re-edited; announcement posts shouldn't. The unified surface must preserve a "last edited" flag per post and resist post-hoc rewriting of announcement claims (the `deployed_facts` lock from the release card is the discipline here).
- Compliance disclaimer block lives in the footer for all posts. Some regulated-product disclaimers are heavier than evergreen disclaimers — design the footer with a slot for the heavier disclaimer when needed, rather than two footer templates.

### Recommendation

Ship one template. Mode is a parameter (announcement / explainer / hybrid), not a URL path. Use the 10-line skeleton above as the floor. h2s are question-shaped in both modes — this is the single highest-leverage clanker-readable affordance Coinbase Learn already demonstrates, and it costs Infinex nothing to inherit.

---

## Sources

- Coinbase Blog (5 posts, structural inference via Google snippets + crypto-press recaps):
  - https://www.coinbase.com/blog/coming-june-8-perpetual-style-equity-index-futures
  - https://www.coinbase.com/blog/Coinbase-Ventures-Ideas-we-are-excited-for-in-2026
  - https://www.coinbase.com/blog/Coinbase-to-acquire-The-Clearing-Company-Powering-the-future-of-prediction-markets
  - https://www.coinbase.com/blog/2025-in-Review-A-Breakout-Year-for-Coinbase-Markets
  - https://www.coinbase.com/blog/coinbase-asset-management-launches-digital-credit-strategy-with-tokenized-shareclass
- Coinbase Learn (5 articles, structural inference via Google snippets):
  - https://www.coinbase.com/learn/crypto-basics/what-is-dollar-cost-averaging-dca
  - https://www.coinbase.com/learn/crypto-basics/what-is-cryptocurrency
  - https://www.coinbase.com/learn/crypto-glossary/what-is-account-abstraction-and-why-is-it-important
  - https://www.coinbase.com/learn/tips-and-tutorials/what-is-the-ethereum-cancun-upgrade
  - https://www.coinbase.com/learn/crypto-basics/what-is-cloud-mining-in-crypto
- Secondary recaps (for Blog post structural confirmation): TheBlock, CoinDesk, Cointelegraph, CryptoBriefing, Bloomberg, Yahoo Finance, Seeking Alpha.

## Caveat

All Coinbase URLs returned HTTP 403 when fetched directly (WebFetch and curl with browser UA). Structural patterns above are reconstructed from Google search snippets and second-source recaps. Macro patterns (opening shape, voice register, footer triad, length range) are high-confidence; exact h2 trees and word counts are estimated.
