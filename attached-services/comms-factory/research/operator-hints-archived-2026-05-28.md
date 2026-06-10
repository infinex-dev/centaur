# 24-tempi operator_hints — archived

**Archived 2026-05-28** per operator decision: voice spec uses Mirodan `canonical_shorthand` only. Drop `operator_hint` — its both-pole grammar is already in the canon line, and the hints had a drift surface (12/24 in the [audit](./24-tempi-audit-2026-05-27.md) had crept off-canon: "institutional landing", "manifesto-force", "future-warmth", "partner credit", etc.). LLMs read the canonical line directly; the hint was a translation layer for human working memory that the system never needed.

Captured here in case the gloss is useful as a research artifact later. Do not reintroduce into `src/voice/*.ts`.

See [[feedback-use-canonical-shorthand-directly]] (the underlying principle) and [[voice-spec-laban-pure]] (the broader refactor this decision sits inside).

---

## Stable (W × S — Inner Attitude)

| # | Tempo | Factor | Archived operator_hint |
|---|---|---|---|
| 1 | commanding | Strong + Direct | Bold-resolve pressure landing as a single direct decision; no ornament around it. |
| 2 | practical | Strong + Flexible | Strong-flexible intention working through complexity before the cut; the carving is earned by the wring. |
| 3 | self-contained | Light + Direct | Cautious light-direct delivery; states without pushing. |
| 4 | receptive | Light + Flexible | Light-flexible accept-or-reject; the welcome is present even in refusal. |

## Adream (W × F — Inner Attitude)

| # | Tempo | Factor | Archived operator_hint |
|---|---|---|---|
| 5 | sombre | Strong + Bound | Sombre gravity carrying a staunch resolve; weight earned through bound flow. |
| 6 | overpowering | Strong + Free | Strong-free spell-casting force; Free Flow makes it irradiant rather than sombre. |
| 7 | diffused | Light + Bound | Light-bound sensation, welcome or irreconcilable; quiet and unfocused. |
| 8 | irradiant | Light + Free | Light-free unfolding or enfolding; sympathetic, buoyant, exultant. |

## Near (W × T — Inner Attitude, motors co-exist `/`)

| # | Tempo | Factor | Archived operator_hint |
|---|---|---|---|
| 9 | materialistic | Strong + Quick | Sudden Strong-Quick aggressive intention either towards or away from a desire. |
| 10 | human | Light + Sustained | Slow Light-Sustained decision for or against a gentle tenderness. |
| 11 | warm | Strong + Sustained | Strong-Sustained staunch intention; warm consent or warm dissent — same heat, both poles. |
| 12 | cool | Light + Quick | Sudden Light-Quick pert intention; intimacy or estrangement. |

## Mobile (T × F — outer-only Action Attitude, motors `/`)

| # | Tempo | Factor | Archived operator_hint |
|---|---|---|---|
| 13 | unacknowledged | Quick + Bound | Concealed sudden decision around a feeling the speaker won't name. |
| 14 | acknowledged | Sustained + Free | Slow Free-flowing revelation; enjoying or evading affection. |
| 15 | revealed | Quick + Free | Sudden Free-flowing revelation; expressing or rejecting ardent sympathy. |
| 16 | concealed | Sustained + Bound | Slow Bound-flow decision for or against a frigid self-assertion. |

## Remote (S × F — outer-only Action Attitude)

| # | Tempo | Factor | Archived operator_hint |
|---|---|---|---|
| 17 | egocentric | Direct + Bound | Narrowing withdrawal; the line is drawn directly, with bound flow. |
| 18 | altruistic | Flexible + Free | Embracing altruistic feeling, for or against cordiality; warm at a distance. |
| 19 | sociable | Direct + Free | Direct-free companionship; the social approach develops or contracts cleanly. |
| 20 | unsociable | Flexible + Bound | Reflective Flexible-Bound image of solitude — welcome or unwelcome. |

## Awake (S × T — outer-only Action Attitude, motors `/`)

| # | Tempo | Factor | Archived operator_hint |
|---|---|---|---|
| 21 | acute | Direct + Quick | Sudden Direct-Quick decision for or against an idea. |
| 22 | doubting | Flexible + Sustained | Slowly dawning Flexible-Sustained attention; doubting awareness, towards or away. |
| 23 | certain | Direct + Sustained | Slow Direct-Sustained dawning; certain or uncertain awareness on the same axis. |
| 24 | uncertain | Flexible + Quick | Sudden Flexible-Quick embrace; new idea or new problem, same shape. |
