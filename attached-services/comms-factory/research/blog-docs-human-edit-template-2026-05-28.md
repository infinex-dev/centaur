# Canonical Blog/Docs Source Template

Fill this once. Derive X, Telegram, website modal, email, and press from it.

Hard rule: only assert claims listed in `deployed_facts`. Everything else is context, shape, or intent.

```markdown
---
type: launch # launch | explainer | weekly-update
release_id: "<release-card-id>"
status: draft # draft | reviewed | approved
ship_date: YYYY-MM-DD
owner: "<human owner>"

audience:
  - web
  - x
  - telegram
  - in-product
  - email
  - press

canonical_url: "https://infinex.xyz/news/<slug>"
slug: "<slug>"
tags: [<tag>, <tag>]
related_posts:
  - "<slug-or-url>"

deployed_facts:
  - "<fact 1: exact, dated if needed>"
  - "<fact 2>"
  - "<fact 3>"

proof_links:
  product: "<url>"
  docs: "<url>"
  source: "<url>"

non_assertable_context:
  reader_prior: "<what the reader probably assumes before this>"
  through_action: "to <verb> <object>"
  obstacle: "<what makes the announcement hard to understand or believe>"
  not_the_point: "<boring framing to avoid>"
---

# <H1: mode-honest subject + status/question>

<Dek / standfirst: 1-2 factual sentences under the headline. This is the TL;DR.>

## Fact Box

| Field | Value |
|---|---|
| Live date | <from deployed_facts> |
| Product / surface | <from deployed_facts> |
| Supported assets / chains / markets | <from deployed_facts, or "not announced"> |
| Fees / limits / regions | <from deployed_facts, or "not announced"> |
| User action | <what a user can do now> |

## <Claim or question 1>

<2-4 short paragraphs. Explain the actual change. No launch throat-clearing.>

## <Claim or question 2>

<2-4 short paragraphs. Explain how it works, using only deployed facts.>

## What to know

- <constraint, risk, availability detail, or "not announced">
- <constraint, risk, availability detail, or "not announced">
- <constraint, risk, availability detail, or "not announced">

## What happens next

<One short paragraph. Only name future work if it is committed in deployed_facts. Otherwise: "More details will be published as they ship.">

## FAQ

### <Question a real user will ask>

<Answer from deployed_facts. If not known, say what is not announced.>

### <Question a real user will ask>

<Answer from deployed_facts. If not known, say what is not announced.>

---

## Touchpoint Adaptations

These are adaptations of the canonical page, not separate source material.

### X

<One post, <=280 chars. Fact first. Link to canonical page.>

### Telegram

<One short paragraph. Slightly more conversational than X. Link to canonical page.>

### Website Modal

Headline: <80 chars>
Body: <140 chars>
CTA: <2-4 words>

### Email

Status: draft only / not sendable until marketing email infrastructure exists.

Subject: <50 chars>
Preheader: <90 chars>
Body:
<Short email. One fact-led opening, 1-2 bullets if needed, one CTA to canonical page.>

### Press

Press path: no-pitch | reactive-only | pitch
Angle: <why a journalist would care, if relevant>
Quote needed: yes | no
Notes: <embargo, partner approval, compliance constraints>

---

## For AI Agents

- Markdown: `https://infinex.xyz/news/<slug>.md`
- Facts: `<deployed_facts manifest URL>`
- Ask: `https://infinex.xyz/news/<slug>?ask=<question>`
- Related: `<related post URL>`

## Human Review Checklist

- [ ] Every asserted claim appears in `deployed_facts`.
- [ ] Unknowns are named as "not announced" rather than invented.
- [ ] X, Telegram, modal, email draft, and press all point back to the same canonical page.
- [ ] Email remains draft only / not sendable until bulk stream + updates.infinex.xyz infrastructure exists.
- [ ] No auto-posting. Human approval required per touchpoint.
- [ ] Validator passes for public short copy.
- [ ] Partner/compliance approval captured if needed.
```
