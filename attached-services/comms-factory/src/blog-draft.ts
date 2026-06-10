import { deployedFactLine, type ReleaseCard } from "./card.js";

const DEFAULT_TOUCHPOINTS = ["x", "telegram", "website-blog", "website-modal", "email", "press"] as const;

export interface BlogDraftOptions {
  owner?: string;
}

export function buildBlogDraftMarkdown(card: ReleaseCard, opts: BlogDraftOptions = {}): string {
  const slug = slugify(card.id || card.title);
  const touchpoints = unique([...card.audience.filter((a) => a !== "internal"), ...DEFAULT_TOUCHPOINTS]);
  const owner = opts.owner ?? "<human owner>";
  const title = card.title;
  const facts = card.deployed_facts;

  return [
    "---",
    "type: launch # launch | explainer | weekly-update",
    `release_id: ${yamlString(card.id)}`,
    `release_kind: ${yamlString(card.kind)}`,
    "status: draft # draft | reviewed | approved",
    `ship_date: ${yamlString(card.ship_date)}`,
    `owner: ${yamlString(owner)}`,
    "",
    "audience:",
    ...card.audience.map((a) => `  - ${yamlString(a)}`),
    "touchpoints:",
    ...touchpoints.map((t) => `  - ${yamlString(t)}`),
    "",
    `canonical_url: ${yamlString(`https://infinex.xyz/news/${slug}`)}`,
    `slug: ${yamlString(slug)}`,
    "tags:",
    "  - <tag>",
    "related_posts: []",
    "",
    "deployed_facts:",
    ...facts.map((fact) => `  - ${yamlString(deployedFactLine(fact))}`),
    "",
    "proof_links:",
    `  product: ${yamlString(card.product_page_url ?? "<url>")}`,
    "  docs: \"<url>\"",
    "  source: \"<url>\"",
    "",
    "non_assertable_context:",
    `  reader_prior: ${yamlString(card.reader_prior ?? "<what the reader probably assumes before this>")}`,
    `  through_action: ${yamlString(card.through_action ?? "to <verb> <object>")}`,
    `  obstacle: ${yamlString(card.obstacle ?? "<what makes the announcement hard to understand or believe>")}`,
    `  not_the_point: ${yamlString(card.not_the_point ?? "<boring framing to avoid>")}`,
    "---",
    "",
    `# ${title}`,
    "",
    "<Dek / standfirst: 1-2 factual sentences under the headline. This is the TL;DR.>",
    "",
    "## Fact Box",
    "",
    "| Field | Value |",
    "|---|---|",
    `| Live date | ${card.ship_date} |`,
    `| Product / surface | ${title} |`,
    "| Supported assets / chains / markets | <from deployed_facts, or \"not announced\"> |",
    "| Fees / limits / regions | <from deployed_facts, or \"not announced\"> |",
    "| User action | <what a user can do now> |",
    "",
    "## What shipped",
    "",
    "<2-4 short paragraphs. Explain the actual change. No launch throat-clearing.>",
    "",
    "## How it works",
    "",
    "<2-4 short paragraphs. Explain the mechanism using only deployed_facts.>",
    "",
    "## What to know",
    "",
    "- <constraint, risk, availability detail, or \"not announced\">",
    "- <constraint, risk, availability detail, or \"not announced\">",
    "- <constraint, risk, availability detail, or \"not announced\">",
    "",
    "## What happens next",
    "",
    "<Only name future work if it is committed in deployed_facts. Otherwise: \"More details will be published as they ship.\">",
    "",
    "## FAQ",
    "",
    "### <Question a real user will ask>",
    "",
    "<Answer from deployed_facts. If not known, say what is not announced.>",
    "",
    "### <Question a real user will ask>",
    "",
    "<Answer from deployed_facts. If not known, say what is not announced.>",
    "",
    "---",
    "",
    "## Touchpoint Adaptations",
    "",
    "These are adaptations of the canonical page, not separate source material.",
    "",
    "### X",
    "",
    "<One post, <=280 chars. Fact first. Link to canonical page.>",
    "",
    "### Telegram",
    "",
    "<One short paragraph. Slightly more conversational than X. Link to canonical page.>",
    "",
    "### Website Modal",
    "",
    "Headline: <80 chars>",
    "Body: <140 chars>",
    "CTA: <2-4 words>",
    "",
    "### Email",
    "",
    "Status: draft only / not sendable until marketing email infrastructure exists.",
    "",
    "Subject: <50 chars>",
    "Preheader: <90 chars>",
    "Body:",
    "<Short email. One fact-led opening, 1-2 bullets if needed, one CTA to canonical page.>",
    "",
    "### Press",
    "",
    "Press path: no-pitch | reactive-only | pitch",
    "Angle: <why a journalist would care, if relevant>",
    "Quote needed: yes | no",
    "Notes: <embargo, partner approval, compliance constraints>",
    "",
    "---",
    "",
    "## For AI Agents",
    "",
    `- Markdown: \`https://infinex.xyz/news/${slug}.md\``,
    "- Facts: `<deployed_facts manifest URL>`",
    `- Ask: \`https://infinex.xyz/news/${slug}?ask=<question>\``,
    "- Related: `<related post URL>`",
    "",
    "## Human Review Checklist",
    "",
    "- [ ] Every asserted claim appears in `deployed_facts`.",
    "- [ ] Unknowns are named as \"not announced\" rather than invented.",
    "- [ ] X, Telegram, modal, email draft, and press all point back to the same canonical page.",
    "- [ ] Email remains draft only / not sendable until bulk stream + updates.infinex.xyz infrastructure exists.",
    "- [ ] No auto-posting. Human approval required per touchpoint.",
    "- [ ] Validator passes for public short copy.",
    "- [ ] Partner/compliance approval captured if needed.",
    "",
  ].join("\n");
}

export function defaultBlogDraftPath(card: ReleaseCard): string {
  return `drafts/${card.id}.md`;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "draft";
}

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}
