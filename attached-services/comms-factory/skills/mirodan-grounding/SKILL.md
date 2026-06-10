---
name: mirodan-grounding
description: Use when grounding, verifying, or auditing any Laban/Mirodan movement-system claim — a tempo read, a Weight/Space/Time/Flow factor call, an Inner Attitude or Aspect or Drive, a voice-spec citation, or before editing the classifier (scripts/classify-corpus.ts) or Director/Actor memory (src/actor-memory.ts) with a movement rule. Points at the distilled findings MD first, the chapter extracts second, the PDF last. Enforces quote-verbatim + page-cite + adjudicate.
---

# Mirodan grounding

Ground movement-system claims against the canonical source cheaply and honestly. The PDF is 52MB and the chapter extracts are 65KB each — do NOT re-read them when the answer is already distilled. Climb the ladder; stop at the first rung that answers.

## Source ladder (cheapest first)

1. **`third_party/mirodan/GROUNDED-FINDINGS.md`** — the distilled, page-cited findings. Motion factors (incl. the re-rooted Weight definition), 6 attitudes, aspects, stresses, the 24-tempo table, 8 working actions, drives, known traps, and a citation-integrity log. **Start here.** Most questions are already answered.
2. **`src/actor-memory.ts` `MIRODAN_24_TEMPI`** — machine-readable mirror of the tempo table (factor shape, motor, canonical shorthand, page ref per tempo).
3. **`third_party/mirodan/mirodan-ch{1,2,3,4}-*.md`** — vol 1 chapter extracts. ch1 = motion factors/working actions; ch2 = inner attitudes + the 24 tempi; ch3 = drives + X-diagram; ch4 = applications. Search these when the findings MD lacks the exact passage.
4. **`third_party/mirodan/laban-mirodan-reference-2026-04-28.md`** — operator synthesis (derived; lookup aid, not primary).
5. **`third_party/mirodan/Mirodan-PhD-1997-Vol2.pdf`** — primary PDF, last resort. Read by page range only (it's huge). The chapter MDs are vol 1; the PDF is vol 2 (tempo definitions p.420–520).

**When you read the PDF or a chapter to answer something not in the findings MD, write it back into `GROUNDED-FINDINGS.md`** (with the page cite + citation-integrity note) so the next pass stops at rung 1. The MD is a living doc — fold findings in, don't just report.

## The grounding method (non-negotiable)

For any claim ("X reads as commanding", "Weight means Y", "this tempo's motor is Z"):

1. **Quote verbatim** from the source, with exact location (chapter/page).
2. **Adjudicate** the claim against the quote, classifying it: **FAITHFUL** / **OVER-NARROWED** (a true-but-partial reading that drops a dimension) / **WRONG**.
3. If OVER-NARROWED or WRONG, state the corrected rule in the *minimal* form that the source supports — and note what you removed.

Try to **break** the claim, don't rubber-stamp it. The 2026-06-04 Weight bug ("unhedged = Strong = commanding") survived because nobody checked the cite against the text — Weight is the trace of *Intending* (will), not "force, nothing else". See `research/mirodan-weight-reroot-audit-2026-06-04.md` for the worked example of this method catching an over-narrowing.

## Hard rules (carried from prior scars)

- **Laban vocabulary only.** Use the canonical terms (Stable/Near/Adream/Mobile/Awake/Remote; the 24 tempi; the 8 working actions; Enclosing/Penetrating/Radiating/Circumscribing). Never invent synthesis labels ("Institutional weight", "Aspirational reach").
- **Use canonical shorthand verbatim** — no "modern translation" layer.
- **The verifier is the gold standard.** When *grading generated copy* against a character spec, use `scripts/classify-corpus.ts` (the v2 instrument). Never substitute a fresh LLM subagent as judge — same instrument across all brands = comparable grades.
- **Weight is never a stress.** It's in every baseline's inner pair.
- **Two rule homes stay in sync.** A movement rule used at runtime lives in BOTH the blind classifier (`scripts/classify-corpus.ts` SYSTEM_PROMPT) and the production Director/Actor memory (`src/actor-memory.ts`). If you change one, change the other, then `npx tsc --noEmit` before any live harness run.
- **Spelling: Mirodan, never Larvin.**

## Common lookups (all in the findings MD)
- "What signifies Weight?" → §2 (re-rooted: Intending/will, not force-only).
- "commanding vs certain?" → §2 discriminator (exert will vs register settled awareness).
- "what's the motor / factor shape for tempo X?" → §6 table.
- "legal stress for Stable/Near/Adream?" → §5.
- "is this a baseline or action-only attitude?" → §3 (only Stable/Near/Adream are baselines).
- "known traps?" → §9.
