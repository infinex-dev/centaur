#!/usr/bin/env tsx
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildBlogDraftMarkdown, defaultBlogDraftPath } from "./blog-draft.js";
import { parseReleaseCard } from "./card.js";
import { generate, type Channel } from "./generator.js";
import { orchestrate, orchestrateWithRetries } from "./orchestrator.js";
import { auditBeatsLLM, auditTextHybrid, validate } from "./validator.js";
import { auditTextLLM } from "./validator-llm.js";
import { defaultBeatsForKind as infinexDefaultBeats, INFINEX_VOICE } from "./voice/infinex.js";
import { defaultBeatsForKind as creamDefaultBeats, CREAM_OF_THE_CROP_VOICE } from "./voice/cream.js";
import { defaultBeatsForKind as projectjinDefaultBeats, PROJECTJIN_VOICE } from "./voice/projectjin.js";
import { defaultBeatsForKind as nigelDefaultBeats, NIGEL_VOICE } from "./voice/nigel.js";
import type { BeatSequence, CharacterSpec, TempoName } from "./voice/types.js";

/**
 * comms-factory CLI.
 *
 *   tsx src/cli.ts generate <card.json> [--beats=...] [--voice=infinex|cream|projectjin|nigel] [--retry]
 *   tsx src/cli.ts draft-blog <card.json> [--out=drafts/<id>.md] [--force]
 *   tsx src/cli.ts validate "<text>" [--beats=...] [--voice=...]
 *   tsx src/cli.ts tempi [--voice=...]   list available tempi for the voice
 *   tsx src/cli.ts demo [--voice=...]    run the canonical demo for the voice
 *   tsx src/cli.ts render <card.json>    (TODO)
 *   tsx src/cli.ts ship <card.json>      (TODO)
 */

type VoiceName = "infinex" | "cream" | "projectjin" | "nigel";

const VOICE_REGISTRY: Record<VoiceName, { voice: CharacterSpec; defaultBeats: (kind: string) => { tempo: TempoName; hint?: string }[] }> = {
  infinex: { voice: INFINEX_VOICE, defaultBeats: infinexDefaultBeats },
  cream: { voice: CREAM_OF_THE_CROP_VOICE, defaultBeats: creamDefaultBeats },
  projectjin: { voice: PROJECTJIN_VOICE, defaultBeats: projectjinDefaultBeats },
  nigel: { voice: NIGEL_VOICE, defaultBeats: nigelDefaultBeats },
};

function parseVoice(args: string[]): { voice: CharacterSpec; defaultBeats: (kind: string) => { tempo: TempoName; hint?: string }[] } {
  const arg = args.find((a) => a.startsWith("--voice="));
  if (!arg) return VOICE_REGISTRY.infinex; // default
  const name = arg.slice("--voice=".length) as VoiceName;
  const entry = VOICE_REGISTRY[name];
  if (!entry) {
    console.error(`unknown voice: ${name}. choices: ${Object.keys(VOICE_REGISTRY).join(", ")}`);
    process.exit(1);
  }
  return entry;
}

type Cmd = "generate" | "draft-blog" | "validate" | "tempi" | "demo" | "render" | "ship" | "help";

async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv as [Cmd | undefined, ...string[]];
  switch (cmd) {
    case "generate":
      return cmdGenerate(rest);
    case "draft-blog":
      return cmdDraftBlog(rest);
    case "validate":
      return await cmdValidate(rest);
    case "tempi":
      return cmdTempi(rest);
    case "demo":
      return cmdDemo(rest);
    case "render":
      return await cmdRender(rest);
    case "ship":
      return cmdShip(rest);
    case "help":
    case undefined:
      printUsage();
      return 0;
    default:
      console.error(`unknown command: ${cmd}`);
      printUsage();
      return 1;
  }
}

function printUsage(): void {
  const out = [
    "comms-factory",
    "",
    "usage:",
    "  tsx src/cli.ts generate <card.json> [--beats=t1,t2,t3] [--retry] generate caption candidates",
    "  tsx src/cli.ts draft-blog <card.json> [--out=drafts/<id>.md] [--force] scaffold canonical blog/docs draft",
    "  tsx src/cli.ts validate \"<text>\" [--beats=t1,t2,t3] [--validator=deterministic|llm|hybrid] ad-hoc validator check",
    "  tsx src/cli.ts tempi                                     list voice tempi",
    "  tsx src/cli.ts demo                                      run Hyperliquid demo",
    "  tsx src/cli.ts render <card.json>                        (TODO) Remotion render",
    "  tsx src/cli.ts ship <card.json>                          (TODO) full pipeline + ship gate",
    "",
    "voice: Stable + Flow-stressed + Penetrating, axis: Spell→Vision.",
    "main tempi: commanding, practical, sombre, irradiant, sociable",
    "set ANTHROPIC_API_KEY for live generation; otherwise stub mode.",
  ].join("\n");
  console.log(out);
}

function flagValue(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = args.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

function parseBeats(args: string[], voice: CharacterSpec): BeatSequence | undefined {
  const beatsArg = args.find((a) => a.startsWith("--beats="));
  if (!beatsArg) return undefined;
  const list = beatsArg.slice("--beats=".length);
  const beats = list.split(",").map((s) => s.trim()).filter(Boolean) as TempoName[];
  if (beats.length === 0) return undefined;
  // Validate each beat against voice's available tempi — fail-loud rather than
  // silently passing through to a no-op audit downstream.
  const available = new Set(Object.keys(voice.tempi));
  const invalid = beats.filter((b) => !available.has(b));
  if (invalid.length > 0) {
    const availableList = Array.from(available).sort().join(", ");
    console.error(`unknown tempi for voice ${voice.name}: ${invalid.join(", ")}`);
    console.error(`available tempi: ${availableList}`);
    process.exit(1);
  }
  return { beats: beats.map((t) => ({ tempo: t })) };
}

async function cmdGenerate(args: string[]): Promise<number> {
  const cardPath = args[0];
  if (!cardPath) {
    console.error("missing <card.json>");
    return 1;
  }
  const { voice, defaultBeats } = parseVoice(args);
  const card = parseReleaseCard(JSON.parse(readFileSync(cardPath, "utf8")));
  const beatsArg = parseBeats(args, voice);
  const channels = card.audience.filter(isAudiencePickChannel);
  // Resolve the actual beats once so generator / validator / orchestrator / printed
  // output all agree on what was used.
  const resolvedBeats: BeatSequence = beatsArg ?? { beats: defaultBeats(card.kind) };
  if (args.includes("--retry")) {
    const retryResult = await orchestrateWithRetries(
      card,
      channels,
      ({ feedback }) => generate(card, {
        beats: resolvedBeats,
        voice,
        defaultBeats,
        ...(feedback !== undefined ? { feedback } : {}),
      }),
      { voice, beats: resolvedBeats },
    );
    console.log(
      JSON.stringify(
        {
          mode: "retry",
          voice: voice.name,
          beats: resolvedBeats.beats.map((b) => b.tempo),
          exhausted: retryResult.exhausted,
          attempts: retryResult.attempts.map((attempt) => ({
            attempt: attempt.attempt,
            feedback: attempt.feedback,
            candidates: attempt.candidates,
            picks: attempt.result.picks,
            rejected: attempt.result.rejected,
          })),
          picks: retryResult.picks,
        },
        null,
        2,
      ),
    );
    return retryResult.picks.length > 0 ? 0 : 2;
  }

  const candidates = await generate(card, { beats: resolvedBeats, voice, defaultBeats });
  const result = orchestrate(
    card,
    candidates,
    channels,
    { voice, beats: resolvedBeats },
  );

  // Validate each candidate against the declared beats.
  const annotated = candidates.map((c) => ({
    ...c,
    validation: validate(c.text, {
      beats: resolvedBeats,
      voice,
      card,
      channel: c.channel,
      ...(c.deployed_facts_used !== undefined ? { deployed_facts_used: c.deployed_facts_used } : {}),
      ...(c.not_said !== undefined ? { not_said: c.not_said } : {}),
    }),
  }));
  console.log(
    JSON.stringify(
      {
        voice: voice.name,
        beats: resolvedBeats.beats.map((b) => b.tempo),
        candidates: annotated,
        picks: result.picks,
      },
      null,
      2,
    ),
  );
  return result.picks.length > 0 ? 0 : 2;
}

function cmdDraftBlog(args: string[]): number {
  const cardPath = args[0];
  if (!cardPath) {
    console.error("missing <card.json>");
    return 1;
  }

  const card = parseReleaseCard(JSON.parse(readFileSync(cardPath, "utf8")));
  const outPath = flagValue(args, "out") ?? defaultBlogDraftPath(card);
  const force = args.includes("--force");

  if (existsSync(outPath) && !force) {
    console.error(`draft exists: ${outPath}`);
    console.error("pass --force to overwrite");
    return 2;
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, buildBlogDraftMarkdown(card), "utf8");
  console.log(outPath);
  return 0;
}

async function cmdValidate(args: string[]): Promise<number> {
  // Text is everything that isn't a flag.
  const text = args.filter((a) => !a.startsWith("--")).join(" ").trim();
  if (!text) {
    console.error("missing text");
    return 1;
  }
  const { voice } = parseVoice(args);
  const beats = parseBeats(args, voice);

  // --validator=deterministic|llm|hybrid (default: deterministic for cheap iteration)
  // Legacy --llm flag still works (maps to llm).
  const validatorFlag = flagValue(args, "validator");
  const mode = validatorFlag ?? (args.includes("--llm") ? "llm" : "deterministic");

  if (mode === "llm") {
    const model = flagValue(args, "model");
    const surface = flagValue(args, "surface");
    const job = flagValue(args, "job");
    const factContext = flagValue(args, "fact-context");
    if (beats) {
      const result = await auditBeatsLLM(text, beats, {
        voice,
        ...(model !== undefined ? { model } : {}),
        ...(surface !== undefined ? { surface } : {}),
        ...(job !== undefined ? { job } : {}),
        ...(factContext !== undefined ? { fact_context: factContext } : {}),
      });
      console.log(JSON.stringify({ mode: "llm", voice: voice.name, beats, result }, null, 2));
      return result.every((beat) => beat.passed) ? 0 : 2;
    }
    const result = await auditTextLLM(text, {
      voice,
      ...(model !== undefined ? { model } : {}),
      ...(surface !== undefined ? { surface } : {}),
      ...(job !== undefined ? { job } : {}),
      ...(factContext !== undefined ? { fact_context: factContext } : {}),
    });
    console.log(JSON.stringify({ mode: "llm", voice: voice.name, result }, null, 2));
    return result.passed ? 0 : 2;
  }

  if (mode === "hybrid") {
    const model = flagValue(args, "model");
    const surface = flagValue(args, "surface");
    const job = flagValue(args, "job");
    const factContext = flagValue(args, "fact-context");
    const llmOpts = {
      ...(model !== undefined ? { model } : {}),
      ...(surface !== undefined ? { surface } : {}),
      ...(job !== undefined ? { job } : {}),
      ...(factContext !== undefined ? { fact_context: factContext } : {}),
    };
    const verdict = await auditTextHybrid(text, {
      voice,
      ...(beats ? { beats } : {}),
      llm_opts: llmOpts,
    });
    console.log(JSON.stringify({ mode: "hybrid", voice: voice.name, verdict }, null, 2));
    return verdict.passed ? 0 : 2;
  }

  // mode === "deterministic" (default)
  const result = validate(text, beats ? { beats, voice } : { voice });
  console.log(JSON.stringify(result, null, 2));
  return result.passed ? 0 : 2;
}

function cmdTempi(args: string[]): number {
  const { voice } = parseVoice(args);
  console.log(`# ${voice.name} voice — tempi reference\n`);
  console.log(`Inner: ${voice.inner_attitude} · Stress: ${voice.stress} · Aspect: ${voice.aspect}`);
  console.log(`Drive: ${voice.drive_primary} + ${voice.drive_secondary} (${voice.drive_axis ?? ""})\n`);
  console.log(`## Main tempi (in rotation)\n`);
  for (const name of voice.main_tempi) {
    const t = voice.tempi[name];
    if (!t) continue;
    const innerCombo = t.inner_combo ?? (t.factor_shape ? `${t.attitude} · ${t.factor_shape}` : t.attitude);
    const motorArrow = t.motor_relation === "co_exist" ? "/" : "→";
    console.log(`  ${name}  (${innerCombo})`);
    console.log(`    motor: ${t.motor[0]} ${motorArrow} ${t.motor[1]}`);
    if (t.canonical_shorthand) console.log(`    canon: ${t.canonical_shorthand}`);
    if (t.feel) console.log(`    feel:  ${t.feel}`);
    console.log("");
  }
  console.log(`## Beat-only tempi (rare)\n`);
  for (const name of voice.beat_only_tempi) {
    const t = voice.tempi[name];
    if (!t) continue;
    const innerCombo = t.inner_combo ?? (t.factor_shape ? `${t.attitude} · ${t.factor_shape}` : t.attitude);
    const motorArrow = t.motor_relation === "co_exist" ? "/" : "→";
    console.log(`  ${name}  (${innerCombo})  motor: ${t.motor[0]} ${motorArrow} ${t.motor[1]}`);
  }
  return 0;
}

async function cmdDemo(args: string[]): Promise<number> {
  const { voice } = parseVoice(args);
  // Demo currently uses Infinex's Hyperliquid card. For other voices, route through generate.
  if (voice.name !== "infinex") {
    console.log(`# ${voice.name} demo — using Infinex's release card as stand-in; voice swapped.\n`);
  }
  // Canonical demo: spot Hyperliquid is live in Infinex.
  // Beats: sombre → commanding → practical → irradiant
  // (Sombre's Pressing prepares Commanding's Punching; Practical wrings the
  // justification; Irradiant floats into a flick close.)
  const card = parseReleaseCard({
    id: "demo-spot-hyperliquid",
    kind: "launch-tier",
    title: "Spot Hyperliquid is live in Infinex",
    ship_date: "2026-05-12",
    audience: ["x", "web"],
    deployed_facts: [
      "Spot trading on Hyperliquid is now live in Infinex",
      "Same Infinex account and passkey — no new wallet required",
      "100+ markets supported",
      "Two clicks from portfolio to fill",
    ],
    headline: "Spot Hyperliquid, native in Infinex",
    tier_reason: "first cross-exchange spot integration; load-bearing for the one-app thesis",
    product_page_url: "https://infinex.xyz/perps",
  });

  // Use the first 4 main_tempi of the chosen voice as the demo beat sequence
  const demoBeats = voice.main_tempi.slice(0, 4) as TempoName[];
  const beats: BeatSequence = {
    beats: demoBeats.map((tempo) => ({ tempo })),
  };

  console.log("## Demo card\n");
  console.log(`  ${card.title}\n  voice: ${voice.name}\n  beats: ${beats.beats.map((b) => b.tempo).join(" → ")}\n`);

  const candidates = await generate(card, { beats, voice });
  console.log(`## ${candidates.length} candidate(s) generated (${candidates[0]?.source})\n`);

  for (const c of candidates) {
    const v = validate(c.text, {
      beats,
      voice,
      card,
      channel: c.channel,
      ...(c.deployed_facts_used !== undefined ? { deployed_facts_used: c.deployed_facts_used } : {}),
      ...(c.not_said !== undefined ? { not_said: c.not_said } : {}),
    });
    console.log(`### ${c.id}  [${v.passed ? "PASS" : "FAIL"}]`);
    console.log(c.text);
    if (!v.passed) {
      console.log("\n  validator failures:");
      for (const f of v.failures) console.log(`    - ${f.rule}: ${f.reason}`);
    }
    console.log("\n---\n");
  }
  return 0;
}

async function cmdRender(args: string[]): Promise<number> {
  const cardPath = args[0];
  if (!cardPath) {
    console.error("missing <card.json>");
    return 1;
  }
  const { voice, defaultBeats } = parseVoice(args);
  const outArg = args.find((a) => a.startsWith("--out="));
  const outDir = outArg ? outArg.slice("--out=".length) : `dist/${voice.name}-${Date.now()}`;
  const bgArg = args.find((a) => a.startsWith("--bg="));
  const backgroundImagePath = bgArg ? bgArg.slice("--bg=".length) : undefined;

  const card = parseReleaseCard(JSON.parse(readFileSync(cardPath, "utf8")));
  const beatsArg = parseBeats(args, voice);
  const resolvedBeats: BeatSequence = beatsArg ?? { beats: defaultBeats(card.kind) };

  // 1. Generate caption candidates
  console.log(`generating captions (voice=${voice.name}, beats=${resolvedBeats.beats.map((b) => b.tempo).join(" → ")})...`);
  const candidates = await generate(card, { beats: resolvedBeats, voice, defaultBeats });

  // 2. Pick a candidate. Renderer extracts the lead beat (first paragraph) as the
  // composition's caption slot — full multi-beat post is for longform/threaded
  // channels, not single-card video. So we don't enforce X's 280-char limit here.
  // Validation-pass preferred; if none pass slop rules, fall back to first candidate.
  let chosen = candidates.find((c) => {
    const v = validate(c.text, { beats: resolvedBeats, voice, card, channel: c.channel });
    return v.passed;
  });
  if (!chosen) {
    console.warn(`no candidate cleanly passed validation; falling back to first candidate (slop may leak)`);
    chosen = candidates[0];
  }
  if (!chosen) {
    console.error("no candidates generated at all");
    return 2;
  }
  // Extract the lead beat — first non-empty paragraph
  const leadBeat = chosen.text.split(/\n\s*\n+/).map((p) => p.trim()).find((p) => p.length > 0) ?? chosen.text;
  console.log(`picked: ${chosen.id} (${chosen.source}) · lead-beat ${leadBeat.length}ch`);

  // 3. Render via Remotion
  const { render } = await import("./remotion/render.js");
  console.log(`rendering to ${outDir}/ ...`);
  const r = await render({
    card,
    caption: leadBeat,
    brandSlug: voice.name,
    outDir,
    ...(backgroundImagePath !== undefined ? { backgroundImagePath } : {}),
  });
  console.log(`mp4:    ${r.mp4Path}`);
  if (r.posterPath) console.log(`poster: ${r.posterPath}`);
  console.log(`${r.width}x${r.height} · ${r.durationFrames} frames @ ${r.fps}fps`);
  return 0;
}

function cmdShip(_args: string[]): number {
  console.error("ship: TODO — pipeline not yet wired");
  return 64;
}

function isPickChannel(s: string): s is Channel {
  return (
    s === "web" ||
    s === "x" ||
    s === "x-thread" ||
    s === "in-product" ||
    s === "modal" ||
    s === "blog" ||
    s === "carousel"
  );
}

function isAudiencePickChannel(s: string): s is Exclude<Channel, "image-brief"> {
  return isPickChannel(s);
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err);
    process.exit(1);
  },
);
