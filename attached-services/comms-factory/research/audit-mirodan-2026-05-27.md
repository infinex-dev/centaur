# Mirodan/Copy Audit — Actor/Director run 01KS6QJNEGFYP6X048V8Y900DM
Date: 2026-05-27
Pass: 2 of 2 (copy + Mirodan canon lens)
Bench: Mirodan vol 2 chapters 1-3 (`/Users/opaque/Downloads/nigel-session-2026-04-28/`)

---

## 1. Headline verdict

The Mirodan vocabulary encoded in code is largely correct on factor-shapes and Variation labels — but the system **misuses the Drive vocabulary as a copy-judgment cudgel** and the Director is the broken stage in the pipeline, not the Actor. The Actor is producing genuinely shippable, on-character copy by attempt 2 (especially attempt-2 X "fiat and crypto live in the same place / wires + SEPA arrive / wall used to be between them"). The Director then rejects it on a fabricated Mirodan rule that "Vision must be the visible projection," walks the Actor in circles, and by attempt 3 has dragged the copy from solid SHIPPABLE into a contorted shape that finally reads as **certain** (Awake-outer) — a tempo Infinex literally cannot occupy as a baseline. Net: the copy is commercially usable; the audit loop is destroying it.

---

## 2. Canon-correctness table (every Mirodan claim in code, checked against chapters)

| Claim location | Claim | Verdict | Canon citation |
|---|---|---|---|
| `actor-memory.ts:91-116` MIRODAN_24_TEMPI: commanding | Stable Strong+Direct, Pressing→Punching, "Commanding demonstration or acceptance of a 'bold resolve'" | **CORRECT** | Ch2 p.494, ch2 §2 Variations table |
| same: practical | Stable Strong+Flexible, Wringing→Slashing, "Developing intention to cast or to submit to a 'spell-binding power'" | **CORRECT** | Ch2 p.495-497 |
| same: receptive | Stable Light+Flexible, Floating→Flicking, "Receptive acceptance or receptive rejection of a 'welcoming tenderness'" | **CORRECT** | Ch2 p.495 |
| same: self-contained | Stable Light+Direct, Gliding→Dabbing, "Cautious expression or cautious acceptance of a 'gentle deference'" | **CORRECT** | Ch2 p.497 |
| same: sombre | Adream Strong+Bound, Pressing→Punching | **DISTORTED** in voice spec | Ch2 p.460 ("Overpowering, sombre unawareness of a 'staunch resolve' or of an 'aggressive resolve'. Subconscious Motifs: Punching / Pressing"). The taxonomy file is right; but in `infinex.ts:91-95` sombre is labeled motor `["pressing","punching"]` "same motor as Commanding, bound flow" — that conflates the Stable Adapting → Adream-outer relation. Mirodan: Adream Strong/Bound is its own Variation, not a "bound version" of Commanding. The motor is identical (Punching/Pressing); the inner Attitude is *not*. |
| same: irradiant | Adream Light+Free, Floating→Flicking, "Irradiant unfolding or irradiant enfolding of a 'sympathetic exultation'" | **CORRECT** | Ch2 p.462-465 |
| same: overpowering | Adream Strong+Free, Wringing→Slashing | **CORRECT** | Ch2 p.465-468 |
| same: diffused | Adream Light+Bound, Gliding→Dabbing | **CORRECT** | Ch2 p.468 |
| same: sociable | Remote-outer Direct+Free, Gliding→Dabbing, "Developing or contracting feeling of 'sociable companionship'" | **CORRECT** | Ch2 p.447 |
| same: altruistic | Remote-outer Flexible+Free, Floating→Flicking | **CORRECT** | Ch2 p.444-446 |
| same: certain | Awake-outer Direct+Sustained, Pressing/Gliding | **CORRECT** | Ch2 p.481-483 |
| `infinex.ts:357-368` Drive table cell: "stable\|penetrating\|flow → primary=spell, secondary=doing, introvert=passion, extravert=vision" | Diagram D of Stable | **DISTORTED — non-canonical encoding.** Canon (ch3 p.546-548): **STABLE = DOING + SPELL** (confluence). The drive table in `infinex.ts:303-307` lists this correctly. But the "introvert=passion, extravert=vision" rendering of the X-diagram is from `laban-mirodan-reference-2026-04-28.md` — the user's *synthesis*. Mirodan ch3 p.556-557 names the four diagram slots as Inner Character / Outer Character / Inner Action / Outer Action; mapping these to introvert/extravert via "drive_introvert / drive_extravert" is operator vocabulary, not Mirodan's. The mapping ITSELF (Inner Action = Passion, Outer Action = Vision for Stable|Penetrating|Flow) checks against Mirodan ch3 p.554-557 reasoning about Stress-axis × Aspect. **CORRECT in substance, DISTORTED in vocabulary** (canon uses Inner/Outer Action; code uses introvert/extravert). |
| `infinex.ts:280-291` MIRODAN_KERNEL rule 6 | "Sustained/Quick are Time poles inside those actions, not separate action types" | **CORRECT** | Ch1 p.341, 8-Working-Actions table |
| same: rule 7 | "Every Quick Working Action requires its matching Sustained Working Action as preparation" | **CORRECT** | Ch1 p.347-348 |
| same: rule 10 | "Subdued, hidden, or introvert does not mean absent" | **CORRECT** | Ch3 p.557 ("Attitudes are not... a matter of excluding altogether any of these functions"). |
| `actor-memory.ts:246-261` movement_corpus_block | All Motion-Factor / Inner-Participation / Inner-Attitude mappings | **CORRECT** | Ch1 grand equation p.276 |
| same: "Only Stable, Near, and Adream contain Weight/Intending and can be baseline characters. Mobile, Remote, and Awake are Action Attitudes only" | **CORRECT** | Ch2 p.432 fn ("Remote, like Awake and Mobile, not having Intending as a component, can only exist as an Action Attitude") |
| `actor-memory.ts:316` Director method: "Read two signals per beat: HOW = two-factor Variation + Working Action motor; WHY/AT-WHAT = the directional-intent pole inside the canonical shorthand" | Directional-intent axis as orthogonal | **CORRECT** | Ch2 every Variation shorthand pairs OR poles ("acceptance OR rejection", "consent OR dissent"); operator memory `mirodan-directional-intent-axis` formalizes this. |
| `actor-memory.ts:341-368` infinex_placement_block: "Infinex extravert projection must be Vision" | Drive-axis prescription for copy surface | **INCORRECT — over-claimed.** Mirodan (ch3 p.529, 558) is explicit: the system "charts the flow of psychological energy into physical expression"; drives are **read by audience from the result**, not performed as labels by the actor. Ch3 p.530 explicitly: "Externalized Drives are used to *identify* the Inner Attitude of a Character." Identification ≠ performance instruction. The Director memory at lines 318-321 actually contains the correct hedge ("Treat drive_read as an inferred surface/projection classification. Do not demand that each line directly performs a drive label.") — but the prompt also says "Infinex extravert projection must be Vision" and the Director consistently fails copy for "doing as visible surface" anyway. The hedge is being overridden by the rule above it. |
| `infinex.ts:303-320` MIRODAN_DRIVE_TABLE | 12 character-cell Diagrams (Stable × Aspect × Stress; Adream × …; Near × …) | **PARTIAL DISTORTION.** The structure (each cell maps to primary/secondary/introvert/extravert) is operator synthesis, not Mirodan's notation. Mirodan ch3 names only the four corners of the X (Inner Character / Outer Character / Inner Action / Outer Action). The operator's relabeling to introvert/extravert is sensible but adds a layer canon doesn't carry. Worse: the cells were derived from the `laban-mirodan-reference-2026-04-28.md` synthesis without an independent check against Mirodan ch4 (Applications), which has the 24 actual Character Diagrams. Spot-check: Stable|Penetrating|Flow = Diagram D. Canon (operator's `infinex-drive-spell-not-passion` memory) confirms Spell-Vision as main axis. ✓ |
| `validator.ts:326-342` OFF_SPEC_REGEXES | Time-pressure, FOMO, hype-theatre regexes reject "Passion as visible projection" | **DISTORTED.** The regex catches do real work (urgency theater IS off-character for Infinex by the operator's lock), but the *reason* given — "surfaces Passion as visible projection" — is a Mirodan-vocab dress-up of a brand rule. Passion in Mirodan ch3 p.534-535 is "constant change" + "I've lost my head" + emotion overriding thinking. Urgency vocabulary is *one* surface symptom of Passion-as-extravert; FOMO-urgency is not "Passion" per se in canon. The regex is right; the canon-citation in the reason field is theatrical. |
| `validator.ts:122` em-dash zero-tolerance rule | "Em-dashes are AI-slop signature" | OUTSIDE-CANON. Operator policy 2026-05-25. Not a Mirodan claim and not in the canon — fine, as long as it doesn't claim to be. ✓ |
| `actor-memory.ts:312` "Strong + Direct + Sustained is not a three-factor definition of commanding. It is either Stable Strong+Direct with Sustained/Pressing motor…" | Two-factor Attitude-gate-first rule for Director classification | **CORRECT and load-bearing.** This is the right Mirodan-faithful directive (ch3 p.530: "Inner Attitudes use TWO Motion Factors and appear as Shadow Moves; Drives use THREE and appear as full Working Actions"). Variation = 2 factors; motor = the third. The Director memory has this right. But the Director model **does not consistently obey it** — see Director audits in §3. |
| `infinex.ts:39-46` `inner_attitude: "stable", stress: "flow", stress_pole: "bound"` | Locked placement | **CORRECT** | Operator lock per `infinex-drive-spell-not-passion`. |
| `infinex.ts:380-382` `super_objective: "to take responsibility for the tech, so the user only has to want"` | Locked Want | **CORRECT** | Operator lock per `infinex-cto-responsibility-frame`. |
| Actor table-work upstream (the `table_work` and `warmup` blocks are emitted in the actor's first call alongside performances) | "Super-Objective + Through-Action + Obstacle + Lining ahead of generation" | **PARTIALLY CORRECT — bolted in same call, not upstream.** Per operator's `methodology-actor-table-work-before-drafting` ("Generator should run in TWO stages: (a) inner-work stage producing structured JSON {thesis, through_action, obstacle, lining, beat_plan}, (b) drafting stage receiving the inner-work as constraint. Single-call generators rationalize; two-call generators must commit before drafting."), the actor pipeline should emit table-work first, hash/commit it, then call again for performances. The current code (`actor-director.ts:228-263`) does this in ONE Anthropic call producing the whole JSON tree at once. The actor produces beautiful table-work but the model is free to backwards-rationalize the table-work to fit the draft. This is exactly the failure mode the memory warns against. |

---

## 3. Per-candidate scoring (every option in the run review, blind)

### Attempt 1

**X channel (5 options + 1 selected):**

- **X-1**: "A wire can now arrive into your Infinex account. / So can a SEPA transfer. The account holds it. / The wall between your bank and your wallet was the part you were tolerating. It isn't there anymore." — **CLOSE**. Strong bank-grammar opener; "the part you were tolerating" is operator-grade banker-trailblazer voice. Closing "It isn't there anymore" is a clean Vision projection. Em-dash-free. The "now" pulls slightly toward activation framing but Mirodan-wise this is fine — Stable can mark state-transition.
- **X-2** (selected): "Send a wire to your Infinex account. It arrives. / Send a SEPA transfer. It arrives. / The sentence that used to require a bank now describes a wallet." — **SHIPPABLE**. The repeated "It arrives" is restrained, banker-plain. The closing line is the Vision projection in compact form. Reads exactly like the locked banker-trailblazer character (knows banks intimately, doesn't have to perform amazement). Director rejected this as "self-contained" / Doing-surface — see §5 distinction failures, this rejection is canon-misuse.
- **X-3**: "Your Infinex account now has account and routing numbers. An IBAN. A CLABE. A PIX code. / Things arrive into it the way they arrive into a bank. / The category your money used to live in stopped being the boundary." — **CLOSE**. The identifier enumeration ("account+routing, IBAN, CLABE, PIX") is exactly what the rehearsal warned against (the "rails list" trap). Drags toward Doing-demonstration. But the closing line lands.
- **X-4**: "For a long time, fiat was something you sent to a bank and crypto was something you held in a wallet. / In an Infinex account, those are the same sentence now." — **SHIPPABLE**. The cleanest before/after structure of the five. "Those are the same sentence now" is the operator's banker-trailblazer voice in two clauses. Quote-worthy.
- **X-5**: "A deposit to your Infinex account now looks like a deposit to a bank. / Wire it. It clears. The account holds it. / The step that used to be a bridge isn't a step anymore." — **SHIPPABLE**. "The step that used to be a bridge isn't a step anymore" retires the bridge metaphor surgically. Tone is the locked character at his most settled. The middle three-beat "Wire it. It clears. The account holds it." is bank-grammar at its most disciplined.

**Web channel (5 options + 1 selected):**

- **Web-1** (selected): "Your Infinex account now takes a wire the way a bank does." — **SHIPPABLE**. One-line bank-equivalence statement. Reads like a product-page heading at a bank. The locked character image.
- **Web-2**: "Wires, SEPA, PIX — they arrive into your Infinex account the same way they arrive into a bank." — **CLOSE**. Em-dash present; the validator would have caught it (and didn't — see §5, the script validator clearly didn't fire here; perhaps the em-dash is treated as exception or hyphen-minus, but the visible character is `—`). Three rail names function as recognition tokens (per actor rationale), which actually does work — bank readers recognize a USD/EUR/MXN trio.
- **Web-3**: "Your Infinex account now has account and routing numbers. An IBAN. A CLABE." — **CLOSE/SLOP edge**. Three short fragments. The identifier-only structure leaves the reader doing the synthesis, which is risky in a one-line web slot.
- **Web-4**: "Deposit fiat to your Infinex account. The account holds it." — **SHIPPABLE**. Maximum plainness. "The account holds it" is Werle-as-banker at his most settled. Probably the strongest of the five web options.
- **Web-5**: "Fiat arrives into your Infinex account. No bridge, no bank in the middle." — **OFF-VOICE**. "No bridge, no bank in the middle" is *agonistic* — it states what's absent, which is closer to crypto-tribal voice ("no middlemen!") than to the banker-trailblazer who doesn't need to negate the old world.

### Attempt 2

**X channel (5 options + 1 selected):**

- **X-1** (selected): "In an Infinex account, fiat and crypto live in the same place. / A wire arrives there. A SEPA transfer arrives there. The account holds both. / The wall used to be between them. It isn't part of the territory anymore." — **SHIPPABLE**. The Director's notes drove the Actor to "territory image first, working examples radiating inside it as inhabitance, closing line that speaks the wall in the imperfect" — and the Actor delivered exactly that. "The wall used to be between them. It isn't part of the territory anymore." is a clean banker-trailblazer cartographic statement. Three-beat arc; preparation hierarchy intact (Wringing → Slashing). The Director then passed this. Then attempt 3 broke it.
- **X-2**: "An Infinex account is one place that holds both sides of the wall. / A bank wire goes there. A stablecoin balance lives there. Same account, same address. / The wall is on older maps." — **SHIPPABLE**. "The wall is on older maps" is one of the strongest single lines in the whole run. Quote-worthy. Cartographic register native to the locked character.
- **X-3**: "There is one account that money arrives into, whether it comes from a bank or from a chain. / A wire. A SEPA. A stablecoin transfer. Same destination. / The two systems your money lived between are one system inside Infinex." — **CLOSE**. Slightly more declarative ("one system inside Infinex" is brand-naming inside the body, slightly awkward). Otherwise fine.
- **X-4**: "Money no longer needs to know which side of the wall it came from to get into your Infinex account. / A bank wire arrives. A SEPA transfer arrives. A stablecoin transfer arrives. All into the same address. / That wall is the part you were keeping the map for." — **SHIPPABLE**. "That wall is the part you were keeping the map for" is the most pointed Vision line in the whole run — obsoletes the reader's mental cartography, not just the feature. This is the lining surfaced exactly as it should be.
- **X-5**: "An Infinex account is a single place where money lives — whether it arrived from a bank or from a chain. / A wire becomes a balance. So does a SEPA transfer. So does an on-chain transfer. / The boundary was the inheritance from two industries that didn't speak. It isn't in the territory here." — **CLOSE**. Em-dash again; validator should reject. "Inheritance from two industries that didn't speak" is reaching slightly for poetry. Otherwise solid.

**Web channel (5 options + 1 selected):**

- **Web-1** (selected): "In an Infinex account, fiat and crypto live in the same place." — **SHIPPABLE**. One sentence. Cartographic register. Locked character voice. The Director rejected as "commanding tempo, but Doing-as-extravert, not Vision" — see §5; this rejection is a category error. Commanding is on the primary palette and the sentence IS the Vision (a new map of where money lives). The Director said "for the Infinex axis (Spell → Vision) to be readable as a beat, a second sentence must carry the Vision extravert" — this is a fabricated requirement. Single-line web copy is one beat; the resting beat IS the placement.
- **Web-2**: "Your Infinex account is one place — for the money you held at a bank and the money you held on-chain." — **CLOSE**. Em-dash. Otherwise on-character.
- **Web-3**: "Fiat and crypto end up in the same account." — **SHIPPABLE**. Compressed cartography. Possibly the single strongest web line in the run.
- **Web-4**: "The line between your bank account and your wallet isn't in the way an Infinex account works." — **OFF-VOICE**. Mild — "isn't in the way" verges on negation framing.
- **Web-5**: "An Infinex account is where money lives — whether it came from a bank or a chain." — **CLOSE**. Em-dash. Reads native otherwise.

### Attempt 3

**X channel (5 options + 1 selected):**

- **X-1** (selected): Same text as Attempt 2 X-1. **SHIPPABLE** as in Attempt 2. Director now rejects it as "certain" tempo (Awake-outer; illegal for Infinex). Director did a 180 from previous attempt's "passed as self-contained." See §5 — this is Director self-contradiction.
- **X-2 through X-5**: Same options as Attempt 2 — verdicts unchanged.

**Web channel (5 options + 1 selected):**

- **Web-1** (selected): "In an Infinex account, fiat and crypto can live in the same place. From inside, there is no other side to cross to." — **CLOSE/OFF-VOICE drift**. "Can live" softens the territorial claim into a hypothetical. "From inside, there is no other side to cross to" has the "to cross to" double-preposition phonetic drag the Director itself flagged. The pre-Director attempt-2 web copy ("In an Infinex account, fiat and crypto live in the same place.") was stronger; the Director's loop pushed it backward.
- **Web-2**: "In an Infinex account, fiat and crypto can live in the same place. The two destinations you used to keep separate are one place to stand." — **CLOSE**. "One place to stand" is the strongest of the five second-sentence options.
- **Web-3**: "In an Infinex account, fiat and crypto can live in the same place. The view from inside doesn't include a wall to look across." — **OFF-VOICE**. "The view from inside doesn't include a wall to look across" is precious — territorial-metaphor strained.
- **Web-4**: "In an Infinex account, fiat and crypto can live in the same place. A paycheck and a stablecoin are the same balance once they arrive." — **SHIPPABLE**. The paycheck/stablecoin pairing is concrete, recognizable, locked-character-voice. "Once they arrive" is bank grammar. The best of the five attempt-3 web options.
- **Web-5**: "In an Infinex account, fiat and crypto can live in the same place. What used to be a crossing is now a single account to stand in." — **CLOSE**. "A single account to stand in" is on-character but slightly mannered.

---

## 4. Failure-mode patterns

**Over-reliance on walls / territory / holds / same-place phrasing.** YES. The Bridge.xyz card's deployed_facts about "fiat-to-crypto conversion + on-chain delivery" plus the rehearsal frame of "the dissolved wall" caused every single candidate across three attempts to use one or more of: *wall*, *territory*, *crossing*, *boundary*, *same place*, *one place*, *map*, *no other side*. This is **same-placement-rephrased**: 15 X candidates + 15 web candidates, ~28/30 use one of those tokens. The Mirodan placement is correct; the *image lexicon* has collapsed to a single semantic neighborhood. Operator's voice spec has the antibody — `irradiant.vocab_anchor` includes "agent", "your own", "without thinking about it", "one step closer", "the move we're making" — but the Bridge.xyz card pulled the actor toward cartography metaphors and the cartography lexicon never broke open.

**Pressing → Punching/Slashing motor lockstep.** All 30 candidates use one of: Pressing → Punching, Wringing → Slashing, or Pressing → Gliding/Dabbing. No Floating / Flicking / Irradiant motor was attempted, despite Irradiant being 45-50% of the locked Infinex cadence (per `infinex-5-tempi-locked` memory). The Actor never moved into Irradiant register. Verdict: the Actor over-fitted to the "release card pressure" framing (which encourages weight + resolution) and never explored the lighter motors. Card-kind-default beat sequences in `infinex.ts:418-456` for `launch-tier`/`data-card-official` do specify `sombre → commanding → practical → irradiant`, but the Bridge.xyz card may not be `launch-tier`; the default chain is `sombre → commanding → irradiant`, so the Actor should have closed in Irradiant once. None of the three attempts did.

**Bad tempo reads by Director (not Actor).** The Director consistently reads any Light + Direct + Sustained line as "self-contained" or "certain" (Awake-outer) and then declares it illegal because it's beat-only or off-palette. This conflates two things: (1) the Variation factor-shape, which is Mirodan canon, and (2) the Attitude that owns the Variation, which depends on which OTHER factors are also active. The Director's own kernel (`actor-memory.ts:307-313`) says exactly this and it's correct — but the Director model isn't following its own kernel. The single sentence "Your Infinex account now takes a wire the way a bank does" was scored Strong + Direct + Sustained + Bound and then read as Commanding — fine. The single sentence "In an Infinex account, fiat and crypto live in the same place" was scored Strong + Direct + Sustained + unclear and ALSO read as Commanding. Then the SAME sentence with a second clause ("From inside, there is no other side to cross to") was read as Light + Direct + Sustained + Bound = self-contained. Each individual classification is plausible, but the system is **assigning maximum tempo confidence (1.00 across all three attempts) to four-letter factor-shape reads that are inherently ambiguous on short copy**. Director confidence calibration is broken — it's never below 0.72 in this run.

**Listicle voice, exclamation cadence, "just got Y" template.** None present. Validator regexes are working on these — credit where due.

**Missing inner-cause logic (Super-Objective → Through-Action → Obstacle → Lining → tempo emerges).** Inverted, not missing. The Actor IS doing actor table-work (Super-Objective is in the voice spec; Through-Action, Obstacle, Lining are all filled per attempt). The Director then uses the Lining as a SCORING criterion ("lining is absent from the prose"). Mirodan ch1 p.357: **"Shadow Moves always reveal the hidden nature and never the acknowledged intentions of the character"** — i.e., the Lining is *hidden by design*. The Director keeps demanding that the Lining surface explicitly in the prose. This is canon-inverted: if the Lining is visible, it's not Lining anymore.

**Same-placement-rephrased.** Across 30 candidates the Actor produced ~5 genuinely distinct image-systems: (a) bank-grammar imitation ("send a wire / it arrives"), (b) bank-identifier placement ("IBAN, CLABE on a wallet"), (c) cartographic territory ("the wall isn't in the territory"), (d) inheritance-from-two-industries framing, (e) "view from inside / no other side." The "wall / territory / same place" semantic neighborhood dominates. **Image diversity = low**; the lexicon is collapsing toward a single metaphor.

---

## 5. Distinction failures (places code/prompts collapse distinctions Mirodan keeps separate)

**Distinction 1: Drive is identification, not performance instruction.**

The Director prompt (`actor-memory.ts:355`) says: "Off-spec as visible/extravert surface: passion. Hidden/introvert lining may still exist." And `actor-memory.ts:361-362`: "Resting Spell without a visible Vision projection is not automatically off-character. It can be a legal contained beat, especially in one-line web or UI copy." This hedge is **correct per Mirodan ch3 p.527** ("Externalized Drives are used to identify the Inner Attitude"). But the same prompt at `actor-memory.ts:355` says "Infinex extravert projection must be Vision" and **the Director repeatedly fails copy that "presents Doing as visible surface"** — flatly contradicting its own hedge. The Director memory contains both rules; the Director model chose the wrong rule on attempts 1, 2-web, and 3-web/x.

The canon position: Mirodan ch3 p.529-530 — Drives flow IN to feed Inner Attitude, and flow OUT into Action. The Drive is the read that audience makes from the visible Working Action. **An Actor cannot "perform Vision."** It's a derived audience-read. Demanding "more Vision in the visible projection" is a category error. Operator's locked drive cell (Diagram D, Spell→Vision) is correct, but it describes how the audience *should* read the result, not how the writer should construct the line.

**Distinction 2: Lining is hidden by design.**

Ch1 p.357: Lining "always reveal[s] the hidden nature and never the acknowledged intentions of the character." Ch3 p.530 on Drives: they "appear in the form of Shadow Moves" — i.e., the lining surfaces as involuntary 2-axis fragments, not as conscious 3-axis Working Actions. The Director on attempts 1 and 2-web demands: "The lining ('the bank wall just stopped existing') is entirely absent from the prose — the Outer Action is present but the hidden Inner Action is unreadable." **This is the wrong demand.** Hidden Inner Action should be hidden, by definition. The Director is asking the Actor to make the Lining visible, which by Mirodan canon collapses Outer/Lining into a single layer.

**Distinction 3: Tempo emerges, never assigned.**

Per `methodology-actor-table-work-before-drafting`: "tempo, motor, and dynamic placement are *outputs* of inner work, not inputs." The Actor's table-work assigns motors per beat ("working_action: pressing", "working_action: wringing") *before* drafting. This is correct usage when treated as a *prediction* of what the inner cause should generate, but in practice the Actor is **constraining the draft to fit the pre-assigned motor**. Attempt 2 X table-work explicitly pre-declares "wringing → wringing → slashing" — and lo, the draft is Wringing → Wringing → Slashing. Tempo-as-prediction has been collapsed into tempo-as-target, paint-by-numbers.

The canon fix: Actor declares the **transitive verb** per beat ("to map", "to inhabit", "to confirm") and lets the motor emerge from the verb under the Lining. Mirodan ch1 p.350-351: "'Punching' can't be acted. 'To box' can." The current Actor JSON requires `working_action` per beat — the schema is structurally enforcing the anti-pattern.

**Distinction 4: Stable/Adream/Remote outer projections are NOT the same as Stable/Adream/Remote Inner Attitudes.**

`infinex.ts:91-95` defines `sombre.attitude = "adream"` and the comment says "outer projection of flow-stressed stable." This is canon-faithful in substance (Stable Flow-stressed produces Adream and Remote outer Actions per Mirodan ch2 p.487). But the validator at `validator.ts:524` filters classification to `voice.main_tempi` and the Director compares "primary tempo" to that list. If the Director reads `irradiant` (Adream outer), the system treats it as the Adream Variation, not as the Adream-outer-of-Stable. The vocabulary in the codebase is sound; the Director's classifier output ("attitude_or_state: Stable|Near|Adream|Mobile outer|Remote outer|Awake outer|unknown" per `actor-director.ts:510`) does distinguish — but **the placement_read field collapses it back into a single label** ("self-contained tempo (Stable; motor Gliding → Dabbing)" — fine — and "certain tempo... Awake outer tempi are Action Attitudes only" — fine — but then in the fit_reason the Director conflates "tempo on the Infinex palette" with "tempo of the Infinex character", which are different things). Awake outer can fire as an Outer Action of a Stable character. The Director treats "certain" as flatly illegal.

**Distinction 5: Directional intent (toward/away) is encoded but not used.**

`actor-memory.ts:257` movement_corpus_block names it: "Directional intent is orthogonal to factor shape and motor: Mirodan's X-or-Y Outer Interpretations mark toward/away, for/against." The Director prompt has the rule. But no Director audit in this run mentions directional intent at all. The OR-pole signal is lost in classification. This is the simplest fix on the list.

**Distinction 6: Two-call inner-work pattern is documented but not implemented.**

Per `methodology-actor-table-work-before-drafting`: "Generator should run in TWO stages: (a) inner-work stage producing structured JSON, (b) drafting stage receiving the inner-work as constraint. Single-call generators rationalize; two-call generators must commit before drafting." The current code (`actor-director.ts:228-263`) makes a single API call producing the whole JSON tree at once. The Actor is producing table_work and performances *in the same response*. The model has free run to harmonize. This is the same architectural issue Codex flagged in 2026-05-15 for the validator (which led to the hybrid path).

---

## 6. Ranked recommendations

### P0 — fix the Director loop

1. **Director must STOP failing copy on "Doing is visible / Vision absent."** Mirodan ch3: Drives are read, not performed. Patch `actor-memory.ts:344-368` infinex_placement_block to remove the rule "Infinex extravert projection must be Vision" and replace with "Off-spec extravert is Passion (urgency, FOMO, time-pressure). Doing or Spell as visible surface is acceptable; Vision is the *target* read, but absence does not fail a single line." This single change would have passed every shippable candidate in §3.

2. **Remove the demand that Lining be visible.** Patch `actor-memory.ts:312-326` directorMethodBlock: replace "Lining" demands with "Lining check: if the prose accidentally reveals what should remain hidden (the strategic anti-pattern of the character), fail. Otherwise, hidden is correct." Today the Director flunks copy for Lining-absent, which is the inverse of Mirodan.

3. **Director confidence calibration.** Three attempts × 4 audits = 12 audit scorings; 9 had confidence 1.00, 1 at 0.72, 0 at <0.5. Two-factor reads on 5-12 word web copy cannot be 1.00 confident. Hardcode a confidence cap on classification: if the candidate has fewer than 3 beats AND fewer than 20 words, cap classification confidence at 0.6 and emit "tempo: short-copy-undetermined" rather than a tempo name. This stops single-sentence web copy from being branded as full Variations.

### P1 — fix the Actor schema

4. **Split the Actor call into two stages.** `generateActorAttempt` in `actor-director.ts:228-263` must call (a) inner-work-only JSON (warmup + table_work, no performances), then (b) performances given (a) as system context. Operator's `methodology-actor-table-work-before-drafting` is explicit. Today the single call lets the model rationalize backward.

5. **Remove `working_action` from per-beat Actor schema; replace with `verb` only.** Per Mirodan ch1 p.350-351 ("'Punching' can't be acted. 'To box' can.") + operator memory. Let the motor emerge from the verb + Lining. The Director can read it back. Today the Actor is target-painting motors and the Director is rubber-stamping them.

6. **Image-lexicon variety.** Add a soft check in the Actor: across the 5 final-copy options for a channel, count unique nouns/metaphors. If 4 of 5 use the same core image (wall/territory/place), generate one option in a different image system. Today the 30 candidates collapse to ~5 image systems; an LLM with a 5-options-must-be-distinct constraint will produce more lexical variety.

### P2 — taxonomy cleanups

7. **In `infinex.ts:91-95` sombre.feel** — drop the line "same motor as Commanding, bound flow." Sombre is its own Variation (Adream Strong/Bound, Mirodan ch2 p.460), not a "bound version" of Commanding. The motor is identical but the Attitude is not. The current language conflates motor with Variation.

8. **`infinex.ts:303-320` MIRODAN_DRIVE_TABLE** — rename the slot vocabulary from `primary/secondary/introvert/extravert` to Mirodan's canon `inner_character/outer_character/inner_action/outer_action` (Ch3 p.556). Same data, canon-faithful names. The current naming hides the fact that "extravert = Outer Action Drive" which is exactly what the Director needs to read.

9. **Directional intent in Director output.** `actor-director.ts:505-530` Director JSON shape: add `directional_intent: "toward|away|for|against|unclear"` to the schema. Today the system declares this signal load-bearing in the prompt but emits no field for it. If you ask the model to read it, it has to write it.

10. **Em-dashes in non-selected options.** At least Web-2 Attempt 2 ("Your Infinex account is one place — for the money..."), Web-5 Attempt 2, X-5 Attempt 2, and Web-2/3/4/5 Attempt 3 contain em-dashes. The validator at `validator.ts:120-138` zero-tolerance EM_DASH rule runs only on the *selected* candidate per channel (script_validation passes on selected). The other 4 options never get validated. If an operator scrolls past the selected and copies an alternative, the em-dash filter doesn't fire. Run the regex hygiene rules on ALL options (not just the selected), and surface a per-option pass/fail badge in the run-review HTML.

### P3 — bigger-picture

11. **The "wall/territory" lexicon collapse is a card-level problem.** The Bridge.xyz card's deployed_facts mention "fiat-to-crypto conversion + on-chain delivery"; the operator's voice-spec opening_shapes are intended to break this kind of gravity. Consider adding to the Actor prompt: "If the rehearsal converges on a single core metaphor across all 5 options, that's a flag. Re-do one option in an image system that does not contain the metaphor." This is a generator-level technique that compounds.

12. **The Mirodan kernel and Drive-table are 95% right but use operator vocabulary (introvert/extravert) instead of canon (inner action/outer action).** Migrate. Same data; faithful labels make the canon claims auditable against ch3 directly.

13. **Actor warm-up section is producing real value.** The `daily_pages` warm-up in attempts 1-3 generates the strongest reasoning in the whole run. Keep it. But: pass the warm-up notes from prior attempts into subsequent attempts as **immutable record**, not as Director-issued corrections. Today the Director paraphrases the actor's own discoveries back at the actor as fresh instructions. Cumbersome and dilutes ownership.

---

## 7. Method notes (for next audit)

- The Mirodan chapters at `/Users/opaque/Downloads/nigel-session-2026-04-28/mirodan-ch{1,2,3}-*.md` are the bench. They cite Mirodan PDF pages, which traces back to the original source. Always check claims against chapter+page, not the synthesis file.
- Distinguish "Variation = 2 factors" (Inner Attitude visible as Shadow Move, ch3 p.530) from "Working Action = 3 factors" (Action visible as motor). The Director kernel has this right; the Director model doesn't always obey.
- Drive is *read*, not *performed*. Any rule of the form "perform Drive X as visible Y" is canon-inverted.
- Lining is hidden. Any rule of the form "Lining must surface in the prose" is canon-inverted.
- For short copy (web), tempo classification confidence should be structurally capped. The current Director treats one-sentence and three-beat copy with the same confidence scale.

End of audit.
