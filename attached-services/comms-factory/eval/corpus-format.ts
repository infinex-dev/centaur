/**
 * Helpers to (a) build a markdown corpus matching the input shape that
 * `scripts/classify-corpus.ts` parses via `parseCorpus()`, and (b) parse the
 * verifier's JSON output back into structured classifications.
 *
 * The classify-corpus parseCorpus() implementation reads markdown tables with
 * an `ID` column and a `Text` column, splits rows by `|`, and unescapes `\|`
 * back into literal pipes. We mirror that contract here.
 */

import fs from "node:fs";

export interface CorpusEntry {
  id: string;
  text: string;
}

export interface VerifierClassification {
  tempo_primary: string;
  inner_attitude: string;
  aspect: string;
  stress: string;
  pole: string;
  drive_primary: string;
  drive_secondary: string;
  drive_introvert: string;
  drive_extravert: string;
  drive_axis: string;
  motor_pair: [string, string] | null;
  outer_action_tempi: string[];
  outer_action_inners: string[];
  confidence: number;
  rationale: string;
  literary_anchor: string | null;
}

export interface VerifierResult {
  id: string;
  text: string;
  classification: VerifierClassification;
}

/**
 * Build a markdown table whose rows the classifier's `parseCorpus` will read.
 * Every newline in the candidate text is collapsed into a literal `\n` token
 * because markdown table rows must stay single-line, and every literal `|` is
 * escaped to `\|` per the classifier's contract.
 */
export function buildCorpusMarkdown(entries: CorpusEntry[], title: string): string {
  const lines: string[] = [];
  lines.push(`# ${title}`, "");
  lines.push("| ID | Text |");
  lines.push("| --- | --- |");
  for (const entry of entries) {
    const safeText = entry.text
      .replace(/\|/g, "\\|")
      .replace(/\r\n/g, "\n")
      .replace(/\n/g, " \\n ");
    const safeId = entry.id.replace(/\|/g, "\\|");
    lines.push(`| ${safeId} | ${safeText} |`);
  }
  return lines.join("\n") + "\n";
}

export function writeCorpusFile(
  entries: CorpusEntry[],
  title: string,
  outPath: string,
): void {
  const md = buildCorpusMarkdown(entries, title);
  fs.writeFileSync(outPath, md);
}

export function parseVerifierJson(jsonPath: string): VerifierResult[] {
  const raw = fs.readFileSync(jsonPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Verifier output at ${jsonPath} is not an array`);
  }
  return parsed.map((row): VerifierResult => {
    const c = row.classification ?? {};
    return {
      id: String(row.id ?? ""),
      text: String(row.text ?? ""),
      classification: {
        tempo_primary: String(c.tempo_primary ?? "n/a"),
        inner_attitude: String(c.inner_attitude ?? "unknown"),
        aspect: String(c.aspect ?? "unknown"),
        stress: String(c.stress ?? "unknown"),
        pole: String(c.pole ?? "n/a"),
        drive_primary: String(c.drive_primary ?? "unknown"),
        drive_secondary: String(c.drive_secondary ?? "unknown"),
        drive_introvert: String(c.drive_introvert ?? "unknown"),
        drive_extravert: String(c.drive_extravert ?? "unknown"),
        drive_axis: String(c.drive_axis ?? "n/a"),
        motor_pair: Array.isArray(c.motor_pair) && c.motor_pair.length === 2
          ? [String(c.motor_pair[0]), String(c.motor_pair[1])]
          : null,
        outer_action_tempi: Array.isArray(c.outer_action_tempi)
          ? c.outer_action_tempi.map((x: unknown) => String(x))
          : [],
        outer_action_inners: Array.isArray(c.outer_action_inners)
          ? c.outer_action_inners.map((x: unknown) => String(x))
          : [],
        confidence: typeof c.confidence === "number" ? c.confidence : 0,
        rationale: String(c.rationale ?? ""),
        literary_anchor: typeof c.literary_anchor === "string" ? c.literary_anchor : null,
      },
    };
  });
}
