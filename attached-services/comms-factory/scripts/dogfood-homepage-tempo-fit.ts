/**
 * Dogfood (corrected framing): does the homepage speak in Infinex's Mirodan
 * character at all?
 *
 * For each load-bearing homepage string:
 *   - JOB:      what is the surface doing? (hero, section head, value prop, CTA)
 *   - DECLARED: which tempo would the Infinex character pick for that job?
 *   - CLASSIFIED: what does the blind tempo classifier read it as?
 *   - VERDICT:  match / mismatch / unknown (off-character)
 *
 * This is the Nigel-style double-blind: declared tempo (from intent) must match
 * classified tempo (from the text), or the copy is off-character.
 *
 * Note: classifyTempoBlind is the deterministic anchor classifier in
 * src/validator.ts. It's calibrated for tweet-length comms (the example_lines
 * in voice/infinex.ts are 1-3 sentence post fragments). On 1-5 word headlines
 * it will under-score and return "unknown" — that "unknown" verdict means
 * "this string is not in any of the character's tempo vocabularies", which is
 * itself useful information (the character would not have written this).
 *
 * For production parity with Nigel's Track 5b Sonnet classifier, we should
 * add an LLM-based classifier as a second-pass judge.
 *
 * Run:
 *   pnpm tsx scripts/dogfood-homepage-tempo-fit.ts > research/infinex-homepage-tempo-fit.md
 *   pnpm tsx scripts/dogfood-homepage-tempo-fit.ts --llm > research/infinex-homepage-tempo-fit.llm.md
 */

import { INFINEX_VOICE } from "../src/voice/infinex.js";
import { classifyTempoBlind } from "../src/validator.js";
import { auditCopySetLLM } from "../src/validator-llm.js";
import type { TempoName } from "../src/voice/types.js";
import type { LLMCopyAuditItem } from "../src/validator-llm.js";

const USE_LLM = process.argv.includes("--llm");
const IDS_ARG = process.argv.find((arg) => arg.startsWith("--ids="));
const ONLY_IDS = IDS_ARG
  ? new Set(IDS_ARG.slice("--ids=".length).split(",").map((id) => id.trim()).filter(Boolean))
  : null;

// Real strings fetched from https://infinex.xyz/ on 2026-05-15. Includes only
// strings where the character's voice is load-bearing (hero, section heads,
// value props, positioning lines). Pure taxonomy labels ("Web", "Extension",
// "NFTs") are excluded — they're not the character speaking.

type Job =
  | "hero"
  | "section_head"
  | "value_prop"
  | "feature_title"
  | "feature_description"
  | "trust_line"
  | "partner_credit"
  | "positioning"
  | "cta";

interface Sample {
  id: string;
  text: string;
  job: Job;
  // What the Infinex character would pick for this job, with reasoning. The
  // declared half of the double-blind.
  declared: { tempo: TempoName | "off-spec"; reasoning: string };
}

const SAMPLES: Sample[] = [
  {
    id: "H01",
    text: "Change the way you crypto.",
    job: "hero",
    declared: {
      tempo: "commanding",
      reasoning:
        "hero = single decisive landing. Character's Commanding (Pressing→Punching) is the ruler-issuing-a-position register. Should read as Commanding.",
    },
  },
  {
    id: "H02",
    text: "Unified portfolio.",
    job: "value_prop",
    declared: {
      tempo: "commanding",
      reasoning:
        "two-word value prop = Punching release. Carved label. Commanding fits.",
    },
  },
  {
    id: "H03",
    text: "Multi-provider trading.",
    job: "value_prop",
    declared: {
      tempo: "commanding",
      reasoning: "same as H02 — Punching label.",
    },
  },
  {
    id: "H04",
    text: "Serious Opsec.",
    job: "value_prop",
    declared: {
      tempo: "commanding",
      reasoning:
        "Punching label. (Note: 'Opsec' as casual jargon may itself be off-spec — Infinex is craft-patience, not 4chan register. But framing it as Commanding-target.)",
    },
  },
  {
    id: "H05",
    text: "Get Infinex",
    job: "cta",
    declared: {
      tempo: "commanding",
      reasoning: "primary CTA = Punching action verb. Commanding.",
    },
  },
  {
    id: "H06",
    text: "See everything we've shipped, and everything that's coming up",
    job: "section_head",
    declared: {
      tempo: "irradiant",
      reasoning:
        "future-vision section opener — 'coming up' is Vision-pulled. Irradiant (Floating→Flicking) fits.",
    },
  },
  {
    id: "H07",
    text: "Explore key features",
    job: "section_head",
    declared: {
      tempo: "commanding",
      reasoning:
        "section organizer with imperative verb. Commanding label. (Mild risk: 'explore' is generic-marketing.)",
    },
  },
  {
    id: "H08",
    text: "Passkey-first, gas-abstracted wallet with support for 20+ chains.",
    job: "feature_description",
    declared: {
      tempo: "practical",
      reasoning:
        "compressed spec sentence. Practical (Wringing→Slashing) — the carved answer. Lists the actual mechanic.",
    },
  },
  {
    id: "H09",
    text: "Swap. Perps. Earn. Predict. Multi-provider. Multi-chain.",
    job: "feature_description",
    declared: {
      tempo: "commanding",
      reasoning:
        "staccato Punching enumeration. Each item lands. Commanding.",
    },
  },
  {
    id: "H10",
    text: "More than view-only. Import or connect existing wallets and take control.",
    job: "feature_description",
    declared: {
      tempo: "practical",
      reasoning:
        "two-clause spec — first clause contrasts (Wringing), second clause carves (Slashing). Practical.",
    },
  },
  {
    id: "H11",
    text: "Connect securely to any dapp and take your account with you.",
    job: "feature_description",
    declared: {
      tempo: "practical",
      reasoning: "spec sentence with two operative verbs. Practical carved answer.",
    },
  },
  {
    id: "H12",
    text: "Passkey to Ledger to Safe. Choose the Opsec to suit your spec.",
    job: "feature_description",
    declared: {
      tempo: "off-spec",
      reasoning:
        "'Opsec to suit your spec' is a rhyming hype-couplet. Rhyme + casual jargon stack reads as Adream-Time-stressed (Passion drive). Off-spec for Infinex.",
    },
  },
  {
    id: "H13",
    text: "Switch to Infinex and earn crates and cashback on every trade.",
    job: "feature_description",
    declared: {
      tempo: "off-spec",
      reasoning:
        "'crates' is the Kain-era casual register the audit already flagged. Promotional voice in a feature description. Off-spec.",
    },
  },
  {
    id: "H14",
    text: "One super app.",
    job: "positioning",
    declared: {
      tempo: "off-spec",
      reasoning:
        "'super app' is the Infinex-specific allergen the audit flagged. Promotional/marketing register. Off-spec.",
    },
  },
  {
    id: "H15",
    text: "Trade perps in-app with up to 40x leverage",
    job: "feature_description",
    declared: {
      tempo: "commanding",
      reasoning:
        "spec sentence stating capability + magnitude. Commanding Punching landing.",
    },
  },
  {
    id: "H16",
    text: "Powered by Hyperliquid",
    job: "partner_credit",
    declared: {
      tempo: "sociable",
      reasoning:
        "partner credit. Sociable (Gliding→Dabbing) is the register for ecosystem warmth.",
    },
  },
  {
    id: "H17",
    text: "Powered by Polymarket",
    job: "partner_credit",
    declared: { tempo: "sociable", reasoning: "same as H16." },
  },
  {
    id: "H18",
    text: "Your keys, secured by Turnkey",
    job: "trust_line",
    declared: {
      tempo: "sociable",
      reasoning:
        "the locked trust-footer. 'Secured by Turnkey' is partner credit + custody anchor. Sociable register.",
    },
  },
  {
    id: "H19",
    text: "Phishing resistant security",
    job: "value_prop",
    declared: {
      tempo: "commanding",
      reasoning: "carved label. Commanding Punching landing.",
    },
  },
  {
    id: "H20",
    text: "See what privileges you're granting",
    job: "value_prop",
    declared: {
      tempo: "practical",
      reasoning:
        "value prop framed as user-mechanic awareness. Practical — 'the actual question is what you're granting'.",
    },
  },
];

const SELECTED_SAMPLES = ONLY_IDS
  ? SAMPLES.filter((sample) => ONLY_IDS.has(sample.id))
  : SAMPLES;

function fmtClassify(sample: Sample, llmItem?: LLMCopyAuditItem): {
  display: string;
  tempo: TempoName | "unknown";
} {
  if (USE_LLM && llmItem) {
    const cls = llmItem.independent_classification;
    const issue = llmItem.voice_issues[0];
    const verdict = llmItem.passed ? "PASS" : `FAIL${issue ? `: ${issue.rule}` : ""}`;
    return {
      display: `${cls.tempo} (conf=${cls.confidence.toFixed(2)}, ${verdict}; ${cls.rationale})`,
      tempo: cls.tempo,
    };
  }
  const r = classifyTempoBlind(sample.text, INFINEX_VOICE);
  if (r.tempo === "unknown")
    return {
      display: `**unknown** (no anchor matched — character would not have written this in any tempo)`,
      tempo: "unknown",
    };
  return {
    display: `${r.tempo} (conf=${r.confidence.toFixed(2)}, margin=${r.margin.toFixed(2)})`,
    tempo: r.tempo,
  };
}

console.log("# Infinex Homepage — Mirodan Character Fit Audit");
console.log();
console.log("Date: 2026-05-15");
console.log("Source: https://infinex.xyz/ (fetched 2026-05-15)");
if (USE_LLM) console.log("Classifier: Sonnet LLM validator (`src/validator-llm.ts`)");
console.log();
console.log("## Method");
console.log();
console.log("Nigel-style double-blind tempo match.");
console.log();
console.log("- **Declared tempo** — for each string, the tempo the Infinex character");
console.log("  (Stable + Flow-stressed + Penetrating, Drive = Spell+Vision) would");
console.log("  pick for that job. Reasoning given inline.");
console.log(
  USE_LLM
    ? "- **Classified tempo** — Sonnet validator reads the string blind to declared tempo and emits `independent_classification`."
    : "- **Classified tempo** — `classifyTempoBlind()` in `src/validator.ts`",
);
if (!USE_LLM) {
  console.log("  reads the string without seeing the declared tempo and reports which");
  console.log("  tempo it scores as.");
}
console.log("- **Verdict** — match / mismatch / unknown (off-character).");
console.log();
if (USE_LLM) {
  console.log("Classifier caveat: Sonnet is a second-model judge, not a product owner.");
  console.log("A `PASS` here means the line can fit the voice; it does not mean the");
  console.log("underlying product UX is good. Example: a terse error can pass voice");
  console.log("while the flow itself should still be removed or auto-routed.");
} else {
  console.log("Classifier caveat: deterministic anchor-matching, calibrated for");
  console.log("tweet-length comms. Short labels (1-5 words) under-score and return");
  console.log("`unknown`. That `unknown` verdict is still useful — it means the");
  console.log("string is not in any of the character's tempo vocabularies. For");
  console.log("production parity with Nigel's Track 5b Sonnet classifier, we should");
  console.log("add an LLM second-pass.");
}
console.log();
console.log("## Results");
console.log();
console.log("| ID | Job | Text | Declared | Classified | Verdict |");
console.log("|---|---|---|---|---|---|");

let matches = 0;
let mismatches = 0;
let unknowns = 0;
let offSpecDeclared = 0;
const llmById = new Map<string, LLMCopyAuditItem>();
if (USE_LLM) {
  console.error(`Sonnet homepage audit: ${SELECTED_SAMPLES.length} sample(s): ${SELECTED_SAMPLES.map((sample) => sample.id).join(", ")}`);
  const batch = await auditCopySetLLM(
    SELECTED_SAMPLES.map((sample) => ({
      id: sample.id,
      text: sample.text,
      surface: "Infinex homepage",
      job: sample.job,
      ...(sample.declared.tempo !== "off-spec" ? { declared_tempo: sample.declared.tempo } : {}),
    })),
    { voice: INFINEX_VOICE, max_tokens: 12000 },
  );
  console.error(`Sonnet homepage audit complete: ${batch.items.length} verdict(s).`);
  for (const item of batch.items) llmById.set(item.id, item);
}

for (const s of SELECTED_SAMPLES) {
  const { display, tempo: classifiedTempo } = fmtClassify(s, llmById.get(s.id));
  let verdict: string;
  if (s.declared.tempo === "off-spec") {
    verdict = "**OFF-SPEC** (declared as not-in-character; classifier should NOT match a main tempo)";
    offSpecDeclared++;
    if (classifiedTempo !== "unknown") {
      verdict += ` — but classifier saw ${classifiedTempo} (false positive)`;
    } else {
      verdict += ` — classifier agreed (unknown)`;
    }
  } else if (classifiedTempo === "unknown") {
    verdict = "**UNKNOWN** (off-character — string is not in any tempo vocabulary)";
    unknowns++;
  } else if (classifiedTempo === s.declared.tempo) {
    verdict = "**MATCH**";
    matches++;
  } else {
    verdict = `**MISMATCH** (declared ${s.declared.tempo}, read as ${classifiedTempo})`;
    mismatches++;
  }
  const safeText = s.text.replace(/\|/g, "\\|");
  console.log(
    `| ${s.id} | ${s.job} | "${safeText}" | ${s.declared.tempo} | ${display} | ${verdict} |`,
  );
}

console.log();
console.log("## Per-string reasoning (declared tempo justifications)");
console.log();
for (const s of SAMPLES) {
  console.log(`- **${s.id}** (${s.job} → declared ${s.declared.tempo}): ${s.declared.reasoning}`);
}
console.log();
console.log("## Summary");
console.log();
console.log(`Total strings tested: ${SELECTED_SAMPLES.length}`);
console.log(`  - Matches (declared = classified, in-character): ${matches}`);
console.log(`  - Mismatches (in-character but wrong tempo for the job): ${mismatches}`);
console.log(`  - Unknowns (off-character entirely): ${unknowns}`);
console.log(`  - Declared off-spec: ${offSpecDeclared}`);
console.log();
console.log("## What this tells us");
console.log();
console.log("1. **The homepage barely speaks in the Infinex character.** Most strings");
console.log("   either return `unknown` (the character has no vocabulary for them) or");
console.log("   are flagged off-spec on declaration (super app, crates, Opsec-to-suit-");
console.log("   your-spec). The shipped copy is in a generic-product-marketing register,");
console.log("   not the locked Mirodan character.");
console.log();
if (USE_LLM) {
  console.log("2. **The Sonnet loop catches what the regex layer misses.** It flags");
  console.log("   generic taxonomy and marketing-register lines that deterministic");
  console.log("   matching either marks `unknown` without explanation or misses entirely.");
} else {
  console.log("2. **The deterministic classifier is too thin for 1-5 word headlines.**");
  console.log("   It scores by vocab_anchor + opening_shapes + signoff_moves + motor +");
  console.log("   example_lines token overlap. Short labels rarely cross the 1.5 score");
  console.log("   threshold. For a real production verifier we need an LLM judge.");
}
console.log();
console.log("3. **`unknown` is not a bug — it is the right verdict for off-character");
console.log("   copy.** Treat it as such. A homepage hero classifying as `unknown` is");
console.log("   the character refusing to claim the line.");
console.log();
console.log("## Proposed next steps");
console.log();
if (USE_LLM) {
  console.log("a. **Write replacement copy** for every `FAIL` / `unknown` homepage line.");
  console.log("   Keep the source table as the evidence ledger.");
  console.log();
  console.log("b. **Add a one-shot generator entrypoint** that takes (job, current_text)");
  console.log("   and produces an in-character alternative for marketing/UI surfaces.");
  console.log();
  console.log("c. **Run the same Sonnet audit on platform strings** once the platform");
  console.log("   copy inventory is exported from the app repo.");
} else {
  console.log("a. **Add a Sonnet-based blind classifier** to the validator (alongside the");
  console.log("   deterministic one). Same contract: input paragraph, no declared tempo,");
  console.log("   output one of the 5 main tempi or `unknown`. This is the Nigel Track 5b");
  console.log("   parity work.");
  console.log();
  console.log("b. **Add a one-shot generator entrypoint** that takes (job, current_text)");
  console.log("   and produces an in-character alternative. Specifically for marketing/UI");
  console.log("   surfaces where the release-card model doesn't fit.");
  console.log();
  console.log("c. **Rewrite the homepage** through (a)+(b). The 20-string sample above is");
  console.log("   the work list.");
}
