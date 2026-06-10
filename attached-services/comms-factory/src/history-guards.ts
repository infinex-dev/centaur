import type { Candidate, Channel } from "./generator.js";
import { INFINEX_VOICE } from "./voice/infinex.js";
import type { CharacterSpec, TempoName } from "./voice/types.js";

export interface ShippedCopyRecord {
  id: string;
  channel: Channel;
  text: string;
  shipped_at?: string | null;
  primary_tempo?: string | null;
  protagonist?: string | null;
  surface?: string | null;
}

export interface HistoryGuardFailure {
  rule: string;
  reason: string;
  compared_against: string[];
}

export interface HistoryGuardResult {
  passed: boolean;
  failures: HistoryGuardFailure[];
  compared_against: string[];
}

export interface HistoryGuardOptions {
  channel: Channel;
  voice?: CharacterSpec;
  recentCopy?: ShippedCopyRecord[];
  protagonist?: string;
  maxRecent?: number;
}

const OPENER_WORDS = 4;
const X_LOOKBACK = 12;
const GENERAL_LOOKBACK = 20;
const TEMPO_CADENCE_X = 2;
const TEMPO_CADENCE_GENERAL = 3;
const PHRASE_BUDGET_X = 2;
const PHRASE_BUDGET_GENERAL = 3;
const ANNOUNCEMENT_FRAME_RE = /\b(?:now\s+live|is\s+live|are\s+live|just\s+shipped|ships?|launch(?:es|ed)?|goes?\s+live)\b/i;
const WATCHED_PHRASES = [
  "now live",
  "is live",
  "are live",
  "powered by",
  "same account",
  "no new wallet",
  "one account",
  "start trading",
];

const RARE_TEMPI = new Set<string>([
  "diffused",
  "egocentric",
  "self-contained",
  "overpowering",
  "receptive",
  "unsociable",
  "altruistic",
]);

export function runHistoryGuards(
  candidate: Candidate,
  opts: HistoryGuardOptions,
): HistoryGuardResult {
  const voice = opts.voice ?? INFINEX_VOICE;
  const maxRecent = opts.maxRecent ?? (opts.channel === "x" ? X_LOOKBACK : GENERAL_LOOKBACK);
  const recent = (opts.recentCopy ?? [])
    .filter((record) => record.channel === opts.channel)
    .slice(0, maxRecent);
  const failures: HistoryGuardFailure[] = [];
  const comparedAgainst = recent.map((record) => record.id);

  const openerFailure = checkRepeatedOpener(candidate.text, recent);
  if (openerFailure) failures.push(openerFailure);

  const phraseFailures = checkPhraseBudgets(candidate.text, recent, opts.channel);
  failures.push(...phraseFailures);

  const tempoFailure = checkTempoCadence(primaryTempo(candidate), recent, opts.channel);
  if (tempoFailure) failures.push(tempoFailure);

  const rareFailure = checkRareTempoOveruse(primaryTempo(candidate), recent, voice);
  if (rareFailure) failures.push(rareFailure);

  const announcementFailure = checkAnnouncementFrame(candidate.text, recent, opts.channel);
  if (announcementFailure) failures.push(announcementFailure);

  const protagonist = opts.protagonist?.trim();
  if (protagonist) {
    const protagonistFailure = checkProtagonistRepetition(protagonist, recent);
    if (protagonistFailure) failures.push(protagonistFailure);
  }

  return {
    passed: failures.length === 0,
    failures,
    compared_against: comparedAgainst,
  };
}

function checkRepeatedOpener(
  text: string,
  recent: ShippedCopyRecord[],
): HistoryGuardFailure | null {
  const opener = openerKey(text);
  if (!opener) return null;
  const matches = recent.filter((record) => openerKey(record.text) === opener);
  if (matches.length === 0) return null;
  return {
    rule: "history:repeated-opener",
    reason: `opener repeats recent shipped copy: "${opener}"`,
    compared_against: matches.map((record) => record.id),
  };
}

function checkPhraseBudgets(
  text: string,
  recent: ShippedCopyRecord[],
  channel: Channel,
): HistoryGuardFailure[] {
  const lower = text.toLowerCase();
  const budget = channel === "x" ? PHRASE_BUDGET_X : PHRASE_BUDGET_GENERAL;
  const failures: HistoryGuardFailure[] = [];
  for (const phrase of WATCHED_PHRASES) {
    if (!lower.includes(phrase)) continue;
    const matches = recent.filter((record) => record.text.toLowerCase().includes(phrase));
    if (matches.length + 1 > budget) {
      failures.push({
        rule: "history:phrase-budget",
        reason: `"${phrase}" would appear ${matches.length + 1} times in the recent ${channel} window; budget is ${budget}`,
        compared_against: matches.map((record) => record.id),
      });
    }
  }
  return failures;
}

function checkTempoCadence(
  tempo: string | null,
  recent: ShippedCopyRecord[],
  channel: Channel,
): HistoryGuardFailure | null {
  if (!tempo) return null;
  const lookback = channel === "x" ? TEMPO_CADENCE_X : TEMPO_CADENCE_GENERAL;
  const window = recent.filter((record) => record.primary_tempo).slice(0, lookback);
  if (window.length < lookback) return null;
  if (!window.every((record) => normal(record.primary_tempo) === normal(tempo))) return null;
  return {
    rule: "history:tempo-cadence",
    reason: `primary tempo "${tempo}" would run ${lookback + 1} times in a row on ${channel}`,
    compared_against: window.map((record) => record.id),
  };
}

function checkRareTempoOveruse(
  tempo: string | null,
  recent: ShippedCopyRecord[],
  voice: CharacterSpec,
): HistoryGuardFailure | null {
  if (!tempo) return null;
  const normalized = normal(tempo);
  const inMainRotation = voice.main_tempi.map((t) => normal(t)).includes(normalized);
  if (inMainRotation && !RARE_TEMPI.has(normalized)) return null;
  const matches = recent
    .slice(0, 8)
    .filter((record) => normal(record.primary_tempo) === normalized);
  if (matches.length === 0) return null;
  return {
    rule: "history:rare-tempo-overuse",
    reason: `rare/off-rotation tempo "${tempo}" already appeared in the recent window`,
    compared_against: matches.map((record) => record.id),
  };
}

function checkAnnouncementFrame(
  text: string,
  recent: ShippedCopyRecord[],
  channel: Channel,
): HistoryGuardFailure | null {
  if (channel !== "x") return null;
  if (!ANNOUNCEMENT_FRAME_RE.test(text)) return null;
  const matches = recent.slice(0, 6).filter((record) => ANNOUNCEMENT_FRAME_RE.test(record.text));
  if (matches.length < 2) return null;
  return {
    rule: "history:announcement-frame",
    reason: "announcement/live framing is already saturated in recent X copy",
    compared_against: matches.map((record) => record.id),
  };
}

function checkProtagonistRepetition(
  protagonist: string,
  recent: ShippedCopyRecord[],
): HistoryGuardFailure | null {
  const key = normal(protagonist);
  if (!key) return null;
  const matches = recent
    .slice(0, 8)
    .filter((record) => normal(record.protagonist) === key);
  if (matches.length < 2) return null;
  return {
    rule: "history:protagonist-repetition",
    reason: `same protagonist "${protagonist}" is carrying too much recent copy`,
    compared_against: matches.map((record) => record.id),
  };
}

function primaryTempo(candidate: Candidate): TempoName | string | null {
  return candidate.declared_beats[0]?.tempo ?? null;
}

function openerKey(text: string): string {
  return meaningfulWords(text).slice(0, OPENER_WORDS).join(" ");
}

function meaningfulWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1);
}

function normal(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}
