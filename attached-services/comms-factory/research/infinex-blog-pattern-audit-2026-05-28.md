# Infinex Blog Pattern Audit — 2026-05-28

**Purpose.** Extract the "absolute bare minimum pattern" of Infinex's existing blog
posts so future automated comms slot into a known skeleton. This is the baseline
(self-reference); Phantom, Coinbase, Hyperliquid, Anchorage are reference brands.

**Voice-spec timing.** Infinex's locked voice spec (`src/voice/infinex.ts`,
Practical-dominant blogs/docs) was established **May 2026** — AFTER every post
audited below was written. Findings here are **observational**, not "drifted off-spec."
There was no spec at write-time. Forward-looking language only.

**Clanker-readability lens.** Throughout, I score posts on whether an LLM agent
could parse and quote them cleanly: heading hierarchy, frontmatter-like opening,
named data points, schema-shaped sections.

---

## Where the blog actually lives

- Canonical URL: `https://infinex.xyz/news`
- Legacy redirect: `https://infinex.xyz/blog` → `301 → /news`
- No Mirror, no Substack, no Medium mirror found via site:- search or external recon.
- Help/Support docs at `https://support.infinex.xyz` are a separate Intercom KB,
  not the blog.
- Kain Warwick's personal essays (referenced by several Infinex blog posts) live
  on his own X/blog and are *summarized* in `infinex.xyz/news`; the canonical
  versions are external (e.g. "The Superapp Thesis," "Infinex Governance Retake").

Total post count on `/news` as of 2026-05-28: ~80 posts dating from Aug 2023 →
Mar 2026. Cadence in last 12 months is ~weekly product update + ~bi-weekly
essay/announcement.

The blog has two **clear, distinct lanes**:

1. **Numbered product updates** — slugs like `42-...` through `62-...`.
   "What's new / Product updates" breadcrumb. Stays in lane.
2. **Essays / announcements / podcast-recap posts** — slugs are descriptive
   (`crypto-s-shift-to-revenue`, `from-mindshare-to-slop-...`,
   `uneasy-money-...`). Varying breadcrumbs.

I sampled 16 posts across both lanes spanning Aug 2023 → Mar 2026, weighted toward
the last 12 months.

---

## Per-post inventory

For each post: URL · date · title · word count · opening · body shape · closing ·
length norm · voice register.

### Product-update lane (numbered weeklies)

#### 1. `№ 62 — Lighter comes to Infinex Perps`
- URL: https://infinex.xyz/news/62-lighter
- Date: Mar 3, 2026 · WC ≈ 378
- Opening (3 sentences):
  > Infinex Perps isn't tied to a single exchange anymore. You can now trade
  > across both Lighter and Hyperliquid — one interface, same order types,
  > your choice of venue. Synthetix is joining the party next.
- Body shape: H1 + dek + four H3 sections
  (`Trade perps on Lighter and Hyperliquid from one interface` /
  `Chase the price with one tap` / `Extension improvements` / `Other improvements`)
  + closing `Coming up` H3. Each H3 anchors 2–3 short paragraphs and a UI
  screenshot/animation. `Other improvements` is a bulleted micro-list.
  `Coming up` is a bulleted teaser list (`Synthetix integration`, `DeFi positions
  in Portfolio`, etc.).
- Closing: dated footer note ("Current as of 2 March 2026") + link to Roadmap.
  No signature, no CTA button.
- Length norm: 250–400 body words per weekly post.
- Voice register: descriptive-Practical. Mirodan/Laban observation:
  declarative + utility-forward + present-tense. "You can now…", "rolling out to
  Patrons first." Reads as **Practical** (factual, dry, sustained-prep clarity)
  with one Sociable beat at the open ("Synthetix is joining the party next").

#### 2. `№ 61 — Private send with Incognito Mode`
- URL: https://infinex.xyz/news/61-incognito-mode
- Date: Feb 16, 2026 · WC ≈ 305
- Opening:
  > You can now send assets with enhanced privacy using Incognito Mode — a
  > privacy-focused swap-and-send feature that breaks the direct on-chain link
  > between sender and recipient wallets.
- Body shape: H1 + lead paragraph (no separate dek) + three H3 sections
  (`Now available in Infinex Labs: send with Incognito Mode` / `Other improvements`
  / `Coming up`). Animated GIF/video frame after each H3.
- Closing: `Coming up` bullets. No CTA, no sign-off.
- Voice: Practical with a Penetrating undertow ("breaks the direct on-chain
  link") — describes mechanism, not benefit-speak.

#### 3. `№ 60 — INX is here`
- URL: https://infinex.xyz/news/60-inx-is-here
- Date: Jan 30, 2026 · WC ≈ 158
- Opening:
  > The INX token is now live. We've put together an INX page on the website
  > with info about the token, how to buy, and more.
- Body shape: H1 + 3-paragraph lead + H3 `Infinex Roadmap`. The TGE post is
  *short* — defers detail to /inx and /roadmap rather than recapping. Confident
  brevity.
- Closing: "See everything we've shipped so far, and what's coming up, on the
  brand new Roadmap page." Single in-line link.
- Voice: Commanding-restrained. Big news, small wordcount — the post knows the
  asset is the page, not the prose.

#### 4. `№ 57 — Swidge crates`
- URL: https://infinex.xyz/news/57-swidge-crates
- Date: Dec 24, 2025 · WC ≈ 269
- Opening:
  > Starting today, in addition to getting the best rate on your swaps, you'll
  > also earn crates when you swidge.
- Body shape: H1 + dek-paragraph + H3 `Earn crates when you swidge`. Then 2-3
  paragraphs on mechanics, screenshot of the swidge UI showing the crate counter.
- Closing: One-line forward-looking note about revenue → buybacks.
  > Swidge fees are an important component of Infinex revenue and token
  > buybacks, and enable us to reward users with crates.
- Voice: Practical. The closing line is **the recurring weekly signature** —
  a one-sentence "why this matters for the token/treasury" thread.

**Weekly template (across №57, №60, №61, №62):**
```
Breadcrumb: "What's new / Product updates"
H1: "№ N — <feature headline>"
Date
Dek (one sentence, italic-ish weight, optional)
[Hero image or product GIF]
H3 per feature (1–4 features)
  └─ 1–3 short paragraphs explaining what + how + who gets it
  └─ inline UI screenshot/animation
H3: "Other improvements"      (optional)
  └─ ▼ accordion bullets
H3: "Coming up"
  └─ bulleted teaser list with bolded feature name + dash + one-line desc
Footer: dated note + Roadmap link
```

---

### Essay / announcement lane

#### 5. `The Infinex Sale: Wrapped`
- URL: https://infinex.xyz/news/the-infinex-sale-wrapped
- Date: Jan 10, 2026 · WC ≈ 362
- Opening:
  > The Infinex Sale closed on 10 January, with total contributions of $7.2
  > million USDC, exceeding the $5 million cap by roughly $2.2 million (44%
  > oversubscribed).
- Body shape: H1 + factual dek + four H3 sections
  (`The numbers` / `How allocation worked` / `What happens now` / `Thank you`).
  Bulleted breakdown under `The numbers`. Plain-prose under the others.
- Closing: "Thank you" section. One-line forward note: "See you on the 30th."
- Voice: Sombre+Practical — quiet, factual, transparency-coded. No
  victory-lap language. **Heaviest on named numerics** of any post in the
  sample — high clanker-readability.

#### 6. `From mindshare to slop: Why we're pausing Yaprun`
- URL: https://infinex.xyz/news/from-mindshare-to-slop-why-we-re-pausing-yaprun
- Date: Aug 12, 2025 · WC ≈ 636
- Opening:
  > Crypto is a game of attention. Teams can build the greatest product in the
  > world, but if they're not capturing attention, it doesn't matter.
- Body shape: H1 + 3 H2 sections (`Optimizing for attention` /
  `When mindshare farming became slop farming` / `What's next`). One inline image.
  Long-form prose, no bulleted lists in body.
- Closing: forward-looking ("lessons learned … will inform a better system").
  No CTA, no link-out.
- Voice: Sombre+Penetrating — the operator admits the program failed and
  names the cause (bots, slop). One-line aside ("Bots, 'Hold my beer.'")
  is a tonal swing toward Sociable that breaks the diagnostic register.

#### 7. `Crypto's shift to revenue` / `The Superapp Thesis`
- URL: https://infinex.xyz/news/crypto-s-shift-to-revenue
- Date: Nov 14, 2025 · WC ≈ 438
- Opening:
  > Read Kain's blog on the superapp thesis and the revenue meta
  > In Kain's recent blog The Superapp Thesis, he outlines how Infinex
  > replicates the Centralized Exchange experience on-chain, and how
  > sustainable protocols require sustainable revenue models…
- Body shape: This is a **recap post**. H1 + dek + ~6 H3 (in the original;
  my extractor only caught one) summarizing Kain's external blog with
  block-quoted lines. Closes with "Dive into the full blog here:
  The Superapp Thesis."
- Closing: link-out to Kain's blog. Pattern: Infinex's site is the **digest**;
  the canonical essay is on Kain's blog.
- Voice: Commanding+Practical — confident framing of the playbook.

#### 8. `Infinex governance retake`
- URL: https://infinex.xyz/news/infinex-governance-retake
- Date: Nov 14, 2025 · WC ≈ 366
- Opening:
  > Kain recently published a reassessment of Infinex's governance structure
  > in his blog post, Infinex Governance Retake. His analysis covers the
  > failures of early DeFi governance, the importance of simplicity, and a
  > new approach to token holder rights.
- Body shape: Recap-post pattern again. H1 + dek + body with two embedded
  block-quotes from Kain ("absolutely diabolical," etc.) + a bulleted
  enumeration of the framework's components (`The platform must remain
  non-custodial`, `Modifying governance requires adaptive quorum voting`, …).
- Closing: "Check out all of Kain's blogs here."
- Voice: Practical recap framing + Penetrating bullets (the framework rules
  are blunt and absolute).

#### 9. `Infinex announces Infinex Connect and a vision for next-gen crypto apps`
- URL: https://infinex.xyz/news/infinex-announces-infinex-connect-and-a-vision-for-next-gen-crypto-apps
- Date: May 2, 2025 · WC ≈ 506
- Opening (Reuters-style dateline):
  > Dubai, April 30, 2025 — In a keynote presentation at TOKEN2049 Dubai,
  > Kain Warwick previewed the launch of Infinex Connect — a new way of
  > interacting with dapps.
- Body shape: H1 + dek + `Quick take` bulleted summary (3 lines) + three H3
  sections (`Next-gen crypto apps` / `Onchain command center` /
  `Infinex SDK for developers`) + media-contact footer.
- Closing: media-contact block (`Email: raz@core.infinex.gg / TG: @Raz_Infinex`).
- Voice: Press-release register — third-person, dateline, named spokespeople.
  Closer to **Practical+Sociable** with PR conventions wired in. Diverges from
  the rest of the corpus (only post in sample with a media-contact block).

#### 10. `Treasury Review: The Patron Sale`
- URL: https://infinex.xyz/news/treasury-review-the-patron-sale
- Date: Dec 4, 2024 · WC ≈ 919
- Opening:
  > The Patron NFT sale concluded on Sunday 24th of September 2024. The event
  > was one of the largest NFT sales in crypto history, with proceeds of
  > $67.69m for a total of 43,244 Patrons sold of 100,000 in the collection.
- Body shape: This is the **most schema-like post in the entire blog**.
  H1 + dek + 10+ H2 sections (`Strategic summary` / `Community Summary` /
  `Combined Patron purchases by tier` / `Unlock schedule` / `Key date summary` /
  `Patron allocation` / `Patron purchase options` / `Sale participants` /
  `Sale access` / `Security` / `Patron governance proposals`). Most sections
  are bulleted facts: `Foundations that purchased: 6`, `Sale proceeds:
  $4,714,699`, `Patrons sold: 2,071`. Very dense, very enumerated.
- Closing: link to superseded XIP-12 proposal.
- Voice: Practical-extreme. No prose flourishes. Reads like a board
  report. **Highest clanker-readability of any post.**

#### 11. `Trust and transparency in DeFi's UX layer`
- URL: https://infinex.xyz/news/trust-and-transparency-in-defis-ux-layer
- Date: Aug 11, 2023 · WC ≈ 1018
- Opening:
  > Innovations in crypto user experience have lagged behind innovations in
  > crypto infrastructure, and this makes sense.
- Body shape: H1 + dek + 4 H2 sections (`Infinitely better` / `Trustlessness` /
  `Transparency` / `What's next`). Long-form prose. 16 em-dashes (highest in
  the sample) — em-dash heavy was the **early Infinex** register.
- Closing:
  > This is DeFi's greatest chance to take on centralised finance — it's our
  > responsibility to make it count.
- Voice: Manifesto-Commanding. This is the **founding essay** style; later
  posts have moved away from the em-dash-and-manifesto cadence toward
  shorter, more factual register.

#### 12. `Governing the Gateway to DeFi`
- URL: https://infinex.xyz/news/governing-the-gateway-to-defi
- Date: Nov 18, 2023 · WC ≈ 1387
- Opening:
  > Before designing a governing framework for something that hasn't been built
  > before, it is worth taking some time to consider what that thing could
  > become.
- Body shape: H1 + dek + 4 H3 setup sections + 4 H2 framework sections
  (`Governance farming` / `The Infinex Council` / `Additional considerations` /
  `Next steps`). Council section has 4 nested H3 (one per seat type).
- Closing: forward-looking call-to-arms ("Infinex is calling for those leaders
  to help fulfil the promise [of] DeFi").
- Voice: Manifesto-Commanding+Practical. Long, structured, named-component prose.

#### 13. `Uneasy Money: Did Jupiter mislead users? And is Hyperliquid's ADL flawed?`
- URL: https://infinex.xyz/news/uneasy-money-jupiter-mislead-users-hyperliquid-adl
- Date: Dec 17, 2025 · WC ≈ 306
- Opening:
  > On this week's episode of 'Uneasy Money', Unchained's new livestream series,
  > hosts Kain Warwick, Luca Netz and Taylor Monahan dive into the most
  > significant news stories from the week.
- Body shape: H1 only (no sub-headings). 6–9 short paragraphs summarizing what's
  in the episode. Closing line:
  > Uneasy Money streams from Kain's X every Wednesday at 3pm ET.
- Closing: Recurring single-line sign-off (the streaming schedule).
- Voice: Sociable+Practical podcast-recap register. The shortest essay-lane
  template in active rotation.

#### 14. `Uneasy Money: Why Crypto Still Can't Overcome Its ICO Struggles`
- URL: https://infinex.xyz/news/uneasy-money-why-crypto-still-can-t-overcome-its-ico-struggles
- Date: Jan 23, 2026 · WC ≈ 227
- Identical shape to (13). H1, 4 short paragraphs, same closing sentence
  ("Uneasy Money streams from Kain's X every Wednesday at 3pm ET.").

#### 15. `Uneasy Money — How Aave Labs and the DAO Should Split Ownership of the Brand`
- URL: https://infinex.xyz/news/uneasy-money-how-aave-labs-and-the-dao-should-split-ownership-of-the-brand
- Date: Jan 9, 2026 · WC ≈ 188
- Identical shape to (13)/(14). Shortest of the Uneasy Money lane.

#### 16. `Uneasy Money: How Ethereum May Have One-Upped Bitcoin in One Big Way`
- URL: https://infinex.xyz/news/uneasy-money-how-ethereum-may-have-one-upped-bitcoin-in-one-big-way
- Date: Jan 29, 2026 · WC ≈ 213
- Identical shape to (13)/(14)/(15).

**Uneasy Money sub-template:**
```
H1: "Uneasy Money: <episode question or thesis>"
Date
Dek (one-line teaser, often with quoted phrasing from the episode)
Lead paragraph (who's on, what the show is)
2–4 short body paragraphs (each = one segment of the episode)
"Don't miss out on…" paragraph (tease specific bits)
Closing sign-off: "Uneasy Money streams from Kain's X every Wednesday at 3pm ET."
```

---

## Cross-post synthesis

### Three live templates, not one

The blog isn't a single template — it's a **family of three**, each disciplined
and consistent within itself:

| Template | Frequency | Length | Heading depth | Visuals | Identifying signal |
|---|---|---|---|---|---|
| **Weekly product update** (№N) | weekly | 150–400 words | H1 + H3-per-feature | UI screenshot per H3 | breadcrumb `What's new / Product updates`; H1 prefix `№` |
| **Uneasy Money recap** | weekly | 180–350 words | H1 only | none | closing line "Uneasy Money streams from Kain's X every Wednesday at 3pm ET." |
| **Essay / announcement** | bi-weekly | 350–1500 words | H1 + H2-section + H3-subsection | 0–1 inline image | descriptive slug; named subsections like `The numbers`, `What's next` |

A future Infinex blog post will (and should) belong to exactly one of these.

### Recurring structural primitives

Across all three templates, the load-bearing primitives are:

1. **Single H1 at the top, no eyebrow/kicker text** above it.
2. **Date directly under H1**, format `MMM D, YYYY`.
3. **Dek paragraph immediately after date** — a 1-2 sentence factual summary
   in heavier weight. The dek does the "what + why now" job; the body does
   the "how + so what."
4. **Section headings are noun-phrases or imperative phrases**, never clickbait
   questions or "5 reasons…" listicle bait. Examples observed: `The numbers`,
   `What happens now`, `Other improvements`, `Coming up`, `Earn crates when
   you swidge`, `Trustlessness`, `Transparency`. Clanker-friendly: any LLM
   can quote `Section: The numbers` and the content is exactly the numbers.
5. **Bulleted lists used for enumeration only** — sale tier breakdowns, "Coming
   up" teaser items, accordion-style "Other improvements," allocation tables.
   Never used to chunk an argument. Essays stay in prose.
6. **Forward-looking closing line** — every post ends with one sentence
   pointing at the next thing ("See you on the 30th," "Check out all of Kain's
   blogs here," "Uneasy Money streams from Kain's X every Wednesday at 3pm ET,"
   "For more, see the Infinex Roadmap"). No CTA buttons, no "subscribe to our
   newsletter," no signature line, no author byline.
7. **External links are sparse** — most posts have 0–3 outbound links, all
   contextual (e.g. linking to Kain's external blog, the roadmap, an XIP).

### What's NOT in the corpus (the negative space)

The absence pattern is as instructive as the presence pattern:

- **No author bylines.** No "Written by …" header, no photo, no Twitter handle
  next to a name. Posts are corporate-voiced even when recapping a named
  person's work.
- **No tags or categories** surface on the post page (only the breadcrumb
  distinguishes lanes).
- **No code blocks** in any post sampled (16/16). No `<pre>`, no `<code>` —
  even when describing technical concepts (zk-proofs, Hyperliquid ADL,
  account abstraction). This is striking for a crypto product blog and may
  be a gap rather than a feature.
- **No tables**, despite `Treasury Review: The Patron Sale` being heavily
  enumerated. Tables are flattened into "Label: value" bulleted lines.
- **No glossary terms / inline definition tooltips.** Technical jargon is used
  unguarded (`adaptive quorum voting`, `derivation paths`, `passkeys`,
  `7702 chains`). Reader is assumed crypto-native.
- **No FAQ section** on any post — even the launch posts. The TGE post
  (`The Infinex Sale: Wrapped`) defers to a "complete guide to the upcoming
  TGE" rather than inlining Q&A.
- **No "TL;DR" header**, although the dek paragraph effectively serves that
  function. Worth noting that "Quick take" appeared only once
  (`Infinex Connect press release`).
- **No share buttons, no newsletter widget, no related-posts module**
  visible on post pages.
- **No social proof, testimonials, or quote blocks** — except where the
  post is *itself* a recap of an external Kain essay (then there are
  block-quotes from that essay).

### Em-dash density: the early-essay tell

| Post | Date | Em-dashes | Notes |
|---|---|---|---|
| Trust and transparency in DeFi's UX layer | Aug 2023 | 16 | manifesto cadence |
| Governing the Gateway to DeFi | Nov 2023 | 10 | manifesto cadence |
| Infinex Connect press release | May 2025 | 6 | dateline + Kain quote |
| 62-lighter | Mar 2026 | 1 | one rhetorical pair |
| 60-inx-is-here, 61-incognito-mode, all Uneasy Money | 2025–2026 | 0 | flat |

The em-dash is decaying out of the corpus over time. The 2023 founding essays
hit `(16, 10)`; mid-2025 posts hit `(3–8)`; the 2025–2026 weeklies and
Uneasy Money recaps hit `(0–1)`. **The current Infinex blog voice is not
em-dash-heavy.** The locked voice spec's zero-tolerance em-dash rule
(per `generator.ts` validator) is *already* the direction the corpus was
moving.

### Clanker-readable affordances — what's there

- **Strong, consistent heading hierarchy** (H1 → H2 → H3) on every essay-lane
  post. An agent can build a section map from the headings alone.
- **Named noun-phrase sections** ("The numbers," "Strategic summary," "Unlock
  schedule," "Coming up") — easy to retrieve and cite.
- **Dek paragraphs are factual** — they parse as a structured summary, not as
  marketing hook. "Closed on 10 January, total contributions of $7.2 million
  USDC, 44% oversubscribed" is a quotable data line.
- **Numerical data appears in-line with units and precision** — `$67.69m`,
  `43,244 Patrons`, `100,000 in the collection`, `$99.99M FDV`, `1-year lock`.
  Agents can extract these without ambiguity.
- **Treasury reviews are effectively structured data flattened into prose**
  — every key fact is a `Label: value` line. This is the highest-fidelity
  clanker-readable post type.
- **Stable closing-line shibboleths** (`Uneasy Money streams from Kain's X
  every Wednesday at 3pm ET`) act as a "post type fingerprint" — an agent
  can classify the post type from the last line alone.

### Clanker-readable affordances — what's MISSING

- **No frontmatter** (YAML or otherwise). Title, date, author, tags, category
  are scattered through the DOM rather than declared up-front. A future
  improvement: render a hidden or visible "card header" block with
  type/date/topic/release-id machine-readable fields.
- **No structured data block** identifying which product launch / numbered
  release a post refers to. Posts about INX, Lighter, Incognito Mode, and
  Swidge Crates have no schema tying back to a `deployed_facts` list.
  comms-factory's own card schema is *exactly the structured layer the blog
  doesn't have*.
- **No code blocks** for CLI flows / SDK examples — for a developer-facing
  product like Connect, this is a real gap. The Connect announcement post
  does not show a single `infinex.connect()` call or SDK snippet.
- **No definition glossary** linked from technical posts. New terms are
  introduced once, capitalized, and assumed.
- **No anchor links to subsections** (`#the-numbers`) visible in the
  rendered page; agents have to scan H2/H3 text to navigate.

### Where the posts diverge from each other

- **Reuters-style dateline** appears only in the Connect press release. No
  other post opens with a `City, Date —` dateline.
- **Media-contact block** appears only in the Connect press release.
- **Em-dash density** swings from 16 to 0 across the corpus.
- **Length swings 158 → 1387 words** in the sample. The weeklies cluster
  tight (150–400); the essays sprawl (350–1400).
- **Heading depth swings** from H1-only (Uneasy Money) to H1+H2+H3+H3
  (`Governing the Gateway to DeFi`).
- **First-person register** swings between corporate-"we" (most posts) and
  founder-singular (the 2023 essays sometimes drift to first-person
  reflection).

### What's load-bearing (KEEP regardless)

These primitives are doing real work and a future template MUST preserve them:

1. **Two-line opening: H1 + date + factual dek.** This is the "frontmatter"
   in disguise. Already clanker-readable.
2. **Section headings are noun-phrases that name the actual content** of the
   section. `The numbers` actually contains the numbers. Don't break this.
3. **Forward-looking closing line.** Every post points at the next thing.
   This is the post-as-pulse signal — Infinex is always moving, every post
   ends with a vector.
4. **Single corporate voice, no bylines.** The brand is the author. (The
   recap-of-Kain posts are the exception that proves the rule: when a
   named person's work is the subject, Infinex frames it as a digest,
   not a guest post.)
5. **Bullets for enumeration, prose for argument.** A list of facts is a
   list; a chain of reasoning is paragraphs.
6. **The three-template family.** Weekly product / Uneasy Money recap /
   Essay-announcement. Don't proliferate.

### What the operator likely wants to STRIP

Reading this against the "bare minimum" framing and the Practical-dominant
voice lock:

1. **Strip the manifesto cadence from the 2023 essays.** Em-dash density of
   10–16, "infinitely better" / "it's our responsibility to make it count"
   are off-spec for Practical-dominant. The corpus has already drifted away
   from this; the validator can lock the drift in.
2. **Strip the press-release dateline and media-contact block** from
   announcement posts — it's a one-off PR convention that doesn't show up
   anywhere else in the corpus. If a press release is needed, render it as
   a separate channel (e.g. a Newswire feed), not as a blog post that
   breaks shape.
3. **Strip "Quick take" as a section heading.** It only appears once
   (Infinex Connect). The dek already does the TL;DR job. Two summaries
   is one too many.
4. **Strip the recap-post pattern's tendency to over-quote.** Recap posts
   sometimes block-quote 3+ lines from Kain's external blog. Either link
   out cleanly (Uneasy Money does this) or summarize in Infinex's own
   voice — pick one.
5. **Strip filler bullets in essay closings.** A few essays end with bulleted
   "principles" or "rules" that read as PowerPoint residue rather than
   prose conclusion.
6. **Strip flexes / victory-lap tone.** Mostly absent already, but the
   Patron Sale post's "one of the largest NFT sales in crypto history" line
   is the sole instance — the Sale Wrapped post correctly drops this
   register entirely.
7. **Strip clickbait-shaped headings.** None are currently present, but
   the validator should hard-reject "5 things you need to know about X",
   "Why X matters", and question-headings that don't earn the question.
   (The Uneasy Money H1s are question-shaped, e.g. "Did Jupiter mislead
   users?" — this is acceptable in the recap template because the question
   is the episode's framing, not the post's marketing.)

---

## Minimum pattern extracted

The smallest scaffold any future Infinex blog post needs — 10 lines max:

```
1.  Breadcrumb: "What's new / <lane>"
2.  H1: <noun-phrase title>            (weekly = "№ N — feature"; essay = descriptive; recap = "Uneasy Money: <question>")
3.  Date: MMM D, YYYY
4.  Dek: one-sentence factual summary in heavier weight (the "frontmatter line")
5.  [optional: one hero image / product GIF]
6.  Body: 1–N H3 sections, each a noun-phrase or imperative naming the section's actual content
7.  Within each H3: 1–3 short paragraphs OR a bulleted enumeration (never both as argument-chunking)
8.  [optional: "Coming up" H3 with bulleted teaser list — weekly template only]
9.  Closing: one forward-looking sentence pointing at the next thing (roadmap, next post, next stream)
10. No byline, no signature, no share buttons, no newsletter widget, no CTA button
```

**Word-count norms by template:**
- Weekly product update: 150–400 words
- Uneasy Money recap: 180–350 words
- Essay / announcement: 350–1500 words (treasury reviews can go longer)

**Voice posture (observational, voice spec postdates corpus):**
The corpus has already drifted toward Practical-dominant — declarative,
present-tense, low-em-dash, named-data, no-victory-lap. The locked May 2026
voice spec codifies what was already happening. Weekly posts hit Practical
cleanly. Treasury Review hits Practical-extreme (most clanker-readable).
Essays still occasionally drift into Commanding-manifesto when the topic is
big (governance, thesis-level posts) — that swing is in the locked tempi set
(`Commanding`) and is on-spec when the post earns it, off-spec when it
doesn't.

**Highest-leverage clanker-readability upgrade if the operator wants one:**
Render a small machine-readable header block — visible or hidden — with
`{type, release_id, date, products, deployed_facts[]}`. This is exactly what
comms-factory's `ReleaseCard` schema already produces. Surfacing it as
frontmatter on the rendered page (e.g. as a `<meta>` block or a tiny visible
"context strip") gives every future blog post a stable extraction target
without changing how humans read the prose.

---

## Sources cited

All URLs are public, fetched 2026-05-28 via real browser (Cloudflare/Vercel
shielded the path against curl/WebFetch):

- https://infinex.xyz/news  (index)
- https://infinex.xyz/news/62-lighter
- https://infinex.xyz/news/61-incognito-mode
- https://infinex.xyz/news/60-inx-is-here
- https://infinex.xyz/news/57-swidge-crates
- https://infinex.xyz/news/the-infinex-sale-wrapped
- https://infinex.xyz/news/from-mindshare-to-slop-why-we-re-pausing-yaprun
- https://infinex.xyz/news/crypto-s-shift-to-revenue
- https://infinex.xyz/news/infinex-governance-retake
- https://infinex.xyz/news/infinex-announces-infinex-connect-and-a-vision-for-next-gen-crypto-apps
- https://infinex.xyz/news/treasury-review-the-patron-sale
- https://infinex.xyz/news/trust-and-transparency-in-defis-ux-layer
- https://infinex.xyz/news/governing-the-gateway-to-defi
- https://infinex.xyz/news/uneasy-money-jupiter-mislead-users-hyperliquid-adl
- https://infinex.xyz/news/uneasy-money-why-crypto-still-can-t-overcome-its-ico-struggles
- https://infinex.xyz/news/uneasy-money-how-aave-labs-and-the-dao-should-split-ownership-of-the-brand
- https://infinex.xyz/news/uneasy-money-how-ethereum-may-have-one-upped-bitcoin-in-one-big-way
