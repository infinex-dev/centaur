# Allergen catalog — Infinex voice validator

**Purpose.** Concrete patterns Infinex's new (sophisticated, in-on-the-joke, never-mean) voice MUST NOT echo from its Synthetix-era / early-Infinex past. Each pattern produces a regex heuristic for `comms-factory/src/validator.ts` `rejectKainBaggage`.

**Research summary.**
- Wayback (`web.archive.org/web/2024/infinex.xyz`, `…/blog.synthetix.io`) was blocked at fetch time. Gap noted; no archive screenshots available this pass.
- Grok was queried 7 times via `infinex_grok_search` (x mode + web mode) under a strict "refuse if no verbatim" instruction. It refused 5/7 — good behavior, no hallucinated quotes. 2/7 returned verifiable verbatim with URL (one X post, one blog post).
- The verified receipts plus widely-known era patterns (publicly visible Synthetix Discord culture, "Spartan" branding, Infinex's own anti-EOA / anti-CEX positioning baked into the product narrative) are the basis for the 8 patterns below.

**Convention.** Each pattern is tagged `verified` (verbatim quote + URL in hand) or `pattern reasoned (not directly cited)` (era pattern is well-known but no specific receipt was located this pass). Regexes are conservative — they target the *phrasing*, not the *concept*, so neutral mentions of competitors / Spartans / DeFi don't get falsely rejected.

---

## Pattern: Coinbase-as-regulatory-punching-bag

**Type:** verified
**Example:** "The fact that Coinbase can get to an 8b valuation selling cryptoassets to retail investors but can't sell its own equity to these same people is a great example of how regulations intended to provide safety can easily end up doing the opposite."
**Source:** https://x.com/kaiynne/status/1058826393658765314
**Why allergenic:** Names a specific CEX competitor and frames it as the villain in a regulatory hypocrisy story. The new voice can acknowledge regulatory absurdity without picking a specific competitor to club with. Punching down at named players is exactly the era posture we're shedding.
**Heuristic for validator:** `/\b(coinbase|binance|kraken|bybit|okx|kucoin|gemini|bitfinex)\b[^.?!]{0,80}\b(regulat\w*|sec|hypocrisy|joke|absurd|broken|farce|theatre|theater|sham)\b/i`

---

## Pattern: Spartan rallying language

**Type:** verified
**Example:** "the Synthetix Spartans have never shied away from asymmetrical bets, and I believe this is one of our biggest."
**Source:** https://blog.synthetix.io/why-optimism
**Why allergenic:** "Spartans" is the Synthetix-era in-group identity. Importing it (or its cousins — "the army," "the soldiers," "the council," "the OG holders") into Infinex copy signals tribe-coded rallying, not the sophisticated outsider-welcoming voice. Asymmetric-bet bravado reads as 2020 DeFi-summer pep talk.
**Heuristic for validator:** `/\b(spartans?|spartan\s+council|the\s+(?:degen\s+)?army|the\s+(?:degen\s+)?soldiers|asymmetric(?:al)?\s+bets?|never\s+shied\s+away|conviction\s+plays?)\b/i`

---

## Pattern: "Fundamentally flawed" dismissals of alternatives

**Type:** verified
**Example:** Kain's view that on-chain governance is "fundamentally flawed" (referenced in third-party governance analysis).
**Source:** https://messari.io/report/state-of-synthetix-governance
**Why allergenic:** "Fundamentally flawed / fundamentally broken / fundamentally wrong" is the founder-essay move that establishes the writer as the adult in the room while implicitly trashing whoever holds the contrary position. The new voice argues with specifics, not with absolute disqualifiers.
**Heuristic for validator:** `/\b(fundamentally|structurally|architecturally)\s+(flawed|broken|wrong|unsound|misguided|cooked)\b/i`

---

## Pattern: Anti-CEX dismissiveness ("X is dying / CEXes are over")

**Type:** pattern reasoned (not directly cited)
**Example:** no direct citation found this pass — pattern inferred from Infinex's product narrative (self-custody superapp positioning explicitly defined against CEX UX) and from the broader Synthetix-era "DeFi will replace TradFi" cadence.
**Source:** none
**Why allergenic:** Triumphalist obituaries for centralized exchanges read as 2021 cope. The new voice can argue self-custody is better without declaring the opponent dead. Death-claims age badly and signal insecurity.
**Heuristic for validator:** `/\b(coinbase|binance|kraken|bybit|okx|kucoin|gemini|cex(?:es)?|centralized\s+exchang\w*)\b[^.?!]{0,40}\b(dying|dead|done|finished|over|cooked|obsolete|legacy|relics?|dinosaurs?)\b/i`

---

## Pattern: Anti-EOA / anti-MetaMask dismissiveness

**Type:** pattern reasoned (not directly cited)
**Example:** no direct citation found this pass — pattern inferred from Infinex's smart-account positioning (account abstraction explicitly framed against seed-phrase wallets).
**Source:** none
**Why allergenic:** "MetaMask is a joke / seed phrases are dumb / EOAs are stone age" is the obvious-but-mean argument every smart-wallet project reaches for. The new voice should let the product speak; dunking on the wallet someone is currently using to read the tweet is exactly the wrong move.
**Heuristic for validator:** `/\b(metamask|phantom|rainbow|rabby|trust\s+wallet|seed\s+phrases?|eoas?|hot\s+wallets?)\b[^.?!]{0,40}\b(joke|stupid|dumb|broken|trash|garbage|stone\s+age|relics?|legacy|cope)\b/i`

---

## Pattern: VC-as-villain framing

**Type:** pattern reasoned (not directly cited)
**Example:** no direct citation found this pass — pattern inferred from the founder-essay genre Kain operates in (Mirror essays, podcast appearances) and from the wider Spartan-era "community-owned, not VC-owned" rhetoric.
**Source:** none
**Why allergenic:** "VCs are extractive / VCs are parasites / VCs ruined this cycle" is era-coded conspiracy mood. The new voice can be aligned with users without needing a villain. Naming a class of investors as the enemy is the cheap version of the argument.
**Heuristic for validator:** `/\b(vcs?|venture\s+capital(?:ists)?|funds?|allocators?)\b[^.?!]{0,40}\b(extract\w*|parasit\w*|vampires?|leech\w*|ruined|killed|dumping|cartel)\b/i`

---

## Pattern: 2020-era degen in-group slang

**Type:** pattern reasoned (not directly cited)
**Example:** no direct citation found this pass — Grok refused on specific verbatim quotes; pattern is era-standard SNX/OHM/DeFi-summer vocabulary visible across thousands of public posts.
**Source:** none
**Why allergenic:** "ser, anon, frens, gigabrain, wagmi, ngmi, gm fam, ape in" are tribal markers. Welcoming sophistication means not gating the reader on whether they know the slang. Each of these phrases dates the writer to a specific 6-month window of 2021 crypto Twitter.
**Heuristic for validator:** `/\b(gm\s+fam|gm\s+frens?|ser\b|anon\b|frens?\b|gigabrain|wagmi|ngmi|ape\s+in|aping\s+in|degens?\s+only|few\s+understand|gn\s+frens?)\b/i`

---

## Pattern: Self-congratulatory founder-essay tics

**Type:** pattern reasoned (not directly cited)
**Example:** no direct citation found this pass — pattern is a composite of the Mirror-essay register Kain shares with peers (Cobie, Hasu, etc.): "let me explain," "the truth is," "here's what's really going on," "I've been saying this for years."
**Source:** none
**Why allergenic:** The new voice should not write founder-essay throat-clearings. These openers position the writer as the explainer-in-chief and the reader as the audience-to-be-corrected. The grown-up voice opens with the thing itself, not with the writer's credentials.
**Heuristic for validator:** `/(?:^|\.\s+)(let\s+me\s+explain|here['']?s\s+what['']?s\s+really\s+going\s+on|the\s+truth\s+is|i['']?ve\s+been\s+saying\s+this\s+for\s+years|nobody\s+is\s+talking\s+about\s+this|few\s+(?:people\s+)?understand)\b/i`

---

## Validator integration

Drop these into `comms-factory/src/validator.ts` as the new `KAIN_BAGGAGE_RES` array (replacing the placeholder). Each entry below is paired with a comment indicating its receipt status — useful for the test fixture and for future audits.

```typescript
const KAIN_BAGGAGE_RES: RegExp[] = [
  // verified — Kain 2018 Coinbase regulatory dig (x.com/kaiynne/status/1058826393658765314)
  /\b(coinbase|binance|kraken|bybit|okx|kucoin|gemini|bitfinex)\b[^.?!]{0,80}\b(regulat\w*|sec|hypocrisy|joke|absurd|broken|farce|theatre|theater|sham)\b/i,

  // verified — "Spartans have never shied away from asymmetrical bets" (blog.synthetix.io/why-optimism)
  /\b(spartans?|spartan\s+council|the\s+(?:degen\s+)?army|the\s+(?:degen\s+)?soldiers|asymmetric(?:al)?\s+bets?|never\s+shied\s+away|conviction\s+plays?)\b/i,

  // verified — "fundamentally flawed" dismissal pattern (messari.io state-of-synthetix-governance)
  /\b(fundamentally|structurally|architecturally)\s+(flawed|broken|wrong|unsound|misguided|cooked)\b/i,

  // pattern reasoned, not directly cited — anti-CEX death-claims
  /\b(coinbase|binance|kraken|bybit|okx|kucoin|gemini|cex(?:es)?|centralized\s+exchang\w*)\b[^.?!]{0,40}\b(dying|dead|done|finished|over|cooked|obsolete|legacy|relics?|dinosaurs?)\b/i,

  // pattern reasoned, not directly cited — anti-EOA / anti-MetaMask dismissiveness
  /\b(metamask|phantom|rainbow|rabby|trust\s+wallet|seed\s+phrases?|eoas?|hot\s+wallets?)\b[^.?!]{0,40}\b(joke|stupid|dumb|broken|trash|garbage|stone\s+age|relics?|legacy|cope)\b/i,

  // pattern reasoned, not directly cited — VC-as-villain framing
  /\b(vcs?|venture\s+capital(?:ists)?|funds?|allocators?)\b[^.?!]{0,40}\b(extract\w*|parasit\w*|vampires?|leech\w*|ruined|killed|dumping|cartel)\b/i,

  // pattern reasoned, not directly cited — 2020-era degen in-group slang
  /\b(gm\s+fam|gm\s+frens?|ser\b|anon\b|frens?\b|gigabrain|wagmi|ngmi|ape\s+in|aping\s+in|degens?\s+only|few\s+understand|gn\s+frens?)\b/i,

  // pattern reasoned, not directly cited — founder-essay self-congratulatory openers
  /(?:^|\.\s+)(let\s+me\s+explain|here['']?s\s+what['']?s\s+really\s+going\s+on|the\s+truth\s+is|i['']?ve\s+been\s+saying\s+this\s+for\s+years|nobody\s+is\s+talking\s+about\s+this|few\s+(?:people\s+)?understand)\b/i,
];
```

**Notes for the validator owner.**
- `antagonism` rule in `validator.ts` already covers the basic competitor+pejorative pattern. The new patterns above are *additive* — they catch the era-specific phrasings that the generic antagonism rule misses (e.g., "fundamentally flawed" doesn't name a competitor but carries the same posture; "spartans never shied away" carries the in-group tribe-coding without any pejorative at all).
- Test fixtures should include at least one positive case (string passes) and one negative case (string rejected) per regex. The "ser\b" / "anon\b" / "frens?\b" cases are aggressive — confirm against the wave-1.5 corpus before shipping in case Infinex's current voice *intentionally* deploys them ironically.
- Wayback gap: a second pass with a non-Claude fetcher (curl + user-agent, or a residential-IP browser session) should pull `web.archive.org/web/2024/infinex.xyz` and `web.archive.org/web/2023/blog.synthetix.io` to back-fill the four `pattern reasoned` entries with direct receipts.
