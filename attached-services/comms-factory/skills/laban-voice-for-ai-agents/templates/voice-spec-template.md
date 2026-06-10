# Voice spec template (TypeScript)

Fill this template after running the 3-move interview. Drop the result at `src/voice/<brand>.ts`.

```typescript
import type { CharacterSpec, Tempo, TempoName } from "./types.js";

// Per-tempo spec — repeat for each of the main tempi + any beat-only ones.
// Reference: skills/laban-voice-for-ai-agents/references/working-actions.md
// for the motor pair per tempo.

const TEMPI: Record<TempoName, Tempo> = {
  commanding: {
    name: "commanding",
    attitude: "stable",
    inner_combo: "Stable · Strong/Direct",
    motor: ["pressing", "punching"], // see working-actions.md
    feel: "[2-3 sentence description of what this tempo FEELS like to read]",
    opening_shapes: [
      "[shape 1]",
      "[shape 2]",
      "[shape 3]",
    ],
    vocab_anchor: ["word1", "word2", "phrase 3", "..."],
    signoff_moves: [
      "[signoff move 1]",
      "[signoff move 2]",
    ],
    example_lines: [
      "[real sample post fragment in this tempo]",
      "[another]",
    ],
  },
  // ... repeat for each tempo
};

// Off-spec language — based on Drive lock.
// Reference: skills/laban-voice-for-ai-agents/references/drive-mapping.md
// for default regexes per Drive.

const OFF_SPEC_REGEXES = [
  {
    name: "[family-name]",
    re: /\b(word1|word2|phrase\s+three)\b/i,
    reason: "[why this is off-spec — usually 'activates X drive which we don't carry']",
  },
  // ... add more as iterated
];

// Cadence approximations (sum to ~1.0 across main_tempi).

const CADENCE: Partial<Record<TempoName, number>> = {
  // commanding: 0.25,
  // ...
};

// The full spec.

export const VOICE: CharacterSpec = {
  name: "[brand-name]",                          // lowercase, no spaces
  inner_attitude: "stable",                      // stable | adream | near
  stress: "flow",                                // time | space | flow
  stress_pole: "bound",                          // bound | free | strong | light | etc. (optional)
  aspect: "penetrating",                         // enclosing | penetrating | circumscribing | radiating
  drive_primary: "spell",                        // doing | spell | passion | vision
  drive_secondary: "vision",
  drive_axis: "Spell-Vision (Diagram D)",
  off_spec_drives: ["passion"],                  // drives the validator should reject
  off_spec_regexes: OFF_SPEC_REGEXES,
  tempi: TEMPI,
  main_tempi: ["commanding", /* ... */],
  beat_only_tempi: ["self-contained", /* ... */],
  cadence: CADENCE,
};

// Default beat sequence per release-card kind.

export function defaultBeatsForKind(kind: string): { tempo: TempoName; hint?: string }[] {
  switch (kind) {
    case "launch-tier":
      return [
        { tempo: "sombre", hint: "[Pressing prep — set up the wall]" },
        { tempo: "commanding", hint: "[Punching release — land the fact]" },
        { tempo: "practical", hint: "[Wringing/Slashing — justify the build]" },
        { tempo: "irradiant", hint: "[Floating/Flicking — future-state lift]" },
      ];
    case "data-card-official":
      return [/* ... */];
    case "data-card-wry":
      return [/* ... */];
    case "split":
      return [/* ... */];
    default:
      return [/* 3-beat fallback */];
  }
}

export { VOICE as BRAND_VOICE };  // also re-export under the brand name for convenience
```

## Checklist before shipping the spec

- [ ] All `main_tempi` have at least 2 `example_lines` (few-shots feed the generator)
- [ ] Canonical Sustained→Quick tempi have the Sustained partner in `motor[0]`; both-Sustained and both-Quick tempi are intentional and do not require a separate prep beat.
- [ ] `off_spec_regexes` covers each off-spec Drive's vocabulary family
- [ ] `cadence` percentages sum to ~1.0 across `main_tempi`
- [ ] `defaultBeatsForKind` covers all release-card kinds the brand will use
- [ ] No tempi from the wrong baseline included (e.g., a Stable-based character should not have Near tempi)
- [ ] Stub generator returns sensible output when run with each release-card kind (`tsx src/cli.ts demo`)
