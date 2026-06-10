# Phantom tweet corpus

Curated 2026-05-18 from existing on-disk tweet data. 55 stratified samples drawn from a ~300-post window spanning 2026-05-03 → 2026-05-12. No fresh fetches.

## Source files used
- `research/wave-1.5-tweets/top/phantom.top.md` (primary — 300 posts ranked by impressions)
- `research/wave-1.5-tweets/phantom.api.md` (cross-reference — latest 100 raw, newest-first)
- `research/wave-1.5-tweets/phantom.md` (narrative recon, not a tweet source; used for visual/voice context only)
- `research/wave-1/phantom.md` (earlier narrative recon; used only for system-level context)

## Stratification breakdown
- Announcements (Perps listings, anniversary, partner moves): 12
- Threads (multi-tweet patterns — main + Note + legal-disclaimer reply): 6 (covering 2 thread groups)
- Replies — peer brands / KOL accounts: 9
- Replies — community / fan replies: 11
- One-liners / vibes (top-level, no announcement payload): 8
- Cultural / in-jokes / meta / community moments: 8
- Legal / disclaimer / "not a bank" boilerplate: 3 (kept because it's a recurring, distinctive register)

No security advisories, postmortems, or apology posts surfaced in this window — the period is celebratory (5th anniversary + Perps rollout + earnings-szn). Phantom's "errata" register in this corpus is purely the legal-disclaimer reply that ships under every Perps announcement; treated as its own stratum.

## Surface-shift notes (for downstream)

The most obvious tonal shift is between **announcement voice** and **reply voice**:
- **Announcements** are Title Case-y, emoji-suffixed, often start with "FYI," / "If it's in the news," and almost always end with a CTA + ghost emoji + product name. Voice is upbeat-consumer-fintech.
- **Replies** are lowercase, terse, often a single emoji or 2–4 word slang ("higher.", "gud one. stealing this", "wake up babe new finance hack just dropped"). Voice is shitposter-on-main, distinctly Gen-Z/CT-native.
- **Thread continuation tweets** (the Note + legal-disclaimer that follow each Perps announcement) are pure formal-compliance register — corporate-counsel voice, sentence case, no emojis, no personality. The same account ships all three within the same minute. This is the largest within-account register swing in the corpus.
- The **5th-anniversary anchor post** sits in a fourth register: sincere brand-history voice ("From 3AM trades to paying for coffee with Cash, we've been with you every step of the way") — neither shitposter nor compliance-lawyer.

Also worth flagging: Phantom does NOT use thread-numbering ("1/", "2/"). Their "threads" are an announcement + reply chain on the same status, not a Twitter thread in the listicle sense. Multi-tweet posts about the same launch happen via *quoted-tweet relays* and reply-chain disclaimers, not numbered threads.

## Samples

| # | Stratum | Date | Text |
|---|---|---|---|
| T001 | announcement | 2026-05-09 | Phantom turns 5 today 🎂  From 3AM trades to paying for coffee with Cash, we've been with you every step of the way.  Here's to the next chapter 👻💜 |
| T002 | announcement | 2026-05-04 | FYI, GameStop is now live for trading in Phantom 🎮 |
| T003 | announcement | 2026-05-07 | Zcash (ZEC) is up almost 70% this week 🤯  What's fueling the latest rally? |
| T004 | announcement | 2026-05-06 | If it's in the news, you can probably trade it on Phantom.  EBAY is now available to trade.  Go long or short with up to 10x leverage. |
| T005 | announcement | 2026-05-07 | FYI, Zoom (ZM) is now live for trading on Phantom 👨‍💻  Go long or short with up to 10x leverage. |
| T006 | announcement | 2026-05-04 | PLTR just announced Q1 earnings.  EPS: $0.33 ( ✅ Beat) Revenue: $1.63B (✅ Beat)  PLTR is currently trading at $148 on Phantom |
| T007 | announcement | 2026-05-11 | FULL CRCL moment: CRCL is up over 11% despite mixed Q1 earnings results.  Their on-chain volume hit $11.9 trillion this year, a 247% surge. |
| T008 | announcement | 2026-05-05 | Despite missing Q1 earnings, MSTR is still up nearly 12% this week 🤔  Did you catch the trade? |
| T009 | announcement | 2026-05-07 | COIN, CRWV, and DKNG all report Q1 earnings today after market close.  Trade them on Phantom before the call 💫 |
| T010 | announcement | 2026-05-05 | Two companies report Q1 2026 earnings today 👻  EPS Estimates:  MSTR $-4.49 AMD $1.30  Results will be reported today after market close. Trade them on Phantom |
| T011 | announcement | 2026-05-04 | Another week, another round of earnings 👻  Palantir, Strategy, Advanced Micro Devices, Coinbase, CoreWeave, and DraftKings are all reporting. |
| T012 | announcement | 2026-05-08 | The S&P500 is up almost 12% since it went live for trading in Phantom 😳 |
| T013 | thread-main | 2026-05-11 | Circle just reported their Q1 Earnings, with HIMS and Alibaba scheduled this week. Go long or short on Phantom 💫 |
| T014 | thread-note | 2026-05-11 | Phantom Perps are not available in all jurisdictions. Referenced leverage reflects the highest maximum among newly listed markets. Any tickers referenced do not represent ownership of actual equities or securities, but rather perpetual contracts issued by Phantom's partner platforms. Review individual market details before trading. Perpetuals involve significant risk and may not be suitable for all users. This content is for informational purposes only and does not constitute investment advice. Past performance does not guarantee future results. |
| T015 | thread-closer | 2026-05-11 | Sidelined?  Trade CRCL on Phantom 👻 |
| T016 | thread-main | 2026-05-07 | Long or short COIN, CRWV and DKNG up to 10x leverage on Phantom 👻 |
| T017 | thread-closer | 2026-05-07 | Phantom Perps involve risks and are not available to users in the US or other restricted jurisdictions. See full disclaimer here: |
| T018 | thread-note | 2026-05-06 | Note: This represents a new perps markets that went live in Phantom this week. |
| T019 | one-liner | 2026-05-10 | call your mom today (NFA, DYOR) |
| T020 | one-liner | 2026-05-06 | ATH supercycle (real) |
| T021 | one-liner | 2026-05-08 | tired of winning? |
| T022 | one-liner | 2026-05-11 | waiting… |
| T023 | one-liner | 2026-05-05 | if you don't love me at my -70% you don't deserve me at my +180% ❤️‍🩹 |
| T024 | one-liner | 2026-05-11 | if your network isn't discussing peptide stacks, drop shipping, and stablecoin payment infrastructure… it's time to find a new network |
| T025 | one-liner | 2026-05-11 | Hyperliquid 👻 |
| T026 | one-liner | 2026-05-04 | best met gala fit so far? |
| T027 | reply-peer | 2026-05-06 | @claudeai @SpaceX @grok are you worried that ai is taking your job? |
| T028 | reply-peer | 2026-05-08 | @Kalshi @grok what is the deal? |
| T029 | reply-peer | 2026-05-06 | @Kalshi so once all elon's companies merge will it be TeslaXBoringSpaceXAiLink |
| T030 | reply-peer | 2026-05-04 | @Kalshi why does it take 6 years to unplug the machine? |
| T031 | reply-peer | 2026-05-05 | @Kalshi wake up babe new finance hack just dropped |
| T032 | reply-peer | 2026-05-06 | @elonmusk @grok in simple terms, explain what the GB300 is and what it can do |
| T033 | reply-peer | 2026-05-06 | the whole gang pulled up  @moonpay + @solana + @useCASH 👻 |
| T034 | reply-peer | 2026-05-08 | @useCASH seems to be working 😏 solana:CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH |
| T035 | reply-peer | 2026-05-08 | @opensea remember when we [REDACTED] |
| T036 | reply-community | 2026-05-09 | @0xSweep true. i'm basically an unc |
| T037 | reply-community | 2026-05-11 | @catznfa gud one. stealing this |
| T038 | reply-community | 2026-05-09 | @lostsol heart maxxing 💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜💜 |
| T039 | reply-community | 2026-05-09 | @web3pingu thanks gang and thanks for showing up in the comments every day 💜 |
| T040 | reply-community | 2026-05-09 | @MINHxDYNASTY Thanks Minh! Hope you're having a great weekend |
| T041 | reply-community | 2026-05-09 | @itsthatgigi wasn't familiar with this piece of lore 🤯 |
| T042 | reply-community | 2026-05-11 | @WatcherGuru dubai? |
| T043 | reply-community | 2026-05-05 | @remarks this is the only reason i fly |
| T044 | reply-community | 2026-05-04 | @paulg all of my best (worst) ideas started in the garage |
| T045 | reply-community | 2026-05-04 | @PopBase what happened to Trudeau |
| T046 | reply-community | 2026-05-07 | @greg16676935420 22 bucks for nothing is pretty steep |
| T047 | cultural | 2026-05-05 | @Kalshi 🍎 > 🥈 |
| T048 | cultural | 2026-05-08 | @Jeremybtc 👽📈 |
| T049 | cultural | 2026-05-11 | @web3Esf gm 👻 |
| T050 | cultural | 2026-05-06 | @Web3Maxx gSol |
| T051 | cultural | 2026-05-05 | @notthreadguy pretty soon i heard |
| T052 | cultural | 2026-05-05 | @Dexerto this is the kind of stuff that happens if we move to a 4 day work week. |
| T053 | cultural | 2026-05-07 | @unusual_whales thanks for the info. stocking up on toilet paper and diet coke this time 🫡 |
| T054 | cultural | 2026-05-09 | @moonpay thanks moongang! you guys have a big birthday coming up soon right? 🥳 |
| T055 | legal-boilerplate | 2026-05-04 | Phantom is not a bank. The Prepaid Debit Visa Card is issued by Lead Bank and managed by Bridge Ventures, LLC. Fees may apply. See Phantom's website for more details. |

## Notes on data quality

- All 55 samples retain their exact original wording, casing, punctuation, and emoji. Where the source had a `> ` quote prefix it was stripped; no other edits.
- Tweet IDs / impression counts / engagement counts were dropped from the table per task spec (just stratum + date + text). All 55 are traceable back to `phantom.top.md` via wording match if needed.
- Two posts in the source corpus are marked `[REDACTED]` (T035 is one of them — kept because the conversational frame "@opensea remember when we [REDACTED]" is itself a register signal even with content removed); the other `[REDACTED]` posts were skipped because they had no surviving text payload to analyze.
- Dates are local to the source file's UTC timestamps; precision down to the minute exists in `phantom.api.md` if needed downstream.
- No tweets in this window were truncated by the source — the `phantom.api.md` cap was 100 posts but `phantom.top.md` extends to 300, which is what was actually sampled.
- "Threads" in Phantom's vernacular = announcement + Note + legal-disclaimer posted within the same minute, not a numbered Twitter thread. T013→T014→T015 and T016→T017 demonstrate this pattern; one announcement and one Note/disclaimer pair (T018) included separately to show the Note register in isolation.
