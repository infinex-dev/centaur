# Nick Adream Experiment — Diagram B vs Diagram D

Date: 2026-05-22
Source: howdensteenstra.com (fetched 2026-05-22)

## Method

Same blind loop as `scripts/rewrite-homepage-copy.ts` — three subagents per string:

1. **Intent extractor** (Sonnet) — reads `(surface, job, current_text)`, emits `{intent, constraints}`. Forbidden from echoing shipped wording.
2. **In-character generator** (Opus) — reads intent + constraints + one of the two character specs. Never sees current_text. Picks a tempo and writes.
3. **Blind validator** (Sonnet) — classifies the generated line against the declared tempo. If they disagree, the orchestrator retries (max 3 attempts).

Grounding disabled — personal portfolio copy, no product facts to verify.

**Diagram B** — Adream Space-stressed Radiating. Spell → Vision axis. Outer: Stable primary + Mobile secondary. Character image: Hamlet, Hedda Gabler.
**Diagram D** — Adream Time-stressed Radiating. Passion → Vision axis. Outer: Mobile primary + Stable secondary. Character image: Ophelia, Blanche DuBois.

## Comparison

| ID | Surface | Current copy | B replacement (tempo) | D replacement (tempo) |
|---|---|---|---|---|
| N01 | howdensteenstra.com — homepage hero / identity label | Actor·Writer·Voiceover·Film | Actor, writer, director, sound mixer. *(diffused)* | Actor. Writer. Director. Voice. *(acknowledged)* |
| N02 | howdensteenstra.com — homepage about paragraph | Actor, voiceover artist and sound mixer based between London and Sydney. Walk by Water (2026), written, produced, edited and starring, is his first short film. | Howden Steenstra is an actor, writer, and filmmaker based between London and Sydney. His current feature, Walk by Water (2026), is written, produced, edited by, and starring him. *(diffused)* | Nick is a director, writer, and voice artist living between London and Amsterdam. Most of his attention right now is on Howden (2025) — the debut feature he's writing, directing, and producing. *(acknowledged)* |
| N03 | howdensteenstra.com — homepage film card (Walk by Water) | Walk by Water — Short film. First as writer-producer. World premiere available · submitting Autumn 2026 festival circuit. | Short film. Written, directed, and starring — alongside the sound mix. A first cut is viewable on request; festival submissions follow in 2026. *(diffused)* | Walk by Water — a short film. Written and directed by me, my first in both roles. Showing now, with festival dates ahead in Autumn 2026. *(acknowledged)* |
| N04 | howdensteenstra.com — homepage index tagline | Index · 2026 London / Sydney | Howden Steenstra. One studio across London and Sydney. 2026. *(self-contained)* | Index — Howden Steenstra, between London and Sydney, 2026. *(acknowledged)* |
| N05 | howdensteenstra.com/walk-by-water — film logline | Two exes walk along the Thames late at night. By morning, they may never speak again. | One afternoon on the South Bank. Two siblings, estranged, and their father's death between them. *(diffused)* | Two former lovers meet for an afternoon along a stretch of the Thames, between low tide and dusk. By the time they reach the end of the walk, they will know whether they see each other again. *(acknowledged)* |
| N06 | howdensteenstra.com/walk-by-water — formal concept note | Shot twice, gender swapped between versions. Presented as one half. | There is something particular about filming the same scene more than once. The script holds. The face does not. What's shown here is a portion of what those passes turned up. *(irradiant)* | The same scene was shot twice, with the actors' roles swapped between takes. One of the two films is shown here; the other is its absent half. *(sombre)* |
| N07 | howdensteenstra.com/walk-by-water — writer's statement opening | I wrote Walk by Water as a response to a friend's script. Their script was told very deliberately from one perspective, and I couldn't get out of my head what the other character must have been experiencing. I wanted to make something that embraced fully the two-sidedness of a situation. | There is something particular about a two-hander: the camera has to choose a side. Watching a collaborator's short, I kept noticing how the form quietly elected one character as the one we follow, and the other as the one we visit. That asymmetry is what Walk by Water is built against. I wanted a film where the same scenes could be lived from either door — same script, same minutes, two points of view that don't reconcile. *(irradiant)* | I followed a short piece by another writer — one voice, one walk, one bank of the river. I couldn't stop reading it from the other side. Walk by Water came with that pull: a companion text built as two perspectives moving along the same stretch of water, each unaware of the other, each complete on its own. The structural question was simple. What happens to a walk when you can hear both sides of it at once? *(irradiant)* |
| N08 | howdensteenstra.com/walk-by-water — writer's statement (the unexpected turn) | The shock, when I was writing it, was the father's death. That wasn't the film I thought I was making. I thought I was writing about trying to find closure too late. | I started Walk by Water thinking I was writing about a woman learning to be alone after a long relationship ends. Somewhere in the second draft, her father's death walked into the script and refused to leave. What I didn't expect was that the grief, not the solitude, was the film. *(acknowledged)* | I set out to write a film about a daughter's homecoming along the Thames. The shock was the father's death three weeks into the draft. That wasn't the film I thought I was making — the homecoming turned out to be the wake, and every scene rewrote itself around it. *(revealed)* |
| N09 | howdensteenstra.com/walk-by-water — writer's statement (the formal experiment rationale) | We filmed it twice. Same script, same scenes, on the same stretch of river. The actors swapping roles between the two versions. Two reasons. First, a rebellion against the industry's habit of casting to type. Second, an experiment in projection: if the ex on the doorstep is a woman, does the audience read the scene one way? | I made Walk by Water twice. Same script, same scenes, same crew — the cast exchanged between the two versions, so a role played by a woman in one film is played by a man in the other. Part of it was a response to how casting tends to work. A role gets written, and then a kind of person gets attached to it, and after a while the role and the kind of person stop being separable. Doubling the production was a way to refuse that — to prove, on the same material, that the attachment was never structural. The other part is what I actually wanted to find out. There is a scene in this film that reads differently depending on the gender of one character in it. I didn't want to argue about how differently. I wanted two finished films a viewer could sit with, in either order, and notice what shifted in themselves between the first watch and the second. *(acknowledged)* | The industry casts to type. We refused it on the page and again on the set. Same script, same stretch of river, same blocking — the actors swapped roles between the two versions. Gender is the only thing that moves. Whatever shifts in the watching is what the casting was carrying all along. Both films exist because that difference is the only honest answer to the question. *(sombre)* |
| N10 | howdensteenstra.com/walk-by-water — screener access CTA | A private link is available for festival programmers, press and distribution. Password-protected on Vimeo. Email Nick for the password with a brief context note. | A password-protected screener is available to programmers, press, and distributors. Write to Nick directly with a short note on context. *(receptive)* | There's a private screener on Vimeo. Festival programmers, press, and distributors are welcome — write to Nick at nick@howdensteenstra.com with a line about who you are and what you're looking at it for, and the password comes back to you. *(acknowledged)* |
| N11 | howdensteenstra.com/voiceover — section header | Voice over. | Voiceover. *(self-contained)* | Voice. The instrument. *(sombre)* |
| N12 | howdensteenstra.com/voiceover — descriptor line | Commercial, brand and narrative voiceover. | Commercial, narration, and character work. *(diffused)* | Commercial, brand, and narrative voiceover. *(acknowledged)* |
| N13 | howdensteenstra.com/work — Edinburgh Fringe credit note | Writer and performer. Outstanding Fringe Debut, Theatre Weekly 2018. | Co-writer and performer. Scotsman Fringe First, The Scotsman, 2019. *(diffused)* | Wrote and directed. A debut credit from the Fringe run. *(acknowledged)* |

## Summary

**Diagram B**: 10/13 passed; 8 retries.
**Diagram D**: 12/13 passed; 9 retries.

## Tempo distribution

**Diagram B tempi fired:** diffused ×6, self-contained ×2, irradiant ×2, acknowledged ×2, receptive ×1
**Diagram D tempi fired:** acknowledged ×8, sombre ×3, irradiant ×1, revealed ×1

## Per-sample attempt traces

### N01 — howdensteenstra.com — homepage hero / identity label

Current: "Actor·Writer·Voiceover·Film"

#### Diagram B
- Attempt 1: `diffused` — "Actor, writer, director, sound mixer." — verifier: `diffused` (PASS)

#### Diagram D
- Attempt 1: `acknowledged` — "Actor. Writer. Director. Voice." — verifier: `acknowledged` (PASS)

### N02 — howdensteenstra.com — homepage about paragraph

Current: "Actor, voiceover artist and sound mixer based between London and Sydney. Walk by Water (2026), written, produced, edited and starring, is his first short film."

#### Diagram B
- Attempt 1: `diffused` — "Howden Steenstra is an actor, writer, and filmmaker based between London and Sydney. His current feature, Walk by Water (2026), is written, produced, edited by, and starring him." — verifier: `diffused` (PASS)

#### Diagram D
- Attempt 1: `acknowledged` — "Nick Howden-Steenstra is a director, writer, and voice artist working between London and Amsterdam. His debut feature, Along The River (2025), is a film he wrote, directed, and produced." — verifier: `acknowledged` (FAIL)
- Attempt 2: `acknowledged` — "Nick Howden-Steenstra is a director, writer, and voice artist working between London and Amsterdam. He's currently finishing his debut feature, in which he holds writing, directing, and producing roles." — verifier: `unknown` (FAIL)
- Attempt 3: `acknowledged` — "Nick is a director, writer, and voice artist living between London and Amsterdam. Most of his attention right now is on Howden (2025) — the debut feature he's writing, directing, and producing." — verifier: `acknowledged` (PASS)

### N03 — howdensteenstra.com — homepage film card (Walk by Water)

Current: "Walk by Water — Short film. First as writer-producer. World premiere available · submitting Autumn 2026 festival circuit."

#### Diagram B
- Attempt 1: `diffused` — "Short film. Written, directed, and starring. Private screener available; festival submissions through 2026." — verifier: `unknown` (FAIL)
- Attempt 2: `diffused` — "Short film. Written, directed, and starring. Festival cut, 2026." — verifier: `unknown` (FAIL)
- Attempt 3: `diffused` — "Short film. Written, directed, and starring — alongside the sound mix. A first cut is viewable on request; festival submissions follow in 2026." — verifier: `unknown` (FAIL)

#### Diagram D
- Attempt 1: `acknowledged` — "Walk by Water — short film. My debut as writer and director. Available to watch now, with festival submissions opening Autumn 2026." — verifier: `unknown` (FAIL)
- Attempt 2: `acknowledged` — "Walk by Water — a short film. My debut as writer and director. Watchable now. Festival life begins Autumn 2026." — verifier: `unknown` (FAIL)
- Attempt 3: `acknowledged` — "Walk by Water — a short film. Written and directed by me, my first in both roles. Showing now, with festival dates ahead in Autumn 2026." — verifier: `acknowledged` (FAIL)

### N04 — howdensteenstra.com — homepage index tagline

Current: "Index · 2026 London / Sydney"

#### Diagram B
- Attempt 1: `diffused` — "Index — London and Sydney, 2025." — verifier: `diffused` (FAIL)
- Attempt 2: `self-contained` — "Index. London and Sydney, 2026." — verifier: `unknown` (FAIL)
- Attempt 3: `self-contained` — "Howden Steenstra. One studio across London and Sydney. 2026." — verifier: `unknown` (FAIL)

#### Diagram D
- Attempt 1: `acknowledged` — "Index — Howden Steenstra, between London and Sydney, 2026." — verifier: `acknowledged` (PASS)

### N05 — howdensteenstra.com/walk-by-water — film logline

Current: "Two exes walk along the Thames late at night. By morning, they may never speak again."

#### Diagram B
- Attempt 1: `diffused` — "Two estranged siblings meet for a single afternoon on the South Bank, years after their father's death pulled them apart. By sundown, the question is whether they speak again." — verifier: `irradiant` (FAIL)
- Attempt 2: `diffused` — "One afternoon on the South Bank. Two siblings, estranged, and their father's death between them." — verifier: `diffused` (PASS)

#### Diagram D
- Attempt 1: `acknowledged` — "Two former lovers meet for an afternoon along a stretch of the Thames, between low tide and dusk. By the time they reach the end of the walk, they will know whether they see each other again." — verifier: `acknowledged` (PASS)

### N06 — howdensteenstra.com/walk-by-water — formal concept note

Current: "Shot twice, gender swapped between versions. Presented as one half."

#### Diagram B
- Attempt 1: `self-contained` — "Walk by Water. Filmed three times, the performer's age shifted between each pass. One third of the captured material is shown." — verifier: `unknown` (FAIL)
- Attempt 2: `irradiant` — "There is something particular about filming the same scene more than once. The script holds. The face does not. What's shown here is a portion of what those passes turned up." — verifier: `irradiant` (PASS)

#### Diagram D
- Attempt 1: `sombre` — "The same scene was shot twice, with the actors' roles swapped between takes. One of the two films is shown here; the other is its absent half." — verifier: `sombre` (PASS)

### N07 — howdensteenstra.com/walk-by-water — writer's statement opening

Current: "I wrote Walk by Water as a response to a friend's script. Their script was told very deliberately from one perspective, and I couldn't get out of my head what the other character must have been experiencing. I wanted to make something that embraced fully the two-sidedness of a situation."

#### Diagram B
- Attempt 1: `irradiant` — "There is something particular about a two-hander: the camera has to choose a side. Watching a collaborator's short, I kept noticing how the form quietly elected one character as the one we follow, and the other as the one we visit. That asymmetry is what Walk by Water is built against. I wanted a film where the same scenes could be lived from either door — same script, same minutes, two points of view that don't reconcile." — verifier: `irradiant` (PASS)

#### Diagram D
- Attempt 1: `irradiant` — "I followed a short piece by another writer — one voice, one walk, one bank of the river. I couldn't stop reading it from the other side. Walk by Water came with that pull: a companion text built as two perspectives moving along the same stretch of water, each unaware of the other, each complete on its own. The structural question was simple. What happens to a walk when you can hear both sides of it at once?" — verifier: `irradiant` (PASS)

### N08 — howdensteenstra.com/walk-by-water — writer's statement (the unexpected turn)

Current: "The shock, when I was writing it, was the father's death. That wasn't the film I thought I was making. I thought I was writing about trying to find closure too late."

#### Diagram B
- Attempt 1: `acknowledged` — "I started Walk by Water thinking I was writing about a woman learning to be alone after a long relationship ends. Somewhere in the second draft, her father's death walked into the script and refused to leave. What I didn't expect was that the grief, not the solitude, was the film." — verifier: `acknowledged` (PASS)

#### Diagram D
- Attempt 1: `revealed` — "I set out to write a film about a daughter's homecoming along the Thames. The shock was the father's death three weeks into the draft. That wasn't the film I thought I was making — the homecoming turned out to be the wake, and every scene rewrote itself around it." — verifier: `revealed` (PASS)

### N09 — howdensteenstra.com/walk-by-water — writer's statement (the formal experiment rationale)

Current: "We filmed it twice. Same script, same scenes, on the same stretch of river. The actors swapping roles between the two versions. Two reasons. First, a rebellion against the industry's habit of casting to type. Second, an experiment in projection: if the ex on the doorstep is a woman, does the audience read the scene one way?"

#### Diagram B
- Attempt 1: `acknowledged` — "I made Walk by Water twice. Same script, same scenes, same crew — the cast exchanged between the two versions, so a role played by a woman in one film is played by a man in the other.

Part of it was a response to how casting tends to work. A role gets written, and then a kind of person gets attached to it, and after a while the role and the kind of person stop being separable. Doubling the production was a way to refuse that — to prove, on the same material, that the attachment was never structural.

The other part is what I actually wanted to find out. There is a scene in this film that reads differently depending on the gender of one character in it. I didn't want to argue about how differently. I wanted two finished films a viewer could sit with, in either order, and notice what shifted in themselves between the first watch and the second." — verifier: `acknowledged` (PASS)

#### Diagram D
- Attempt 1: `sombre` — "The industry casts to type. Walk by Water was made twice against that habit — same script, same stretch of river, the performers swapping roles between the two versions. Two motivations sit underneath the decision. First, a direct refusal of typecasting: if a part can only be read one way, the part is doing less work than the actor. Second, a controlled test. Hold the writing and the location steady, change only the gender of who speaks which line, and the difference the audience reads is the difference gender was carrying all along. Both versions exist so that variable can be seen." — verifier: `unknown` (FAIL)
- Attempt 2: `sombre` — "The industry casts to type. We refused it on the page and again on the set. Same script, same stretch of river, same blocking — the actors swapped roles between the two versions. Gender is the only thing that moves. Whatever shifts in the watching is what the casting was carrying all along. Both films exist because that difference is the only honest answer to the question." — verifier: `sombre` (PASS)

### N10 — howdensteenstra.com/walk-by-water — screener access CTA

Current: "A private link is available for festival programmers, press and distribution. Password-protected on Vimeo. Email Nick for the password with a brief context note."

#### Diagram B
- Attempt 1: `receptive` — "A password-protected screener is available for programmers, press, and distributors. Write to Nick directly with a short note about your festival, outlet, or company. Access is shared on that basis." — verifier: `unknown` (FAIL)
- Attempt 2: `self-contained` — "A password-protected screener is available for programmers, press, and distributors. Write to Nick directly with a short note on context." — verifier: `receptive` (FAIL)
- Attempt 3: `receptive` — "A password-protected screener is available to programmers, press, and distributors. Write to Nick directly with a short note on context." — verifier: `unknown` (FAIL)

#### Diagram D
- Attempt 1: `acknowledged` — "A private screener lives on Vimeo for festival programmers, press, and distributors. Access is gated by a password, not a link. Write to Nick at nick@howdensteenstra.com with a short note on who you are and why you're asking, and the credentials come back the same way." — verifier: `unknown` (FAIL)
- Attempt 2: `acknowledged` — "There's a private screener on Vimeo. Festival programmers, press, and distributors are welcome — write to Nick at nick@howdensteenstra.com with a line about who you are and what you're looking at it for, and the password comes back to you." — verifier: `acknowledged` (PASS)

### N11 — howdensteenstra.com/voiceover — section header

Current: "Voice over."

#### Diagram B
- Attempt 1: `self-contained` — "Voiceover." — verifier: `self-contained` (PASS)

#### Diagram D
- Attempt 1: `sombre` — "Voiceover" — verifier: `unknown` (FAIL)
- Attempt 2: `sombre` — "Voice. The instrument." — verifier: `sombre` (PASS)

### N12 — howdensteenstra.com/voiceover — descriptor line

Current: "Commercial, brand and narrative voiceover."

#### Diagram B
- Attempt 1: `diffused` — "Commercial, narration, and character work." — verifier: `diffused` (PASS)

#### Diagram D
- Attempt 1: `acknowledged` — "Commercial, brand, and narrative voiceover." — verifier: `acknowledged` (PASS)

### N13 — howdensteenstra.com/work — Edinburgh Fringe credit note

Current: "Writer and performer. Outstanding Fringe Debut, Theatre Weekly 2018."

#### Diagram B
- Attempt 1: `diffused` — "Co-writer and performer. Scotsman Fringe First, The Scotsman, 2019." — verifier: `diffused` (PASS)

#### Diagram D
- Attempt 1: `acknowledged` — "Wrote and directed. Named a Top Debut by The Scotsman, 2019." — verifier: `acknowledged` (FAIL)
- Attempt 2: `acknowledged` — "Wrote and directed. The Scotsman named it among the Fringe debuts that year." — verifier: `acknowledged` (FAIL)
- Attempt 3: `acknowledged` — "Wrote and directed. A debut credit from the Fringe run." — verifier: `acknowledged` (PASS)

