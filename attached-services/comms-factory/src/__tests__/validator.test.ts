import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { ReleaseCard } from "../card.js";
import {
  auditChangelogFormat,
  auditClaimContract,
  auditClaimTripwires,
  auditBeats,
  auditTextHybrid,
  auditUnsupportedClaims,
  classifyTempoBlind,
  rejectAIslop,
  rejectAntagonism,
  rejectClaimedPalettes,
  rejectCliches,
  rejectKainBaggage,
  rejectListicleVoice,
  rejectOutwardVersionTag,
  rejectVisualSlop,
  structureIssues,
  validate,
} from "../validator.js";
import { renderStructured, type StructuredOutput } from "../generator.js";
import type { LLMVoiceAuditOptions } from "../validator-llm.js";
import { INFINEX_VOICE } from "../voice/infinex.js";

const CARD: ReleaseCard = {
  id: "test-launch",
  kind: "launch-tier",
  title: "Fact A Launch",
  ship_date: "2026-05-13",
  audience: ["x"],
  deployed_facts: ["Fact A is live", "Fact B stays private"],
  headline: "Fact A",
  tier_reason: "test card",
};

const CHANGELOG_CARD: ReleaseCard = {
  id: "bridge-fiat-deposit-2026-06-05",
  kind: "split",
  title: "Bank deposits: dollars into Infinex as USDC on Base",
  ship_date: "2026-06-05",
  audience: ["blog"],
  deployed_facts: [
    "Infinex now supports bank deposits: send US dollars from your own bank account (ACH or wire) and they arrive in your Infinex account as USDC on Base.",
    "Bank deposits are powered by Bridge.xyz, the stablecoin-infrastructure company acquired by Stripe.",
    "US dollars are supported at launch, by ACH or wire.",
    "Funds settle as USDC on Base, into your main Infinex account.",
    "Infinex does not add a fee on bank deposits at launch.",
    "Verification is one-time, handled by Bridge.",
    "After approval you receive reusable bank details in your name.",
    "This is deposit-only at launch.",
    "EUR bank transfers are coming soon.",
    "Hyperliquid spot is coming in the weeks ahead.",
  ],
  from: "US dollars from your own bank account",
  to: "USDC in your Infinex account on Base",
  split_semantics: "on-off-chain bank and wallet split",
};

const KEYSTONE_CHANGELOG = readFileSync("drafts/bridge-launch-changelog-2026-06-05.md", "utf8");

describe("structureIssues", () => {
  it("passes a well-formed thread (2-6 tweets, each ≤280)", () => {
    const s: StructuredOutput = { kind: "thread", tweets: ["hook tweet", "fact tweet", "landing tweet"] };
    expect(structureIssues(s)).toEqual([]);
  });
  it("flags a thread with too few tweets", () => {
    const s: StructuredOutput = { kind: "thread", tweets: ["only one"] };
    expect(structureIssues(s).some((i) => i.includes("min 2"))).toBe(true);
  });
  it("flags a thread with too many tweets", () => {
    const s: StructuredOutput = { kind: "thread", tweets: Array(7).fill("t") };
    expect(structureIssues(s).some((i) => i.includes("max 6"))).toBe(true);
  });
  it("flags an over-length tweet", () => {
    const s: StructuredOutput = { kind: "thread", tweets: ["ok", "x".repeat(281)] };
    expect(structureIssues(s).some((i) => i.startsWith("tweet 2"))).toBe(true);
  });
  it("flags a link in the first tweet (X reach penalty)", () => {
    const s: StructuredOutput = {
      kind: "thread",
      tweets: ["Spot is live. Read more at https://infinex.xyz/news", "Onchain order book."],
    };
    expect(structureIssues(s).some((i) => i.includes("tweet 1 contains a link"))).toBe(true);
  });
  it("flags a bare domain in the first tweet", () => {
    const s: StructuredOutput = {
      kind: "thread",
      tweets: ["Spot is live — infinex.xyz/news has the details.", "Onchain order book."],
    };
    expect(structureIssues(s).some((i) => i.includes("tweet 1 contains a link"))).toBe(true);
  });
  it("allows a link in a later tweet", () => {
    const s: StructuredOutput = {
      kind: "thread",
      tweets: ["Spot is live inside Infinex.", "Details: https://infinex.xyz/news"],
    };
    expect(structureIssues(s).some((i) => i.includes("contains a link"))).toBe(false);
  });
  it("passes a well-formed carousel (3-6 slides)", () => {
    const s: StructuredOutput = {
      kind: "carousel",
      slides: [
        { name: "Spot is live", body: "Hyperliquid Spot now trades inside Infinex Perps." },
        { name: "Real order book", body: "A fully onchain CLOB — every order, cancel, and trade onchain." },
        { name: "Start trading", body: "Quote in USDC. Switch to Spot to place your first order." },
      ],
    };
    expect(structureIssues(s)).toEqual([]);
  });
  it("flags too few slides and an over-length slide body", () => {
    const s: StructuredOutput = {
      kind: "carousel",
      slides: [
        { name: "One", body: "short" },
        { name: "Two", body: "y".repeat(241) },
      ],
    };
    const issues = structureIssues(s);
    expect(issues.some((i) => i.includes("min 3"))).toBe(true);
    expect(issues.some((i) => i.startsWith("slide 2 body"))).toBe(true);
  });
  it("flags an over-length slide name", () => {
    const s: StructuredOutput = {
      kind: "carousel",
      slides: [
        { name: "x".repeat(41), body: "b" },
        { name: "ok", body: "b" },
        { name: "ok", body: "b" },
      ],
    };
    expect(structureIssues(s).some((i) => i.startsWith("slide 1 name"))).toBe(true);
  });
  it("passes a well-formed web card and ignores the responsive slash in the title", () => {
    const s: StructuredOutput = {
      kind: "web-card",
      subheading: "Spot trading",
      title: "Hyperliquid Spot, / now on Infinex.",
      caption: "First CLOB order book in Perps",
    };
    expect(structureIssues(s)).toEqual([]);
  });
  it("flags an over-length web title (measured without the slash)", () => {
    const s: StructuredOutput = {
      kind: "web-card",
      subheading: "Spot",
      title: "x".repeat(49),
      caption: "ok",
    };
    expect(structureIssues(s).some((i) => i.startsWith("title"))).toBe(true);
  });
  it("renderStructured produces readable text slop rules can run on (no JSON syntax)", () => {
    const thread: StructuredOutput = { kind: "thread", tweets: ["first", "second"] };
    const text = renderStructured(thread);
    expect(text).toContain("first");
    expect(text).toContain("second");
    expect(text).not.toContain("{");
    expect(text).not.toContain("—");
  });
});

describe("rejectOutwardVersionTag", () => {
  it("flags 'Spot V1'", () => {
    expect(rejectOutwardVersionTag("Spot V1 is live inside Infinex.").passed).toBe(false);
  });
  it("flags a lowercase version tag", () => {
    const result = rejectOutwardVersionTag("Swidge v2 routes the swap.");
    expect(result.passed).toBe(false);
    expect(result.reason).toContain("v2");
  });
  it("passes copy with no version tag", () => {
    expect(rejectOutwardVersionTag("Hyperliquid spot is live inside Infinex.").passed).toBe(true);
  });
});

describe("rejectCliches", () => {
  it("flags 'game-changer'", () => {
    expect(rejectCliches("a real game-changer for trading").passed).toBe(false);
  });
  it("flags 'unlock'", () => {
    expect(rejectCliches("Unlocking new yield primitives").passed).toBe(false);
  });
  it("flags 'seamless'", () => {
    expect(rejectCliches("a seamless onboarding flow").passed).toBe(false);
  });
  it("flags 'paradigm'", () => {
    expect(rejectCliches("a paradigm shift for DeFi").passed).toBe(false);
  });
  it("flags 'leverage' as verb", () => {
    expect(rejectCliches("leverage your portfolio").passed).toBe(false);
  });
  it("does NOT flag 'leverage ratio' (financial term, not the cliché)", () => {
    expect(rejectCliches("leverage ratio capped at 10x").passed).toBe(true);
  });
  it("does NOT flag 'leveraged long' (financial term)", () => {
    expect(rejectCliches("a leveraged long on ETH").passed).toBe(true);
  });
  it("passes clean copy", () => {
    expect(rejectCliches("Bridge USDC from Base to Arbitrum in one click.").passed).toBe(true);
  });
  it("passes single short headline", () => {
    expect(rejectCliches("JUST IN: Polymarket integrates Phantom Wallet.").passed).toBe(true);
  });
});

describe("rejectListicleVoice", () => {
  it("flags '3 reasons'", () => {
    expect(rejectListicleVoice("3 reasons Infinex matters today").passed).toBe(false);
  });
  it("flags 'why X matters'", () => {
    expect(rejectListicleVoice("Why on-chain settlement matters").passed).toBe(false);
  });
  it("flags 'the only X you'll ever need'", () => {
    expect(rejectListicleVoice("The only wallet you'll ever need").passed).toBe(false);
  });
  it("flags 'top 5'", () => {
    expect(rejectListicleVoice("Top 5 features in this release").passed).toBe(false);
  });
  it("passes 'three improvements shipped today'", () => {
    expect(rejectListicleVoice("three improvements shipped today").passed).toBe(true);
  });
  it("passes 'JUST IN:' format", () => {
    expect(rejectListicleVoice("JUST IN: Spot perps now live on Base.").passed).toBe(true);
  });
  it("passes data-card caption", () => {
    expect(rejectListicleVoice("$11.9T on-chain volume YTD.").passed).toBe(true);
  });
});

describe("rejectAntagonism", () => {
  it("flags 'binance is slow'", () => {
    expect(rejectAntagonism("binance is slow and broken").passed).toBe(false);
  });
  it("flags 'unlike Coinbase'", () => {
    expect(rejectAntagonism("Unlike Coinbase, we don't gate users.").passed).toBe(false);
  });
  it("flags 'metamask is clunky'", () => {
    expect(rejectAntagonism("metamask is clunky and slow").passed).toBe(false);
  });
  it("passes neutral mention of Coinbase", () => {
    expect(rejectAntagonism("Withdraw to Coinbase in one tap.").passed).toBe(true);
  });
  it("passes neutral mention of Binance", () => {
    expect(rejectAntagonism("Listed pairs include Binance's BTC/USDT.").passed).toBe(true);
  });
  it("passes when no competitor named", () => {
    expect(rejectAntagonism("Slow bridges are bad UX.").passed).toBe(true);
  });
});

describe("rejectAIslop", () => {
  it("flags 'innovative'", () => {
    expect(rejectAIslop("an innovative new product").passed).toBe(false);
  });
  it("flags 'cutting-edge'", () => {
    expect(rejectAIslop("our cutting-edge platform").passed).toBe(false);
  });
  it("flags 'users will appreciate'", () => {
    expect(rejectAIslop("users will appreciate the new flow").passed).toBe(false);
  });
  it("flags 'thrilled to'", () => {
    expect(rejectAIslop("We're thrilled to announce").passed).toBe(false);
  });
  it("flags 'stay tuned'", () => {
    expect(rejectAIslop("more soon — stay tuned").passed).toBe(false);
  });
  it("flags ANY em-dash (zero-tolerance per operator 2026-05-25)", () => {
    expect(rejectAIslop("a — b — c — d — fin").passed).toBe(false);
    // Single em-dash in tweet-length copy also fails now.
    expect(
      rejectAIslop("Bridge USDC from Base to Arbitrum — settles in 3 seconds.").passed,
    ).toBe(false);
  });
  it("passes clean tweet-length copy", () => {
    expect(rejectAIslop("JUST IN: Spot perps now live.").passed).toBe(true);
  });
});

describe("rejectKainBaggage", () => {
  it("flags placeholder phrase 'degen army'", () => {
    expect(rejectKainBaggage("the degen army assembles").passed).toBe(false);
  });
  it("flags 'synthetic everything'", () => {
    expect(rejectKainBaggage("synthetic everything, on-chain").passed).toBe(false);
  });
  it("flags 'the spartan council'", () => {
    expect(rejectKainBaggage("the spartan council voted yes").passed).toBe(false);
  });
  it("passes neutral copy", () => {
    expect(rejectKainBaggage("Bridge from Base to Arbitrum.").passed).toBe(true);
  });
  it("passes mention of 'army' alone", () => {
    expect(rejectKainBaggage("the swiss army of wallets").passed).toBe(true);
  });
  it("passes mention of 'council' alone", () => {
    expect(rejectKainBaggage("city council approved the motion").passed).toBe(true);
  });
});

describe("rejectVisualSlop", () => {
  it("flags glassmorphism", () => {
    expect(rejectVisualSlop("modern glassmorphism panels with depth").passed).toBe(false);
  });
  it("flags neumorphism", () => {
    expect(rejectVisualSlop("soft neumorphism cards").passed).toBe(false);
  });
  it("flags claymorphism", () => {
    expect(rejectVisualSlop("playful claymorphism style").passed).toBe(false);
  });
  it("flags purple gradient", () => {
    expect(rejectVisualSlop("a vibrant purple gradient header").passed).toBe(false);
  });
  it("flags holographic gradient", () => {
    expect(rejectVisualSlop("a holographic gradient backdrop").passed).toBe(false);
  });
  it("flags iridescent gradient", () => {
    expect(rejectVisualSlop("iridescent gradient sheen").passed).toBe(false);
  });
  it("flags hype-driven", () => {
    expect(rejectVisualSlop("hype-driven visual choices").passed).toBe(false);
  });
  it("flags 'futuristic UI'", () => {
    expect(rejectVisualSlop("a futuristic UI for power users").passed).toBe(false);
  });
  it("flags vaporwave", () => {
    expect(rejectVisualSlop("vaporwave aesthetic returns").passed).toBe(false);
  });
  it("passes 'purple' alone (not paired with gradient)", () => {
    expect(rejectVisualSlop("the purple wallet is Phantom's").passed).toBe(true);
  });
  it("passes 'gradient' alone (not paired with slop modifier)", () => {
    expect(rejectVisualSlop("a subtle gradient scrim").passed).toBe(true);
  });
  it("passes neutral product copy", () => {
    expect(rejectVisualSlop("Spot Hyperliquid is live.").passed).toBe(true);
  });
});

describe("rejectClaimedPalettes", () => {
  it("flags Polymarket #2E5CFF", () => {
    expect(rejectClaimedPalettes("on a #2E5CFF background").passed).toBe(false);
  });
  it("flags Pendle #1BE3C2", () => {
    expect(rejectClaimedPalettes("PT-green #1BE3C2 stays Pendle's").passed).toBe(false);
  });
  it("flags Phantom #AB9FF2", () => {
    expect(rejectClaimedPalettes("the #AB9FF2 ghost").passed).toBe(false);
  });
  it("flags Monad #6E54FF (lowercase)", () => {
    expect(rejectClaimedPalettes("electric purple #6e54ff").passed).toBe(false);
  });
  it("passes neutral hex", () => {
    expect(rejectClaimedPalettes("#FF6A00 sunset tone").passed).toBe(true);
  });
  it("passes no hex at all", () => {
    expect(rejectClaimedPalettes("Spot perps now live.").passed).toBe(true);
  });
});

describe("validate (composite)", () => {
  it("passes a clean Polymarket-style caption", () => {
    const r = validate("JUST IN: Spot perps now live on Base.");
    expect(r.passed).toBe(true);
    expect(r.failures).toEqual([]);
  });
  it("accumulates multiple failures", () => {
    const r = validate(
      "We're thrilled to unlock a game-changing, seamless, innovative experience.",
    );
    expect(r.passed).toBe(false);
    expect(r.failures.length).toBeGreaterThanOrEqual(2);
  });
  it("returns the failing rule names", () => {
    const r = validate("3 reasons this is a paradigm shift.");
    expect(r.passed).toBe(false);
    const names = r.failures.map((f) => f.rule);
    expect(names).toContain("cliches");
    expect(names).toContain("listicle-voice");
  });
});

describe("auditChangelogFormat", () => {
  it("passes the keystone changelog format for blog changelog cards", () => {
    expect(auditChangelogFormat(KEYSTONE_CHANGELOG, { channel: "blog", card: CHANGELOG_CARD })).toEqual([]);

    const result = validate(KEYSTONE_CHANGELOG, {
      channel: "blog",
      card: CHANGELOG_CARD,
    });

    expect(result.passed).toBe(true);
    expect(result.failures.filter((f) => f.rule === "changelog-format")).toEqual([]);
  });

  it("fails a blog changelog missing the Coming up section", () => {
    const withoutComingUp = KEYSTONE_CHANGELOG.replace(/\n---\n\n### Coming up[\s\S]*$/m, "\n---\n");
    const failures = auditChangelogFormat(withoutComingUp, { channel: "blog", card: CHANGELOG_CARD });

    expect(failures.map((f) => f.reason)).toContain("missing ### Coming up section");
  });

  it("fails a blog changelog with the wrong frontmatter category", () => {
    const wrongCategory = KEYSTONE_CHANGELOG.replace("category: changelogs", "category: news");
    const result = validate(wrongCategory, {
      channel: "blog",
      card: CHANGELOG_CARD,
      fact_contract: "off",
    });

    expect(result.passed).toBe(false);
    expect(result.failures.map((f) => f.reason)).toContain("frontmatter category must be changelogs");
  });

  it("fails freeform blog prose with a specific frontmatter reason", () => {
    const result = validate("Bank deposits are live. Dollars arrive as USDC on Base.", {
      channel: "blog",
      card: CHANGELOG_CARD,
      fact_contract: "off",
    });

    expect(result.passed).toBe(false);
    expect(result.failures.map((f) => f.reason)).toContain("missing YAML frontmatter block");
  });

  it("fails unbalanced Markdoc toggle tags", () => {
    const unbalanced = KEYSTONE_CHANGELOG.replace("{% /toggle %}", "");
    const failures = auditChangelogFormat(unbalanced, { channel: "blog", card: CHANGELOG_CARD });

    expect(failures.map((f) => f.reason).join("\n")).toContain("Markdoc toggle tags are unbalanced");
  });

  it("does not apply the changelog gate outside the blog channel", () => {
    const result = validate("Bank deposits are live. Dollars arrive as USDC on Base.", {
      channel: "x",
      card: CHANGELOG_CARD,
      fact_contract: "off",
    });

    expect(result.failures.filter((f) => f.rule === "changelog-format")).toEqual([]);
    expect(result.passed).toBe(true);
  });
});

describe("auditClaimContract", () => {
  it("fails when a candidate omits fact receipts", () => {
    const failures = auditClaimContract("Fact A is live.", { card: CARD });
    expect(failures.map((f) => f.reason)).toContain("candidate omitted deployed_facts_used receipt");
    expect(failures.map((f) => f.reason)).toContain("candidate omitted not_said receipt");
  });

  it("fails when deployed_facts_used contains a non-card fact", () => {
    const failures = auditClaimContract("Fact A is live.", {
      card: CARD,
      deployed_facts_used: ["Fact A is live", "Invented claim"],
      not_said: [{ fact: "Fact B stays private", reason: "not needed for this line" }],
    });
    expect(failures.map((f) => f.reason)).toContain(
      'deployed_facts_used contains non-card fact: "Invented claim"',
    );
  });

  it("passes when used facts are present and unused facts are accounted for", () => {
    const failures = auditClaimContract("Fact A is live.", {
      card: CARD,
      deployed_facts_used: ["Fact A is live"],
      not_said: [{ fact: "Fact B stays private", reason: "would dilute the short launch line" }],
    });
    expect(failures).toEqual([]);
  });

  it("does not make validate fail hard on strict receipt bookkeeping by default", () => {
    const r = validate("Fact A is live.", {
      card: CARD,
      deployed_facts_used: ["Invented claim"],
      not_said: [{ fact: "Fact B stays private", reason: "not used" }],
    });
    expect(r.passed).toBe(true);
    expect(r.failures.map((f) => f.rule)).not.toContain("fact-contract");
  });

  it("can still run the old strict receipt audit when explicitly requested", () => {
    const r = validate("Fact A is live.", {
      card: CARD,
      deployed_facts_used: ["Invented claim"],
      not_said: [{ fact: "Fact B stays private", reason: "not used" }],
      fact_contract: "strict",
    });
    expect(r.passed).toBe(false);
    expect(r.failures.map((f) => f.rule)).toContain("fact-contract");
  });

  it("fails when copy asserts an extra numeric claim outside deployed_facts", () => {
    const failures = auditClaimContract("Fact A is live. Also supports 100 markets.", {
      card: CARD,
      deployed_facts_used: ["Fact A is live"],
      not_said: [{ fact: "Fact B stays private", reason: "not relevant" }],
    });
    expect(failures.map((f) => f.rule)).toContain("unsupported-claim");
    expect(failures.map((f) => f.reason).join("\n")).toContain("100");
  });

  it("does not flag structural carousel slide ordinals as numeric claims", () => {
    const carousel: StructuredOutput = {
      kind: "carousel",
      slides: [
        { name: "Fact A", body: "Fact A is live." },
        { name: "Fact B", body: "Fact B stays private." },
        { name: "Operator note", body: "No extra figure appears here." },
        { name: "Review lane", body: "Copy stays on the release card." },
      ],
    };
    const text = renderStructured(carousel);
    const failures = auditClaimTripwires(text, CARD);
    expect(failures.filter((f) => f.reason.includes("numeric claim"))).toEqual([]);

    const result = validate(text, { card: CARD });
    expect(result.failures.filter((f) => f.reason.includes("numeric claim"))).toEqual([]);
  });

  it("still flags a real numeric claim not in deployed_facts when carousel ordinals are present", () => {
    const bare = auditClaimTripwires("Yields up to 20% APY.", CARD);
    expect(bare.map((f) => f.rule)).toContain("unsupported-claim");
    expect(bare.map((f) => f.reason).join("\n")).toContain("20");

    const carousel: StructuredOutput = {
      kind: "carousel",
      slides: [
        { name: "Big yields", body: "20% APY now live." },
        { name: "Real order book", body: "Hyperliquid Spot trades inside Infinex." },
        { name: "Start trading", body: "Switch to Spot to begin." },
      ],
    };
    const failures = auditClaimTripwires(renderStructured(carousel), CARD);
    const numericReasons = failures
      .filter((f) => f.reason.includes("numeric claim"))
      .map((f) => f.reason)
      .join("\n");
    expect(numericReasons).toContain("20");
    expect(numericReasons).not.toMatch(/"1"|"2"|"3"/);
  });

  it("fails on unsupported superlative/status claims even with a valid receipt", () => {
    const failures = auditUnsupportedClaims("Fact A is live. The first wallet to do this.", CARD);
    expect(failures.map((f) => f.rule)).toContain("unsupported-claim");
    expect(failures.map((f) => f.reason).join("\n")).toContain("first wallet");
  });

  it("fails on unsupported readiness claims even when the launch fact is valid", () => {
    const failures = auditClaimContract("Fact A is live, ready to trade.", {
      card: CARD,
      deployed_facts_used: ["Fact A is live"],
      not_said: [{ fact: "Fact B stays private", reason: "not relevant" }],
    });
    expect(failures.map((f) => f.rule)).toContain("unsupported-claim");
    expect(failures.map((f) => f.reason).join("\n")).toContain("ready to trade");
  });

  it("allows product_page_url without requiring it in deployed_facts", () => {
    const failures = auditClaimTripwires("Fact A is live. https://example.com/release", {
      ...CARD,
      product_page_url: "https://example.com/release",
    });
    expect(failures).toEqual([]);
  });

  it("keeps validate's hard fact gate to deterministic numeric/URL tripwires", () => {
    const railCard: ReleaseCard = {
      ...CARD,
      deployed_facts: [
        "Bridge.xyz supported fiat deposit rails: USD (ACH/wire, US account+routing number), EUR (SEPA IBAN), MXN (SPEI CLABE), BRL (PIX BR code), GBP (FPS, beta), COP (Bre-B, beta)",
        "Bridge.xyz fiat deposit settlement output: Fiat deposits are converted to a target crypto (e.g. USDC) and delivered on-chain to a configured destination wallet address on a specified payment rail (e.g. Ethereum)",
      ],
    };
    const r = validate(
      "Your Infinex account has a routing number. Wire it the way you'd wire a bank. It lands as USDC, on-chain.",
      { card: railCard, deployed_facts_used: ["wrong"], not_said: [] },
    );
    expect(r.passed).toBe(true);
    expect(r.failures).toEqual([]);
  });
});

describe("blind tempo classification", () => {
  // Heuristic blind classifier is informational only after the 2026-05-28
  // Laban-pure voice spec refactor. INFINEX_VOICE no longer carries brand
  // vocab (vocab_anchor / opening_shapes / example_lines / signoff_moves),
  // so the heuristic returns "unknown" for Laban-pure voices and the
  // validator defers to validator-llm for tempo classification. See
  // research/pre-mortem-non-canon-contamination-2026-05-28.md (Option C).

  it("returns unknown for a Laban-pure voice (defer to LLM)", () => {
    const paragraph =
      "Today: spot Hyperliquid is live in Infinex. Same account, same passkey, the orderbook where your portfolio already lives.";
    const classified = classifyTempoBlind(paragraph, INFINEX_VOICE);
    expect(classified.tempo).toBe("unknown");
    expect(classified.confidence).toBe(0);
  });

  it("auditBeats passes when classifier is unknown (heuristic deferral)", () => {
    const paragraph =
      "Spot was harder than perps. The orderbook semantics had to feel native, not bolted on. We held it back until that was true.";
    const audit = auditBeats(paragraph, { beats: [{ tempo: "practical" }] }, INFINEX_VOICE);
    expect(audit[0]?.passed).toBe(true);
    expect(audit[0]?.classified_tempo).toBe("unknown");
    expect(audit[0]?.reason).toContain("deferred");
  });

  it("validate() passes for in-palette declared tempo even when heuristic defers", () => {
    // After Laban-pure migration: blind classifier returns "unknown" for
    // Infinex prose because there's no brand-vocab to match. The validator
    // defers to validator-llm for tempo classification; the declared tempo
    // is in voice.main_tempi by construction, so the audit passes.
    const paragraph =
      "Today: spot Hyperliquid is live in Infinex. Same account, same passkey, the orderbook where your portfolio already lives.";
    const result = validate(paragraph, {
      beats: { beats: [{ tempo: "irradiant" }] },
      voice: INFINEX_VOICE,
    });
    expect(result.passed).toBe(true);
    expect(result.failures.map((f) => f.rule)).not.toContain("beat-tempo-fit");
    expect(result.beat_audit?.[0]?.classified_tempo).toBe("unknown");
    expect(result.beat_audit?.[0]?.passed).toBe(true);
    expect(result.beat_audit?.[0]?.reason).toContain("deferred");
  });
});

describe("auditTextHybrid", () => {
  function makeStubClient(responses: Array<Record<string, unknown>>): { client: NonNullable<LLMVoiceAuditOptions["client"]>; calls: number } {
    let i = 0;
    const state = { calls: 0 };
    const client = {
      messages: {
        create: async () => {
          state.calls += 1;
          const body = responses[i] ?? responses[responses.length - 1];
          i += 1;
          return { content: [{ type: "tool_use", id: `toolu_${state.calls}`, name: body?.name, input: body?.input } as never] };
        },
      },
    } as unknown as NonNullable<LLMVoiceAuditOptions["client"]>;
    return { client, calls: state.calls };
  }

  it("short-circuits on regex failure WITHOUT making an LLM call", async () => {
    const state = makeStubClient([]);
    const verdict = await auditTextHybrid("This is a game-changing, next-gen, seamless experience!", {
      voice: INFINEX_VOICE,
      llm_opts: { client: state.client },
    });
    expect(verdict.passed).toBe(false);
    expect(verdict.deterministic.passed).toBe(false);
    expect(verdict.llm).toBeUndefined();
    expect(verdict.reason).toContain("cliche");
  });

  it("calls the LLM judge when the regex layer passes", async () => {
    const state = makeStubClient([
      {
        name: "audit_pass",
        input: {
          notes: "fits",
          independent_classification: {
            tempo: "commanding",
            motifs: ["pressing", "punching"],
            detected_drive: "spell-vision",
            confidence: 0.85,
            rationale: "decisive landing",
          },
        },
      },
    ]);
    const verdict = await auditTextHybrid("Spot Hyperliquid is live in Infinex.", {
      voice: INFINEX_VOICE,
      llm_opts: { client: state.client },
    });
    expect(verdict.deterministic.passed).toBe(true);
    expect(verdict.llm?.passed).toBe(true);
    expect(verdict.passed).toBe(true);
    expect(verdict.reason).toBeNull();
  });

  it("fails when regex passes but LLM judge fails on character drift", async () => {
    const state = makeStubClient([
      {
        name: "audit_fail",
        input: {
          feedback: "Off-spec drive: Passion. Aspirational framing.",
          independent_classification: {
            tempo: "unknown",
            motifs: ["pressing"],
            detected_drive: "passion",
            confidence: 0.8,
            rationale: "rallying-cry shape",
          },
        },
      },
    ]);
    // A phrase that escapes regex but is off-character.
    const verdict = await auditTextHybrid("Reimagine what your portfolio could be.", {
      voice: INFINEX_VOICE,
      llm_opts: { client: state.client },
    });
    expect(verdict.deterministic.passed).toBe(true);
    expect(verdict.passed).toBe(false);
    expect(verdict.llm?.passed).toBe(false);
    expect(verdict.reason).toContain("Passion");
  });
});
