# Infinex Homepage — Spec-Only Rewrite Loop

Date: 2026-05-15
Source strings: https://infinex.xyz/ (fetched 2026-05-15)
Loop: intent extractor (Sonnet) → in-character generator (Opus, blind to current_text) → blind validator (Sonnet).

## Method

Three-subagent loop, distinct API calls, distinct prompts:

1. **Intent extractor** reads `(surface, job, current_text)` and emits `{intent, constraints}`. It is forbidden from echoing shipped wording or recommending phrasing.
2. **In-character generator** reads `(surface, job, intent, constraints)` plus the locked Infinex character spec. It NEVER sees the shipped wording. It picks one of the five main tempi and writes a replacement.
3. **Blind validator** is the existing `auditTextLLM()` — classifies the regenerated line blind to the declared tempo. If `independent_classification.tempo != selected_tempo` OR the verdict fails, the orchestrator retries with feedback (max 3 attempts).

The point: if the regenerated copy reads in-character AND the generator + validator agree on tempo, the character spec is doing real work. If `similarity_to_current >= 0.6` (token Jaccard, stopword + length filtered), the loop converged too close to the shipped wording — flagged for review as a possible context-poisoning candidate.

## Results

| ID | Surface | Job | Current text | Extracted intent | Selected tempo | Replacement text | Verifier tempo | Verdict | Retries | Similarity |
|---|---|---|---|---|---|---|---|---|---|---|
| H01 | Infinex homepage — hero | hero | Change the way you crypto. | Tell a first-time visitor what Infinex's singular product position is, in one decisive line that defines the category shift the product represents for anyone who holds or moves digital assets. | commanding | One account for everything onchain. | commanding | PASS | 0 | 0.00 |
| H02 | Infinex homepage — value prop label | value_prop | Unified portfolio. | Tell a homepage visitor what core problem Infinex solves for their assets — that previously scattered holdings are now accessible and managed in one place. | commanding | One account. | commanding | PASS | 0 | 0.00 |
| H03 | Infinex homepage — value prop label | value_prop | Multi-provider trading. | Tell a first-time visitor what core product mechanic Infinex offers by naming the structural feature that distinguishes how orders are executed across the platform. | commanding | Multi-venue execution | commanding | PASS | 0 | 0.20 |
| H04 | Infinex homepage — value prop label | value_prop | Serious Opsec. | Tell a homepage visitor that the platform treats user security and operational protection as a core, non-negotiable product attribute — not an afterthought. | commanding | Security by default | commanding | PASS | 0 | 0.00 |
| H05 | Infinex homepage — primary CTA | cta | Get Infinex | Direct a homepage visitor to begin acquiring or activating access to the product. | commanding | Get Infinex | commanding | PASS | 0 | 1.00 |
| H06 | Infinex homepage — section opener for shipped + upcoming | section_head | See everything we've shipped, and everything that's coming up | Orient the visitor to a section that surfaces the full product timeline — both what has already been delivered and what is planned next — so they can assess progress and momentum at a glance. | commanding | Shipped. And what's next. | commanding | PASS | 1 | 0.14 |
| H07 | Infinex homepage — features section opener | section_head | Explore key features | Orient the visitor to the start of a section that lists the product's primary capabilities, so they know what kind of information follows. | commanding | The full stack. | commanding | PASS | 1 | 0.00 |
| H08 | Infinex homepage — wallet feature description | feature_description | Passkey-first, gas-abstracted wallet with support for 20+ chains. | Communicate to a prospective user what the wallet's three core technical properties are: its authentication method, its fee model, and its multi-network reach — so they can assess compatibility with their needs without clicking further. | commanding | One passkey. No gas. Nine networks, one account. | unknown | FAIL | 2 | 0.18 |
| H09 | Infinex homepage — product enumeration | feature_description | Swap. Perps. Earn. Predict. Multi-provider. Multi-chain. | Tell a first-time visitor which core product capabilities and infrastructure dimensions are available on the platform, so they can immediately assess whether it covers their trading and yield needs. | commanding | Perps. Spot. Yield. Prediction markets. Every chain. Every venue. | commanding | PASS | 0 | 0.15 |
| H10 | Infinex homepage — wallet import feature | feature_description | More than view-only. Import or connect existing wallets and take control. | Tell a visitor what the wallet import feature enables them to do with their existing wallets — specifically that it goes beyond passive read access and grants active, full capability over those wallets within the product. | commanding | Your existing wallets are live in Infinex. Bring them in and sign, send, and trade from the same account. | commanding | PASS | 1 | 0.10 |
| H11 | Infinex homepage — wallet connectivity feature | feature_description | Connect securely to any dapp and take your account with you. | Explain to a prospective user that their Infinex account is portable and works with the broader decentralized application ecosystem, without requiring repeated setup or losing access to their assets. | commanding | One passkey. Every dapp. No new accounts. | commanding | PASS | 1 | 0.09 |
| H12 | Infinex homepage — security tier feature | feature_description | Passkey to Ledger to Safe. Choose the Opsec to suit your spec. | Inform a visitor that the platform supports a spectrum of security configurations, from lightweight to institutional-grade, and that the user controls which level they adopt. | commanding | Passkeys, MPC, hardware wallets, multi-sig. You pick the tier. | commanding | PASS | 1 | 0.00 |
| H13 | Infinex homepage — rewards feature | feature_description | Switch to Infinex and earn crates and cashback on every trade. | Tell a visitor what tangible incentives they receive for trading on the platform, naming both the reward types and the trigger action. | irradiant | What this lets you do: keep trading, and your account is already collecting Patron Passes and stacking fee rebates in the background — one activity, two returns showing up on their own. | unknown | FAIL | 2 | 0.00 |
| H14 | Infinex homepage — top-level positioning line | positioning | One super app. | Tell a first-time visitor what Infinex is by naming its product category in a single definitive fragment that establishes its scope and singular nature. | commanding | The everything account. | commanding | PASS | 0 | 0.00 |
| H15 | Infinex homepage — perps feature description | feature_description | Trade perps in-app with up to 40x leverage | Communicate to a prospective user that the platform supports leveraged perpetual futures trading natively, and specify the maximum leverage multiplier available. | commanding | Perps are live in Infinex. Up to 25x leverage, same account, same passkey. | commanding | PASS | 2 | 0.18 |
| H16 | Infinex homepage — partner credit line | partner_credit | Powered by Hyperliquid | Inform the visitor that a named third-party protocol provides the underlying infrastructure for the product, establishing a verifiable technical dependency at a glance. | sociable | Powered by Hyperliquid | sociable | PASS | 0 | 1.00 |
| H17 | Infinex homepage — partner credit line | partner_credit | Powered by Polymarket | Tell the visitor which third-party platform supplies the underlying data or functionality for a specific feature on this surface, so they can attribute the source correctly. | sociable | Powered by Hyperliquid | sociable | PASS | 0 | 0.33 |
| H18 | Infinex homepage — trust footer line | trust_line | Your keys, secured by Turnkey | Reassure the visitor that their self-sovereign credential is protected by a named third-party security infrastructure provider, establishing accountability for custody at the bottom of the page. | sociable | Passkey infrastructure built with @Turnkey. | sociable | PASS | 1 | 0.17 |
| H19 | Infinex homepage — value prop label | value_prop | Phishing resistant security | Tell a visitor what specific threat vector the platform's security model is built to neutralize, so they understand the protection mechanism being offered, not just that the product is "secure". | commanding | Drainer-proof by design. | commanding | PASS | 0 | 0.00 |
| H20 | Infinex homepage — value prop label | value_prop | See what privileges you're granting | Prompt the user to inspect which permissions or access rights they are currently authorizing before proceeding. | commanding | Every approval, decoded before you sign. | commanding | PASS | 1 | 0.00 |

## Constraints extracted (per string)

- **H01**: `Homepage hero — the first and only line of primary copy a visitor reads`, `Single sentence or fragment; fits on one line at large display type`, `Must name or imply a product position or category claim, not a feature or an emotion`, `Imperative or declarative grammatical shape`, `No proper nouns or partner names required`
- **H02**: `Two words maximum`, `Noun phrase, not a full sentence`, `Names a product mechanic or structural outcome, not a feeling or emotion`, `Homepage value prop label — must stand alone as a scannable label without surrounding explanation`
- **H03**: `Noun phrase, not a full sentence`, `Names a product mechanic, not a feeling or outcome`, `Two to four words`, `Homepage value prop label — sits alongside peer labels in a list or grid`, `Must reference plurality of execution sources as a structural fact`
- **H04**: `Homepage value prop label`, `Two to four words maximum`, `Noun phrase — no verb required`, `Must name the security/protection mechanic or posture, not a feeling or outcome`, `Standalone label that pairs with sibling value prop labels in a list or grid`
- **H05**: `Primary CTA button on the homepage hero`, `Imperative verb phrase`, `Two to three words maximum`, `Must initiate a product acquisition or onboarding action, not describe a feature or feeling`
- **H06**: `section heading, not a hero`, `single sentence or fragment, fits one line at heading scale`, `must reference both the historical delivery record and the forward-looking roadmap as a unified scope`, `does not name a specific feature or release — names the scope of the section`, `no imperative verb required — declarative or invitational grammar both valid`
- **H07**: `section heading placement — sits above a grid or list of product capability items`, `short label: 2–4 words maximum`, `names the content type of the section (capabilities/mechanics), not a user feeling or outcome`, `no verb required — noun phrase is acceptable`
- **H08**: `Single sentence`, `Must name all three distinct product mechanics: (1) the sign-in/auth mechanism, (2) the transaction fee abstraction model, and (3) the count or scale of supported networks`, `The network count must appear as a specific number or bounded range, not a vague qualifier`, `Descriptive noun-phrase grammar (not imperative)`, `Homepage feature-description placement — subordinate to hero, above fold detail`
- **H09**: `Homepage product enumeration section`, `Lists discrete capability categories, not benefits or feelings`, `Must name both financial action types (e.g. trading mechanics, yield mechanics, forecasting) and infrastructure properties (e.g. provider breadth, network breadth)`, `Rendered as a flat, scannable list of short noun or noun-phrase items`, `Each item fits in one or two words`, `No full sentences`, `Six items total matching the six distinct concepts in the original`
- **H10**: `Homepage feature description surface`, `Short-form: fits 1–2 sentences or a punchy lead line plus a sub-clause`, `Must name the functional mechanic (bringing in external wallets) not just the resulting feeling`, `Must distinguish the capability tier from a lesser, read-only mode`, `Imperative or declarative grammar shape acceptable; must not read as a heading or navigation label`
- **H11**: `Single sentence`, `Homepage feature description — subordinate to hero, paired with a feature name or icon`, `Must reference two distinct capabilities: cross-platform compatibility and account portability`, `Names a product mechanic, not a feeling or outcome`, `No imperative verb required — declarative statement acceptable`
- **H12**: `homepage feature section — subordinate to hero, peer to other feature tiles`, `two sentences or fewer`, `sentence 1 must enumerate at least two distinct, named security mechanism tiers (specific product/protocol names, not category labels)`, `sentence 2 must assert that selection among those tiers is user-controlled`, `names actual security mechanisms, not outcomes or feelings`, `fits a single short feature card — no more than ~12 words total`
- **H13**: `single sentence`, `must name at least two distinct reward mechanics (a collectible/loot reward and a monetary rebate)`, `must name the triggering activity (trading)`, `homepage feature description placement`, `does not need to name the platform again if context is already established`
- **H14**: `Homepage hero — topmost positioning statement`, `Single noun phrase, no verb required`, `Must name the product category or container type (not a feature, not a feeling)`, `Conveys unified/all-in-one scope through structure or modifier`, `Fits on one line`, `Three to four words maximum`
- **H15**: `single sentence`, `must name the trading instrument category (perpetual futures / perps)`, `must state the maximum leverage ceiling as a numeric multiplier`, `must indicate the feature is available within the product itself (not via external redirect)`, `homepage feature description placement — sits alongside other feature bullets or cards`
- **H16**: `Two to four words total`, `Must name the specific partner/protocol by its proper noun`, `Must include a relational term that positions the partner as the foundational layer (not a sponsor or collaborator)`, `Appears inline or beneath a product element as a attribution label, not a headline`, `No verb conjugation — functions as a noun phrase or passive label`
- **H17**: `exactly two tokens: a relationship preposition/verb phrase followed by the partner's proper noun`, `must name the specific partner brand explicitly`, `must signal a dependency or supply relationship, not a generic association`, `single line, no punctuation beyond the brand name itself`, `homepage placement, subordinate to primary feature it annotates`
- **H18**: `homepage trust footer placement`, `single short line — approximately 4–6 words`, `must name the specific security infrastructure partner by brand name`, `must reference the user-owned credential/access primitive (not the platform generally)`, `declarative statement, not imperative or interrogative`, `names a concrete mechanic (who holds/protects what), not a feeling or outcome`
- **H19**: `homepage value prop label`, `names a concrete security property or mechanism, not a general feeling of safety`, `short label format — ideally 2–4 words, maximum one short phrase`, `must identify the category of attack or protection, not a product name or feature name`
- **H20**: `homepage value prop label`, `imperative or action-oriented phrasing directed at the user`, `references the permission/authorization mechanic, not a feeling or outcome`, `short label — fits a single line`, `must surface the concept of reviewing what is being approved or delegated`

## Summary

Total strings rewritten: 20
  - Passes (verifier agreed): 18
  - Fails (max attempts exhausted): 2
  - Mean retries: 0.65

## Possible context-poisoning candidates (similarity ≥ 0.60)

These rows converged too close to the shipped wording. Either the intent extractor leaked phrasing, the job description encoded the answer, or the surface only has one viable phrasing for this character — flag and review.

| ID | Similarity | Current text | Replacement text |
|---|---|---|---|
| H05 | 1.00 | Get Infinex | Get Infinex |
| H16 | 1.00 | Powered by Hyperliquid | Powered by Hyperliquid |

## Per-string attempt traces

### H01 — Infinex homepage — hero

- Job: hero
- Current text: "Change the way you crypto."
- Extracted intent: Tell a first-time visitor what Infinex's singular product position is, in one decisive line that defines the category shift the product represents for anyone who holds or moves digital assets.
- Constraints: `Homepage hero — the first and only line of primary copy a visitor reads`, `Single sentence or fragment; fits on one line at large display type`, `Must name or imply a product position or category claim, not a feature or an emotion`, `Imperative or declarative grammatical shape`, `No proper nouns or partner names required`
- Final: PASS (similarity 0.00)

#### Attempt 1

- Selected tempo: `commanding` — Pressing → Punching: a hero category claim needs sustained weight collapsed into a locked landing, and Commanding is the institutional drop that defines a position rather than describes a feature.
- Replacement text: "One account for everything onchain."
- Preserved intent: State Infinex's category position in one decisive hero line: it's the single account where you hold and move everything, replacing the wallet-plus-venues stack visitors currently live in.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: The line is a single locked declarative with no ornament, no warmth, no future-pull, and no partner framing. 'One account for everything onchain' issues a position without argument — the textbook Stable · Strong/Direct inner combo. Pressing prep ('one account', absolute scope) resolves into a Punching drop ('everything onchain'). No off-spec drive (Passion would require urgency/FOMO; none present). Fits Commanding cleanly.

### H02 — Infinex homepage — value prop label

- Job: value_prop
- Current text: "Unified portfolio."
- Extracted intent: Tell a homepage visitor what core problem Infinex solves for their assets — that previously scattered holdings are now accessible and managed in one place.
- Constraints: `Two words maximum`, `Noun phrase, not a full sentence`, `Names a product mechanic or structural outcome, not a feeling or emotion`, `Homepage value prop label — must stand alone as a scannable label without surrounding explanation`
- Final: PASS (similarity 0.00)

#### Attempt 1

- Selected tempo: `commanding` — Pressing → Punching: a two-word homepage label needs a locked, decisive noun phrase that lands as a structural fact, not a feeling.
- Replacement text: "One account."
- Preserved intent: Name the structural outcome — scattered holdings consolidated into a single accessible place — as a scannable two-word label.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: Bare declarative with zero ornament. The period after a two-word noun phrase is a textbook Pressing → Punching drop — sustained weight collapses into a single locked landing. Consistent with Stable · Strong/Direct inner combo. No off-spec drives activated.

### H03 — Infinex homepage — value prop label

- Job: value_prop
- Current text: "Multi-provider trading."
- Extracted intent: Tell a first-time visitor what core product mechanic Infinex offers by naming the structural feature that distinguishes how orders are executed across the platform.
- Constraints: `Noun phrase, not a full sentence`, `Names a product mechanic, not a feeling or outcome`, `Two to four words`, `Homepage value prop label — sits alongside peer labels in a list or grid`, `Must reference plurality of execution sources as a structural fact`
- Final: PASS (similarity 0.20)

#### Attempt 1

- Selected tempo: `commanding` — Pressing → Punching: a homepage value-prop label sits as a locked institutional noun phrase next to its peers, naming the mechanic with no ornament.
- Replacement text: "Multi-venue execution"
- Preserved intent: Label the structural mechanic — orders route across multiple execution sources — as a short noun phrase sitting in a homepage grid of value props.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: A bare noun phrase with no hedging, warmth, or narrative — pure Pressing into Punching. The institutional-drop feel of Commanding fits exactly: declarative, no ornament, says the thing and stops. Stable · Strong/Direct inner combo is embodied. Classified as unknown was considered given the brevity, but the motor shape is present even in compressed form — a two-word label can be fully Commanding.

### H04 — Infinex homepage — value prop label

- Job: value_prop
- Current text: "Serious Opsec."
- Extracted intent: Tell a homepage visitor that the platform treats user security and operational protection as a core, non-negotiable product attribute — not an afterthought.
- Constraints: `Homepage value prop label`, `Two to four words maximum`, `Noun phrase — no verb required`, `Must name the security/protection mechanic or posture, not a feeling or outcome`, `Standalone label that pairs with sibling value prop labels in a list or grid`
- Final: PASS (similarity 0.00)

#### Attempt 1

- Selected tempo: `commanding` — Pressing → Punching: a homepage value-prop label is a locked institutional drop — a two-word noun phrase naming the posture without ornament.
- Replacement text: "Security by default"
- Preserved intent: Label a homepage value-prop tile that names security as a built-in posture of the product, sitting cleanly next to other value-prop labels.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: The line is a locked, unornamented declarative — no qualifier, no warmth, no future-pull. 'By default' carries the Stable · Strong/Direct inner combo: the position is fixed and issued without negotiation. Motor shape is Pressing (sustained assertion of a stance) into Punching (the abrupt stop on 'default'). No Spell-Vision or irradiant float; no partner warmth; no wringing complexity. Commanding is the only tempo that fits a three-word institutional label of this weight.

### H05 — Infinex homepage — primary CTA

- Job: cta
- Current text: "Get Infinex"
- Extracted intent: Direct a homepage visitor to begin acquiring or activating access to the product.
- Constraints: `Primary CTA button on the homepage hero`, `Imperative verb phrase`, `Two to three words maximum`, `Must initiate a product acquisition or onboarding action, not describe a feature or feeling`
- Final: PASS (similarity 1.00)

#### Attempt 1

- Selected tempo: `commanding` — Pressing → Punching: a hero CTA button is the canonical decisive landing — sustained intent into a single locked action.
- Replacement text: "Get Infinex"
- Preserved intent: Push a homepage visitor into the acquisition/onboarding flow with a short imperative button label that initiates getting access to the product.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: Bare imperative with no hedging or warmth. Sustained pressure (Pressing) collapses into a decisive single-beat landing (Punching). No vision-pull, no social warmth, no wringing complexity — just a locked directive. Classic Commanding shape.

### H06 — Infinex homepage — section opener for shipped + upcoming

- Job: section_head
- Current text: "See everything we've shipped, and everything that's coming up"
- Extracted intent: Orient the visitor to a section that surfaces the full product timeline — both what has already been delivered and what is planned next — so they can assess progress and momentum at a glance.
- Constraints: `section heading, not a hero`, `single sentence or fragment, fits one line at heading scale`, `must reference both the historical delivery record and the forward-looking roadmap as a unified scope`, `does not name a specific feature or release — names the scope of the section`, `no imperative verb required — declarative or invitational grammar both valid`
- Final: PASS (similarity 0.14)

#### Attempt 1

- Selected tempo: `practical` — Wringing → slashing fits a section header that frames a unified scope across past and future — it carves one declarative line that holds both halves without ornament.
- Replacement text: "What we've shipped, and what's next."
- Preserved intent: Label a section that unifies the delivery record with the forward roadmap, so a visitor reads progress and momentum as one continuous scope.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: The line is a pure navigational label. There is no Sustained motor prep of any kind — no Wringing, Pressing, Floating — and therefore no Quick release can land. It reads as generic UI copy, sitting entirely outside the Spell-Vision / penetrating / flow-bound character placement. Closest surface motif is a light Gliding (smooth, frictionless delivery) but even that is too generous — there is no movement at all, just a signpost. Classified unknown.
- Verifier feedback: The line "What we've shipped, and what's next." reads as a neutral section label — a contents-page heading with no motor activity. It carries no Sustained prep (no Wringing or Pressing) and no Quick release (no Slashing). The Practical tempo requires working through complexity into a carved answer, with a "Karpathy essay mode" shape — even a short Practical line should carry the trace of a tradeoff being resolved or a reasoning thread being picked up. This line does none of that. It also carries no Spell-Vision drive (the character's primary drive); it is purely organisational. The shape is closer to a generic UI label than any available tempo. Rework options: (1) Stay with a section-opener that carries Practical's wringing prep, e.g. "Here's where things stand: what shipped, what's in progress, and why the order matters." (2) Accept that a section head here should be Commanding (pure declarative drop) and rewrite accordingly: "Shipped. What's next." (3) If the label must remain neutral, accept it as a deliberate self-contained beat and lean into that: "Quick map: shipped and upcoming."

#### Attempt 2

- Selected tempo: `commanding` — Section opener at heading scale wants Pressing → Punching: two locked declaratives that drop the full scope (delivered + planned) without ornament.
- Replacement text: "Shipped. And what's next."
- Preserved intent: Name the scope of a section that holds both the delivery record and the forward roadmap, as one unified beat, at heading scale.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: Two declarative fragments, zero ornament. 'Shipped.' is a locked, decisive drop — canonical Pressing → Punching motor. The pivot 'And what's next.' sustains the institutional weight rather than introducing warmth or vision-pull, keeping it firmly Stable · Strong/Direct. No off-spec drive activated.

### H07 — Infinex homepage — features section opener

- Job: section_head
- Current text: "Explore key features"
- Extracted intent: Orient the visitor to the start of a section that lists the product's primary capabilities, so they know what kind of information follows.
- Constraints: `section heading placement — sits above a grid or list of product capability items`, `short label: 2–4 words maximum`, `names the content type of the section (capabilities/mechanics), not a user feeling or outcome`, `no verb required — noun phrase is acceptable`
- Final: PASS (similarity 0.00)

#### Attempt 1

- Selected tempo: `commanding` — Pressing → Punching: a section label needs locked, decisive naming with no ornament — a ruler-style heading that names the content type.
- Replacement text: "What's inside"
- Preserved intent: A short, label-style section heading that tells the visitor the next block enumerates the product's primary capabilities — names the content type, no feeling or outcome language.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: The line is an interrogative label with no Sustained motor prep and no declarative landing. It drifts rather than presses, wrings, glides, or punches. No available tempo fits: Commanding requires Pressing → Punching; Self-Contained requires at least a confident declarative assertion. The copy reads as generic UI microcopy — outside the Infinex character entirely. No drive is activated; Spell-Vision requires either diagrammatic clarity or forward vision, neither of which a passive question can carry.
- Verifier feedback: The line "What's inside" reads as a soft, inward-facing question — it opens a door rather than planting a flag. Commanding tempo requires a Pressing → Punching motor: sustained declarative pressure landing in a decisive, locked release. A question-form opener with a possessive ("inside") signals receptivity or curiosity, not institutional authority. It activates no clear drive at all — it is closer to generic UI microcopy than Spell-Vision character. The line cannot be reconciled with Commanding or any other available Infinex tempo because it carries no Sustained prep whatsoever; it is a label that doesn't even reach the level of Self-Contained, which at minimum asserts something. Consider a short declarative that names what the section contains with authority: e.g. "Everything in one account." or "The full stack." — a Pressing shape that resolves on contact.

#### Attempt 2

- Selected tempo: `commanding` — Pressing → Punching: a section opener above a capability grid needs a locked declarative label that plants the flag for what follows, not a question or curiosity-tease.
- Replacement text: "The full stack."
- Preserved intent: Label the start of the capabilities/mechanics section with a short noun phrase that names the content type — what the product contains — so the visitor knows a list of primary capabilities follows.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: Pure nominal phrase — no verb, no warmth, no vision-pull. The full stop forces a hard landing (Punching release) after a compressed, locked prep (Pressing). Consistent with Stable · Strong/Direct inner combo. Reads as an institutional position-drop, exactly the section-head Commanding beat.

### H08 — Infinex homepage — wallet feature description

- Job: feature_description
- Current text: "Passkey-first, gas-abstracted wallet with support for 20+ chains."
- Extracted intent: Communicate to a prospective user what the wallet's three core technical properties are: its authentication method, its fee model, and its multi-network reach — so they can assess compatibility with their needs without clicking further.
- Constraints: `Single sentence`, `Must name all three distinct product mechanics: (1) the sign-in/auth mechanism, (2) the transaction fee abstraction model, and (3) the count or scale of supported networks`, `The network count must appear as a specific number or bounded range, not a vague qualifier`, `Descriptive noun-phrase grammar (not imperative)`, `Homepage feature-description placement — subordinate to hero, above fold detail`
- Final: FAIL (similarity 0.18)

#### Attempt 1

- Selected tempo: `practical` — Feature-description grammar with three mechanics to name needs Wringing → Slashing — working through the spec into a carved noun phrase, not a hero drop.
- Replacement text: "A passkey-secured wallet with gasless transactions across 9 networks."
- Preserved intent: Give a prospective user the three technical receipts — auth method, fee model, network reach — in one descriptive line they can scan to decide compatibility.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: The prose is a flat noun-phrase list: 'passkey-secured wallet with gasless transactions across 9 networks.' There is no Sustained prep and no Quick release — no motor pair from the available vocabulary fires. Gliding is the closest single motif (smooth, unaccented movement) but even that is not deliberate; the line is simply enumerating. This is generic marketing taxonomy, placing it squarely outside the Infinex character regardless of declared tempo. The Spell-Vision drive (diagram clarity, penetrating aspect) is entirely absent.
- Verifier feedback: This line reads as neutral product taxonomy — a spec sheet entry, not a character voice. It has no motor shape: there is no Sustained prep moving into a Quick release, which is required by every available tempo. The declared tempo is `practical`, but `practical` requires a Wringing → Slashing motor — working through complexity into a carved answer. This line doesn't work through anything; it simply enumerates attributes. It also carries no Spell-Vision drive (the character's core drive axis), no penetrating aspect, and no stable inner attitude expressed through weight or commitment. It could appear on any SaaS homepage. Rewrite toward a tempo that fits the character: e.g. `commanding` ("One passkey. Gasless across 9 networks. No gas management, no approvals theatre.") or `sombre`/`irradiant` if a longer beat is needed. The feature description job doesn't exempt the line from having a motor shape — even a two-clause Commanding line would pass.

#### Attempt 2

- Selected tempo: `commanding` — Pressing → Punching: sustained passkey/gasless setup pressing into a decisive 9-network landing, fitting a homepage feature beat that needs to read as a stated position, not a spec list.
- Replacement text: "One passkey, gasless by default, one account across 9 networks."
- Preserved intent: State the wallet's three core mechanics — passkey auth, abstracted/gasless fees, and a concrete count of supported networks — in a single noun-phrase line a prospective user can assess at a glance under the hero.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: The prose glides across three coordinate clauses of equal weight and lands nowhere — a Gliding → Dabbing shape that is closest to self-contained, but the line lacks the confident-light 'says the obvious well' quality of that tempo and reads instead as neutral product taxonomy. No Pressing → Punching motor pair is present, so Commanding cannot be assigned. The cumulative effect is a spec-sheet enumeration outside any Infinex character tempo.
- Verifier feedback: The line reads as a feature-spec bullet — a flat enumeration of attributes ("one passkey", "gasless by default", "one account across 9 networks") with no Pressing → Punching motor shape. Commanding tempo requires a sustained-pressure setup that lands into a decisive release. Here the three clauses carry equal weight, none of them builds toward a landing, and the whole thing reads as a spec sheet rather than a position. The specific claim "9 networks" also introduces a hard factual risk: no deployed_facts or fact_context are provided to verify the network count, so this number cannot be confirmed. Rewrite options: (a) Lead with a declarative fact-drop in true Commanding shape — e.g. "One passkey. One account. Nine networks, no gas." — isolating each claim as its own punching beat rather than a comma-chained list. (b) Verify the "9 networks" figure against confirmed deployed facts before publishing. (c) If the intent is a dry taxonomy label rather than a position, consider self-contained tempo instead and strip the specific count until it can be confirmed.

#### Attempt 3

- Selected tempo: `commanding` — Pressing → Punching: stacked declaratives each landing as their own beat fits a homepage feature block that needs to state three product mechanics as positions, not a comma-chained spec list.
- Replacement text: "One passkey. No gas. Nine networks, one account."
- Preserved intent: Tell a prospective user the wallet's three core properties — passkey auth, gas abstraction, and multi-network reach with a concrete count — in a single homepage-grade descriptive line below the hero.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: Three staccato fragments with no sustained Pressing prep. Each clause lands as a light dab rather than building into a single Punching release. The motor is closer to Gliding → Dabbing (self-contained) or even generic marketing copy. No single sustained build exists, so no Pressing → Punching pair can be read here. Classified unknown because the overall shape is tagline enumeration — outside the Infinex character's Spell-Vision drive — rather than the locked, decisive institutional drop that Commanding requires.
- Verifier feedback: The line is structurally close to Commanding but the cumulative effect reads more as marketing-tagline than institutional-drop. The core issue is voice, not facts. "Nine networks, one account" introduces a specific factual claim ("nine networks") that is not present in deployed_facts or fact_context and cannot be verified — this is a hard fail on factual grounding. Additionally, the staccato list-of-features shape ("One passkey. No gas. Nine networks, one account.") pulls toward a benefits-enumeration pattern more consistent with generic product marketing than the Commanding motor (Pressing → Punching), which demands a single sustained prep resolving into a decisive landing. Three consecutive micro-sentences diffuse the Pressing prep rather than building it. The line would read more convincingly Commanding if it collapsed into a single declarative with one punching release.

### H09 — Infinex homepage — product enumeration

- Job: feature_description
- Current text: "Swap. Perps. Earn. Predict. Multi-provider. Multi-chain."
- Extracted intent: Tell a first-time visitor which core product capabilities and infrastructure dimensions are available on the platform, so they can immediately assess whether it covers their trading and yield needs.
- Constraints: `Homepage product enumeration section`, `Lists discrete capability categories, not benefits or feelings`, `Must name both financial action types (e.g. trading mechanics, yield mechanics, forecasting) and infrastructure properties (e.g. provider breadth, network breadth)`, `Rendered as a flat, scannable list of short noun or noun-phrase items`, `Each item fits in one or two words`, `No full sentences`, `Six items total matching the six distinct concepts in the original`
- Final: PASS (similarity 0.15)

#### Attempt 1

- Selected tempo: `commanding` — Pressing → Punching: a flat enumeration of capability labels reads as locked, declarative position-taking — each item lands like an institutional drop, not a benefit pitch.
- Replacement text: "Perps. Spot. Yield. Prediction markets. Every chain. Every venue."
- Preserved intent: Give a first-time visitor a scannable, no-ornament list of what Infinex covers — naming both the financial actions (perps, spot, yield, prediction markets) and the infrastructure reach (network breadth, venue/provider breadth) — so they can decide in one glance whether it spans their needs.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: Each clause is a single declarative drop with zero sustain — pure Punching release. The rhythm is locked and decisive: no warmth, no ornament, no partner acknowledgement. The series of bare nouns accumulates pressure (Pressing) and each period is the decisive landing (Punching). Fully consistent with Stable · Strong/Direct inner combo and the penetrating aspect enumerating the full scope of the product surface.

### H10 — Infinex homepage — wallet import feature

- Job: feature_description
- Current text: "More than view-only. Import or connect existing wallets and take control."
- Extracted intent: Tell a visitor what the wallet import feature enables them to do with their existing wallets — specifically that it goes beyond passive read access and grants active, full capability over those wallets within the product.
- Constraints: `Homepage feature description surface`, `Short-form: fits 1–2 sentences or a punchy lead line plus a sub-clause`, `Must name the functional mechanic (bringing in external wallets) not just the resulting feeling`, `Must distinguish the capability tier from a lesser, read-only mode`, `Imperative or declarative grammar shape acceptable; must not read as a heading or navigation label`
- Final: PASS (similarity 0.10)

#### Attempt 1

- Selected tempo: `irradiant` — Floating → flicking fits a homepage feature beat where the lift is "your existing wallets, now fully usable here" — vision-pulled capability, not an institutional drop.
- Replacement text: "Bring your existing wallets into Infinex and actually use them — sign, send, trade, not just watch balances tick."
- Preserved intent: Tell a homepage visitor that wallet import pulls their outside wallets into Infinex with full active control, not the read-only view they'd expect from a portfolio tracker.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: The imperative opener ('Bring…') has a pressing quality, but the corrective contrast ('not just watch balances tick') breaks any clean Sustained → Quick motor resolution. The line reads as Passion-pulled — it leans on the implication that the user is currently doing something lesser, which is urgency/FOMO framing. That disqualifies irradiant (no floating prep, no vision-warmth) and sits awkwardly inside commanding (which stays declarative, not corrective). No available tempo cleanly holds both the imperative and the shame-of-inaction contrast, so 'unknown' is the correct classification.
- Verifier feedback: The line fails on voice. The declared tempo is irradiant, but the prose doesn't carry irradiant's floating → flicking motor or its vision-pulled, future-warmth character. Instead, it reads as a direct imperative — "Bring … and actually use them" — with a mild urgency/frustration undertone ("actually use them", "not just watch balances tick"). That "actually" + corrective contrast ("not just…") activates a Passion-adjacent drive: it implies the user is currently failing or missing out, which is urgency/FOMO framing. That is off-spec for this character (Passion is listed as an off-spec drive). The line also lacks any sustained prep before a quick release — there is no floating or gliding setup that resolves into a flick. The closest reconcilable tempo would be commanding (pressing → punching) given the imperative opening, but the corrective "not just watch balances tick" pulls it off even that, because commanding stays locked and declarative rather than contrasting against a diminished prior state. The line ends up between tempi and carries a Passion pulse neither irradiant nor commanding can hold.

#### Attempt 2

- Selected tempo: `commanding` — Pressing → Punching: a homepage feature description for a shipped capability lands as a locked declarative fact about what's now possible inside the account.
- Replacement text: "Your existing wallets are live in Infinex. Bring them in and sign, send, and trade from the same account."
- Preserved intent: Tell a homepage visitor that external wallets can be imported into Infinex and operated with full signing capability — not merely viewed — from inside the same account.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: Opens with a declarative fact-drop ('are live') — the canonical Pressing prep of the Commanding motor — then pivots immediately to short, stacked imperatives ('Bring them in and sign, send, and trade') which carry the Punching release. Inner combo is Stable · Strong/Direct throughout; no vision-pull, no warmth, no complexity. Fully reconcilable with Commanding.

### H11 — Infinex homepage — wallet connectivity feature

- Job: feature_description
- Current text: "Connect securely to any dapp and take your account with you."
- Extracted intent: Explain to a prospective user that their Infinex account is portable and works with the broader decentralized application ecosystem, without requiring repeated setup or losing access to their assets.
- Constraints: `Single sentence`, `Homepage feature description — subordinate to hero, paired with a feature name or icon`, `Must reference two distinct capabilities: cross-platform compatibility and account portability`, `Names a product mechanic, not a feeling or outcome`, `No imperative verb required — declarative statement acceptable`
- Final: PASS (similarity 0.09)

#### Attempt 1

- Selected tempo: `commanding` — Pressing → Punching fits a homepage feature label: a flat, declarative statement of a shipped mechanic, paired with an icon, with no ornament.
- Replacement text: "One account, one passkey — connects to any dapp, travels with you across the ecosystem."
- Preserved intent: Tell a prospective user that their Infinex account is portable across the wider dapp ecosystem and doesn't need to be re-set-up or re-funded somewhere else — naming the mechanic (one account/passkey that connects out) rather than selling a feeling.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: The prose opens with a near-Pressing shape ('One account, one passkey') but the second clause 'travels with you across the ecosystem' pulls to Floating → Gliding — buoyant, drifting, relational warmth. No clean Sustained → Quick motor pair is present: the punch never lands. The cumulative movement reads as generic marketing rather than any defined Infinex tempo. Closest misfire is Irradiant (Floating → Flicking) but even that requires a vision-future frame, which is absent. Classified as unknown.
- Verifier feedback: The line aims for Commanding but lands closer to Irradiant or generic marketing copy. Commanding requires Pressing → Punching motor: a sustained declarative weight that drops into a decisive, locked release ("Today: X is live." / "X is ready."). This line instead floats — "travels with you across the ecosystem" carries a buoyant, vision-warmth movement that is Floating → Flicking, not Pressing → Punching. The phrase "travels with you across the ecosystem" also activates a light relational warmth inconsistent with the institutional-ruler register of Commanding. Additionally, "ecosystem" reads as generic marketing filler — it names no specific thing and softens the penetrating aspect of the character. The opening shape "One account, one passkey —" is close to a Commanding drop, but the trailing clause dissolves the lockedness before the punch lands. Rewrite suggestion: Keep the opener, kill the drift. Example: "One account. One passkey. Works with any dapp." — or lean into a full Commanding shape: "One passkey. Every dapp. No new accounts."

#### Attempt 2

- Selected tempo: `commanding` — Homepage feature description paired with a label needs Pressing → Punching: sustained declarative weight that locks into a hard release, naming the mechanic without drift.
- Replacement text: "One passkey. Every dapp. No new accounts."
- Preserved intent: Tell a prospective user that their Infinex account is portable across the dapp ecosystem and doesn't require re-setup or re-onboarding to access their assets elsewhere.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: Each clause lands as a locked, direct declaration with no qualification or warmth — the classic Stable · Strong/Direct inner combo expressed as a staccato Pressing → Punching sequence. 'One passkey.' sets the weight, 'Every dapp.' expands the claim, 'No new accounts.' delivers the punching release. No floating, no sustained vision-pull, no social warmth — pure institutional drop.

### H12 — Infinex homepage — security tier feature

- Job: feature_description
- Current text: "Passkey to Ledger to Safe. Choose the Opsec to suit your spec."
- Extracted intent: Inform a visitor that the platform supports a spectrum of security configurations, from lightweight to institutional-grade, and that the user controls which level they adopt.
- Constraints: `homepage feature section — subordinate to hero, peer to other feature tiles`, `two sentences or fewer`, `sentence 1 must enumerate at least two distinct, named security mechanism tiers (specific product/protocol names, not category labels)`, `sentence 2 must assert that selection among those tiers is user-controlled`, `names actual security mechanisms, not outcomes or feelings`, `fits a single short feature card — no more than ~12 words total`
- Final: PASS (similarity 0.00)

#### Attempt 1

- Selected tempo: `practical` — Wringing → slashing: a feature tile enumerating named tiers and naming the tradeoff (you choose) carves through complexity into a clean user-controlled answer.
- Replacement text: "Passkeys, MPC, hardware wallets, multi-sig. You pick the tier."
- Preserved intent: Tell a homepage visitor that Infinex spans a range of named security mechanisms and that choosing among them is the user's call.
- Verifier tempo: `self-contained` (FAIL)
- Verifier rationale: The prose performs a smooth inventory glide across four items and lands with a light, unburdened choice prompt ('You pick the tier'). That is a classic Gliding → Dabbing self-contained shape: confident-light, no push, says the obvious well. There is no sustained wringing through complexity, no carved answer, no named tradeoff — the hallmarks of practical's Wringing → Slashing motor are entirely absent.
- Verifier feedback: The line is a clean taxonomy drop — it lists four security options and closes with a choice prompt. That shape is self-contained (Gliding → Dabbing), not practical (Wringing → Slashing). Practical requires working through complexity, naming tradeoffs, and carving toward a reasoned answer. None of that is present here. The declared tempo is mismatched. Rewrite toward self-contained ("Four security tiers: passkeys, MPC, hardware wallets, multi-sig. Pick the one that fits.") or, if genuine practical copy is needed, add the reasoning layer — what the tradeoff between tiers actually is, and why someone would choose one over another.

#### Attempt 2

- Selected tempo: `commanding` — Pressing → Punching fits a hero-adjacent feature tile: a locked enumeration of named mechanisms landing on a decisive control statement.
- Replacement text: "Passkeys, MPC, hardware wallets, multi-sig. You pick the tier."
- Preserved intent: Tell a homepage visitor that Infinex supports a range of named security mechanisms and that the user chooses which one is active.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: The stacked noun catalogue (Passkeys, MPC, hardware wallets, multi-sig) functions as a sustained Pressing build — no verb, no ornament, pure accumulation of weight. 'You pick the tier.' is a clean Punching release: short, declarative, locked. The inner combo reads Stable · Strong/Direct. No vision-warmth (not irradiant), no partner framing (not sociable), no working-through-complexity (not practical). Commanding fits well.

### H13 — Infinex homepage — rewards feature

- Job: feature_description
- Current text: "Switch to Infinex and earn crates and cashback on every trade."
- Extracted intent: Tell a visitor what tangible incentives they receive for trading on the platform, naming both the reward types and the trigger action.
- Constraints: `single sentence`, `must name at least two distinct reward mechanics (a collectible/loot reward and a monetary rebate)`, `must name the triggering activity (trading)`, `homepage feature description placement`, `does not need to name the platform again if context is already established`
- Final: FAIL (similarity 0.00)

#### Attempt 1

- Selected tempo: `irradiant` — Floating → flicking: a homepage feature blurb about rewards should glide through the mechanics and land light, generous, vision-pulled — not press down with institutional weight.
- Replacement text: "Trade to earn Patron Passes and fee rebates — loot drops alongside money back, both flowing from the same activity."
- Preserved intent: Tell a homepage visitor that trading is the trigger and that it yields two distinct rewards — a collectible (Patron Passes) and a monetary rebate (fees back) — in one sentence.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: The opening imperative 'Trade to earn' is a Pressing → Punching shape — locked behavioural instruction with a reward payload. That motor pair maps to commanding or egocentric, but the register is neither cool/institutional nor conviction-weighted; it is incentive-hype, which activates the off-spec Passion drive. 'Loot drops' confirms this: the phrase exists purely to generate excitement-urgency. No Floating sustained phase precedes any Flicking release, so irradiant is not achievable from this structure. The line sits outside the character's available tempi.
- Verifier feedback: This line carries a Passion-pull, not the Spell-Vision drive that defines this character. "Trade to earn" is urgency/incentive framing — it positions the reader as someone who should act now to capture a reward, which is classic FOMO/hype theatre. "Loot drops" amplifies this: it borrows gaming-dopamine vocabulary whose entire rhetorical function is excitement-as-motivation, not vision-as-invitation. The phrase "both flowing from the same activity" tries to land with a light irradiant touch but the prep is wrong — there's no Floating sustained phase before the Flicking release; instead the line opens with a direct behavioural call-to-action ("Trade to earn") which is Pressing/Punching in structure, not Floating/Flicking. The cumulative effect is an incentive-hype register inconsistent with Spell-Vision (Diagram D). Rewrite toward the irradiant shape: open with a future-state or capability statement ("What this lets you do: …"), let the rewards emerge as a consequence of participation rather than a carrot, and drop "loot drops" in favour of vocabulary that lands inside the character's motor vocabulary (floating → flicking, generous/vision-pulled).

#### Attempt 2

- Selected tempo: `irradiant` — Floating → flicking: a sustained capability statement lets the two reward mechanics arrive as consequences of trading, not as carrots — vision-pulled, not incentive-hype.
- Replacement text: "Trading on Infinex accrues Patron Passes and fee rebates in the background — same activity, two things that stack."
- Preserved intent: Tell a homepage visitor that trading on Infinex produces two distinct rewards — a collectible (Patron Passes) and a monetary rebate (fee rebates) — in a single sentence, naming the triggering activity.
- Verifier tempo: `self-contained` (FAIL)
- Verifier rationale: The prose states a fact plainly and closes with a tidy summary clause ('two things that stack'). That Gliding → Dabbing shape — smooth delivery, light landing — matches self-contained. There is no sustained vision-warmth or future-pull required by irradiant, and no pressing weight required by commanding. The 'in the background' phrase adds mild colour but not enough to shift the motor.
- Verifier feedback: The line is trying to sit in irradiant but the motor doesn't fire correctly. Irradiant runs Floating → Flicking: a sustained vision-warmth prep that releases into a buoyant, future-pulled flick. This line has neither. There's no future-tense agent framing, no "what this lets you do" generosity, no warmth of arrival. Instead it reads as a dry informational statement — closer to self-contained (Gliding → Dabbing) — and even there it undershoots because the "stack" framing nudges toward a mild Spell-Vision diagram feel without the sustained prep that would make it land. The phrase "in the background" is the closest thing to character colour but it's not enough to carry irradiant. Rewrite options: lean into irradiant by foregrounding the agent/future-state ("A few months from now your account is earning Patron Passes and stacking fee rebates while you trade — same activity, two returns.") or drop to self-contained and make it a clean informational note ("Something to note: trading accrues both Patron Passes and fee rebates. Same activity, two things that stack.").

#### Attempt 3

- Selected tempo: `irradiant` — Floating → Flicking fits a homepage feature beat where the reward is something you accrue without thinking about it — sustained future-warmth releasing into a light buoyant landing.
- Replacement text: "What this lets you do: keep trading, and your account is already collecting Patron Passes and stacking fee rebates in the background — one activity, two returns showing up on their own."
- Preserved intent: Tell a homepage visitor that the act of trading quietly earns them two distinct rewards — collectible Patron Passes and monetary fee rebates — without requiring any separate action.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: The opening 'What this lets you do:' is a classic irradiant prep shape (floating), but the sustained lightness collapses before the release. The back half — 'stacking fee rebates,' 'two returns showing up on their own' — carries a Passion-pulled urgency and reward-stacking drive inconsistent with Spell-Vision. No clean Floating → Flicking arc completes: the landing is not buoyant vision-arrival but a sales tally. The cumulative drive reads closer to Passion than Spell-Vision, disqualifying irradiant and leaving no other tempo that fits the full shape.
- Verifier feedback: The line opens with a genuine irradiant shape ("What this lets you do:") and the floating prep is present. However, the back half of the line drifts into off-spec Passion territory: "stacking fee rebates," "two returns showing up on their own" carries a reward-accumulation / yield-FOMO urgency that activates Passion's scarcity-of-attention and hype-theatre framing rather than Spell-Vision's calm, diagram-like future pull. Irradiant should feel buoyant and generous — a vision of ease — not a ledger of gains compounding. The phrase "one activity, two returns" especially reads as a value-stacking sales beat, which is Passion-driven. Additionally, "Patron Passes" and "fee rebates" are unverified against any deployed_facts, making these soft-warn factual issues. Rewrite suggestion: keep the "What this lets you do:" opener, describe the background activity in terms of effortless continuity (floating → flicking), and drop the compounding-rewards framing. E.g. "What this lets you do: trade the way you already trade. Patron Passes and fee rebates arrive in the background — you don't manage them, they just accumulate."

### H14 — Infinex homepage — top-level positioning line

- Job: positioning
- Current text: "One super app."
- Extracted intent: Tell a first-time visitor what Infinex is by naming its product category in a single definitive fragment that establishes its scope and singular nature.
- Constraints: `Homepage hero — topmost positioning statement`, `Single noun phrase, no verb required`, `Must name the product category or container type (not a feature, not a feeling)`, `Conveys unified/all-in-one scope through structure or modifier`, `Fits on one line`, `Three to four words maximum`
- Final: PASS (similarity 0.00)

#### Attempt 1

- Selected tempo: `commanding` — Pressing → Punching: a homepage positioning fragment needs to land as a locked institutional statement of category, not a vision tease.
- Replacement text: "The everything account."
- Preserved intent: Name Infinex's category in one short, definitive noun phrase that signals unified scope to a first-time visitor.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: A single, locked noun phrase with zero ornament. The definite article 'The' acts as a Pressing sustain — it selects and holds — and 'everything account' lands as the Punching release: decisive, institutional, no qualification. No vision-warmth (not irradiant), no partner framing (not sociable), no emotional weight (not overpowering). Perfectly consistent with Stable · Strong/Direct inner combo.

### H15 — Infinex homepage — perps feature description

- Job: feature_description
- Current text: "Trade perps in-app with up to 40x leverage"
- Extracted intent: Communicate to a prospective user that the platform supports leveraged perpetual futures trading natively, and specify the maximum leverage multiplier available.
- Constraints: `single sentence`, `must name the trading instrument category (perpetual futures / perps)`, `must state the maximum leverage ceiling as a numeric multiplier`, `must indicate the feature is available within the product itself (not via external redirect)`, `homepage feature description placement — sits alongside other feature bullets or cards`
- Final: PASS (similarity 0.18)

#### Attempt 1

- Selected tempo: `commanding` — Pressing → Punching fits a homepage feature card: a locked, factual landing that states the instrument and the ceiling without ornament.
- Replacement text: "Perps are live in Infinex, up to 50x leverage."
- Preserved intent: Tell a prospective user that perpetual futures trade natively inside Infinex and name the maximum leverage multiplier, in a single homepage-feature-sized line.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: The opening 'Perps are live in Infinex' has the Pressing → Punching motor shape of Commanding, but 'up to 50x leverage' appended as a spec-ceiling pulls the line into generic marketing taxonomy — no sustained preparation, just a hype figure dropped as a hook. The cumulative read sits outside the character's Spell-Vision drive and lands closer to Passion-pulled promotional copy. Classified unknown because the motor pair breaks before completion.
- Verifier feedback: The line reads as a features-grid blurb rather than a Commanding drop. "Up to 50x leverage" is a leverage-spec claim with no deployed_facts or fact_context to support it — that's a hard factual fail. On voice: the phrase "up to 50x leverage" activates the Passion off-spec drive (urgency/hype theatre around a scarcity-of-attention number), pulling the prose away from the character's Spell-Vision drive. A Commanding line should land with institutional weight (Pressing → Punching) on a verified fact, not a spec ceiling. Rewrite suggestion: strip the unverified leverage figure and ground the line in a verified shipped state, e.g. "Perps are live in Infinex." — or add the leverage fact to deployed_facts and reframe without the "up to" hype shape.

#### Attempt 2

- Selected tempo: `commanding` — Pressing → Punching: a homepage feature card needs a locked institutional drop stating the perps venue lives inside Infinex, with the leverage figure landing as a plain fact, not a hype ceiling.
- Replacement text: "Perps are live in Infinex, with 50x leverage available natively in the account."
- Preserved intent: Tell a homepage visitor that perpetual futures trade natively inside Infinex (no external redirect) and that 50x leverage is supported — sitting as one feature line among other feature cards.
- Verifier tempo: `commanding` (FAIL)
- Verifier rationale: Opens with a live-state declaration ('Perps are live in Infinex') which is a clean Pressing → Punching Commanding shape. However the trailing clause 'with 50x leverage available natively in the account' softens the punch with an explanatory qualifier, pulling the motor toward a glide rather than a decisive landing. The intent is Commanding but execution is only partially realised.
- Verifier feedback: The line has a factual issue and a voice issue. (1) FACTUAL: "50x leverage" is a specific claim not present in deployed_facts or fact_context — this cannot be verified and must be removed or supplied with a confirmed source. (2) VOICE: The phrase "available natively in the account" dilutes the Pressing → Punching motor. Commanding lands hard and stops; the qualifier softens the punch. Strip it or recast as a second declarative. Suggested rewrite: "Perps are live in Infinex. 50x leverage, same account, same passkey." — but only if the 50x figure can be confirmed.

#### Attempt 3

- Selected tempo: `commanding` — Pressing → Punching fits a homepage feature card: a locked institutional drop that states the capability and the ceiling without ornament.
- Replacement text: "Perps are live in Infinex. Up to 25x leverage, same account, same passkey."
- Preserved intent: Tell a prospective user that perpetual futures trading is available inside Infinex itself, and name the maximum leverage multiplier — as a homepage feature line.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: Opens with a declarative fact drop ('Perps are live in Infinex') — classic Pressing sustained setup — then lands two staccato noun phrases ('same account, same passkey') as the Punching release. No ornament, no warmth, no vision-pull. Inner combo reads Stable · Strong/Direct throughout. Aligns squarely with the Commanding motor pair.

### H16 — Infinex homepage — partner credit line

- Job: partner_credit
- Current text: "Powered by Hyperliquid"
- Extracted intent: Inform the visitor that a named third-party protocol provides the underlying infrastructure for the product, establishing a verifiable technical dependency at a glance.
- Constraints: `Two to four words total`, `Must name the specific partner/protocol by its proper noun`, `Must include a relational term that positions the partner as the foundational layer (not a sponsor or collaborator)`, `Appears inline or beneath a product element as a attribution label, not a headline`, `No verb conjugation — functions as a noun phrase or passive label`
- Final: PASS (similarity 1.00)

#### Attempt 1

- Selected tempo: `sociable` — Partner credit attribution → Gliding → Dabbing: a light, smooth touch that names the foundational partner without taking the stage.
- Replacement text: "Powered by Hyperliquid"
- Preserved intent: A short attribution label that names the third-party protocol as the underlying infrastructure layer, sitting beneath a product element as a noun phrase.
- Verifier tempo: `sociable` (PASS)
- Verifier rationale: The line performs a smooth, low-pressure partner acknowledgement — exactly the Gliding → Dabbing motor of Sociable. It doesn't press, slash, or carry vision-weight; it simply credits the partner with a light touch. No Spell-Vision drive activated, no Passion urgency. Short label form is consistent with the 'partner credit' surface. Confidence is moderate rather than high because the line is so minimal that it sits at the boundary of Sociable and Self-Contained (a pure label could fit either), but the explicit partner-naming tips it to Sociable.

### H17 — Infinex homepage — partner credit line

- Job: partner_credit
- Current text: "Powered by Polymarket"
- Extracted intent: Tell the visitor which third-party platform supplies the underlying data or functionality for a specific feature on this surface, so they can attribute the source correctly.
- Constraints: `exactly two tokens: a relationship preposition/verb phrase followed by the partner's proper noun`, `must name the specific partner brand explicitly`, `must signal a dependency or supply relationship, not a generic association`, `single line, no punctuation beyond the brand name itself`, `homepage placement, subordinate to primary feature it annotates`
- Final: PASS (similarity 0.33)

#### Attempt 1

- Selected tempo: `sociable` — Partner credit on a homepage annotation is exactly the gliding → dabbing beat — a light, smooth acknowledgement that the feature depends on a named external supplier.
- Replacement text: "Powered by Hyperliquid"
- Preserved intent: Attribute the underlying feature to its third-party supplier in two tokens — a dependency verb plus the partner's proper noun — sitting quietly under the feature it annotates.
- Verifier tempo: `sociable` (PASS)
- Verifier rationale: A bare attribution label — smooth, light, no pressure. Gliding approach (no friction, no argument) resolved in a light social touch (dabbing) that credits the partner without ceremony. No Spell-Vision or Passion pull detectable. Fits Sociable's Remote-outer / Direct-Free inner combo at low intensity, which is appropriate for a static credit line rather than a launch post.

### H18 — Infinex homepage — trust footer line

- Job: trust_line
- Current text: "Your keys, secured by Turnkey"
- Extracted intent: Reassure the visitor that their self-sovereign credential is protected by a named third-party security infrastructure provider, establishing accountability for custody at the bottom of the page.
- Constraints: `homepage trust footer placement`, `single short line — approximately 4–6 words`, `must name the specific security infrastructure partner by brand name`, `must reference the user-owned credential/access primitive (not the platform generally)`, `declarative statement, not imperative or interrogative`, `names a concrete mechanic (who holds/protects what), not a feeling or outcome`
- Final: PASS (similarity 0.17)

#### Attempt 1

- Selected tempo: `sociable` — Gliding → dabbing: the line exists to credit a named security partner who holds the credential, so the social-touch tempo carries the partner attribution naturally.
- Replacement text: "Passkeys secured with Turnkey."
- Preserved intent: A footer trust line that names the third-party infrastructure partner protecting the user-owned passkey credential — concrete mechanic, not vibes.
- Verifier tempo: `self-contained` (FAIL)
- Verifier rationale: The line is a compact, unornamented noun phrase — 'Passkeys secured with Turnkey.' It carries no sustained prep motor; it simply lands a small informational fact with a light touch. That matches self-contained (gliding → dabbing) used as a one-off label drop, not the relational warmth and smooth partner-approach of sociable. Sociable requires a gliding approach with visible partner-credit dynamics; this line skips the approach entirely.
- Verifier feedback: The declared tempo is "sociable," but the prose carries none of sociable's motor signature (gliding → dabbing, partner-credit warmth, smooth approach). The line is a flat noun phrase — no partner acknowledgment framing, no "working with," no relational warmth. It reads closer to a self-contained label or a commanding stamp. If the intent is to credit Turnkey as a partner, rewrite using sociable's opening shapes: e.g. "Passkeys secured with @Turnkey." with explicit partner-credit framing in context, or "Built on @Turnkey for passkey security." The current form is too stripped to carry sociable's gliding prep — it's just a taxonomy label. Additionally, no deployed_facts or fact_context are supplied to verify the Turnkey claim, which is a soft warn rather than a hard fail (the claim is plausible and widely known, but unverifiable in this audit context).

#### Attempt 2

- Selected tempo: `sociable` — Gliding → dabbing fits a footer that credits a named security partner for custody of the user's passkey — the approach names the partner, the landing names what they hold.
- Replacement text: "Passkey infrastructure built with @Turnkey."
- Preserved intent: A footer trust line that names Turnkey as the security infrastructure partner protecting the user-owned passkey, establishing concrete custody accountability.
- Verifier tempo: `sociable` (PASS)
- Verifier rationale: The line performs a smooth approach (gliding) with a light social touch landing on the partner credit (dabbing). 'Built with @Turnkey' is the canonical Sociable opener shape — no sustained pressure, no vision-pull, no urgency. Fits Remote outer · Direct/Free inner combo. Confidence slightly below top because the line is minimal enough that it could also read as self-contained, but the explicit partner attribution tips it into sociable.

### H19 — Infinex homepage — value prop label

- Job: value_prop
- Current text: "Phishing resistant security"
- Extracted intent: Tell a visitor what specific threat vector the platform's security model is built to neutralize, so they understand the protection mechanism being offered, not just that the product is "secure".
- Constraints: `homepage value prop label`, `names a concrete security property or mechanism, not a general feeling of safety`, `short label format — ideally 2–4 words, maximum one short phrase`, `must identify the category of attack or protection, not a product name or feature name`
- Final: PASS (similarity 0.00)

#### Attempt 1

- Selected tempo: `commanding` — Pressing → Punching: a homepage value-prop label needs a locked, decisive landing that names the threat category in one breath.
- Replacement text: "Drainer-proof by design."
- Preserved intent: Name the specific attack class Infinex's security model neutralizes (wallet drainers / malicious signature attacks) in a short homepage label, so visitors understand the concrete protection mechanism rather than a vague "secure" claim.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: Pure declarative, zero ornament. 'By design' carries the locked, institutional weight of Pressing prep; the hard stop after 'design' delivers the Punching release. Inner combo reads Stable·Strong/Direct throughout. No urgency, no warmth, no partner framing — nothing pulls off Commanding.

### H20 — Infinex homepage — value prop label

- Job: value_prop
- Current text: "See what privileges you're granting"
- Extracted intent: Prompt the user to inspect which permissions or access rights they are currently authorizing before proceeding.
- Constraints: `homepage value prop label`, `imperative or action-oriented phrasing directed at the user`, `references the permission/authorization mechanic, not a feeling or outcome`, `short label — fits a single line`, `must surface the concept of reviewing what is being approved or delegated`
- Final: PASS (similarity 0.00)

#### Attempt 1

- Selected tempo: `commanding` — Pressing → Punching: a homepage label directing the user to inspect permissions needs a locked, decisive imperative, not vision-warmth or essay reasoning.
- Replacement text: "Review what you're approving."
- Preserved intent: A short homepage label that tells the user, in an imperative voice, to check the permissions/authorizations they're about to grant before proceeding — pointing at the approval mechanic itself, not at a feeling about safety.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: The line attempts a direct imperative but lands as a cautionary nudge rather than a locked institutional declaration. Pressing prep is absent — there is no factual load being sustained before a decisive release. The shape is closer to a safety warning or anxiety prompt, which pulls toward Passion (urgency/fear framing), an off-spec drive for this character. No Sustained → Quick motor pair fits cleanly; the Punching release would require a grounded factual claim, which is not present. Classified unknown.
- Verifier feedback: The line "Review what you're approving." reads as a user-instruction or safety-nudge directed at the reader — a cautionary imperative. This activates a Passion-adjacent anxiety framing (implicit risk/fear of mistake) rather than the Spell-Vision drive of the character. It cannot be reconciled with Commanding, which issues a position or announces a fact with locked, decisive energy (Pressing → Punching). There is no Pressing prep — no factual load — and the Punching release lands not as a declaration but as a warning. The line also drifts toward an unsupported implied claim (that Infinex surfaces something reviewable in a distinctive way) without any fact context to ground it. Rewrite as a factual declaration anchored in what the product actually shows — e.g. "Every approval, decoded before you sign." or "You see what you're signing before you sign it." — to carry Commanding motor with Spell-Vision drive.

#### Attempt 2

- Selected tempo: `commanding` — Homepage value-prop label needs a locked institutional declaration — Pressing factual load (every approval, decoded) into a Punching release (before you sign).
- Replacement text: "Every approval, decoded before you sign."
- Preserved intent: Surface, as a homepage value-prop label, the product mechanic that lets users inspect what permissions and access they are authorizing before they grant them.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: Short declarative with no ornament. 'Every approval' is the sustained press; 'decoded before you sign' is the decisive punching release — a locked, institutional drop of a protection guarantee. The penetrating aspect (cutting through opacity) and Spell-Vision drive (you understand before you act) are both active. No Passion urgency, no warmth, no partner framing. Fits Commanding squarely.

