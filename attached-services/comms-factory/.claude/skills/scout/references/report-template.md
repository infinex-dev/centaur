# Scout brief template

Write to `scout/<question-slug>-<YYYY-MM-DD>/REPORT.md`. Drop raw query outputs (`*.json`/`*.tsv`) and the label file alongside it so every number is reproducible. **Headline number first, caveats second** — burying the lede is the default failure mode.

```markdown
# Scout: <the question, restated>
<date> · Internal Scout · cohort gate: post-2026-02-01

## Headline
<the single biggest finding, one sentence, with the corrected number and its confidence tag (hard/medium)>

## 1. Capturable value, ranked
| rank | opportunity | layer (L1/L2) | quantitative_case (one line) | confidence |
|---|---|---|---|---|
<the ranked list — recoverable $ × buildability, not gross flow. Each row's quantitative_case is what graduates toward a proposal card.>

## 2. <L1 activity-leakage | the dApp/vertical view>
<distinct-user ranking by vertical; what leaves only the UI>

## 3. <L2 capital-outflow | gravity wells>
<labeled destinations ≥ threshold, corrected $, "$X across N senders (top-3 = Y%)">

## 4. Method, verified vs estimated, and what the data can't see
- Probes run (paste the SQL — reproducibility = the safety mechanism)
- Valuation tags: which figures are hard / medium / artifact-excluded, and any row >40% that was independently re-valued
- Concentration notes on any swung/dominant number
- Caveats: no USD-inflow ledger (band-proxy); DeBank EVM-only (Solana yield invisible); balances banded; off-platform commingling invisible

## Proposal seeds
<bullet list: each finding as a "we should build X because <quantitative_case>" line — ready for the Director's brand-case pass and a Monday proposal card. Mark any "defend, don't build" findings explicitly.>
```

Keep the chat summary to: headline → the ranked seeds → path to the file. Don't paste the brief into chat.
