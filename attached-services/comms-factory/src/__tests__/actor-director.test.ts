import { describe, expect, it } from "vitest";
import { cpus } from "node:os";
import { deployedFactClaims, type ReleaseCard } from "../card.js";
import {
  auditCandidateWithDirector,
  actorOutputToCandidates,
  buildActorAssignmentMessage,
  buildActorTranscript,
  buildDirectorNotesMessage,
  type DirectorNotes,
  buildDirectorUserMessage,
  detectVersionTag,
  extractJsonObject,
  generateActorAttempt,
  prewarmDirectorCache,
  parseDirectorAudit,
  parseActorOutput,
  type ActorOutput,
  type FactRequest,
} from "../actor-director.js";
import { buildActorMemoryPack, buildDirectorMemoryPack } from "../actor-memory.js";
import type { Channel } from "../generator.js";
import {
  channelMaxLen,
  collectChannelFailureFeedback,
  collectFactRequests,
  dedupeNewRequests,
  orchestrateActorDirectorWithRetries,
  validateActorMovement,
  type ActorDirectorCandidateRecord,
  type FactRequestGrounderFn,
} from "../actor-orchestrator.js";
import { INFINEX_VOICE } from "../voice/infinex.js";
import { ALL_TEMPO_NAMES } from "../voice/types.js";

const CARD: ReleaseCard = {
  id: "actor-test",
  title: "Bridge deposits",
  ship_date: "2026-05-26",
  audience: ["web", "x"],
  deployed_facts: [
    "Bridge.xyz is the fiat deposit provider for Infinex",
  ],
  kind: "split",
  from: "bank deposit",
  to: "USDC in Infinex",
  split_semantics: "fiat enters and settles as USDC",
  through_action: "to reveal that the bank wall moved off the user",
  obstacle: "reader expects rails mechanics",
  reader_prior: "bank and wallet are separate systems",
  not_the_point: "do not list rails",
  lining: "surface: a deposit route. underneath: responsibility moved into the account.",
};

const CHANGELOG_CARD: ReleaseCard = {
  ...CARD,
  id: "bridge-fiat-deposit-2026-06-05",
  title: "Bank deposits: dollars into Infinex as USDC on Base",
  audience: ["blog"],
};

const NON_CHANGELOG_BLOG_CARD = {
  ...CHANGELOG_CARD,
  category: "news",
} as ReleaseCard & { category: string };

describe("actor/director architecture", () => {
  it("builds source-indexed actor and director memory from canonical artifacts", () => {
    const actor = buildActorMemoryPack(INFINEX_VOICE);
    const director = buildDirectorMemoryPack(INFINEX_VOICE);
    const allSources = actor.source_index;

    expect(actor.system_prompt).toContain("Canonical source index");
    expect(actor.system_prompt).toContain("Mirodan Ch. I: Basic Concepts");
    expect(actor.system_prompt).toContain("Actor Memory");
    expect(actor.system_prompt).toContain("You are the Actor");
    expect(actor.system_prompt).toContain("Blog: up to 3600 characters");
    expect(allSources).toHaveLength(7);
    expect(allSources.every((entry) => entry.exists)).toBe(true);
    expect(allSources.every((entry) => entry.sha256)).toBe(true);
    expect(allSources.every((entry) => entry.path.includes("third_party/mirodan"))).toBe(true);
    expect(allSources.every((entry) => !entry.path.includes("/Users/opaque/Downloads"))).toBe(true);
    expect(actor.source_index.filter((entry) => entry.role === "chapter").every((entry) => entry.exists)).toBe(true);
    expect(actor.source_index.filter((entry) => entry.role === "chapter").every((entry) => entry.sha256)).toBe(true);
    expect(actor.source_index.some((entry) => entry.id === "vol2-pdf" && entry.exists && entry.bytes > 40_000_000)).toBe(true);
    expect(actor.source_index.some((entry) => entry.id === "combined-reference" && entry.exists)).toBe(true);

    expect(director.system_prompt).toContain("Director Memory");
    expect(director.system_prompt).toContain("Classify primary tempo from all 24 tempi");
    expect(director.system_prompt).toContain("flexible/indirect pathing");
    expect(director.system_prompt).toContain("Inner Attitudes are two-Motion-Factor compounds");
    expect(director.system_prompt).toContain("Mobile (Time + Flow)");
    expect(director.system_prompt).toContain("Remote (Space + Flow)");
    expect(director.system_prompt).toContain("Awake (Space + Time)");
    expect(director.system_prompt).toContain("canonical shorthand");
    expect(director.system_prompt).toContain("Commanding demonstration or acceptance of a 'bold resolve'");
    expect(director.system_prompt).toContain("Directional intent is orthogonal to factor shape and motor");
    expect(director.system_prompt).not.toContain("operator hint");
    expect(director.system_prompt).not.toContain("institutional landing");
    expect(director.system_prompt).toContain("Voice Mirodan kernel");
	  expect(director.system_prompt).toContain("Voice drive table");
	  expect(director.system_prompt).toContain("stable|penetrating|flow -> primary=spell");
	  expect(director.system_prompt).toContain("Lining check");
	  expect(director.system_prompt).toContain("Drives are READ from the visible Working Action");
	  expect(director.system_prompt).toContain("Doing or Spell as visible surface is acceptable");
	  expect(director.source_index.some((entry) => entry.id === "source-location-memory" && entry.exists)).toBe(true);
	});

  it("carries release economy (Actor) and motor uniformity (Director) with the shared example pair", () => {
    const actor = buildActorMemoryPack(INFINEX_VOICE);
    const director = buildDirectorMemoryPack(INFINEX_VOICE);

    expect(actor.version).toBe("actor-memory-v2.1");
    expect(actor.system_prompt).toContain("## Release economy");
    expect(actor.system_prompt).toContain("AT MOST ONE beat per piece");
    expect(actor.system_prompt).toContain("Antithesis grammar");

    expect(director.version).toBe("director-memory-v2.1");
    expect(director.system_prompt).toContain("## Motor uniformity");
    expect(director.system_prompt).toContain("assigned, not decided");
    expect(director.system_prompt).toContain("naming WHICH closes should end Sustained");

    // The general example pair (button vs Sustained close) must be in BOTH packs
    // — a fresh Director has never seen any past run's prose, so the contrast
    // travels with the prompt.
    for (const prompt of [actor.system_prompt, director.system_prompt]) {
      expect(prompt).toContain("The machine is not impressive. It is finished.");
      expect(prompt).toContain("the next inspection is in March");
    }
  });

  it("gives the Director all 24 tempi and evidence requirements", () => {
    const director = buildDirectorMemoryPack(INFINEX_VOICE);
    for (const tempo of ALL_TEMPO_NAMES) {
      expect(director.system_prompt).toContain(`- ${tempo}:`);
    }
    expect(director.system_prompt).toContain("If you call something Flexible");
    expect(director.system_prompt).toContain("If you call something Strong");
    expect(director.system_prompt).toContain("working actions");
  });

  it("parses actor table work and performances without declared tempo fields", () => {
    const parsed = parseActorOutput(JSON.stringify(actorOutput("The wall moved.", "The wall moved.")), ["x", "web"]);
    const candidates = actorOutputToCandidates(parsed, ["x", "web"], "anthropic");

    expect(parsed.warmup.mode).toBe("daily_pages");
    expect(parsed.warmup.warmed_state).toContain("fixture warmed state");
    expect(parsed.table_work.channel_beat_plans.x?.[0]?.verb).toBe("to reveal");
    expect(JSON.stringify(parsed.table_work.channel_beat_plans)).not.toContain("tempo");
    expect(candidates).toHaveLength(10);
    expect(candidates.every((candidate) => candidate.declared_beats.every((beat) => !("tempo" in beat)))).toBe(true);
  });

  it("does not fail candidate parsing when scene rehearsal warmup omits a self_note", () => {
    const output = actorOutput("The wall moved.", "The wall moved.");
    output.warmup = {
      mode: "scene_rehearsal",
      scene_rehearsal: {
        given_circumstances: "fixture circumstances",
        reader_scene_partner: "fixture reader",
        playable_objective: "to reveal the fixture result",
        false_actions_rejected: [],
        rehearsal_passes: [{
          pass: 1,
          action: "to reveal",
          text_or_moment: "The wall moved.",
        } as never],
        final_playable_state: "fixture warmed state",
      },
      notes: [],
      warmed_state: "fixture warmed state",
    };

    const parsed = parseActorOutput(JSON.stringify(output), ["x", "web"]);

    expect(parsed.warmup.scene_rehearsal?.rehearsal_passes[0]?.self_note).toBe("");
    expect(actorOutputToCandidates(parsed, ["x", "web"], "anthropic")).toHaveLength(10);
  });

	  it("sends all five actor options per channel forward while preserving the Actor recommendation", () => {
    const parsed = parseActorOutput(
      JSON.stringify(actorOutput("x option 1", "web option 1", {
        xOptions: ["x option 1", "x option 2", "x option 3", "x option 4", "x option 5"],
        webOptions: ["web option 1", "web option 2", "web option 3", "web option 4", "web option 5"],
        selectedX: 4,
        selectedWeb: 2,
      })),
      ["x", "web"],
    );

    const candidates = actorOutputToCandidates(parsed, ["x", "web"], "anthropic");

    expect(parsed.performances.x).toHaveLength(5);
    expect(parsed.performances.web).toHaveLength(5);
    expect(candidates).toHaveLength(10);
    expect(candidates.filter((c) => c.channel === "x").map((c) => c.text)).toEqual([
      "x option 1",
      "x option 2",
      "x option 3",
      "x option 4",
      "x option 5",
    ]);
    expect(candidates.filter((c) => c.channel === "web").map((c) => c.text)).toEqual([
      "web option 1",
      "web option 2",
      "web option 3",
      "web option 4",
      "web option 5",
    ]);
    expect(candidates.map((c) => c.rationale).join("\n")).toContain("Actor option 4 (Actor recommended)");
	    expect(candidates.map((c) => c.rationale).join("\n")).toContain("Actor recommended option 2 instead");
	  });

	  it("parses structured actor performances into typed output plus readable text", () => {
	    const parsed = parseActorOutput(JSON.stringify(structuredActorOutput()), ["web", "x-thread", "carousel"]);
	    const candidates = actorOutputToCandidates(parsed, ["web", "x-thread", "carousel"], "anthropic");

	    const web = candidates.find((candidate) => candidate.channel === "web");
	    const thread = candidates.find((candidate) => candidate.channel === "x-thread");
	    const carousel = candidates.find((candidate) => candidate.channel === "carousel");

	    expect(web?.structured).toEqual({
	      kind: "web-card",
	      subheading: "Spot",
	      title: "Hyperliquid spot / inside Infinex",
	      caption: "CLOB spot, unified account only",
	    });
	    expect(web?.text).toBe("Spot\nHyperliquid spot inside Infinex\nCLOB spot, unified account only");
	    expect(thread?.structured?.kind).toBe("thread");
	    expect(thread?.text).toBe("Spot V1 is inside Infinex Perps.\n\nCLOB spot runs in a unified account.");
	    expect(carousel?.structured?.kind).toBe("carousel");
	    expect(carousel?.text).toContain("1. Spot V1");
	  });

	  it("can request no warm-up or scene rehearsal without daily-pages language", () => {
	    const none = buildActorAssignmentMessage(CARD, ["x"], 5, "none");
	    const scene = buildActorAssignmentMessage(CARD, ["x"], 5, "scene_rehearsal");
	    const structured = buildActorAssignmentMessage(CARD, ["x-thread", "web", "carousel"], 2, "none", {
	      flow_direction: "outwards-in",
	      flow_order: ["carousel", "web", "x-thread"],
	      feedback_wave_regime: "two-tier",
	      x_thread_target_tweets: 3,
	    });

    expect(none).toContain("Actor warm-up mode: none");
    expect(none).toContain('"mode": "none"');
    expect(none).not.toContain('"daily_pages"');
    expect(scene).toContain("Actor warm-up mode: scene_rehearsal");
    expect(scene).toContain('"scene_rehearsal"');
    expect(scene).toContain("rehearsal_passes");
    expect(scene).not.toContain("movement_function");
    expect(scene).toContain("The Actor targets two layers");
	    expect(scene).toContain("Working Action/Subconscious Motif");
	    expect(scene).toContain('"working_action"');
	    expect(scene).toContain('"preparation_from"');
	    expect(structured).toContain("Vertical flow direction: outwards-in");
	    expect(structured).toContain('"tweets"');
	    expect(structured).toContain('"slides"');
	    expect(structured).toContain('"subheading"');
	  });

  it("injects Director notes into the fresh assignment when no previous transcript exists", () => {
    const notes: DirectorNotes = {
      attempt: 1,
      summary: "Missing valid performances for channels: x.",
      notes: ["x: regex/format rejected \"Spot is live...\" because x-opening-link — drop the link."],
    };
    const transcript = buildActorTranscript(CARD, ["x"], 2, "scene_rehearsal", undefined, notes);
    expect(transcript).toHaveLength(1);
    expect(transcript[0]?.role).toBe("user");
    expect(transcript[0]?.content).toContain("Director notes after attempt 1");
    expect(transcript[0]?.content).toContain("x-opening-link");
  });

  it("tells the actor up front that X copy cannot carry links", () => {
    const msg = buildActorAssignmentMessage(CARD, ["x", "x-thread"], 2);
    expect(msg).toContain("must not contain a URL");
    expect(msg).toContain("Tweet 1 must not contain a URL");
    expect(msg).toContain("not_said");
  });

  it("does not provide fake Actor output in stub mode", async () => {
    await expect(generateActorAttempt(CARD, {
      channels: ["x"],
      mode: "stub",
    })).rejects.toThrow("stub mode has been removed");
  });

  it("validates actor movement grammar without relying on invented movement-function labels", () => {
    const parsed = parseActorOutput(JSON.stringify(actorOutput("The wall moved.", "The wall moved.")), ["x", "web"]);
    const [candidate] = actorOutputToCandidates(parsed, ["x"], "anthropic");
    expect(candidate).toBeDefined();
    expect(validateActorMovement(candidate!)).toEqual([]);

    const noPrep = {
      ...candidate!,
      movement_score: [{
        objective_verb: "to reveal",
        working_action: "punching" as const,
        physical_score: "unprepared hard strike",
      }],
      movement_receipt: [{
        text_span: "The wall moved.",
        objective_verb: "to reveal",
        working_action: "punching" as const,
        evidence: "short hard strike",
      }],
    };

    expect(validateActorMovement(noPrep).some((failure) => failure.rule === "movement-prep")).toBe(true);
    expect(JSON.stringify(noPrep)).not.toContain("movement_function");
  });

  it("keeps all requested channels in one actor call per attempt and appends Director notes", async () => {
    const actorRequests: unknown[] = [];
    const directorRequests: unknown[] = [];
    const actorClient = {
      messages: {
        create: async (params: unknown) => {
          actorRequests.push(params);
          return {
            content: [{
              type: "text",
              text: JSON.stringify(actorOutput("The wall moved.", "The wall moved.")),
            }],
          };
        },
      },
    };
    const directorClient = {
      messages: {
        create: async (params: unknown) => {
          directorRequests.push(params);
          const passed = actorRequests.length > 1;
          return {
            content: [{
              type: "text",
              text: JSON.stringify(directorOutput(passed)),
            }],
          };
        },
      },
    };

    const result = await orchestrateActorDirectorWithRetries(CARD, ["x", "web"], {
      n: 5,
      mode: "live",
      actor_client: actorClient as never,
      director_client: directorClient as never,
      maxAttempts: 3,
    });

    expect(result.exhausted).toBe(false);
    expect(actorRequests).toHaveLength(2);
    expect(directorRequests).toHaveLength(20);
    expect(result.attempts[1]?.director_notes_in?.notes.length).toBeGreaterThan(0);
    expect(JSON.stringify(actorRequests[1])).toContain("Director notes after attempt 1");
  });

  it("keeps retrying unsettled candidates after every channel has a pick, narrowing the wave and pooling earlier passers", async () => {
    // Wave 1: all 5 x candidates pass; web option 1 passes but options 2-5 fail.
    // Old contract would stop here ("one pick per channel = done"). New contract:
    // wave 2 regenerates ONLY web; the x pick survives from the wave-1 pool.
    const actorRequests: unknown[] = [];
    let directorCalls = 0;
    const actorClient = {
      messages: {
        create: async (params: unknown) => {
          actorRequests.push(params);
          return {
            content: [{
              type: "text",
              text: JSON.stringify(actorOutput("The wall moved.", "The bank wall is gone.", {
                xOptions: ["The wall moved.", "The wall moved off.", "The wall moved away.", "The wall moved aside.", "The wall moved on."],
                webOptions: ["The bank wall is gone.", "The wall slipped aside.", "The wall slipped away.", "The wall slipped past.", "The wall slipped off."],
              })),
            }],
          };
        },
      },
    };
    const directorClient = {
      messages: {
        create: async (params: unknown) => {
          directorCalls += 1;
          const user = JSON.stringify(params);
          const isLaterWave = actorRequests.length > 1;
          const isFailingWebOption = user.includes("slipped");
          const passed = isLaterWave || !isFailingWebOption;
          return {
            content: [{ type: "text", text: JSON.stringify(directorOutput(passed)) }],
          };
        },
      },
    };

    const result = await orchestrateActorDirectorWithRetries(CARD, ["x", "web"], {
      n: 5,
      mode: "live",
      actor_client: actorClient as never,
      director_client: directorClient as never,
      maxAttempts: 3,
    });

    expect(result.exhausted).toBe(false);
    expect(result.attempts).toHaveLength(2);
    expect(actorRequests).toHaveLength(2);
    // Wave 1 audits 10 candidates (5 per channel); wave 2 audits only web's 5.
    expect(directorCalls).toBe(15);
    // The x pick survives from the wave-1 pool even though wave 2 had no x records.
    expect(result.picks.map((pick) => pick.channel).sort()).toEqual(["web", "x"]);
    expect(result.picks.find((pick) => pick.channel === "x")?.text).toContain("The wall moved");
  });

  it("seeds attempt 1 from seed_transcript + seed_notes for manual regenerate-with-notes", async () => {
    const actorRequests: unknown[] = [];
    const actorClient = {
      messages: {
        create: async (params: unknown) => {
          actorRequests.push(params);
          return {
            content: [{ type: "text", text: JSON.stringify(actorOutput("Reworked draft.", "Reworked draft.")) }],
          };
        },
      },
    };
    const directorClient = {
      messages: {
        create: async () => ({
          content: [{ type: "text", text: JSON.stringify(directorOutput(true)) }],
        }),
      },
    };

    const result = await orchestrateActorDirectorWithRetries(CARD, ["x"], {
      n: 5,
      mode: "live",
      actor_client: actorClient as never,
      director_client: directorClient as never,
      maxAttempts: 3,
      seed_transcript: [
        { role: "user", content: "ASSIGNMENT: prior single-channel assignment" },
        { role: "assistant", content: "PRIOR_DRAFT_MARKER good vibes wrong format" },
      ],
      seed_notes: {
        attempt: 1,
        summary: "Operator: restructure into changelog format, keep the voice.",
        notes: ["RESTRUCTURE_MARKER into changelog format"],
      },
    });

    // Director passes immediately, so exactly one (seeded) actor attempt runs.
    expect(result.exhausted).toBe(false);
    expect(actorRequests).toHaveLength(1);
    const firstReq = JSON.stringify(actorRequests[0]);
    // The seeded prior draft AND the seed notes must reach attempt 1's actor call.
    expect(firstReq).toContain("PRIOR_DRAFT_MARKER good vibes wrong format");
    expect(firstReq).toContain("RESTRUCTURE_MARKER into changelog format");
  });

	it("can generate all channels in one actor call when Director passes first time", async () => {
    const actorRequests: unknown[] = [];
    const directorRequests: unknown[] = [];
    const actorClient = {
      messages: {
        create: async (params: unknown) => {
          actorRequests.push(params);
          return {
            content: [{
              type: "text",
              text: JSON.stringify(actorOutput("The wall moved.", "The wall moved.")),
            }],
          };
        },
      },
    };
    const directorClient = {
      messages: {
        create: async (params: unknown) => {
          directorRequests.push(params);
          return {
            content: [{
              type: "text",
              text: JSON.stringify(directorOutput(true)),
            }],
          };
        },
      },
    };

    const result = await orchestrateActorDirectorWithRetries(CARD, ["x", "web"], {
      n: 5,
      mode: "live",
      actor_client: actorClient as never,
      director_client: directorClient as never,
      maxAttempts: 3,
    });

    expect(result.picks).toHaveLength(2);
    expect(actorRequests).toHaveLength(1);
    expect(directorRequests).toHaveLength(10);
    expect(buildActorAssignmentMessage(CARD, ["x", "web"], 5)).toContain("Required channels: x, web");
	  expect(buildActorAssignmentMessage(CARD, ["x", "web"], 5)).toContain("Candidates per channel: 5 final-copy options");
	});

	it("ranks passing candidates instead of picking the first passing option", async () => {
	  const actorClient = {
	    messages: {
	      create: async () => ({
	        content: [{
	          type: "text",
	          text: JSON.stringify(actorOutput("unused x", "unused web", {
	            xOptions: [
	              "Wire rail rail rail account account account live in Infinex.",
	              "Hyperliquid spot is live in Infinex.",
	              "Infinex now has Hyperliquid spot.",
	              "Spot trading is live in Infinex.",
	              "Hyperliquid spot, inside Infinex.",
	            ],
	            webOptions: [
	              "Wire rail rail rail account account account.",
	              "Hyperliquid spot is live in Infinex.",
	              "Spot is live in Infinex.",
	              "Hyperliquid, inside Infinex.",
	              "Infinex now has spot.",
	            ],
	          })),
	        }],
	      }),
	    },
	  };
	  const directorClient = {
	    messages: {
	      create: async () => ({
	        content: [{
	          type: "text",
	          text: JSON.stringify(directorOutput(true)),
	        }],
	      }),
	    },
	  };

	  const result = await orchestrateActorDirectorWithRetries(CARD, ["x", "web"], {
	    n: 5,
	    mode: "live",
	    actor_client: actorClient as never,
	    director_client: directorClient as never,
	    maxAttempts: 1,
	  });

	  expect(result.picks.find((pick) => pick.channel === "x")?.text).toBe("Hyperliquid spot is live in Infinex.");
	  expect(result.selection_rationales.x?.rationale).toContain("score");
	  expect(result.picks.find((pick) => pick.channel === "x")?.rationale).toContain("Final pick rationale");
	});

		it("applies operator preferences during ranked selection", async () => {
	  const actorClient = {
	    messages: {
	      create: async () => ({
	        content: [{
	          type: "text",
	          text: JSON.stringify(actorOutput("unused x", "unused web", {
	            xOptions: [
	              "Bridge.xyz deposits are live in Infinex.",
	              "Bridge.xyz is the fiat deposit provider for Infinex.",
	            ],
	            selectedX: 1,
	          })),
	        }],
	      }),
	    },
	  };
	  const directorClient = {
	    messages: {
	      create: async () => ({
	        content: [{
	          type: "text",
	          text: JSON.stringify(directorOutput(true)),
	        }],
	      }),
	    },
	  };

	  const result = await orchestrateActorDirectorWithRetries(CARD, ["x"], {
	    n: 2,
	    mode: "live",
	    actor_client: actorClient as never,
	    director_client: directorClient as never,
	    maxAttempts: 1,
	    operator_preferences: [{
	      channel: "x",
	      prefer: "fiat deposit provider",
	      weight: 30,
	      reason: "operator wants provider phrasing",
	    }],
	  });

	  expect(result.picks[0]?.text).toBe("Bridge.xyz is the fiat deposit provider for Infinex.");
		  expect(result.selection_rationales.x?.rationale).toContain("operator preference matched");
		});

		it("skips the blind Director for regex-failed candidates but still batches regex notes into the retry wave", async () => {
		  const actorClient = {
		    messages: {
		      create: async () => ({
		        content: [{
		          type: "text",
		          text: JSON.stringify(actorOutput("A game-changing launch.", "unused web", {
		            xOptions: ["A game-changing launch."],
		          })),
		        }],
		      }),
		    },
		  };
		  const directorRequests: unknown[] = [];
		  const directorClient = {
		    messages: {
		      create: async (params: unknown) => {
		        directorRequests.push(params);
		        return {
		          content: [{
		            type: "text",
		            text: JSON.stringify(directorOutput(true)),
		          }],
		        };
		      },
		    },
		  };

		  const result = await orchestrateActorDirectorWithRetries(CARD, ["x"], {
		    n: 1,
		    mode: "live",
		    actor_client: actorClient as never,
		    director_client: directorClient as never,
		    maxAttempts: 1,
		  });

		  expect(result.exhausted).toBe(true);
		  expect(result.picks).toHaveLength(0);
		  expect(directorRequests.length).toBe(0);
		  expect(result.attempts[0]?.records[0]?.director_audit).toBeUndefined();
		  expect(result.attempts[0]?.director_notes.change?.format?.join("\n")).toContain("game-changing");
		  expect(result.attempts[0]?.director_notes.feedback_wave?.regex_format_notes.join("\n")).toContain("regex/format");
		});

    it("sends the Director rubric as a cached system block and keeps candidate text in the user message", async () => {
      const calls: unknown[] = [];
      const client = {
        messages: {
          create: async (params: unknown) => {
            calls.push(params);
            return { content: [{ type: "text", text: JSON.stringify(directorOutput(true)) }] };
          },
        },
      };

      await auditCandidateWithDirector({
        card: CARD,
        channel: "x",
        candidate: {
          id: "cache-shape",
          channel: "x",
          text: "The wall moved.",
          declared_beats: [],
          source: "anthropic",
        },
        mode: "live",
        client: client as never,
      });

      const call = calls[0] as { system?: unknown; messages?: Array<{ content?: unknown }> };
      expect(Array.isArray(call.system)).toBe(true);
      const block = (call.system as Array<{ type: string; text: string; cache_control?: unknown }>)[0];
      if (!block) throw new Error("missing Director system block");
      expect(block).toMatchObject({ type: "text", cache_control: { type: "ephemeral" } });
      expect(block.text).toContain("Director Memory");
      expect(block.text).not.toContain("The wall moved.");
      expect(JSON.stringify(call.messages)).toContain("The wall moved.");
    });

    it("prewarms the Director cache with a one-token cached system request", async () => {
      const calls: unknown[] = [];
      const client = {
        messages: {
          create: async (params: unknown) => {
            calls.push(params);
            return { content: [{ type: "text", text: "x" }] };
          },
        },
      };

      await prewarmDirectorCache({ mode: "live", client: client as never });

      const call = calls[0] as { max_tokens?: number; system?: unknown; messages?: unknown };
      expect(call.max_tokens).toBe(1);
      expect(call.messages).toEqual([{ role: "user", content: "warmup" }]);
      const block = (call.system as Array<{ type: string; text: string; cache_control?: unknown }>)[0];
      if (!block) throw new Error("missing warmup system block");
      expect(block).toMatchObject({ type: "text", cache_control: { type: "ephemeral" } });
    });

    it("runs Director audits in bounded parallel while preserving record order", async () => {
      const actorClient = {
        messages: {
          create: async () => ({
            content: [{ type: "text", text: JSON.stringify(actorOutput("The wall moved.", "The wall moved.")) }],
          }),
        },
      };
      let inFlight = 0;
      let peak = 0;
      const auditedTexts: string[] = [];

      const result = await orchestrateActorDirectorWithRetries(CARD, ["x", "web"], {
        n: 5,
        mode: "live",
        actor_client: actorClient as never,
        director: async ({ candidate, channel }) => {
          auditedTexts.push(candidate.text);
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          await new Promise((resolve) => setTimeout(resolve, 20));
          inFlight -= 1;
          return parsedDirectorAudit(true, candidate.text, channel);
        },
        maxAttempts: 1,
      });

      const cap = Math.max(1, Math.min(8, cpus().length));
      expect(peak).toBeLessThanOrEqual(cap);
      if (cap > 1) expect(peak).toBeGreaterThan(1);
      expect(auditedTexts).toHaveLength(10);
      expect(result.attempts[0]?.records.map((record) => record.candidate.channel)).toEqual([
        "x",
        "x",
        "x",
        "x",
        "x",
        "web",
        "web",
        "web",
        "web",
        "web",
      ]);
    });

    it("targets a zero-pick channel from script-validation failures and regenerates it without a grounder", async () => {
      const actorRequests: unknown[] = [];
      let actorCalls = 0;
      const actorClient = {
        messages: {
          create: async (params: unknown) => {
            actorRequests.push(params);
            actorCalls += 1;
            const first = actorCalls === 1;
            const output = first
              ? actorOutput("The wall moved.", "A game-changing launch.", {
                  xOptions: ["The wall moved."],
                  webOptions: ["A game-changing launch."],
                })
              : actorOutput("The wall moved.", "The wall moved.", {
                  xOptions: ["The wall moved."],
                  webOptions: ["The wall moved."],
                });
            return { content: [{ type: "text", text: JSON.stringify(output) }] };
          },
        },
      };
      const directorClient = {
        messages: {
          create: async () => ({ content: [{ type: "text", text: JSON.stringify(directorOutput(true)) }] }),
        },
      };
      const events: Array<{ event_type: string; payload?: Record<string, unknown> }> = [];

      const result = await orchestrateActorDirectorWithRetries(CARD, ["x", "web"], {
        n: 1,
        mode: "live",
        actor_client: actorClient as never,
        director_client: directorClient as never,
        maxAttempts: 3,
        onEvent: (event) => { events.push(event); },
      });

      expect(actorCalls).toBeGreaterThanOrEqual(2);
      expect(result.exhausted).toBe(false);
      expect(result.picks.map((pick) => pick.channel).sort()).toEqual(["web", "x"]);
      expect(JSON.stringify(actorRequests[1])).toContain("game-changing");
      const targeted = events.filter((event) => event.event_type === "channel_regeneration_targeted");
      expect(targeted).toHaveLength(1);
      const targetedChannels = targeted[0]?.payload?.channels as Channel[] | undefined;
      expect(targetedChannels).toContain("web");
      expect(targetedChannels).not.toContain("x");
    });

    it("targets a zero-pick channel at most once per run", async () => {
      let actorCalls = 0;
      const actorClient = {
        messages: {
          create: async () => {
            actorCalls += 1;
            return {
              content: [{
                type: "text",
                text: JSON.stringify(actorOutput("The wall moved.", "A game-changing launch.", {
                  xOptions: ["The wall moved."],
                  webOptions: ["A game-changing launch."],
                })),
              }],
            };
          },
        },
      };
      const directorClient = {
        messages: {
          create: async () => ({ content: [{ type: "text", text: JSON.stringify(directorOutput(true)) }] }),
        },
      };
      const events: Array<{ event_type: string; payload?: Record<string, unknown> }> = [];

      const result = await orchestrateActorDirectorWithRetries(CARD, ["x", "web"], {
        n: 1,
        mode: "live",
        actor_client: actorClient as never,
        director_client: directorClient as never,
        maxAttempts: 3,
        onEvent: (event) => { events.push(event); },
      });

      expect(actorCalls).toBe(3);
      expect(result.exhausted).toBe(true);
      expect(result.picks.map((pick) => pick.channel)).toEqual(["x"]);
      const targeted = events.filter((event) => event.event_type === "channel_regeneration_targeted");
      expect(targeted).toHaveLength(1);
      expect(targeted[0]?.payload?.channels as Channel[] | undefined).toEqual(["web"]);
    });

    it("collects concrete zero-pick channel failure feedback", () => {
      const records: ActorDirectorCandidateRecord[] = [
        {
          candidate: { id: "script-fail", text: "A game-changing launch.", channel: "web", declared_beats: [], source: "anthropic" },
          script_validation: {
            passed: false,
            failures: [{ rule: "cliches", reason: "contains banned term: game-changer" }],
          },
        },
        {
          candidate: { id: "director-fail", text: "The wall moved.", channel: "web", declared_beats: [], source: "anthropic" },
          script_validation: { passed: true, failures: [] },
          director_audit: parsedDirectorAudit(false, "The wall moved.", "web"),
        },
      ];

      const feedback = collectChannelFailureFeedback(["web"], records);
      const web = feedback.web ?? [];
      expect(web).toContain("script cliches: contains banned term: game-changer");
      expect(web).toContain("voice: fixture voice issue");
      expect(web).toContain("director: Fixture note for retry handling.");
      expect(new Set(web).size).toBe(web.length);
      expect(web.length).toBeLessThanOrEqual(12);
      expect(collectChannelFailureFeedback(["x"], records).x).toBeUndefined();
    });

		it("keeps Director classification blind to actor table work and rationale", () => {
    const user = buildDirectorUserMessage({
      card: CARD,
      channel: "x",
      candidate: {
        id: "blind-check",
        channel: "x",
        text: "The wall moved.",
        declared_beats: [{ hint: "SECRET_ACTOR_VERB" }],
        rationale: "SECRET_ACTOR_TABLE_WORK",
        deployed_facts_used: [],
        not_said: deployedFactClaims(CARD).map((fact) => ({ fact, reason: "not used" })),
        source: "anthropic",
      },
    });

	  expect(user).toContain("Classify the final prose only");
	  expect(user).toContain("Candidate movement receipt");
	  expect(user).toContain("Do not fail a single line solely because Vision is not visibly projected");
	  expect(user).toContain("The wall moved.");
	  expect(user).not.toContain("SECRET_ACTOR_VERB");
	  expect(user).not.toContain("SECRET_ACTOR_TABLE_WORK");
	});

	it("feeds each channel's reader_context into the Actor's given circumstances", () => {
	  const message = buildActorAssignmentMessage(CARD, ["x", "web", "in-product"], 3);
	  expect(message).toContain("Channel reader contexts");
	  expect(message).toContain("x: public timeline, mixed CT audience, scrolling, zero Infinex context assumed");
	  expect(message).toContain("web: cold prospect evaluating; arrived by link or search; no account assumed");
	  expect(message).toContain("in-product: logged-in user mid-session; already ours; needs orientation, not persuasion");
	  // reader_prior must be derived, not invented.
	  expect(message).toContain("reader_prior must be DERIVED");
	  // House rule: situation only — no tempo/register/Laban stamped on the channel.
	  expect(message).toContain("SITUATION, not register");
	});

  it("injects the house changelog scaffold only for blog changelog assignments", () => {
    const message = buildActorAssignmentMessage(CHANGELOG_CARD, ["blog"], 1);

    expect(message).toContain("Blog changelog format scaffold");
    expect(message).toContain("category: changelogs");
    expect(message).toContain("coverImage:");
    expect(message).toContain("{% cloud-image");
    expect(message).toContain("### Coming up");
    expect(message).toContain("300-450 words");
    expect(message).toContain("existing users + onlookers who chose to read");

    expect(buildActorAssignmentMessage(CHANGELOG_CARD, ["x"], 1)).not.toContain("Blog changelog format scaffold");
    expect(buildActorAssignmentMessage(NON_CHANGELOG_BLOG_CARD, ["blog"], 1)).not.toContain("Blog changelog format scaffold");
  });

  it("gives thesis cards an essay scaffold and a no-CTA constraint instead of the changelog scaffold", () => {
    const thesisCard = {
      ...CHANGELOG_CARD,
      id: "infinex-security-thesis",
      audience: ["blog", "x-thread", "x"],
      category: "thesis",
    } as ReleaseCard;

    const message = buildActorAssignmentMessage(thesisCard, ["blog", "x-thread"], 1);
    expect(message).toContain("Thesis blog scaffold");
    expect(message).not.toContain("Blog changelog format scaffold");
    expect(message).toContain("THESIS PIECE");
    expect(message).toContain("No calls to action");
    expect(message).toContain("900-1400 words");

    expect(buildActorAssignmentMessage(CHANGELOG_CARD, ["blog"], 1)).not.toContain("Thesis blog scaffold");
  });

  it("raises the blog length ceiling for thesis cards only", () => {
    const thesisCard = { ...CHANGELOG_CARD, category: "thesis" } as ReleaseCard;
    expect(channelMaxLen("blog", thesisCard)).toBe(12000);
    expect(channelMaxLen("blog", CHANGELOG_CARD)).toBe(3600);
    expect(channelMaxLen("x", thesisCard)).toBe(280);
  });

  it("generates structure-bearing blog changelog output through the Actor path with an injected client", async () => {
    const actorRequests: unknown[] = [];
    const changelog = minimalChangelogText();
    const actorClient = {
      messages: {
        create: async (params: unknown) => {
          actorRequests.push(params);
          expect(JSON.stringify(params)).toContain("Blog changelog format scaffold");
          return {
            content: [{
              type: "text",
              text: JSON.stringify(blogActorOutput(changelog)),
            }],
          };
        },
      },
    };

    const result = await generateActorAttempt(CHANGELOG_CARD, {
      channels: ["blog"],
      n: 1,
      mode: "live",
      warmup_mode: "none",
      client: actorClient as never,
    });

    expect(actorRequests).toHaveLength(1);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.channel).toBe("blog");
    expect(result.candidates[0]?.text).toContain("---\ntitle: Bank deposits come to Infinex");
    expect(result.candidates[0]?.text).toContain("{% cloud-image");
    expect(result.candidates[0]?.text).toContain("### Coming up");
  });

	it("includes the declared reader in the Director's user message and the reader-fit rule", () => {
	  const user = buildDirectorUserMessage({
	    card: CARD,
	    channel: "in-product",
	    candidate: {
	      id: "rf", channel: "in-product", text: "Spot is live.",
	      declared_beats: [], deployed_facts_used: [],
	      not_said: deployedFactClaims(CARD).map((fact) => ({ fact, reason: "not used" })),
	      source: "anthropic",
	    },
	  });
	  expect(user).toContain("Declared reader (situation): logged-in user mid-session");
	  expect(user).toContain("reader_fit_notes");
	  expect(user).toContain("does NOT fail the draft");
	});

	it("treats reader_fit_notes as a non-gating flag (note, not auto-fail)", () => {
	  const memory = buildDirectorMemoryPack(INFINEX_VOICE);
	  const audit = parseDirectorAudit(
	    JSON.stringify({ ...directorOutput(true), reader_fit_notes: ["pitches basics to a depth reader"] }),
	    memory,
	    "user prompt",
	    "anthropic",
	    "Spot is live inside Infinex.\nThe order book is fully onchain.",
	    { channel: "blog", voice: INFINEX_VOICE },
	  );
	  expect(audit.reader_fit_notes).toEqual(["pitches basics to a depth reader"]);
	  // A reader-fit note alone does not fail the draft.
	  expect(audit.passed).toBe(true);
	  expect(audit.copy_voice_passed).toBe(true);
	});

	it("caps Director tempo confidence on very short copy", () => {
	  const memory = buildDirectorMemoryPack(INFINEX_VOICE);
	  const audit = parseDirectorAudit(
	    JSON.stringify({
	      ...directorOutput(true),
	      primary_confidence: 1,
	    }),
	    memory,
	    "user prompt",
	    "anthropic",
	    "INX is here.",
	  );

	  expect(audit.primary_confidence).toBe(0.65);
	});

	it("preserves table work by default in structured Director retry notes", () => {
	  const message = buildDirectorNotesMessage({
	    attempt: 1,
	    summary: "web needs a local copy repair",
	    notes: ["web: remove generic launch wording."],
	    preserve: {
	      through_action: true,
	      beat_plan: true,
	      working_actions: true,
	      objective_verbs: true,
	    },
	    change: {
	      copy: ["remove generic launch wording"],
	      metaphor_image_system: ["all options share the same object"],
	    },
	  });

	  expect(message).toContain("through_action: preserve");
	  expect(message).toContain("working_actions: preserve");
	  expect(message).toContain("Do not throw away table work");
	  expect(message).toContain("Do not feed the Director's metaphor wording back");
	});

  it("stops after the default three actor attempts when Director never passes", async () => {
    const actorRequests: unknown[] = [];
    const directorRequests: unknown[] = [];
    const actorClient = {
      messages: {
        create: async (params: unknown) => {
          actorRequests.push(params);
          return {
            content: [{
              type: "text",
              text: JSON.stringify(actorOutput("The wall moved.", "The wall moved.")),
            }],
          };
        },
      },
    };
    const directorClient = {
      messages: {
        create: async (params: unknown) => {
          directorRequests.push(params);
          return {
            content: [{
              type: "text",
              text: JSON.stringify(directorOutput(false)),
            }],
          };
        },
      },
    };

    const result = await orchestrateActorDirectorWithRetries(CARD, ["x", "web"], {
      n: 5,
      mode: "live",
      actor_client: actorClient as never,
      director_client: directorClient as never,
    });

    expect(result.exhausted).toBe(true);
    expect(result.attempts).toHaveLength(3);
    expect(actorRequests).toHaveLength(3);
    expect(directorRequests).toHaveLength(30);
  });

  it("fails legal when primary_tempo is a beat-only/reserve tempo on a multi-line read", () => {
    const memory = buildDirectorMemoryPack(INFINEX_VOICE);
    const audit = parseDirectorAudit(
      JSON.stringify({ ...directorOutput(true), primary_tempo: "self-contained" }),
      memory,
      "user prompt",
      "anthropic",
      "Spot is live inside Infinex.\nThe order book is fully onchain.",
      { channel: "x", voice: INFINEX_VOICE },
    );
    expect(audit.primary_tempo).toBe("self-contained");
    expect(audit.infinex_fit.legal).toBe(false);
    expect(audit.passed).toBe(false);
    expect(audit.voice_issues.join(" ")).toContain("beat-only");
  });

  it("downgrades a beat-only primary tempo to a flagged voice_issue on single-beat microcopy", () => {
    const memory = buildDirectorMemoryPack(INFINEX_VOICE);
    const audit = parseDirectorAudit(
      JSON.stringify({ ...directorOutput(true), primary_tempo: "self-contained" }),
      memory,
      "user prompt",
      "anthropic",
      "Spot is live.",
      { channel: "in-product", voice: INFINEX_VOICE },
    );
    // Single contained beat on a one-line microcopy surface stays legal, flagged for operator.
    expect(audit.infinex_fit.legal).toBe(true);
    expect(audit.voice_issues.join(" ")).toContain("operator adjudication");
  });

  it("fails factually and emits a fact_request for an unsupported proper-noun claim", () => {
    const memory = buildDirectorMemoryPack(INFINEX_VOICE);
    const audit = parseDirectorAudit(
      JSON.stringify({
        ...directorOutput(true),
        factual_passed: false,
        factual_issues: ["'Curve' is named but not in the release card"],
        fact_requests: [{ question: "what swap providers does Swidge aggregate?", reason: "blog compares to Curve/Jupiter" }],
      }),
      memory,
      "user prompt",
      "anthropic",
      "Unlike Curve or Jupiter, this is a real order book.",
      { channel: "blog", voice: INFINEX_VOICE },
    );
    expect(audit.factual_passed).toBe(false);
    expect(audit.passed).toBe(false);
    expect(audit.fact_requests).toHaveLength(1);
    expect(audit.fact_requests[0]?.question).toContain("Swidge");
  });

  it("fails the whole read when a per-beat audit reports a failing tweet (long-form)", () => {
    const memory = buildDirectorMemoryPack(INFINEX_VOICE);
    const audit = parseDirectorAudit(
      JSON.stringify({
        ...directorOutput(true),
        per_beat: [
          { beat: "tweet 1", text_span: "Spot is live inside Infinex.", passed: true, issues: [] },
          { beat: "tweet 2", text_span: "A game-changing unlock.", passed: false, issues: ["slop register in this tweet"] },
        ],
      }),
      memory,
      "user prompt",
      "anthropic",
      "Spot is live inside Infinex.\n\nA game-changing unlock.",
      { channel: "x-thread", voice: INFINEX_VOICE },
    );
    expect(audit.per_beat).toHaveLength(2);
    expect(audit.passed).toBe(false);
    expect(audit.voice_issues.join(" ")).toContain("tweet 2");
  });

  it("flags an outward-channel version tag as a voice issue deterministically", () => {
    const memory = buildDirectorMemoryPack(INFINEX_VOICE);
    const audit = parseDirectorAudit(
      JSON.stringify(directorOutput(true)),
      memory,
      "user prompt",
      "anthropic",
      "Spot V1 is live inside Infinex.",
      { channel: "x", voice: INFINEX_VOICE },
    );
    expect(audit.voice_issues.join(" ")).toContain("version tag");
    expect(audit.passed).toBe(false);
    expect(detectVersionTag("Spot V1 is live")).toBe("V1");
  });

  it("runs the EAGER back-edge before any audit: grounds on table-work requests, re-runs the Actor, then audits", async () => {
    let actorCalls = 0;
    let directorCalls = 0;
    // Capture whether the grounder fired before the Director ever ran.
    let directorRanBeforeGrounder = false;
    const cardsSeen: ReleaseCard[] = [];
    const actorClient = {
      messages: {
        create: async () => {
          actorCalls += 1;
          // The FIRST draft declares a fact_request in table work. The eager round
          // grounds it and re-runs the Actor; the re-run carries no open request.
          const output = actorOutput("Hyperliquid spot is live in Infinex.", "Spot is live in Infinex.");
          if (actorCalls === 1) {
            output.table_work.fact_requests = [
              { question: "are HL spot assets wrapped, and by what?", channels: ["x"] },
            ];
          }
          return { content: [{ type: "text", text: JSON.stringify(output) }] };
        },
      },
    };
    const directorClient = {
      messages: {
        create: async () => {
          directorCalls += 1;
          return { content: [{ type: "text", text: JSON.stringify(directorOutput(true)) }] };
        },
      },
    };
    const grounderCalls: FactRequest[][] = [];
    const grounder: FactRequestGrounderFn = async (requests, card) => {
      if (directorCalls > 0) directorRanBeforeGrounder = true;
      grounderCalls.push(requests);
      cardsSeen.push(card);
      return [{
        question: requests[0]!.question,
        fact: { claim: "HL spot assets (UBTC/UETH/USOL) are Unit-wrapped" },
        provenance: "platform-code:integrations/hyperliquid.ts (confidence 0.90)",
      }];
    };

    const events: Array<{ type: string; trigger?: unknown }> = [];
    const result = await orchestrateActorDirectorWithRetries(CARD, ["x", "web"], {
      n: 1,
      mode: "live",
      actor_client: actorClient as never,
      director_client: directorClient as never,
      maxAttempts: 3,
      grounder,
      onEvent: (event) => { events.push({ type: event.event_type, trigger: event.payload?.trigger }); },
    });

    expect(grounderCalls).toHaveLength(1);
    expect(directorRanBeforeGrounder).toBe(false); // grounded BEFORE auditing the holey draft
    expect(actorCalls).toBe(2); // first draft + eager re-run, all inside attempt 1
    // The augmented card reached the grounder.
    expect(cardsSeen[0]?.deployed_facts.length).toBe(CARD.deployed_facts.length);
    // Eager grounding resolved everything inside one attempt.
    expect(result.attempts).toHaveLength(1);
    expect(result.picks.length).toBe(2);
    // Run events distinguish the trigger.
    expect(events.some((e) => e.type === "fact_requests_collected" && e.trigger === "eager")).toBe(true);
    expect(events.some((e) => e.type === "fact_requests_answered" && e.trigger === "eager")).toBe(true);
    expect(events.some((e) => e.type === "fact_requests_answered" && e.trigger === "audit")).toBe(false);
  });

  it("runs the AUDIT-triggered back-edge as a backstop when the Director finds a hole", async () => {
    let actorCalls = 0;
    const actorRequests: unknown[] = [];
    const actorClient = {
      messages: {
        create: async (params: unknown) => {
          actorCalls += 1;
          actorRequests.push(params);
          // No table-work request, so the eager round never fires; the hole is
          // only surfaced by the Director audit below. One option per channel.
          return { content: [{ type: "text", text: JSON.stringify(actorOutput("Spot is live in Infinex.", "Spot is live in Infinex.", { xOptions: ["Spot is live in Infinex."] })) }] };
        },
      },
    };
    let directorCalls = 0;
    const directorClient = {
      messages: {
        create: async () => {
          directorCalls += 1;
          // First attempt's only candidate fails factually + emits a fact_request;
          // after the audit-triggered back-edge regenerates, it passes.
          const failing = directorCalls === 1;
          const base = directorOutput(!failing);
          return {
            content: [{
              type: "text",
              text: JSON.stringify(failing
                ? { ...base, factual_passed: false, factual_issues: ["names Curve, not in card"], fact_requests: [{ question: "what does Swidge aggregate?" }] }
                : base),
            }],
          };
        },
      },
    };
    const grounderCalls: FactRequest[][] = [];
    const grounder: FactRequestGrounderFn = async (requests) => {
      grounderCalls.push(requests);
      return [{ question: requests[0]!.question, fact: { claim: "Swidge aggregates 20+ swap providers" } }];
    };

    const events: Array<{ type: string; trigger?: unknown }> = [];
    const result = await orchestrateActorDirectorWithRetries(CARD, ["x"], {
      n: 1,
      mode: "live",
      actor_client: actorClient as never,
      director_client: directorClient as never,
      maxAttempts: 3,
      grounder,
      onEvent: (event) => { events.push({ type: event.event_type, trigger: event.payload?.trigger }); },
    });

    expect(grounderCalls).toHaveLength(1);
    expect(events.some((e) => e.type === "fact_requests_answered" && e.trigger === "audit")).toBe(true);
    expect(events.some((e) => e.trigger === "eager")).toBe(false);
    expect(result.attempts.length).toBeGreaterThanOrEqual(2); // regenerated against the augmented card
    expect(result.picks.length).toBe(1);
    // The back-edge resets the transcript for fresh table work, but the
    // Director's failure feedback must still reach the next attempt.
    expect(result.attempts[1]?.director_notes_in).toBeDefined();
    expect(JSON.stringify(actorRequests[1])).toContain("Director notes after attempt 1");
  });

  it("caps total grounder rounds at 2 per run and dedupes the same question across rounds", async () => {
    const actorClient = {
      messages: {
        create: async () => {
          // Every draft re-declares the SAME request; only the first round should ground it.
          const output = actorOutput("Spot is live in Infinex.", "Spot is live in Infinex.");
          output.table_work.fact_requests = [{ question: "same recurring question?" }];
          return { content: [{ type: "text", text: JSON.stringify(output) }] };
        },
      },
    };
    const directorClient = {
      messages: {
        // Always fail so the run keeps retrying and would re-trigger grounding if not bounded/deduped.
        create: async () => ({ content: [{ type: "text", text: JSON.stringify(directorOutput(false)) }] }),
      },
    };
    const grounderCalls: FactRequest[][] = [];
    const grounder: FactRequestGrounderFn = async (requests) => {
      grounderCalls.push(requests);
      return [{ question: requests[0]!.question, fact: { claim: "answer" } }];
    };

    const result = await orchestrateActorDirectorWithRetries(CARD, ["x"], {
      n: 1,
      mode: "live",
      actor_client: actorClient as never,
      director_client: directorClient as never,
      maxAttempts: 3,
      grounder,
    });

    // The recurring question is asked exactly once (deduped across rounds); the
    // eager round consumes the only viable round, and dedupe starves the rest.
    expect(grounderCalls.length).toBeLessThanOrEqual(2);
    expect(grounderCalls).toHaveLength(1);
    expect(result.exhausted).toBe(true);
  });

  it("dedupeNewRequests drops already-asked questions and records survivors", () => {
    const asked = new Set<string>();
    const first = dedupeNewRequests([{ question: "What is X?" }, { question: "What is Y?" }], asked);
    expect(first.map((r) => r.question)).toEqual(["What is X?", "What is Y?"]);
    // Re-asking X (any casing/whitespace) is dropped; Z is new.
    const second = dedupeNewRequests([{ question: "what   is x?" }, { question: "What is Z?" }], asked);
    expect(second.map((r) => r.question)).toEqual(["What is Z?"]);
  });

  it("bounds the back-edge to one round and dedupes requests across channels", () => {
    const requests = collectFactRequests(
      [{ question: "What is X?", channels: ["x"] }],
      [
        {
          candidate: { id: "c1", text: "t", channel: "x", declared_beats: [], source: "anthropic" },
          script_validation: { passed: true, failures: [] },
          director_audit: {
            ...parseDirectorAudit(JSON.stringify(directorOutput(true)), buildDirectorMemoryPack(INFINEX_VOICE), "u", "anthropic", "t", { channel: "x" }),
            fact_requests: [
              { question: "what is x?", channels: ["web"] },
              { question: "What is Y?", channels: ["web"] },
            ],
          },
        },
      ],
    );
    // "What is X?" / "what is x?" dedupe to one with unioned channels.
    expect(requests).toHaveLength(2);
    const x = requests.find((r) => r.question.toLowerCase() === "what is x?");
    expect(x?.channels?.sort()).toEqual(["web", "x"]);
  });

  it("persists the vertical flow direction on each candidate as prompt_variant", async () => {
    const actorClient = {
      messages: {
        create: async () => ({
          content: [{ type: "text", text: JSON.stringify(actorOutput("x copy", "web copy")) }],
        }),
      },
    };
    const directorClient = {
      messages: {
        create: async () => ({ content: [{ type: "text", text: JSON.stringify(directorOutput(true)) }] }),
      },
    };
    const result = await orchestrateActorDirectorWithRetries(CARD, ["x", "web"], {
      n: 1,
      mode: "live",
      flow_direction: "outwards-in",
      actor_client: actorClient as never,
      director_client: directorClient as never,
      maxAttempts: 1,
    });
    expect(result.picks.every((pick) => pick.prompt_variant === "outwards-in")).toBe(true);
  });
});

describe("actor JSON resilience", () => {
  it("repairs a dropped comma between array elements without a re-call", () => {
    // The launch-day failure: model emits two array elements with no comma between
    // them ("Expected ',' or ']' after array element"). jsonrepair recovers it.
    const obj = extractJsonObject('noise {"arr": [{"x": 1} {"y": 2}], "ok": true} trailing');
    expect(obj.ok).toBe(true);
    expect((obj.arr as unknown[]).length).toBe(2);
  });

  it("parses already-valid JSON unchanged", () => {
    expect(extractJsonObject('{"a": [1, 2, 3]}').a).toEqual([1, 2, 3]);
  });

  it("throws when no JSON object is present (so the corrective retry engages)", () => {
    expect(() => extractJsonObject("nothing parseable here")).toThrow(/No JSON object/);
  });

  it("re-asks the actor with a correction turn after an unparseable response, then succeeds", async () => {
    const actorRequests: unknown[] = [];
    let call = 0;
    const actorClient = {
      messages: {
        create: async (params: unknown) => {
          actorRequests.push(params);
          call += 1;
          // 1st call: prose with no JSON object (repair can't help). 2nd: valid.
          const text = call === 1
            ? "I cannot comply; here is prose only."
            : JSON.stringify(actorOutput("The wall moved.", "The wall moved."));
          return { content: [{ type: "text", text }] };
        },
      },
    };

    const result = await generateActorAttempt(CARD, {
      channels: ["x"],
      n: 1,
      mode: "live",
      client: actorClient as never,
    });

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(actorRequests).toHaveLength(2);
    // The retry must show the model what broke, not blindly re-send the transcript.
    expect(JSON.stringify(actorRequests[1])).toContain("could not be parsed as JSON");
  });

  it("re-asks the actor after a schema violation (bad Working Action enum), then succeeds", async () => {
    // Valid JSON, invalid schema: preparation_from off the Working Action enum.
    // This used to escape the retry loop and kill the whole run (run_failed).
    const invalid = JSON.parse(JSON.stringify(actorOutput("The wall moved.", "The wall moved."))) as Record<
      string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    >;
    invalid.table_work.channel_beat_plans.x[0].preparation_from = "settling";

    const actorRequests: unknown[] = [];
    let call = 0;
    const actorClient = {
      messages: {
        create: async (params: unknown) => {
          actorRequests.push(params);
          call += 1;
          const text = call === 1
            ? JSON.stringify(invalid)
            : JSON.stringify(actorOutput("The wall moved.", "The wall moved."));
          return { content: [{ type: "text", text }] };
        },
      },
    };

    const result = await generateActorAttempt(CARD, {
      channels: ["x"],
      n: 1,
      mode: "live",
      client: actorClient as never,
    });

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(actorRequests).toHaveLength(2);
    const correction = JSON.stringify(actorRequests[1]);
    expect(correction).toContain("violated the output schema");
    expect(correction).toContain("preparation_from");
  });
});

function actorOutput(
  xText: string,
  webText: string,
  opts: {
    xOptions?: string[];
    webOptions?: string[];
    selectedX?: number;
    selectedWeb?: number;
  } = {},
): ActorOutput {
  const not_said = deployedFactClaims(CARD).map((fact) => ({ fact, reason: "not needed for this line" }));
  const xOptions = opts.xOptions ?? Array.from({ length: 5 }, () => xText);
  const webOptions = opts.webOptions ?? Array.from({ length: 5 }, () => webText);
  return {
    warmup: {
      mode: "daily_pages",
      daily_pages: {
        page_1_given_circumstances: "Fixture daily-pages content for parser coverage; not production Actor guidance.",
        page_2_character_rehearsal: "Fixture character-rehearsal content.",
        page_3_false_starts_and_adjustments: "Fixture false-start content.",
        left_right_choices: [{
          left: "fixture left option",
          right: "fixture right option",
          decision: "fixture decision",
        }],
        what_felt_false: ["fixture rejected option"],
        warmed_state: "fixture warmed state",
      },
      notes: ["fixture warmup note"],
      warmed_state: "fixture warmed state",
    },
    table_work: {
      thesis: "Fixture thesis.",
      through_action: "to reveal the fixture result",
      obstacle: "fixture obstacle",
      reader_prior: "fixture prior",
      lining: "fixture surface and lining",
      not_the_point: "fixture exclusion",
      fact_requests: [],
      channel_beat_plans: {
        x: [
          {
            verb: "to reveal",
            working_action: "pressing",
            physical_score: "fixture pressing score",
            micro_objective: "fixture micro objective",
            obstacle_local: "fixture obstacle",
          },
          {
            verb: "to reveal",
            working_action: "punching",
            preparation_from: "pressing",
            physical_score: "fixture punching score",
            micro_objective: "fixture micro objective",
            obstacle_local: "fixture obstacle",
          },
        ],
        web: [
          {
            verb: "to reveal",
            working_action: "pressing",
            physical_score: "fixture pressing score",
            micro_objective: "fixture micro objective",
            obstacle_local: "fixture obstacle",
          },
        ],
      },
    },
    performances: {
      x: xOptions.map((text, i) => ({
        text,
        rationale: `x ${i + 1}`,
        movement_receipt: [{
          text_span: text,
          objective_verb: "to reveal",
          working_action: "punching",
          evidence: "fixture punching receipt",
        }],
        deployed_facts_used: [],
        not_said,
      })),
      web: webOptions.map((text, i) => ({
        text,
        rationale: `web ${i + 1}`,
        movement_receipt: [{
          text_span: text,
          objective_verb: "to reveal",
          working_action: "pressing",
          evidence: "fixture pressing receipt",
        }],
        deployed_facts_used: [],
        not_said,
      })),
    },
    selected_performances: {
      x: {
        selected_option: opts.selectedX ?? 1,
        selection_rationale: "strongest x performance",
      },
      web: {
        selected_option: opts.selectedWeb ?? 1,
        selection_rationale: "strongest web performance",
      },
    },
  };
}

function minimalChangelogText(): string {
  return [
    "---",
    "title: Bank deposits come to Infinex",
    "date: 2026-06-05",
    "published: false",
    "pinned: false",
    "category: changelogs",
    "coverImage:",
    "  src: <designer-cover-url>",
    "  alt: Bank deposits come to Infinex",
    "  height: 640",
    "  width: 1280",
    "---",
    "",
    "### Fund Infinex straight from your bank",
    "",
    "{% cloud-image src=\"<designer-cover-url>\" alt=\"Bank deposits come to Infinex\" height=640 width=1280 /%}",
    "",
    "Bank deposits now let US dollars arrive in Infinex as USDC on Base.",
    "",
    "---",
    "",
    "### Reusable bank details",
    "",
    "Bridge handles verification once. After approval, the bank details are reusable.",
    "",
    "{% toggle title=\"What is not part of this release\" defaultOpen=false %}",
    "Off-ramp withdrawals are not part of this release.",
    "{% /toggle %}",
    "",
    "---",
    "",
    "### Coming up",
    "- EUR bank transfers are coming soon.",
    "",
    "For more, see the [Infinex Roadmap](https://infinex.xyz/roadmap).",
  ].join("\n");
}

function blogActorOutput(text: string): ActorOutput {
  const not_said = deployedFactClaims(CHANGELOG_CARD).map((fact) => ({ fact, reason: "not needed for this fixture" }));
  return {
    warmup: {
      mode: "none",
      notes: ["fixture direct assignment note"],
      warmed_state: "fixture warmed state",
    },
    table_work: {
      thesis: "Fixture thesis.",
      through_action: "to reveal the fixture result",
      obstacle: "fixture obstacle",
      reader_prior: "fixture prior",
      lining: "fixture surface and lining",
      not_the_point: "fixture exclusion",
      fact_requests: [],
      channel_beat_plans: {
        blog: [{
          verb: "to reveal",
          working_action: "pressing",
          physical_score: "fixture pressing score",
          micro_objective: "fixture micro objective",
          obstacle_local: "fixture obstacle",
        }],
      },
    },
    performances: {
      blog: [{
        text,
        rationale: "blog changelog fixture",
        movement_receipt: [{
          text_span: "Bank deposits now let US dollars arrive in Infinex as USDC on Base.",
          objective_verb: "to reveal",
          working_action: "pressing",
          evidence: "fixture pressing receipt",
        }],
        deployed_facts_used: [],
        not_said,
      }],
    },
    selected_performances: {
      blog: { selected_option: 1, selection_rationale: "blog" },
    },
  };
}

function structuredActorOutput(): ActorOutput {
  const not_said = deployedFactClaims(CARD).map((fact) => ({ fact, reason: "not needed for this line" }));
  const beat = {
    verb: "to reveal",
    working_action: "pressing" as const,
    physical_score: "fixture pressing score",
    micro_objective: "fixture micro objective",
    obstacle_local: "fixture obstacle",
  };
  const receipt = (text_span: string) => [{
    text_span,
    objective_verb: "to reveal",
    working_action: "pressing" as const,
    evidence: "fixture pressing receipt",
  }];
  return {
    warmup: {
      mode: "daily_pages",
      daily_pages: {
        page_1_given_circumstances: "Fixture daily-pages content.",
        page_2_character_rehearsal: "Fixture character-rehearsal content.",
        page_3_false_starts_and_adjustments: "Fixture false-start content.",
        left_right_choices: [],
        what_felt_false: [],
        warmed_state: "fixture warmed state",
      },
      notes: [],
      warmed_state: "fixture warmed state",
    },
    table_work: {
      thesis: "Fixture thesis.",
      through_action: "to reveal the fixture result",
      obstacle: "fixture obstacle",
      reader_prior: "fixture prior",
      lining: "fixture surface and lining",
      not_the_point: "fixture exclusion",
      fact_requests: [],
      channel_beat_plans: {
        web: [beat],
        "x-thread": [beat],
        carousel: [beat],
      },
    },
    performances: {
      web: [{
        subheading: "Spot",
        title: "Hyperliquid spot / inside Infinex",
        caption: "CLOB spot, unified account only",
        rationale: "web structured option",
        movement_receipt: receipt("Hyperliquid spot inside Infinex"),
        deployed_facts_used: [],
        not_said,
      } as never],
      "x-thread": [{
        tweets: ["Spot V1 is inside Infinex Perps.", "CLOB spot runs in a unified account."],
        rationale: "thread structured option",
        movement_receipt: receipt("Spot V1 is inside Infinex Perps."),
        deployed_facts_used: [],
        not_said,
      } as never],
      carousel: [{
        slides: [
          { name: "Spot V1", body: "Hyperliquid spot is inside Infinex Perps." },
          { name: "CLOB order book", body: "The order book is fully onchain on HyperCore." },
          { name: "Unified account", body: "Spot uses the unified account only." },
        ],
        rationale: "carousel structured option",
        movement_receipt: receipt("Hyperliquid spot is inside Infinex Perps."),
        deployed_facts_used: [],
        not_said,
      } as never],
    },
    selected_performances: {
      web: { selected_option: 1, selection_rationale: "web" },
      "x-thread": { selected_option: 1, selection_rationale: "thread" },
      carousel: { selected_option: 1, selection_rationale: "carousel" },
    },
  };
}

function parsedDirectorAudit(passed: boolean, text = "The wall moved.", channel: Channel = "x") {
  return parseDirectorAudit(
    JSON.stringify(directorOutput(passed)),
    buildDirectorMemoryPack(INFINEX_VOICE),
    "user prompt",
    "anthropic",
    text,
    { channel, voice: INFINEX_VOICE },
  );
}

function directorOutput(passed: boolean) {
  return {
    passed,
    copy_voice_passed: passed,
    factual_passed: true,
    publication_gate_passed: true,
    primary_tempo: passed ? "sombre" : "commanding",
    primary_confidence: 0.8,
    motion_evidence: {
      weight: {
        pole: "Strong",
        evidence: ["observation: fixture weight evidence"],
        source_refs: ["combined-reference §8.1 working-action table"],
      },
      space: {
        pole: "Direct",
        evidence: ["observation: fixture space evidence"],
        source_refs: ["combined-reference §8.1 working-action table"],
      },
      time: passed
        ? {
            pole: "Sustained",
            evidence: ["observation: fixture sustained evidence"],
            source_refs: ["combined-reference §8.1 working-action table"],
          }
        : {
            pole: "Quick",
            evidence: ["observation: fixture quick evidence"],
            source_refs: ["combined-reference §8.1 working-action table"],
          },
      flow: {
        pole: "Bound",
        evidence: ["observation: fixture flow evidence"],
        source_refs: ["combined-reference §5 fusion/flow notes"],
      },
    },
    working_actions: [{
      action: passed ? "pressing" : "punching",
      evidence: passed ? "observation: fixture pressing evidence" : "observation: fixture punching evidence",
      source_refs: ["combined-reference §8.1 working-action table", "combined-reference §8.2 prep hierarchy"],
    }],
    drive_read: passed ? "spell" : "passion",
    placement_read: passed ? "Stable + Penetrating + Flow" : "Stable + Penetrating + Time",
    infinex_fit: {
      legal: passed,
      reason: passed ? "fixture pass" : "fixture fail",
      nearest_allowed_read: "sombre",
    },
    factual_issues: [],
    voice_issues: passed ? [] : ["fixture voice issue"],
    notes_for_actor: passed ? [] : ["Fixture note for retry handling."],
  };
}
