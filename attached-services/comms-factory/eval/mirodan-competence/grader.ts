/**
 * Mechanical grader for the Mirodan competence eval.
 *
 * Takes (questions, model_responses) → per-question { pass, reasoning }.
 *
 * Hard rule: NO LLM-judge grading. All matching is exact / regex / set membership.
 * The structured grader supports prose responses by:
 *   1. Trying to extract a "<key>: <value>" or "<key>=<value>" or "<key> is <value>"
 *      span first (a "labeled" window).
 *   2. Falling back to whole-response matching if no labeled span is found.
 *   3. For boolean-verdict keys ("verdict", "legal", "baseline"), running a
 *      negation guard: if the matched token is preceded by a negation cue
 *      ("not", "isn't", "wouldn't be", "rather than"), the match is rejected.
 */

import type {
  Question,
  ExactQuestion,
  OneOfQuestion,
  RegexQuestion,
  AllOfQuestion,
  StructuredQuestion,
  Category,
  Discriminator,
} from "./questions.js";

export interface ModelResponse {
  question_id: string;
  response: string;
}

export interface GradedResult {
  question_id: string;
  category: Category;
  discriminator: Discriminator;
  pass: boolean;
  reasoning: string;
}

export interface AggregateMetrics {
  total: number;
  passed: number;
  pass_rate: number;
  by_category: Record<Category, { total: number; passed: number; pass_rate: number }>;
  by_discriminator: Record<
    Discriminator,
    { total: number; passed: number; pass_rate: number }
  >;
  headline_mirodan_specific_pass_rate: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Normalization
// ────────────────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/→/g, "→")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// Strict-token check: word boundary on both sides, but tolerant of punctuation.
function containsToken(haystack: string, needle: string): boolean {
  const n = normalize(needle);
  const h = normalize(haystack);
  if (!n) return false;
  // For multi-word tokens, regex-escape and look for it surrounded by non-word
  // characters OR string boundaries.
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
  return pattern.test(h);
}

function matchesAnyRegex(
  haystack: string,
  patterns: string[],
  flags: string,
): boolean {
  for (const p of patterns) {
    try {
      const re = new RegExp(p, flags);
      if (re.test(haystack)) return true;
    } catch {
      continue;
    }
  }
  return false;
}

// ────────────────────────────────────────────────────────────────────────────
// Per-kind graders
// ────────────────────────────────────────────────────────────────────────────

function gradeExact(q: ExactQuestion, resp: string): GradedResult {
  const expected = normalize(q.correct_answer);
  const got = normalize(resp);
  const pass = got === expected || containsToken(resp, q.correct_answer);
  return {
    question_id: q.id,
    category: q.category,
    discriminator: q.discriminator,
    pass,
    reasoning: pass
      ? `exact match: '${expected}'`
      : `expected exact '${expected}', got: '${got.slice(0, 120)}'`,
  };
}

function gradeOneOf(q: OneOfQuestion, resp: string): GradedResult {
  for (const candidate of q.correct_answer) {
    if (containsToken(resp, candidate)) {
      return {
        question_id: q.id,
        category: q.category,
        discriminator: q.discriminator,
        pass: true,
        reasoning: `matched one_of token: '${candidate}'`,
      };
    }
  }
  return {
    question_id: q.id,
    category: q.category,
    discriminator: q.discriminator,
    pass: false,
    reasoning: `no token in {${q.correct_answer.join(", ")}} present in response`,
  };
}

function gradeRegex(q: RegexQuestion, resp: string): GradedResult {
  const flags = q.case_insensitive === false ? "" : "i";
  const pass = matchesAnyRegex(normalize(resp), q.correct_answer, flags);
  return {
    question_id: q.id,
    category: q.category,
    discriminator: q.discriminator,
    pass,
    reasoning: pass
      ? `matched a regex pattern (case ${flags ? "insensitive" : "sensitive"})`
      : `no regex in {${q.correct_answer.join(" | ")}} matched`,
  };
}

function gradeAllOf(q: AllOfQuestion, resp: string): GradedResult {
  const missing: string[][] = [];
  for (const group of q.correct_answer) {
    const matched = group.some((tok) => containsToken(resp, tok));
    if (!matched) missing.push(group);
  }
  const pass = missing.length === 0;
  return {
    question_id: q.id,
    category: q.category,
    discriminator: q.discriminator,
    pass,
    reasoning: pass
      ? `all ${q.correct_answer.length} required tokens (or synonyms) found`
      : `missing token groups: ${missing.map((g) => `{${g.join("|")}}`).join(", ")}`,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Structured grader
// ────────────────────────────────────────────────────────────────────────────

const NEGATION_CUES = [
  "not ",
  "isn't ",
  "is not ",
  "wasn't ",
  "rather than ",
  "instead of ",
  "no, ",
  "no — ",
  "no, ",
  "neither ",
  "never ",
];

function isNegated(window: string, token: string): boolean {
  const w = normalize(window);
  const t = normalize(token);
  const idx = w.indexOf(t);
  if (idx === -1) return false;
  const before = w.slice(Math.max(0, idx - 32), idx);
  return NEGATION_CUES.some((cue) => before.includes(cue));
}

function findLabeledWindow(response: string, key: string): string | null {
  const r = normalize(response);
  const k = normalize(key);
  const patterns = [
    new RegExp(`\\b${k}\\s*[:=\\-–—]\\s*([^\\n]+)`, "i"),
    new RegExp(`\\b${k}\\s+is\\s+([^\\n.;]+)`, "i"),
    new RegExp(`\\(${k}\\)\\s*[:=]?\\s*([^\\n]+)`, "i"),
    new RegExp(`\\b${k}\\b[^\\n]*?[—\\-:]\\s*([^\\n]+)`, "i"),
  ];
  for (const p of patterns) {
    const m = r.match(p);
    if (m && m[1]) return m[1];
  }
  return null;
}

function gradeStructured(q: StructuredQuestion, resp: string): GradedResult {
  const missing: string[] = [];
  const negated: string[] = [];
  for (const [key, matcher] of Object.entries(q.correct_answer)) {
    const window = findLabeledWindow(resp, key) ?? resp;
    let matched = false;
    let matchedToken: string | null = null;
    if (matcher.kind === "one_of") {
      for (const candidate of matcher.values) {
        if (containsToken(window, candidate)) {
          matched = true;
          matchedToken = candidate;
          break;
        }
      }
      if (!matched) {
        for (const candidate of matcher.values) {
          if (containsToken(resp, candidate)) {
            matched = true;
            matchedToken = candidate;
            break;
          }
        }
      }
    } else {
      const flags = "i";
      matched =
        matchesAnyRegex(normalize(window), matcher.values, flags) ||
        matchesAnyRegex(normalize(resp), matcher.values, flags);
      if (matched) matchedToken = "(regex hit)";
    }
    if (!matched) {
      missing.push(key);
      continue;
    }
    if (
      matcher.kind === "one_of" &&
      matchedToken &&
      isNegated(window, matchedToken)
    ) {
      negated.push(`${key}='${matchedToken}'`);
    }
  }
  const pass = missing.length === 0 && negated.length === 0;
  const parts: string[] = [];
  if (missing.length === 0 && negated.length === 0) {
    parts.push(`all ${Object.keys(q.correct_answer).length} structured keys matched`);
  } else {
    if (missing.length > 0) parts.push(`missing keys: ${missing.join(", ")}`);
    if (negated.length > 0) parts.push(`negated matches: ${negated.join(", ")}`);
  }
  return {
    question_id: q.id,
    category: q.category,
    discriminator: q.discriminator,
    pass,
    reasoning: parts.join("; "),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Top-level dispatch + aggregation
// ────────────────────────────────────────────────────────────────────────────

export function gradeOne(q: Question, resp: string): GradedResult {
  switch (q.grader_kind) {
    case "exact":
      return gradeExact(q, resp);
    case "one_of":
      return gradeOneOf(q, resp);
    case "regex":
      return gradeRegex(q, resp);
    case "all_of":
      return gradeAllOf(q, resp);
    case "structured":
      return gradeStructured(q, resp);
  }
}

export function gradeAll(
  questions: Question[],
  responses: ModelResponse[],
): GradedResult[] {
  const byId = new Map<string, string>(
    responses.map((r) => [r.question_id, r.response]),
  );
  return questions.map((q) => {
    const resp = byId.get(q.id);
    if (resp === undefined) {
      return {
        question_id: q.id,
        category: q.category,
        discriminator: q.discriminator,
        pass: false,
        reasoning: "no response for question",
      };
    }
    return gradeOne(q, resp);
  });
}

export function aggregate(results: GradedResult[]): AggregateMetrics {
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const byCategory = {} as Record<Category, { total: number; passed: number; pass_rate: number }>;
  const byDisc = {} as Record<Discriminator, { total: number; passed: number; pass_rate: number }>;
  for (const r of results) {
    if (!byCategory[r.category]) {
      byCategory[r.category] = { total: 0, passed: 0, pass_rate: 0 };
    }
    byCategory[r.category].total += 1;
    if (r.pass) byCategory[r.category].passed += 1;
    if (!byDisc[r.discriminator]) {
      byDisc[r.discriminator] = { total: 0, passed: 0, pass_rate: 0 };
    }
    byDisc[r.discriminator].total += 1;
    if (r.pass) byDisc[r.discriminator].passed += 1;
  }
  for (const v of Object.values(byCategory)) {
    v.pass_rate = v.total === 0 ? 0 : v.passed / v.total;
  }
  for (const v of Object.values(byDisc)) {
    v.pass_rate = v.total === 0 ? 0 : v.passed / v.total;
  }
  const mirodan = byDisc["mirodan_specific"] ?? { total: 0, passed: 0, pass_rate: 0 };
  return {
    total,
    passed,
    pass_rate: total === 0 ? 0 : passed / total,
    by_category: byCategory,
    by_discriminator: byDisc,
    headline_mirodan_specific_pass_rate: mirodan.pass_rate,
  };
}
