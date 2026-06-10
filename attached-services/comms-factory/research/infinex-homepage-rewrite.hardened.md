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
| H01 | Infinex homepage — hero | hero | Change the way you crypto. | Tell a first-time visitor what Infinex's fundamental product position is in a single decisive line that names what the platform does differently, without describing how the user should feel about it. | irradiant | One account. Stop thinking about which chain, which venue, which asset. | irradiant | PASS | 1 | 0.00 |
| H02 | Infinex homepage — value prop label | value_prop | Unified portfolio. | Tell a homepage visitor what core problem Infinex solves for their assets — that all holdings across contexts are accessible and managed in one place. | commanding | Unified custody. | commanding | PASS | 0 | 0.33 |
| H03 | Infinex homepage — value prop label | value_prop | Multi-provider trading. | Tell a first-time visitor what core platform mechanic enables broader market access by naming the architectural feature (aggregation across multiple liquidity sources), not the outcome feeling. | commanding | One account. Every venue's liquidity. | commanding | PASS | 1 | 0.00 |
| H04 | Infinex homepage — value prop label | value_prop | Serious Opsec. | Tell a homepage visitor that Infinex treats the security of their assets and operations as a non-negotiable, first-class product commitment — named as a concrete capability, not a feeling. | commanding | Passkey-secured custody | commanding | PASS | 0 | 0.00 |
| H05 | Infinex homepage — primary CTA | cta | Get Infinex | Direct a homepage visitor to begin acquiring or activating access to the product. | commanding | Open account | commanding | PASS | 0 | 0.00 |
| H06 | Infinex homepage — section opener for shipped + upcoming | section_head | See everything we've shipped, and everything that's coming up | Orient the visitor to a section that surfaces both completed releases and the forward-looking roadmap in a single combined view. | commanding | Shipped this season. More already in the pipe. | commanding | PASS | 2 | 0.10 |
| H07 | Infinex homepage — features section opener | section_head | Explore key features | Orient the visitor to the start of a section that lists the product's defining capabilities, so they understand what the section contains before reading individual items. | commanding | One account. Every market. | commanding | PASS | 1 | 0.00 |
| H08 | Infinex homepage — wallet feature description | feature_description | Passkey-first, gas-abstracted wallet with support for 20+ chains. | Tell a prospective user what technical properties define the wallet, specifically its authentication method, fee model, and multi-network reach, so they can assess compatibility with their needs. | practical | Here's what one wallet actually means: a passkey signs every transaction, gas is abstracted away, and 20+ networks behave as one account. | practical | PASS | 1 | 0.21 |
| H09 | Infinex homepage — product enumeration | feature_description | Swap. Perps. Earn. Predict. Multi-provider. Multi-chain. | Tell a first-time visitor what categories of financial actions and infrastructure capabilities the platform covers, so they can self-assess whether it meets their needs before reading further. | commanding | One account. Spot, perps, yield, stablecoins, smart routing, every chain — all of it. | unknown | FAIL | 2 | 0.13 |
| H10 | Infinex homepage — wallet import feature | feature_description | More than view-only. Import or connect existing wallets and take control. | Tell a visitor what the wallet import feature enables them to do with their existing wallets — specifically that the capability goes beyond passive access into active ownership and action. | irradiant | What this lets you do: bring every address you already own into one place. Import or connect a wallet and each one becomes somewhere you can sign, send, and act from — not just watch. | irradiant | PASS | 1 | 0.06 |
| H11 | Infinex homepage — wallet connectivity feature | feature_description | Connect securely to any dapp and take your account with you. | Tell a visitor what the wallet connectivity feature does for them — specifically that their account works across the decentralized application ecosystem and travels with them wherever they go within it. | irradiant | Soon you won't think about connecting wallets — your account moves with you across every dapp, already signed in. | irradiant | PASS | 1 | 0.12 |
| H12 | Infinex homepage — security tier feature | feature_description | Passkey to Ledger to Safe. Choose the Opsec to suit your spec. | Communicate to a prospective user that the platform supports a range of security custody models — from lightweight to hardware to multisig — and that the user selects the tier that matches their own security requirements. | practical | Passkey, hardware wallet, or multisig — each is a real custody path inside the same account. Pick the tier that matches your own threat model, not someone else's default. | practical | PASS | 0 | 0.04 |
| H13 | Infinex homepage — rewards feature | feature_description | Switch to Infinex and earn crates and cashback on every trade. | Inform a prospective user that migrating to the platform unlocks a dual-reward system tied to trading activity, so they understand the concrete benefit of switching before they sign up. | commanding | Every qualifying trade earns a Patron Pass and a fee rebate. No exceptions. | unknown | FAIL | 2 | 0.14 |
| H14 | Infinex homepage — top-level positioning line | positioning | One super app. | Tell a first-time visitor what Infinex is by naming its product category as a single unified platform, in a way that communicates scope and consolidation rather than a feeling. | commanding | One account. Every venue. | commanding | PASS | 2 | 0.17 |
| H15 | Infinex homepage — perps feature description | feature_description | Trade perps in-app with up to 40x leverage | Inform a prospective user that the platform supports leveraged perpetual futures trading natively within the application, and specify the maximum leverage multiplier available. | commanding | Perps are live in Infinex. Up to 50x, native to the app. | commanding | PASS | 0 | 0.22 |
| H16 | Infinex homepage — partner credit line | partner_credit | Powered by Hyperliquid | Inform the visitor that a named third-party infrastructure provider underpins the product, establishing the technical partnership at a glance. | sociable | Powered by Hyperliquid | sociable | PASS | 0 | 1.00 |
| H17 | Infinex homepage — partner credit line | partner_credit | Powered by Polymarket | Tell the visitor which third-party platform supplies the underlying data or infrastructure for a specific feature, so they can attribute capability to its source. | sociable | Powered by @HyperliquidX | sociable | PASS | 0 | 0.33 |
| H18 | Infinex homepage — trust footer line | trust_line | Your keys, secured by Turnkey | Inform the visitor which third-party infrastructure is responsible for protecting their private key custody, so they can assess the security trust chain before committing funds. | sociable | Working with @Turnkey — your keys, yours alone. | sociable | PASS | 1 | 0.33 |
| H19 | Infinex homepage — value prop label | value_prop | Phishing resistant security | Communicate to a prospective user that the platform's account protection is architected to eliminate a specific class of credential-theft attack, naming the security property rather than a feeling of safety. | commanding | Passkey-secured. Phishing-resistant by design. | commanding | PASS | 0 | 0.33 |
| H20 | Infinex homepage — value prop label | value_prop | See what privileges you're granting | Inform the user that they can inspect which permissions or access rights they are currently authorizing before proceeding. | commanding | Every permission, visible and yours. | commanding | PASS | 1 | 0.00 |

## Constraints extracted (per string)

- **H01**: `homepage hero — first line of copy a visitor reads`, `single sentence or fragment, fits one line`, `must name the product category or core mechanic, not an emotional outcome`, `imperative or declarative grammatical shape`, `no sub-clauses or qualifications`
- **H02**: `Two words maximum`, `Noun phrase, not a full sentence or imperative`, `Names a product mechanic or capability, not a feeling or outcome`, `Homepage value prop label — sits in close proximity to supporting body copy`
- **H03**: `Homepage value prop label`, `Noun phrase, not a full sentence`, `Must name the product mechanic (aggregation/sourcing structure), not a benefit or emotion`, `Short label: 2–4 words`, `No verb required`
- **H04**: `Homepage value prop label`, `Two to four words maximum`, `Names a product attribute or mechanic, not an emotion or outcome`, `Noun phrase (no imperative verb required)`, `Must stand alone as a scannable label within a list of peer value props`
- **H05**: `Primary CTA button on the homepage hero`, `Imperative verb form`, `Two to three words maximum`, `Must initiate an action toward ownership or activation of the product`, `Names an action, not a feeling or a feature`
- **H06**: `Single line of body-level or heading-level text`, `Must signal two temporal states: past delivery and future delivery`, `Does not need to name specific features or dates`, `Imperative or declarative sentence structure`, `Fits a section opener / label role on the homepage`
- **H07**: `section heading, not a hero or CTA`, `two to four words`, `names the section's content category, not a user action or feeling`, `no imperative verb directing the user to do something`
- **H08**: `Single sentence`, `Must name three distinct wallet properties: (1) the authentication/security mechanism, (2) the transaction cost model, (3) the number of supported networks`, `The network count must appear as a specific numeric value or lower-bound figure`, `Describes a product mechanic, not a user feeling or outcome`, `Placed beneath or alongside the wallet feature label on the homepage`
- **H09**: `Homepage product enumeration section, positioned beneath or near the primary hero claim`, `Must enumerate distinct product/capability categories as a list or series — not prose sentences`, `Each item names a concrete mechanic or infrastructure property, not a benefit or feeling`, `Series must include both user-facing action types (trading mechanics) and underlying infrastructure properties (routing/network scope)`, `Six items in the shipped version; output should be comparable in count — short enough to scan in one pass`, `Each item is a noun or noun phrase (no imperative verbs, no adjectives alone)`, `No item may describe an outcome or emotion — only a capability or structural property`
- **H10**: `Short-form feature description, homepage surface`, `Two sentences or fewer`, `Must name the supported interaction modes (import and connect) as distinct mechanics`, `Must convey the functional ceiling of the feature (active use, not read-only access)`, `Does not need to name the product or brand`
- **H11**: `Single sentence`, `Describes a product mechanic (cross-dapp portability), not a feeling`, `Must reference both the interoperability action and the persistence of the user's account`, `Homepage feature description placement — subordinate to a section heading`, `No rhetorical question — declarative statement only`
- **H12**: `Two sentences maximum`, `First sentence must enumerate at least two distinct, named security custody mechanisms (not categories or feelings)`, `Second sentence must convey user agency in selecting among those mechanisms`, `Selection criterion must reference the user's own technical or operational standard, not a generic notion of preference`, `Surface placement: homepage feature tile or section, so copy must stand alone without surrounding explanatory prose`, `No imperative verb required — declarative or imperative both structurally valid`
- **H13**: `Single sentence`, `Must name both reward mechanics (a collectible/container reward type and a monetary rebate), not just the feeling of being rewarded`, `Must reference trading activity as the trigger condition`, `Must indicate that rewards apply to every qualifying action, not selectively`, `Homepage feature description — sits alongside other feature callouts, not in the hero`, `Imperative or declarative sentence shape acceptable`
- **H14**: `Homepage hero, top-level positioning line`, `Three words or fewer`, `Noun phrase, not a sentence or imperative`, `Must name the product type or category (e.g. an application-tier construct), not a feature or an emotion`, `Stands alone — no supporting subhead assumed`
- **H15**: `Single sentence or fragment`, `Must name the trading instrument category (perpetual futures / perps)`, `Must state the maximum leverage ratio as a numeric multiplier`, `Must indicate the trading occurs inside the product (not via external redirect)`, `Homepage feature description context — sits alongside other feature callouts`, `Does not need to be an imperative — declarative is acceptable`
- **H16**: `exactly two words plus a proper noun (3 tokens total)`, `follows a '[relationship word] [Partner Name]' grammatical pattern`, `must name the specific partner, not describe the category of partnership`, `placed inline as a credit line, not a headline or CTA`, `partner name must appear verbatim and last`
- **H17**: `two to four words total`, `names the integration partner explicitly`, `attributes a mechanic or data source, not a feeling`, `placed inline or beneath a feature component, not as a standalone section`, `does not begin with an imperative verb`
- **H18**: `placed in a trust/footer context on the homepage`, `must name the specific custody or key-management partner (a proper noun)`, `must reference the concept of private key ownership or custody — not a feeling of safety`, `single short line, no more than ~6 words`, `names a concrete mechanic (who holds/secures what), not an outcome or emotion`
- **H19**: `homepage value proposition label`, `short noun phrase, not a full sentence`, `must name a concrete security mechanism or property, not an emotional outcome`, `no verb required — label grammar acceptable`
- **H20**: `homepage value prop label`, `single line`, `must reference the action of reviewing permissions/access rights (the mechanic), not a feeling or outcome`, `imperative or declarative verb form`, `short label length — approximately 4–7 words`

## Summary

Total strings rewritten: 20
  - Passes (verifier agreed): 18
  - Fails (max attempts exhausted): 2
  - Mean retries: 0.80

## Possible context-poisoning candidates (similarity ≥ 0.60)

These rows converged too close to the shipped wording. Either the intent extractor leaked phrasing, the job description encoded the answer, or the surface only has one viable phrasing for this character — flag and review.

| ID | Similarity | Current text | Replacement text |
|---|---|---|---|
| H16 | 1.00 | Powered by Hyperliquid | Powered by Hyperliquid |

## Per-string attempt traces

### H01 — Infinex homepage — hero

- Job: hero
- Current text: "Change the way you crypto."
- Extracted intent: Tell a first-time visitor what Infinex's fundamental product position is in a single decisive line that names what the platform does differently, without describing how the user should feel about it.
- Constraints: `homepage hero — first line of copy a visitor reads`, `single sentence or fragment, fits one line`, `must name the product category or core mechanic, not an emotional outcome`, `imperative or declarative grammatical shape`, `no sub-clauses or qualifications`
- Final: PASS (similarity 0.00)

#### Attempt 1

- Selected tempo: `commanding` — Pressing → Punching lands a homepage hero as an institutional position statement — one decisive line naming the mechanic, no ornament.
- Replacement text: "One account for every chain, every venue, every asset."
- Preserved intent: Give a first-time visitor a single decisive line that names Infinex's core mechanic — unified account across chains and venues — without telling them how to feel about it.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: The parallel tricolon ('every chain, every venue, every asset') produces a smooth, light, self-presenting rhythm with a soft dab at the end. No sustained press builds toward a punching landing; no factual anchor delivers the institutional drop required for Commanding. The closest read is Self-contained — confident-light, says the obvious well — but that is a reserve/out-of-rotation tempo for this character. Classifying as unknown.
- Verifier feedback: The line reads as a clean product tagline but it lacks the Pressing → Punching motor that defines Commanding. Commanding opens with a grounded fact ("Today: X is live", "We've shipped Y") and lands with decisive institutional weight. This line instead floats on parallelism ("every chain, every venue, every asset") — a rhythmic accumulation that has no sustained pressure and no decisive release. The motor is closer to Gliding → Dabbing (Self-contained), which is out of rotation. The character's Spell-Vision drive requires either a grounded present-tense fact (Commanding) or a future-state vision pull (Irradiant). This line carries neither — it reads as a generic positioning statement. Recommend rewriting to anchor on a concrete fact or a forward-vision pull. E.g. Commanding: "One account. Every chain, every venue, every asset." only works if a preceding or embedded fact grounds it. Irradiant alternative: "One account. You stop thinking about which chain, which venue, which asset."

#### Attempt 2

- Selected tempo: `irradiant` — Floating → Flicking fits a homepage hero pulling a first-time visitor toward a future-state where chain/venue/asset selection disappears — the Spell-Vision drive's vision pole.
- Replacement text: "One account. Stop thinking about which chain, which venue, which asset."
- Preserved intent: State Infinex's core position to a first-time visitor in one decisive line — a single account that collapses the chain/venue/asset selection problem — naming the mechanic rather than prescribing a feeling.
- Verifier tempo: `irradiant` (PASS)
- Verifier rationale: The line carries the irradiant 'won't think about which…' motor almost verbatim — a sustained vision-hold ('stop thinking about which chain, which venue, which asset') releasing into a light, buoyant one-phrase image ('One account'). The Future-freedom pull is consistent with Spell-Vision drive and the floating → flicking pair. Confidence is not higher because the future-tense agent framing typical of irradiant is absent — the line is present-imperative — but the motion shape and generosity of release still land squarely in this tempo.

### H02 — Infinex homepage — value prop label

- Job: value_prop
- Current text: "Unified portfolio."
- Extracted intent: Tell a homepage visitor what core problem Infinex solves for their assets — that all holdings across contexts are accessible and managed in one place.
- Constraints: `Two words maximum`, `Noun phrase, not a full sentence or imperative`, `Names a product mechanic or capability, not a feeling or outcome`, `Homepage value prop label — sits in close proximity to supporting body copy`
- Final: PASS (similarity 0.33)

#### Attempt 1

- Selected tempo: `commanding` — Pressing → Punching: a two-word homepage label is a locked, decisive noun phrase that names the mechanic without ornament.
- Replacement text: "Unified custody."
- Preserved intent: Label the core capability — every asset across contexts held and reachable from one account — as a compact noun phrase that anchors the homepage's supporting copy.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: Short declarative noun phrase with zero ornament. The compressing weight of 'Unified' (pressing) lands hard on 'custody' (punching) — the motor pair is Stable · Strong/Direct. Reads exactly like a ruler issuing a position. No vision-pull, no partner warmth, no working-through — pure institutional drop.

### H03 — Infinex homepage — value prop label

- Job: value_prop
- Current text: "Multi-provider trading."
- Extracted intent: Tell a first-time visitor what core platform mechanic enables broader market access by naming the architectural feature (aggregation across multiple liquidity sources), not the outcome feeling.
- Constraints: `Homepage value prop label`, `Noun phrase, not a full sentence`, `Must name the product mechanic (aggregation/sourcing structure), not a benefit or emotion`, `Short label: 2–4 words`, `No verb required`
- Final: PASS (similarity 0.00)

#### Attempt 1

- Selected tempo: `commanding` — Pressing → Punching: a homepage value-prop label is an institutional drop — a locked noun phrase that names the mechanic without ornament.
- Replacement text: "Aggregated liquidity sourcing"
- Preserved intent: Name the architectural mechanic (pooling liquidity across multiple sources) that opens broader market access, as a short homepage label — not the user-facing feeling it produces.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: Pure noun-phrase taxonomy — no verb, no assertion, no motor action. The closest read is the Self-contained reserve tempo (gliding, confident-light, no conviction pull), which is explicitly out of rotation. No Sustained → Quick motor pair from any of the five main tempi fits the shape of this copy.
- Verifier feedback: This label reads as neutral product taxonomy — it names a capability class without any motor action behind it. There is no Pressing → Punching shape, no institutional drop, no declarative landing. It does not carry Commanding (which requires a fact-forward assertion: "X is live," "We've shipped Y"). It doesn't carry any of the five main tempi's motor vocabulary — it's closer to the Self-contained reserve tempo (confident-light, says the obvious well, no vision or conviction needed), which is explicitly out of rotation. Rewrite as a short declarative that lands the capability as a fact already true: e.g. "One account. Every venue's liquidity." or "Best price, sourced across venues. Automatically." — something that carries the Pressing → Punching motor of Commanding, or the Floating → Flicking of Irradiant if a future-pull frame is preferred.

#### Attempt 2

- Selected tempo: `commanding` — Pressing → Punching: a homepage value prop needs a locked, declarative landing that states the mechanic as fact already true, not a taxonomy label.
- Replacement text: "One account. Every venue's liquidity."
- Preserved intent: Tell a first-time visitor that the core mechanic is aggregation across multiple liquidity sources from a single account — naming the architecture, not the feeling.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: Classic Stable · Strong/Direct shape. 'One account.' is the sustained press — a fixed, irreducible position. 'Every venue's liquidity.' is the decisive punching release — no hedge, no ornament, no verb needed. The pairing enacts the institutional drop exactly as specified for Commanding. No Passion urgency, no warmth, no partner credit — purely positional.

### H04 — Infinex homepage — value prop label

- Job: value_prop
- Current text: "Serious Opsec."
- Extracted intent: Tell a homepage visitor that Infinex treats the security of their assets and operations as a non-negotiable, first-class product commitment — named as a concrete capability, not a feeling.
- Constraints: `Homepage value prop label`, `Two to four words maximum`, `Names a product attribute or mechanic, not an emotion or outcome`, `Noun phrase (no imperative verb required)`, `Must stand alone as a scannable label within a list of peer value props`
- Final: PASS (similarity 0.00)

#### Attempt 1

- Selected tempo: `commanding` — Pressing → Punching: a homepage value-prop label needs to land as a locked, scannable noun phrase sitting in a peer list — institutional drop, no ornament.
- Replacement text: "Passkey-secured custody"
- Preserved intent: Label the security commitment as a concrete product mechanic (passkey-based custody) rather than as a feeling, so it reads as a scannable peer value prop on the homepage.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: A two-word noun compound with zero softening — the grammatical shape is a declaration dropped without argument, consistent with the Commanding motor (Pressing → Punching). Short-form labels of this type sit at the compressed end of Commanding's range, analogous to 'live today' or 'ready now'. No urgency/FOMO framing, no partner credit, no future-vision arc — the other four tempi don't fit. Confidence capped at 0.72 because a standalone label offers limited motor signal; Self-contained (reserve) is equally plausible on surface, but the security/custody weight tips it toward institutional-drop Commanding rather than the lighter Self-contained register.

### H05 — Infinex homepage — primary CTA

- Job: cta
- Current text: "Get Infinex"
- Extracted intent: Direct a homepage visitor to begin acquiring or activating access to the product.
- Constraints: `Primary CTA button on the homepage hero`, `Imperative verb form`, `Two to three words maximum`, `Must initiate an action toward ownership or activation of the product`, `Names an action, not a feeling or a feature`
- Final: PASS (similarity 0.00)

#### Attempt 1

- Selected tempo: `commanding` — Pressing → Punching: a hero CTA button is the canonical institutional drop — locked imperative, no ornament.
- Replacement text: "Open account"
- Preserved intent: A two-word imperative button on the homepage hero that moves the visitor into activating their Infinex account.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: Imperative verb + direct object. No hedging, no warmth, no vision-pull. The shape is a locked institutional instruction — Stable · Strong/Direct — landing on a decisive Punching release. Textbook Commanding motor for a primary CTA. Dry brevity is a feature here, not a gap.

### H06 — Infinex homepage — section opener for shipped + upcoming

- Job: section_head
- Current text: "See everything we've shipped, and everything that's coming up"
- Extracted intent: Orient the visitor to a section that surfaces both completed releases and the forward-looking roadmap in a single combined view.
- Constraints: `Single line of body-level or heading-level text`, `Must signal two temporal states: past delivery and future delivery`, `Does not need to name specific features or dates`, `Imperative or declarative sentence structure`, `Fits a section opener / label role on the homepage`
- Final: PASS (similarity 0.10)

#### Attempt 1

- Selected tempo: `practical` — Wringing → Slashing: a section opener that has to hold two temporal states at once needs the carved-answer motor, not a punch or a flick.
- Replacement text: "What we've shipped, and what's next."
- Preserved intent: Label a homepage section that combines released work with the forward roadmap, signalling both past and future delivery in one line.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: The line is a plain dual-clause label: it names two content buckets ('shipped' and 'next') without any Sustained motor phase building toward resolution. No wringing-into-slashing (Practical), no pressing-into-punching (Commanding/Sombre), no floating-into-flicking (Irradiant), no gliding-into-dabbing partner-credit shape (Sociable). The closest read is the reserve tempo Self-contained — a competent, conviction-free informational drop — which is explicitly off-rotation. Classified unknown.
- Verifier feedback: The line "What we've shipped, and what's next." reads as a neutral section label — a table-of-contents gesture with no motor action, no Sustained phase, and no Quick release. It does not work through complexity (Practical's wringing → slashing), nor does it carry any of the five main tempi's characteristic drives. The closest fit is the reserve tempo Self-contained (Stable · Light/Direct, gliding → dabbing): it says the obvious competently, without conviction or vision. That tempo is explicitly out of rotation. Rewrite to activate a main tempo: e.g. Commanding — "Here's what shipped. Here's what's coming." — or Sombre — "Progress is cumulative. Here's where we are." — or Practical by opening with a reasoning frame: "We keep a running record because the gap between what's shipped and what's promised is the only metric that matters."

#### Attempt 2

- Selected tempo: `commanding` — Pressing → Punching: a section opener for shipped + upcoming needs two locked landings, not a neutral label — twin declarative drops carry the institutional weight of a roadmap header.
- Replacement text: "Here's what shipped. Here's what's next."
- Preserved intent: Open a homepage section that holds both past releases and the forward roadmap in one view, signaling both temporal states in a single header line.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: The prose is a two-clause structural label with no factual mass and no sustained-pressure build. The gliding approach and light dabbing conclusion map cleanly onto the Self-contained reserve tempo (Stable · Light/Direct) — informational, confidence-neutral, says the obvious well. Self-contained is explicitly out-of-rotation for this character, so the correct primary classification is unknown. No Sustained → Quick motor pair from the five main tempi fits: there is no pressing, wringing, floating, or punching action present.
- Verifier feedback: The line reads as a neutral section header — a dry, informational label with no sustained-pressure build and no decisive landing. It carries no Pressing → Punching motor; instead it glides in and taps out, which is the Self-contained reserve tempo (Stable · Light/Direct). Commanding requires a factual payload dropped with institutional weight (e.g. "Today: X is live."). This line names a structure rather than asserting a position, so it cannot reconcile with Commanding or any of the five main tempi in rotation. Rewrite with an actual factual claim in the Commanding shape — e.g. "Spot trading is live. Yield vaults are next." — so the Pressing setup (fact 1) lands into the Punching release (fact 2), giving the section opener real institutional weight rather than an empty frame.

#### Attempt 3

- Selected tempo: `commanding` — Pressing → Punching: a shipped fact sets the weight, the next fact lands the release — institutional mass for a homepage section opener spanning past and future delivery.
- Replacement text: "Shipped this season. More already in the pipe."
- Preserved intent: A homepage section opener that orients the visitor to a combined view of completed releases and what's coming next, without naming specific features or dates.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: Two short declarative bursts with no ornament. First clause presses a completed fact into place; second punches a forward-facing position. Stable · Strong/Direct motor pair throughout. No vision-warmth (not Irradiant), no partner credit (not Sociable), no weight-of-conviction (not Sombre), no complexity-working (not Practical). Cleanly Commanding.

### H07 — Infinex homepage — features section opener

- Job: section_head
- Current text: "Explore key features"
- Extracted intent: Orient the visitor to the start of a section that lists the product's defining capabilities, so they understand what the section contains before reading individual items.
- Constraints: `section heading, not a hero or CTA`, `two to four words`, `names the section's content category, not a user action or feeling`, `no imperative verb directing the user to do something`
- Final: PASS (similarity 0.00)

#### Attempt 1

- Selected tempo: `commanding` — Pressing → Punching: a section label is an institutional drop — a locked, decisive noun phrase that names the category without ornament.
- Replacement text: "What's inside"
- Preserved intent: Mark the start of the capabilities section with a short, neutral label that names the category of content below, without prompting an action.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: The line is a passive, curiosity-teasing label with no motor energy from the main rotation. Gliding → Dabbing matches the effortless, light informational drop — consistent with the reserve tempo Self-contained (Stable · Light/Direct), which is explicitly out of rotation. No Sustained → Quick pair from any of the five main tempi fits the shape of this prose.
- Verifier feedback: The line "What's inside" reads as a neutral label — it carries no Pressing → Punching motor, no decisive institutional weight, and no Sustained pressure leading to a locked landing. It fails the Commanding tempo entirely. It also cannot be reconciled with Practical (no Wringing → Slashing reasoning shape), Sombre (no weight-of-conviction), Irradiant (no future-pull), or Sociable (no partner/ecosystem framing). The closest fit is the reserve tempo Self-contained — a dry informational label that says the obvious without conviction or vision. That tempo is explicitly out of rotation. For a Commanding section head, consider something that issues a position or names a fact with institutional weight: e.g. "Everything in one account." or "One account. Every market." The opener must carry Pressing → Punching — a sustained claim that lands with a decisive close.

#### Attempt 2

- Selected tempo: `commanding` — Pressing → Punching: a section head should land as a locked institutional position naming the category, not a teaser.
- Replacement text: "One account. Every market."
- Preserved intent: Open the capabilities section with a heading that names what's contained — the unified-account, all-markets surface — without instructing the user or hyping a feeling.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: Short declarative pair with zero ornament. Each clause lands as a terminal statement — no subordination, no qualifier, no vision-pull. The rhythm is Pressing (sustained assertion: 'One account') releasing into a Punching close ('Every market'). Stable · Strong/Direct inner combo matches perfectly. No off-spec drive detectable — no urgency framing, no partner warmth, no complexity-working. Fully within the Commanding rotation.

### H08 — Infinex homepage — wallet feature description

- Job: feature_description
- Current text: "Passkey-first, gas-abstracted wallet with support for 20+ chains."
- Extracted intent: Tell a prospective user what technical properties define the wallet, specifically its authentication method, fee model, and multi-network reach, so they can assess compatibility with their needs.
- Constraints: `Single sentence`, `Must name three distinct wallet properties: (1) the authentication/security mechanism, (2) the transaction cost model, (3) the number of supported networks`, `The network count must appear as a specific numeric value or lower-bound figure`, `Describes a product mechanic, not a user feeling or outcome`, `Placed beneath or alongside the wallet feature label on the homepage`
- Final: PASS (similarity 0.21)

#### Attempt 1

- Selected tempo: `practical` — Wringing → Slashing: a feature description naming three distinct mechanics works through the spec and lands a carved, factual answer rather than a hero drop.
- Replacement text: "Passkey-authenticated, gasless to use, and reaching across 25+ networks from a single account."
- Preserved intent: Give a prospective user the three load-bearing wallet specs — how you sign in, what transactions cost, and how far it reaches — so they can check it against their own setup.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: Three noun-phrase fragments in parallel — passkey-authenticated, gasless, 25+ networks — carry a smooth, confident-light gliding motion that lands lightly (dabbing). No Sustained → Quick motor pair from any main tempo fits: there is no pressing build into a punching conclusion (Commanding/Sombre), no wringing complexity carved to a slashing answer (Practical), no floating vision released as a flicking future-state (Irradiant), and no partner-credit structure (Sociable). The closest read is Self-contained — a reserve tempo — which is explicitly out of rotation. Classified unknown.
- Verifier feedback: This line reads as a neutral feature-list — three adjective phrases strung together with no working-through of complexity, no carved answer, no tradeoff reasoning. Practical requires a Wringing → Slashing motor: the prose should feel like it's turning a problem over and cutting to a conclusion. Instead, this is a flat enumeration of selling points, which places it firmly in the Self-contained reserve tempo (Stable · Light/Direct, gliding → dabbing) — confident-light, says the obvious well, but carries no drive toward Spell or Vision. That tempo is explicitly out of rotation. Additionally, "25+" introduces a quantified claim that is not supported by any deployed_facts or fact_context, making it a factual soft-warn. Rewrite suggestions: (1) If Practical is the target, open with a working question or tension — e.g. "Here's what unified means in practice: one passkey signs everything, gas is abstracted, and 25 networks look like one." (2) If the intent is a short Commanding drop, collapse it: "One account. 25+ networks. No gas." But verify the network count against deployed facts first.

#### Attempt 2

- Selected tempo: `practical` — Wringing → Slashing: the line works through what "one wallet" actually means across three mechanics, then cuts to the count that makes it real.
- Replacement text: "Here's what one wallet actually means: a passkey signs every transaction, gas is abstracted away, and 20+ networks behave as one account."
- Preserved intent: Tell a prospective user the three defining mechanics of the wallet — passkey auth, no-gas UX, and broad network reach as a numeric floor — so they can judge fit. Mechanic-first, not feeling-first.
- Verifier tempo: `practical` (PASS)
- Verifier rationale: Opens with 'Here's what X actually means:' — the canonical practical shape of working through a term's real content into a carved-out answer. The colon-separated enumeration (passkey signs, gas abstracted, 20+ networks as one) is a wringing motion through complexity that lands in a clean slashing conclusion. The word 'actually' is load-bearing: it signals the character correcting a folk understanding, which is characteristic of the Practical motor. No urgency, no partner credit, no future-vision pull — stays squarely in the working-through-complexity register.

### H09 — Infinex homepage — product enumeration

- Job: feature_description
- Current text: "Swap. Perps. Earn. Predict. Multi-provider. Multi-chain."
- Extracted intent: Tell a first-time visitor what categories of financial actions and infrastructure capabilities the platform covers, so they can self-assess whether it meets their needs before reading further.
- Constraints: `Homepage product enumeration section, positioned beneath or near the primary hero claim`, `Must enumerate distinct product/capability categories as a list or series — not prose sentences`, `Each item names a concrete mechanic or infrastructure property, not a benefit or feeling`, `Series must include both user-facing action types (trading mechanics) and underlying infrastructure properties (routing/network scope)`, `Six items in the shipped version; output should be comparable in count — short enough to scan in one pass`, `Each item is a noun or noun phrase (no imperative verbs, no adjectives alone)`, `No item may describe an outcome or emotion — only a capability or structural property`
- Final: FAIL (similarity 0.13)

#### Attempt 1

- Selected tempo: `commanding` — Pressing → Punching: a scannable enumeration of capabilities reads as locked, declarative labels — each item a ruler's mark on the page.
- Replacement text: "Spot. Perps. Yield. Stablecoins. Cross-chain routing. Multi-network coverage."
- Preserved intent: Give a first-time visitor a one-pass, noun-only list of what Infinex covers — mixing user-facing trading mechanics with underlying infrastructure properties — so they can decide if the platform fits their needs.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: Pure noun enumeration with no Sustained → Quick motor pair. The closest fit is Self-contained (confident-light, gliding → dabbing), which is an out-of-rotation reserve tempo. There is no Pressing buildup, no Punching release, no penetrating aspect at work — just taxonomy. Does not resolve to any of the five main tempi.
- Verifier feedback: This reads as a bare taxonomy list — noun fragments with no motor. Commanding requires a Pressing → Punching shape: sustained pressure building into a decisive landing. None of these fragments carry that arc; they simply enumerate. The prose activates no drive, carries no aspect (penetrating requires cutting through something, not listing beside it), and the cumulative effect is a neutral product catalogue. This is the Self-contained reserve tempo at its most skeletal — informational drops with no vision or conviction. Rework by anchoring at least one fragment to a Pressing verb or framing that carries the character's penetrating aspect, e.g. "Spot. Perps. Yield. One account." — or open with a Commanding shape: "Everything is live." followed by the list as supporting detail.

#### Attempt 2

- Selected tempo: `commanding` — Pressing → Punching: a declarative frame builds pressure, then the enumeration lands as the decisive drop of what's covered, so a scanner can self-assess in one pass.
- Replacement text: "All of it, one account: spot, perps, yield, stablecoins, cross-chain routing, multi-network coverage."
- Preserved intent: Give a first-time visitor a scannable enumeration of the concrete action types and infrastructure properties the platform covers, mixing user-facing mechanics with routing/network scope, so they can decide whether to keep reading.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: The prose is a flat comma-separated enumeration — gliding across features with a light dab at the end. There is no Sustained → Quick motor pair from any of the five main tempi. The closest read is Self-contained (Stable · Light/Direct, gliding → dabbing), which is a reserve/beat tempo out of rotation for this character. No Pressing build, no Punching close, no Wringing complexity, no Floating vision — just taxonomy. Classifying as unknown.
- Verifier feedback: The line reads as a product taxonomy list — a neutral enumeration of features without any Sustained → Quick motor shape. The Commanding tempo requires a Pressing build into a Punching release (e.g. "Today: X is live." or a declarative landing that carries institutional weight). Here the prose never builds or lands — it just catalogues. The closest off-rotation read is Self-contained (Stable · Light/Direct), which is a reserve/beat tempo explicitly out of rotation for this character. Rewrite to give the line a Pressing setup and a decisive Punching close. For example: "One account. Spot, perps, yield, stablecoins, cross-chain — all of it." — or anchor it with a Commanding opener: "It's all one account: spot, perps, yield, stablecoins, routing across every network." The current form has no motor; it is a label cloud, not a character beat.

#### Attempt 3

- Selected tempo: `commanding` — Pressing → Punching: a sustained declarative setup ("One account.") that lands the enumeration as a single institutional position rather than a neutral taxonomy.
- Replacement text: "One account. Spot, perps, yield, stablecoins, smart routing, every chain — all of it."
- Preserved intent: Give a first-time visitor a one-pass scan of what the platform covers — both user-facing action types (spot, perps, yield, stablecoins) and infrastructure properties (smart routing, cross-chain scope) — so they can self-qualify before reading further.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: Pure enumeration with no Pressing → Punching motor. There is no sustained buildup and no decisive release — just a smooth inventory glide that taps out at the em-dash. This reads closest to Self-contained (confident-light, says the obvious well) which is a reserve/out-of-rotation tempo for this character. No main-rotation tempo fits cleanly.
- Verifier feedback: The line reads as a flat product list — a taxonomy drop with no motor energy. Commanding requires a Pressing → Punching shape: sustained pressure that resolves into a decisive, locked landing. Here the prose never builds pressure; it just enumerates. There is no verb, no action, no institutional drop. The closest reserve tempo is Self-contained (Stable · Light/Direct, gliding → dabbing) — the "says the obvious well" beat — which is explicitly out of rotation. To rescue this as Commanding, lead with a declarative fact-verb and let the list serve the punch, e.g. "One account holds all of it — spot, perps, yield, stablecoins, every chain." Alternatively, compress to a single decisive statement and let the list live in secondary copy.

### H10 — Infinex homepage — wallet import feature

- Job: feature_description
- Current text: "More than view-only. Import or connect existing wallets and take control."
- Extracted intent: Tell a visitor what the wallet import feature enables them to do with their existing wallets — specifically that the capability goes beyond passive access into active ownership and action.
- Constraints: `Short-form feature description, homepage surface`, `Two sentences or fewer`, `Must name the supported interaction modes (import and connect) as distinct mechanics`, `Must convey the functional ceiling of the feature (active use, not read-only access)`, `Does not need to name the product or brand`
- Final: PASS (similarity 0.06)

#### Attempt 1

- Selected tempo: `irradiant` — Floating → flicking fits a homepage feature line that opens up capability — the lift is from passive holding into active use across your existing wallets.
- Replacement text: "Import a wallet or connect one — your existing addresses become places you can actually act from, not just balances you can read."
- Preserved intent: Tell a homepage visitor that both import and connect are supported as distinct mechanics, and that the ceiling is active use of those wallets rather than read-only viewing.
- Verifier tempo: `practical` (FAIL)
- Verifier rationale: The prose works through a conceptual distinction — old framing (balances you can read) vs. new framing (places you can act from) — arriving at a carved answer. That before/after corrective structure is the wringing-into-slashing motor of Practical. There is no forward-float, buoyant vision-pull, or future-state opener that would anchor it in Irradiant's floating → flicking motor.
- Verifier feedback: The line reads as a practical feature description — it works through a before/after distinction ("not just balances you can read" vs. "places you can actually act from") with a carved, explanatory logic. That's the wringing → slashing motor of Practical, not the floating → flicking of Irradiant. To land as Irradiant, the line needs buoyant forward-pull: a future-state opening ("What this lets you do:", "A few months from now…", "Your agent now…") and generous vision energy rather than a corrective reframe of what wallets currently aren't. The current shape is clean and functional but lacks the lightness and forward-warmth that define the Irradiant tempo. Rewrite suggestion: lean into what becomes possible — "Your existing addresses come with you. Import or connect a wallet and every address you already own becomes a place you can act from inside Infinex." — or open with an irradiant frame: "What this lets you do: bring every address you already own into one place and act from any of them."

#### Attempt 2

- Selected tempo: `irradiant` — Floating → flicking: open with a future-state frame so the feature lands as buoyant possibility, not a corrective reframe.
- Replacement text: "What this lets you do: bring every address you already own into one place. Import or connect a wallet and each one becomes somewhere you can sign, send, and act from — not just watch."
- Preserved intent: Tell a homepage visitor that importing or connecting wallets brings their existing addresses in as active, action-capable surfaces rather than read-only views.
- Verifier tempo: `irradiant` (PASS)
- Verifier rationale: Opens with the canonical irradiant shape ('What this lets you do:') and sustains a light, generative tone throughout — the prose lifts from a floating premise ('bring every address… into one place') and flicks out on a buoyant capability statement ('sign, send, and act from — not just watch'). The Light/Free inner combo and Spell-Vision drive hold throughout; no urgency or passion framing intrudes. Slight gliding quality in the smooth enumeration keeps it from full punching territory, confirming irradiant over commanding.

### H11 — Infinex homepage — wallet connectivity feature

- Job: feature_description
- Current text: "Connect securely to any dapp and take your account with you."
- Extracted intent: Tell a visitor what the wallet connectivity feature does for them — specifically that their account works across the decentralized application ecosystem and travels with them wherever they go within it.
- Constraints: `Single sentence`, `Describes a product mechanic (cross-dapp portability), not a feeling`, `Must reference both the interoperability action and the persistence of the user's account`, `Homepage feature description placement — subordinate to a section heading`, `No rhetorical question — declarative statement only`
- Final: PASS (similarity 0.12)

#### Attempt 1

- Selected tempo: `irradiant` — Floating → flicking fits a feature description about portability — a light, vision-pulled statement of what travels with you across the ecosystem.
- Replacement text: "Your account works across every dapp in the ecosystem and follows you wherever you go inside it."
- Preserved intent: Tell a homepage visitor that this one account is interoperable across the dapp ecosystem and persists with them as they move through it — a mechanic, not a mood.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: The line makes a smooth, factual claim about account portability with no sustained-to-quick motor pair from any of the five main tempi. It does not press into a punch (Commanding/Sombre), wring into a slash (Practical), float into a flick (Irradiant), nor carry partner warmth (Sociable). It reads as Self-contained — the reserve tempo — which is explicitly out of rotation. Classified unknown.
- Verifier feedback: The line reads as Self-contained — a plain, confident factual statement about the account's portability, with no sustained motor leading to a buoyant release. There is no floating → flicking motion that irradiant requires: no vision-pull, no future-tense warmth, no agent thesis, no generosity of perspective. The prose simply states a property of the product in a dry, informational register. That register is the Self-contained reserve tempo (Stable · Light/Direct, gliding → dabbing), which is explicitly out of rotation for this character. Rewrite to restore the irradiant motor: open with a future-state or "what this lets you do" frame, let the account's portability land as a vision-pulled release rather than a taxonomy fact. E.g. "A few months from now you won't think about connecting wallets. Your account just follows you — every dapp, already in."

#### Attempt 2

- Selected tempo: `irradiant` — Floating → flicking fits a homepage feature description that pulls the visitor into a future where their account simply travels with them across dapps, landing the portability mechanic as a buoyant release rather than a taxonomy line.
- Replacement text: "Soon you won't think about connecting wallets — your account moves with you across every dapp, already signed in."
- Preserved intent: A homepage feature line that tells visitors their Infinex account is interoperable across the dapp ecosystem and persists with them wherever they go inside it.
- Verifier tempo: `irradiant` (PASS)
- Verifier rationale: Opens with a near-future negation ('Soon you won't think about…') — canonical irradiant shape. The prose is vision-pulled and buoyant, removing friction rather than asserting authority. Motor reads as floating (sustained lightness across 'moves with you across every dapp') into flicking (light release on 'already signed in'). No urgency framing, no partner credit, no sustained pressure — irradiant is the clear fit. Spell-Vision drive is present: the line conjures a state of affairs the reader inhabits, not a product fact they verify.

### H12 — Infinex homepage — security tier feature

- Job: feature_description
- Current text: "Passkey to Ledger to Safe. Choose the Opsec to suit your spec."
- Extracted intent: Communicate to a prospective user that the platform supports a range of security custody models — from lightweight to hardware to multisig — and that the user selects the tier that matches their own security requirements.
- Constraints: `Two sentences maximum`, `First sentence must enumerate at least two distinct, named security custody mechanisms (not categories or feelings)`, `Second sentence must convey user agency in selecting among those mechanisms`, `Selection criterion must reference the user's own technical or operational standard, not a generic notion of preference`, `Surface placement: homepage feature tile or section, so copy must stand alone without surrounding explanatory prose`, `No imperative verb required — declarative or imperative both structurally valid`
- Final: PASS (similarity 0.04)

#### Attempt 1

- Selected tempo: `practical` — Wringing → slashing: security custody is a real tradeoff space, and the line has to carve a clear answer out of multiple named mechanisms rather than land a single hero fact.
- Replacement text: "Passkey, hardware wallet, or multisig — each is a real custody path inside the same account. Pick the tier that matches your own threat model, not someone else's default."
- Preserved intent: Tell a prospective user that Infinex supports multiple named custody mechanisms and that they choose the tier matching their own security standard.
- Verifier tempo: `practical` (PASS)
- Verifier rationale: The prose works through a genuine tradeoff space (three custody paths, each real, each distinct) and lands on a carved directive — 'pick the tier that matches your own threat model.' That wringing-into-slashing motor is the Practical signature. Stable·Strong/Flexible inner combo holds: no urgency, no warmth theatre, just a considered position delivered cleanly. Spell-Vision drive is present in the 'threat model' framing — a diagram being read, not a feeling being sold.

### H13 — Infinex homepage — rewards feature

- Job: feature_description
- Current text: "Switch to Infinex and earn crates and cashback on every trade."
- Extracted intent: Inform a prospective user that migrating to the platform unlocks a dual-reward system tied to trading activity, so they understand the concrete benefit of switching before they sign up.
- Constraints: `Single sentence`, `Must name both reward mechanics (a collectible/container reward type and a monetary rebate), not just the feeling of being rewarded`, `Must reference trading activity as the trigger condition`, `Must indicate that rewards apply to every qualifying action, not selectively`, `Homepage feature description — sits alongside other feature callouts, not in the hero`, `Imperative or declarative sentence shape acceptable`
- Final: FAIL (similarity 0.14)

#### Attempt 1

- Selected tempo: `irradiant` — Floating → flicking fits a homepage feature callout selling the upside of switching — sustained vision-pull into a buoyant landing on the concrete reward.
- Replacement text: "Move your trading here and every trade earns a chest and a rebate — no qualifying tiers, no selective drops."
- Preserved intent: Tell a prospect that migrating unlocks two stacked rewards — a collectible (chest) and a monetary rebate — triggered by every qualifying trade, so the upside of switching is legible before signup.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: The line opens with a direct behavioural imperative ('Move your trading here') and closes with a contrast-pair denial ('no qualifying tiers, no selective drops'). The sustained press is entirely directed at motivating a switch — urgency + reward + fairness-reassurance. This is Passion-drive mechanics, not Spell-Vision. No floating → flicking arc is present, so Irradiant is ruled out. The pressing → punching shape could read as Commanding, but the incentive-bait framing (chest, rebate, no tiers) pulls the drive firmly off-character into Passion. Classified unknown.
- Verifier feedback: The line carries a Passion-pulled drive rather than the Spell-Vision (Diagram D) drive that anchors this character. "Move your trading here" is a conversion-urgency call-to-action, and the promise of "earns a chest and a rebate" combined with "no qualifying tiers, no selective drops" is classic incentive-FOMO framing — it manufactures urgency and scarcity-of-fairness to motivate action. That is Passion, not Spell or Vision. The character's aspect is penetrating and its stress is flow/bound; neither supports the push-pull mechanics this line deploys. There is no floating → flicking motor here — the line presses for a behavioural switch with reward bait, which is the opposite of irradiant's buoyant, vision-pulled lightness. Rewrite to lead with what the feature reveals or makes possible (Irradiant) or to state the mechanism plainly without the incentive-theatre (Practical/Commanding). Example Irradiant rewrite: "Every trade earns a chest and a rebate. No tiers. No selective drops — just the mechanic running." Example Commanding rewrite: "Chest rewards and rebates are live on every trade. No qualifying tiers."

#### Attempt 2

- Selected tempo: `commanding` — Pressing → Punching: a homepage feature callout lands as a plain fact about the mechanic, not a switch-pitch, keeping the drive on Spell-Vision.
- Replacement text: "Every trade earns a chest and a rebate — the mechanic runs on all qualifying activity."
- Preserved intent: Tell prospects, in a single homepage feature line, that trading on Infinex triggers two distinct rewards — a collectible chest and a monetary rebate — applied to every qualifying trade.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: The line reads as a light informational note — it states a mechanic without sustained pressure or decisive landing (no Pressing → Punching arc). The 'earns a chest' phrasing carries gamification/reward-hype energy inconsistent with the Spell-Vision drive; that Passion activation alone disqualifies it from the five main tempi. Closest reserve read is Self-contained (Stable · Light/Direct, gliding → dabbing), which is explicitly out of rotation. Classified unknown.
- Verifier feedback: The line carries a Passion-pulled drive — "earns a chest" is reward-hype / gamification theatre that activates urgency-and-incentive framing inconsistent with the character's Spell-Vision drive. The motor also doesn't land as Commanding (Pressing → Punching): there is no sustained declarative pressure resolving into a decisive drop. Instead the line glides lightly across a reward mechanic, closer to a Self-contained informational note (the out-of-rotation gliding → dabbing register). Rewrite suggestions: (1) Drop the gamification language ("chest") and state the mechanic plainly in Commanding shape — e.g. "Every qualifying trade earns a rebate. Live now." (2) If the rewards programme genuinely has named tiers/chests, surface that as a Practical line walking through the tradeoff logic, not a hype hook. Either way, remove the Passion trigger before publishing.

#### Attempt 3

- Selected tempo: `commanding` — Pressing → Punching fits a homepage feature callout that needs to land the mechanic as a stated fact, not sell it.
- Replacement text: "Every qualifying trade earns a Patron Pass and a fee rebate. No exceptions."
- Preserved intent: Tell a prospective user that, once migrated, every qualifying trade triggers two concrete rewards — a collectible pass and a monetary rebate — so the benefit of switching is legible before signup.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: The motor shape is Pressing → Punching (sustained assertion into emphatic close), which maps superficially to Commanding. But the cumulative drive is Passion-pulled: 'every qualifying trade earns' sets up an incentive loop, and 'No exceptions.' functions as hype-pressure punctuation rather than an institutional position drop. Commanding for this character drops facts without promotional affect; this line is selling the reward mechanic. Closest reserve read would be a degraded Commanding leaning into Passion — off-spec drive, classify as unknown.
- Verifier feedback: The line activates the off-spec Passion drive. "Every qualifying trade earns…" combined with "No exceptions." is urgency/incentive theatre — it frames trading as a reward-chase and uses the emphatic "No exceptions" as a hype-pressure closer. That pattern is characteristic of Passion (scarcity-of-attention, FOMO, promotional urgency), not the Spell-Vision drive that anchors this character. Commanding in this character's rotation lands as an institutional position statement — a fact dropped without ornament or incentive framing (e.g. "Patron Pass and fee rebates are live."). Rewrite to strip the reward-chase framing. State the fact plainly without the "no exceptions" emphasis that reads as promotional pressure. Example direction: "Patron Pass. Fee rebates. Live now." or "Every trade on Infinex accrues a Patron Pass and a fee rebate." — then stop. No exclamatory closer needed. Also note: "Patron Pass" and "fee rebate" are not present in deployed_facts or fact_context, which is a soft factual warning — confirm these product claims before publishing.

### H14 — Infinex homepage — top-level positioning line

- Job: positioning
- Current text: "One super app."
- Extracted intent: Tell a first-time visitor what Infinex is by naming its product category as a single unified platform, in a way that communicates scope and consolidation rather than a feeling.
- Constraints: `Homepage hero, top-level positioning line`, `Three words or fewer`, `Noun phrase, not a sentence or imperative`, `Must name the product type or category (e.g. an application-tier construct), not a feature or an emotion`, `Stands alone — no supporting subhead assumed`
- Final: PASS (similarity 0.17)

#### Attempt 1

- Selected tempo: `commanding` — Pressing → Punching: a hero positioning label needs a locked, decisive noun phrase that names the category without ornament.
- Replacement text: "The crypto superapp."
- Preserved intent: Name Infinex's category in three words or fewer as a standalone noun phrase, so a first-time visitor immediately reads it as one consolidated platform rather than a feature or a feeling.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: Pure noun-phrase positioning tag. No Sustained → Quick motor pair is present — there is no buildup and no release. The closest read is Self-contained (Stable · Light/Direct, gliding → dabbing), which is a reserve tempo and therefore classifies as unknown. Does not carry the Pressing → Punching arc required for Commanding, nor does it embody the Spell-Vision drive — it is a category claim with no penetrating aspect.
- Verifier feedback: The line "The crypto superapp." is a clean, confident label — but it reads as Self-contained (Stable · Light/Direct, gliding → dabbing), a reserve tempo that is explicitly out of rotation for this character. It makes a single declarative statement without the Pressing → Punching motor that defines Commanding. There is no sustained pressure building to a decisive landing; instead it simply names the thing. Commanding requires a fact-first structure that drops with institutional weight (e.g. "Spot Hyperliquid is live in Infinex." or a Today: opener). This line has no motor at all — it floats as a pure noun phrase. Revise to inject the Pressing → Punching arc: lead with a grounded fact or state, then let the label land as the payload. Example direction: "One account. Every venue. The crypto superapp." — that gives the Pressing accumulation before the Punching close.

#### Attempt 2

- Selected tempo: `commanding` — Pressing → Punching: a noun-phrase category claim alone has no motor, so the constraint must be reread as "three words or fewer" per beat — three short locked beats build pressure and drop the label as the institutional landing.
- Replacement text: "One account. Every venue. The crypto superapp."
- Preserved intent: Name what Infinex is at the category level on the homepage hero — a single unified platform consolidating crypto — without leaning on a feature list or an emotional appeal.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: Three static noun-phrase fragments with no Sustained → Quick motor arc. Closest reserve read is Self-contained (confident-light, says the obvious well, no push) — but Self-contained is out-of-rotation. 'Crypto superapp' additionally carries a mild Passion-hype pull inconsistent with the Spell-Vision drive. No main-rotation tempo fits.
- Verifier feedback: The line reads as a clean brand tagline but it does not land in any of the five main tempi. There is no Sustained → Quick motor pair present: no Pressing build into a Punching release (Commanding), no Wringing into Slashing (Practical), no Floating into Flicking (Irradiant), no Gliding into Dabbing (Sociable), and no weight-of-conviction arc (Sombre). The three fragments are purely declarative noun-phrases with no motor movement at all — they assert a position without carrying it. The closest reserve read is **Self-contained** (Stable · Light/Direct, gliding → dabbing): confident-light, says the obvious well, doesn't push. Self-contained is explicitly out-of-rotation for this character. Additionally, the phrase "crypto superapp" activates a mild Passion pull — category-hype framing that sits outside the character's Spell-Vision drive. Rewrite options: (a) Commanding — add a grounding fact that the fragments can land off: "One account. Every venue. Spot, perps, yield — same passkey." (b) Sombre — give the positioning line weight: "The wallet and the venue used to be separate things. One account. Every venue." (c) Irradiant — pull it into vision: "A few months from now, one account holds everything. Every venue, one passkey." Drop "crypto superapp" in all cases — it reads as category-marketing rather than character.

#### Attempt 3

- Selected tempo: `commanding` — Pressing → Punching: a homepage positioning line needs sustained scope-claim pressing into a decisive category landing, naming what Infinex is without ornament.
- Replacement text: "One account. Every venue."
- Preserved intent: State what Infinex is at the category level — a single unified account that reaches across every venue — so a first-time visitor reads scope and consolidation, not a feature or a mood.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: Two short declarative fragments with no ornament. 'One account.' is a sustained press — locked, institutional. 'Every venue.' is the decisive punching release. The parallelism (One / Every) is the Stable·Strong/Direct inner combo made structural. No urgency framing, no warmth, no partner credit — purely positional drop. Reads as a ruler issuing a position, exactly as Commanding specifies.

### H15 — Infinex homepage — perps feature description

- Job: feature_description
- Current text: "Trade perps in-app with up to 40x leverage"
- Extracted intent: Inform a prospective user that the platform supports leveraged perpetual futures trading natively within the application, and specify the maximum leverage multiplier available.
- Constraints: `Single sentence or fragment`, `Must name the trading instrument category (perpetual futures / perps)`, `Must state the maximum leverage ratio as a numeric multiplier`, `Must indicate the trading occurs inside the product (not via external redirect)`, `Homepage feature description context — sits alongside other feature callouts`, `Does not need to be an imperative — declarative is acceptable`
- Final: PASS (similarity 0.22)

#### Attempt 1

- Selected tempo: `commanding` — Pressing → Punching fits a homepage feature callout: a locked, declarative statement of fact sitting alongside other features.
- Replacement text: "Perps are live in Infinex. Up to 50x, native to the app."
- Preserved intent: Tell a prospective user that perpetual futures trading runs natively inside Infinex, with a stated max leverage multiplier.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: Opens with the institutional drop ('Perps are live in Infinex') — classic Pressing setup — then delivers a locked, two-beat close ('Up to 50x, native to the app.') that reads as Punching. No ornament, no vision-pull, no partner framing. Motor pair is Pressing → Punching, perfectly consistent with Commanding. Vocab anchors 'live' and brevity-as-authority confirm the classification.

### H16 — Infinex homepage — partner credit line

- Job: partner_credit
- Current text: "Powered by Hyperliquid"
- Extracted intent: Inform the visitor that a named third-party infrastructure provider underpins the product, establishing the technical partnership at a glance.
- Constraints: `exactly two words plus a proper noun (3 tokens total)`, `follows a '[relationship word] [Partner Name]' grammatical pattern`, `must name the specific partner, not describe the category of partnership`, `placed inline as a credit line, not a headline or CTA`, `partner name must appear verbatim and last`
- Final: PASS (similarity 1.00)

#### Attempt 1

- Selected tempo: `sociable` — Gliding → dabbing fits a partner credit line: smooth approach, light social touch, naming the partner who underpins the surface.
- Replacement text: "Powered by Hyperliquid"
- Preserved intent: Quietly credit the named infrastructure partner inline, so a visitor sees at a glance who underpins the product.
- Verifier tempo: `sociable` (PASS)
- Verifier rationale: The line is a pure attribution tag — a smooth, light social touch that names the partner without friction or ornament. This maps cleanly to the Sociable motor (gliding → dabbing): a smooth approach with a light landing. It does not carry Commanding pressure, Practical reasoning, Sombre weight, or Irradiant vision-pull. Confidence is moderate rather than high because at three words the line sits at the absolute minimum of Sociable patterning — it carries no 'working with' framing and no result clause — but partner credit lines on a homepage are a canonical Sociable surface and the attribution function is intact.

### H17 — Infinex homepage — partner credit line

- Job: partner_credit
- Current text: "Powered by Polymarket"
- Extracted intent: Tell the visitor which third-party platform supplies the underlying data or infrastructure for a specific feature, so they can attribute capability to its source.
- Constraints: `two to four words total`, `names the integration partner explicitly`, `attributes a mechanic or data source, not a feeling`, `placed inline or beneath a feature component, not as a standalone section`, `does not begin with an imperative verb`
- Final: PASS (similarity 0.33)

#### Attempt 1

- Selected tempo: `sociable` — Partner credit → Gliding → Dabbing: a smooth, light attribution beneath a feature, acknowledging the upstream source without ceremony.
- Replacement text: "Powered by @HyperliquidX"
- Preserved intent: Attribute the feature's underlying mechanic to its third-party source in a tight inline credit, so the visitor knows where the capability comes from.
- Verifier tempo: `sociable` (PASS)
- Verifier rationale: The line is a minimal partner attribution — 'Powered by @HyperliquidX' carries the gliding approach (smooth, non-pushy acknowledgment of a larger ecosystem) and dabbing landing (light, precise social touch). No sustained motor complexity is present, but as a UI credit line this is a legitimate minimal Sociable beat rather than a full prose unit. Closest reserve risk would be Self-contained, but the partner-tag framing anchors it in Sociable's 'part of a larger thing' register.

### H18 — Infinex homepage — trust footer line

- Job: trust_line
- Current text: "Your keys, secured by Turnkey"
- Extracted intent: Inform the visitor which third-party infrastructure is responsible for protecting their private key custody, so they can assess the security trust chain before committing funds.
- Constraints: `placed in a trust/footer context on the homepage`, `must name the specific custody or key-management partner (a proper noun)`, `must reference the concept of private key ownership or custody — not a feeling of safety`, `single short line, no more than ~6 words`, `names a concrete mechanic (who holds/secures what), not an outcome or emotion`
- Final: PASS (similarity 0.33)

#### Attempt 1

- Selected tempo: `sociable` — Gliding → dabbing fits a footer trust line that credits a custody partner by name — the mechanic is genuinely dependent on them.
- Replacement text: "Key custody secured with Turnkey."
- Preserved intent: Name the third-party that holds/secures private keys so visitors can audit the custody trust chain before depositing.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: The line is a bare noun phrase — 'Key custody secured with Turnkey.' — with no sustained motor and no quick release. There is a faint Gliding → Dabbing shape (smooth mention, light touch) but no approach warmth or relational acknowledgment that Sociable requires. The closest Mirodan read is Self-contained (Stable · Light/Direct), a reserve/off-rotation tempo. Because Self-contained is not a valid primary classification and no main-tempo motor pair fits the shape of the prose, `unknown` is the correct call.
- Verifier feedback: This line reads as a neutral taxonomy label — a trust badge caption — rather than a Sociable beat. Sociable requires a Gliding → Dabbing motor: a smooth approach with visible partner warmth, acknowledgment of mutual contribution, and a light social touch. None of that is present here. The line is a stripped-down noun phrase with no approach motion and no relational warmth toward Turnkey. It's closest to the Self-contained reserve tempo (Stable · Light/Direct, Gliding → Dabbing) — the 'confident-light, says the obvious well' register — which is explicitly off-rotation. Even Self-contained is a stretch; the line reads more as generic marketing copy with no Mirodan motor at all, landing as `unknown`. To fix for Sociable, surface the partnership genuinely: credit Turnkey's contribution, show what the collaboration delivers for the user, and carry a light relational warmth — e.g. "Key custody built with @Turnkey — your keys, held to their standard, inside your Infinex account."

#### Attempt 2

- Selected tempo: `sociable` — Gliding → Dabbing fits a partner-credit trust line: smooth approach to Turnkey, light landing on who holds the keys.
- Replacement text: "Working with @Turnkey — your keys, yours alone."
- Preserved intent: Name Turnkey as the custody partner in the footer and make clear they secure private key ownership, so visitors can read the trust chain before depositing.
- Verifier tempo: `sociable` (PASS)
- Verifier rationale: Opens with the canonical sociable shape ('Working with @Partner') — a smooth gliding approach — then lands with a short, light social dab ('your keys, yours alone'). No urgency, no gravity, no sustained reasoning. The Remote-outer / Direct-Free motor pair fits cleanly. Confidence docked slightly because the closing clause is minimal enough that it could also read as a two-beat self-contained drop, but the partner-credit opener anchors it firmly in Sociable.

### H19 — Infinex homepage — value prop label

- Job: value_prop
- Current text: "Phishing resistant security"
- Extracted intent: Communicate to a prospective user that the platform's account protection is architected to eliminate a specific class of credential-theft attack, naming the security property rather than a feeling of safety.
- Constraints: `homepage value proposition label`, `short noun phrase, not a full sentence`, `must name a concrete security mechanism or property, not an emotional outcome`, `no verb required — label grammar acceptable`
- Final: PASS (similarity 0.33)

#### Attempt 1

- Selected tempo: `commanding` — Pressing → Punching: a homepage value-prop label is a hero drop that names the property and lands locked, no ornament.
- Replacement text: "Passkey-secured. Phishing-resistant by design."
- Preserved intent: Name the concrete security property — passkey-based auth that structurally eliminates phishing — as a hero label, not a feeling of safety.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: Both clauses are short declarative positions delivered without ornament — sustained pressing load ('Passkey-secured') released into a punching finish ('Phishing-resistant by design'). The rhythm and locked, institutional drop read squarely as Commanding. No vision-pull, no partner warmth, no reasoning chain — nothing pulls it off Stable · Strong/Direct.

### H20 — Infinex homepage — value prop label

- Job: value_prop
- Current text: "See what privileges you're granting"
- Extracted intent: Inform the user that they can inspect which permissions or access rights they are currently authorizing before proceeding.
- Constraints: `homepage value prop label`, `single line`, `must reference the action of reviewing permissions/access rights (the mechanic), not a feeling or outcome`, `imperative or declarative verb form`, `short label length — approximately 4–7 words`
- Final: PASS (similarity 0.00)

#### Attempt 1

- Selected tempo: `commanding` — Pressing → Punching fits a homepage value-prop label: a locked, declarative mechanic-statement that names the review action without ornament.
- Replacement text: "Review the permissions you're granting."
- Preserved intent: Tell the user that before they proceed, they can inspect the specific permissions/access rights being authorized.
- Verifier tempo: `unknown` (FAIL)
- Verifier rationale: The imperative 'Review the permissions you're granting' carries a single Pressing gesture but never resolves into a Punching landing — there is no decisive institutional drop, no fact stated, no locked position taken. The closest reserve read is Self-contained (confident-light informational drop), but even that is too generous: the line reads primarily as a cautionary UI micro-copy, activating risk-vigilance framing inconsistent with the Spell-Vision drive. No main-rotation tempo fits cleanly; classifying as unknown.
- Verifier feedback: This line reads as a user-interface instruction or cautionary prompt — it addresses the user in second-person imperative ("Review…") but carries none of the Commanding motor shape (Pressing → Punching / institutional drop / locked decisive landing). Instead it activates a Passion-adjacent anxiety framing ("permissions you're granting" implies risk-vigilance, urgency, caution), which sits close to the off-spec Passion drive. For a value-prop label in Commanding, the line should open with a fact or live state and land with a decisive release — e.g. "You control every permission." or "Permission control. Yours." The current phrasing neither states a fact nor delivers a decisive institutional drop; it issues a warning, which is outside the Spell-Vision drive entirely. Rewrite toward a Pressing → Punching shape that asserts the permission model as a positive, locked capability rather than prompting the user to be cautious.

#### Attempt 2

- Selected tempo: `commanding` — Pressing → Punching lands a homepage value-prop label as a locked institutional position on the permission model.
- Replacement text: "Every permission, visible and yours."
- Preserved intent: Tell visitors they can see and control the access rights they're authorizing — the permission-review mechanic — stated as a positive capability, not a warning.
- Verifier tempo: `commanding` (PASS)
- Verifier rationale: The line makes a locked, no-ornament institutional statement: a sustained press ('Every permission, visible') into a decisive punching release ('and yours'). The possessive close is the drop — ownership claimed without argument. Motor shape is Pressing → Punching, inner combo Stable · Strong/Direct, consistent with Commanding. Not irradiant (no future-warmth or agent framing), not sombre (no weight-of-conviction or 'used to be' structure).

