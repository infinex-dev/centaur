/**
 * Build a side-by-side HTML diff of soft-cleaned vs hardened validator runs.
 *
 * Run: pnpm tsx scripts/build-soft-vs-hardened-html.ts > research/soft-vs-hardened.html
 */

import { readFileSync } from "node:fs";

const ROOT = "/Users/opaque/.superset/projects/comms-factory/research";

interface Row {
  id: string;
  cells: string[];
}

function parseTableRows(path: string): Row[] {
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n");
  const rows: Row[] = [];
  for (const line of lines) {
    if (!line.startsWith("|")) continue;
    if (line.startsWith("|---") || line.startsWith("| ---") || line.includes("| ID | ") || line.includes("| ID |")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length === 0) continue;
    const id = cells[0];
    if (!id || !/^[HS]\d+/.test(id)) continue;
    rows.push({ id, cells });
  }
  return rows;
}

function alignById(a: Row[], b: Row[]): Array<{ id: string; soft?: Row; hard?: Row }> {
  const ids = new Set<string>([...a.map((r) => r.id), ...b.map((r) => r.id)]);
  const aById = new Map(a.map((r) => [r.id, r]));
  const bById = new Map(b.map((r) => [r.id, r]));
  return Array.from(ids)
    .sort((x, y) => x.localeCompare(y, undefined, { numeric: true }))
    .map((id) => ({
      id,
      ...(aById.get(id) ? { soft: aById.get(id)! } : {}),
      ...(bById.get(id) ? { hard: bById.get(id)! } : {}),
    }));
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractVerdict(cell: string): { kind: "PASS" | "FAIL" | "MATCH" | "MISMATCH" | "UNKNOWN" | "OFF-SPEC" | "?"; tempo: string; raw: string } {
  // Try to pull a final verdict marker
  const m = cell.match(/\*\*(PASS|FAIL|MATCH|MISMATCH|UNKNOWN|OFF-SPEC)\*\*/i);
  const kind = (m?.[1]?.toUpperCase() ?? "?") as ReturnType<typeof extractVerdict>["kind"];
  const tempoMatch = cell.match(/(commanding|practical|sombre|irradiant|sociable|self-contained|receptive|overpowering|diffused|egocentric|altruistic|unsociable|unknown)\b/i);
  const tempo = tempoMatch?.[1]?.toLowerCase() ?? "";
  return { kind, tempo, raw: cell };
}

function extractDrive(cell: string): string {
  // Phase 3 introduces a structured `detected_drive` field. Existing dogfood
  // markdown predates that field, so we extract drive from rationale prose
  // best-effort. Future dogfood runs that emit drive structurally will still
  // mention it in rationale, so this stays stable.
  const lower = cell.toLowerCase();
  const m1 = lower.match(/(?:off-spec\s+)?drive(?:\s+activated)?[:\s—-]+(spell-vision|doing-passion|passion|vision|spell|doing)/);
  if (m1?.[1]) return m1[1];
  const m2 = lower.match(/\b(?:carries|activates|reads as|pulled toward|pulls toward)\s+(spell-vision|doing-passion|passion|vision|spell|doing)\b/);
  if (m2?.[1]) return m2[1];
  const m3 = lower.match(/\b(spell-vision|doing-passion)\b/);
  if (m3?.[1]) return m3[1];
  // Bare "Passion" / "Vision" mention is too loose — only trust it when the
  // word "drive" appears nearby (within 30 chars) to avoid false positives
  // like "passion project" or "vision statement".
  const m4 = cell.match(/\b(passion|vision|spell|doing)\b[^.]{0,30}\bdrive\b|\bdrive\b[^.]{0,30}\b(passion|vision|spell|doing)\b/i);
  const tok = m4?.[1] ?? m4?.[2];
  if (tok) return tok.toLowerCase();
  return "";
}

function driveBadge(drive: string): string {
  if (!drive) return `<span style="color:#bbb;font-size:11px;">—</span>`;
  // Spec-positive drives for Infinex character: spell, vision, spell-vision.
  // Off-spec: passion, doing-passion. Neutral: doing.
  const isOffSpec = drive === "passion" || drive === "doing-passion";
  const isOnSpec = drive === "spell" || drive === "vision" || drive === "spell-vision";
  const color = isOffSpec ? "#a83232" : isOnSpec ? "#1f7a3f" : "#6b6b6b";
  return `<span style="background:${color};color:#fff;padding:1px 6px;border-radius:3px;font-size:11px;font-weight:600;letter-spacing:0.02em;">${drive}</span>`;
}

function extractClassified(cell: string): { tempo: string; conf: string; status: string; rationale: string } {
  // Cell looks like: "commanding (conf=0.72, PASS; ...rationale text...)"
  //              or: "unknown (conf=0.75, FAIL: <fail reason>; ...rationale...)"
  const tempoM = cell.match(/^([a-z-]+)\s*\(/i);
  const tempo = tempoM?.[1]?.toLowerCase() ?? "";
  const confM = cell.match(/conf=([0-9.]+)/);
  const conf = confM?.[1] ?? "";
  const statusM = cell.match(/conf=[0-9.]+,\s*(PASS|FAIL)/);
  const status = statusM?.[1] ?? "";
  // Rationale: everything inside the outer parens after the status, minus FAIL prefix
  const inside = cell.match(/\(([^)]*(?:\([^)]*\)[^)]*)*)\)/);
  let rationale = inside?.[1] ?? "";
  rationale = rationale.replace(/^conf=[0-9.]+,\s*(?:PASS|FAIL)(?::\s*[^;]*)?;\s*/i, "");
  rationale = rationale.replace(/^conf=[0-9.]+,\s*FAIL:\s*/, "FAIL: ");
  return { tempo, conf, status, rationale: rationale.trim() };
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

function verdictBadge(v: ReturnType<typeof extractVerdict>): string {
  const color = (() => {
    switch (v.kind) {
      case "PASS":
      case "MATCH":
        return "#1f7a3f";
      case "FAIL":
      case "MISMATCH":
        return "#a83232";
      case "UNKNOWN":
        return "#6b6b6b";
      case "OFF-SPEC":
        return "#7a5b1f";
      default:
        return "#3a3a3a";
    }
  })();
  return `<span style="background:${color};color:#fff;padding:1px 6px;border-radius:3px;font-size:11px;font-weight:600;">${v.kind}</span> <span style="color:#444;font-size:11px;">${v.tempo}</span>`;
}

function diffBadge(soft?: Row, hard?: Row, softVerdictIdx?: number, hardVerdictIdx?: number): string {
  if (!soft || !hard) return `<span style="color:#999">—</span>`;
  const s = extractVerdict(soft.cells[softVerdictIdx!] ?? "");
  const h = extractVerdict(hard.cells[hardVerdictIdx!] ?? "");
  if (s.kind === h.kind && s.tempo === h.tempo) return `<span style="color:#999;font-size:11px">unchanged</span>`;
  if ((s.kind === "PASS" || s.kind === "MATCH") && (h.kind === "FAIL" || h.kind === "UNKNOWN" || h.kind === "MISMATCH")) {
    return `<span style="background:#a83232;color:#fff;padding:1px 6px;border-radius:3px;font-size:11px;font-weight:600;">TIGHTENED</span>`;
  }
  if ((h.kind === "PASS" || h.kind === "MATCH") && (s.kind === "FAIL" || s.kind === "UNKNOWN" || s.kind === "MISMATCH")) {
    return `<span style="background:#1f7a3f;color:#fff;padding:1px 6px;border-radius:3px;font-size:11px;font-weight:600;">LOOSENED</span>`;
  }
  if (s.tempo !== h.tempo) {
    return `<span style="background:#a06a00;color:#fff;padding:1px 6px;border-radius:3px;font-size:11px;font-weight:600;">TEMPO SHIFT</span>`;
  }
  return `<span style="color:#999;font-size:11px">~changed</span>`;
}

const sections: string[] = [];

// ============ SECTION 1: Homepage tempo-fit (audit) ============
{
  const soft = parseTableRows(`${ROOT}/infinex-homepage-tempo-fit.llm.cleaned.md`);
  const hard = parseTableRows(`${ROOT}/infinex-homepage-tempo-fit.llm.hardened.md`);
  const pairs = alignById(soft, hard);

  // Columns in tempo-fit table: ID | Job | Text | Declared | Classified | Verdict
  const VERDICT_IDX = 5;

  const DECLARED_IDX = 3;
  const CLASSIFIED_IDX = 4;
  const rowsHtml = pairs.map(({ id, soft, hard }) => {
    const job = soft?.cells[1] ?? hard?.cells[1] ?? "";
    const text = (soft?.cells[2] ?? hard?.cells[2] ?? "").replace(/^"|"$/g, "");
    const softV = soft ? extractVerdict(soft.cells[VERDICT_IDX] ?? "") : null;
    const hardV = hard ? extractVerdict(hard.cells[VERDICT_IDX] ?? "") : null;
    const softDeclared = soft?.cells[DECLARED_IDX] ?? "";
    const hardDeclared = hard?.cells[DECLARED_IDX] ?? "";
    const softCls = soft ? extractClassified(soft.cells[CLASSIFIED_IDX] ?? "") : null;
    const hardCls = hard ? extractClassified(hard.cells[CLASSIFIED_IDX] ?? "") : null;
    // Drive — preferred source is the hardened validator's rationale (more
    // explicit about off-spec drives). Fall back to soft when hardened absent.
    const drive = extractDrive(hard?.cells[CLASSIFIED_IDX] ?? soft?.cells[CLASSIFIED_IDX] ?? "");
    const renderSide = (declared: string, cls: typeof softCls, v: typeof softV) => {
      if (!cls) return "—";
      return `
        <div class="tempo-row"><span class="label">declared</span> <code>${escape(declared)}</code> <span class="arrow">→</span> <span class="label">read as</span> <code>${escape(cls.tempo)}</code>${cls.conf ? ` <span class="conf">(conf ${cls.conf})</span>` : ""}</div>
        <div class="verdict-row">${v ? verdictBadge(v) : ""}</div>
        ${cls.rationale ? `<div class="rationale">${escape(truncate(cls.rationale, 280))}</div>` : ""}
      `;
    };
    return `<tr>
      <td class="id">${escape(id)}</td>
      <td class="job">${escape(job)}</td>
      <td class="text og">${escape(text)}</td>
      <td class="drive">${driveBadge(drive)}</td>
      <td class="side">${renderSide(softDeclared, softCls, softV)}</td>
      <td class="side">${renderSide(hardDeclared, hardCls, hardV)}</td>
      <td class="diff">${diffBadge(soft, hard, VERDICT_IDX, VERDICT_IDX)}</td>
    </tr>`;
  }).join("\n");

  sections.push(`<section>
    <h2>1. Homepage tempo-fit audit (Sonnet validator only)</h2>
    <p class="explain">For each shipped homepage string, the validator blind-classifies it. <b>Soft</b> = validator allows all 12 tempi (main + reserve). <b>Hardened</b> = validator only accepts the 5 main tempi (Commanding · Practical · Sombre · Irradiant · Sociable); strings reading as Self-contained etc. are flagged as off-rotation. <b>Drive</b> is parsed from the hardened validator's rationale prose — green = on-spec for Infinex (spell / vision / spell-vision), red = off-spec (passion / doing-passion).</p>
    <table>
      <thead><tr><th>ID</th><th>Job</th><th>OG (shipped)</th><th>Drive</th><th>Soft validator</th><th>Hardened validator</th><th>Diff</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </section>`);
}

// ============ SECTION 2: Existing platform copy (audit) ============
{
  const soft = parseTableRows(`${ROOT}/infinex-dogfood-pipeline.llm.cleaned.md`);
  const hard = parseTableRows(`${ROOT}/infinex-dogfood-pipeline.llm.hardened.md`);
  const pairs = alignById(soft, hard);

  // Columns in existing-copy table: ID | Surface | Text | Layer1 | Layer2 (det) | LLM verdict
  const VERDICT_IDX = 5;

  const rowsHtml = pairs.map(({ id, soft, hard }) => {
    const surface = soft?.cells[1] ?? hard?.cells[1] ?? "";
    const text = (soft?.cells[2] ?? hard?.cells[2] ?? "").replace(/^"|"$/g, "");
    // dogfood-pipeline LLM column format: "FAIL · unknown (conf=0.72) · Off-spec drive: Passion. <rationale>"
    //                                or:  "PASS · commanding (conf=0.85) · <rationale>"
    const parseDogfood = (cell: string) => {
      const statusM = cell.match(/^(PASS|FAIL)/i);
      const tempoM = cell.match(/\b(commanding|practical|sombre|irradiant|sociable|self-contained|receptive|overpowering|diffused|egocentric|altruistic|unsociable|unknown)\b/i);
      const confM = cell.match(/conf=([0-9.]+)/);
      const status = statusM?.[1]?.toUpperCase() ?? "";
      const tempo = tempoM?.[1]?.toLowerCase() ?? "";
      const conf = confM?.[1] ?? "";
      // Rationale: text after the last " · " bullet, or after the closing paren of conf
      const parts = cell.split(/\s·\s/);
      const rationale = (parts.length > 2 ? parts.slice(2).join(" · ") : cell.replace(/^.*?\)\s*/, "")).trim();
      return { status, tempo, conf, rationale };
    };
    const softP = soft ? parseDogfood(soft.cells[VERDICT_IDX] ?? "") : null;
    const hardP = hard ? parseDogfood(hard.cells[VERDICT_IDX] ?? "") : null;
    // Drive — preferred source is the hardened validator's rationale prose.
    const drive = extractDrive(hard?.cells[VERDICT_IDX] ?? soft?.cells[VERDICT_IDX] ?? "");
    const renderSide = (p: typeof softP) => {
      if (!p) return "—";
      const color = p.status === "PASS" ? "#1f7a3f" : p.status === "FAIL" ? "#a83232" : "#6b6b6b";
      return `
        <div class="tempo-row"><span class="label">classified</span> <code>${escape(p.tempo)}</code>${p.conf ? ` <span class="conf">(conf ${p.conf})</span>` : ""}</div>
        <div class="verdict-row"><span style="background:${color};color:#fff;padding:1px 6px;border-radius:3px;font-size:11px;font-weight:600;">${p.status}</span></div>
        ${p.rationale ? `<div class="rationale">${escape(truncate(p.rationale, 320))}</div>` : ""}
      `;
    };
    const diffLabel = (() => {
      if (!softP || !hardP) return `<span style="color:#999">—</span>`;
      if (softP.status === hardP.status && softP.tempo === hardP.tempo) return `<span style="color:#999;font-size:11px">unchanged</span>`;
      if (softP.status === "PASS" && hardP.status === "FAIL") return `<span style="background:#a83232;color:#fff;padding:1px 6px;border-radius:3px;font-size:11px;font-weight:600;">TIGHTENED</span>`;
      if (softP.status === "FAIL" && hardP.status === "PASS") return `<span style="background:#1f7a3f;color:#fff;padding:1px 6px;border-radius:3px;font-size:11px;font-weight:600;">LOOSENED</span>`;
      if (softP.tempo !== hardP.tempo) return `<span style="background:#a06a00;color:#fff;padding:1px 6px;border-radius:3px;font-size:11px;font-weight:600;">TEMPO SHIFT</span>`;
      return `<span style="color:#999;font-size:11px">~changed</span>`;
    })();
    return `<tr>
      <td class="id">${escape(id)}</td>
      <td class="job">${escape(surface)}</td>
      <td class="text og">${escape(text)}</td>
      <td class="drive">${driveBadge(drive)}</td>
      <td class="side">${renderSide(softP)}</td>
      <td class="side">${renderSide(hardP)}</td>
      <td class="diff">${diffLabel}</td>
    </tr>`;
  }).join("\n");

  sections.push(`<section>
    <h2>2. Existing platform / dogfood copy audit (Sonnet validator only)</h2>
    <p class="explain">Same validator pass, but on platform / website strings dogfooded from the 45-minute ElevenLabs transcript audit. Rows S14–S18 are the audit's proposed replacements — they should pass cleanly as Commanding. <b>Drive</b> column same convention as section 1.</p>
    <table>
      <thead><tr><th>ID</th><th>Surface</th><th>OG (shipped)</th><th>Drive</th><th>Soft validator</th><th>Hardened validator</th><th>Diff</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </section>`);
}

// ============ SECTION 3: Intent-strip rewrite loop ============
{
  const soft = parseTableRows(`${ROOT}/infinex-homepage-rewrite.md`);
  const hard = parseTableRows(`${ROOT}/infinex-homepage-rewrite.hardened.md`);
  const pairs = alignById(soft, hard);

  // Columns in rewrite-loop table:
  // ID | Surface | Job | Current text | Extracted intent | Selected tempo | Replacement text | Verifier tempo | Verdict | Retries | Similarity
  const CURRENT_IDX = 3;
  const SELECTED_TEMPO_IDX = 5;
  const REPLACEMENT_IDX = 6;
  const VERIFIER_TEMPO_IDX = 7;
  const VERDICT_IDX = 8;

  const INTENT_IDX = 4;
  const RETRIES_IDX = 9;
  const SIM_IDX = 10;
  const rowsHtml = pairs.map(({ id, soft, hard }) => {
    const current = soft?.cells[CURRENT_IDX] ?? hard?.cells[CURRENT_IDX] ?? "";

    const renderSide = (row: typeof soft) => {
      if (!row) return "—";
      const intent = row.cells[INTENT_IDX] ?? "";
      const selected = row.cells[SELECTED_TEMPO_IDX] ?? "";
      const repl = row.cells[REPLACEMENT_IDX] ?? "";
      const verifier = row.cells[VERIFIER_TEMPO_IDX] ?? "";
      const verdict = row.cells[VERDICT_IDX] ?? "";
      const retries = row.cells[RETRIES_IDX] ?? "";
      const sim = row.cells[SIM_IDX] ?? "";
      const color = verdict === "PASS" ? "#1f7a3f" : verdict === "FAIL" ? "#a83232" : "#6b6b6b";
      const drive = `Spell-Vision (Passion off-spec)`;
      return `
        <div class="intent"><span class="label">intent</span> ${escape(truncate(intent, 240))}</div>
        <div class="tempo-row"><span class="label">generator picked</span> <code>${escape(selected)}</code> <span class="arrow">→</span> <span class="label">verifier read</span> <code>${escape(verifier)}</code></div>
        <div class="verdict-row"><span style="background:${color};color:#fff;padding:1px 6px;border-radius:3px;font-size:11px;font-weight:600;">${escape(verdict)}</span> <span class="meta">retries ${escape(retries)} · sim ${escape(sim)}</span></div>
        <div class="replacement">${escape(repl)}</div>
      `;
    };

    const softVerdict = soft?.cells[VERDICT_IDX] ?? "";
    const hardVerdict = hard?.cells[VERDICT_IDX] ?? "";
    const softTempo = (soft?.cells[SELECTED_TEMPO_IDX] ?? "").toLowerCase();
    const hardTempo = (hard?.cells[SELECTED_TEMPO_IDX] ?? "").toLowerCase();
    const softRepl = soft?.cells[REPLACEMENT_IDX] ?? "";
    const hardRepl = hard?.cells[REPLACEMENT_IDX] ?? "";

    let diffLabel: string;
    if (softVerdict !== hardVerdict) {
      diffLabel = (softVerdict === "PASS" && hardVerdict === "FAIL")
        ? `<span style="background:#a83232;color:#fff;padding:1px 6px;border-radius:3px;font-size:11px;font-weight:600;">TIGHTENED</span>`
        : `<span style="background:#1f7a3f;color:#fff;padding:1px 6px;border-radius:3px;font-size:11px;font-weight:600;">LOOSENED</span>`;
    } else if (softTempo !== hardTempo) {
      diffLabel = `<span style="background:#a06a00;color:#fff;padding:1px 6px;border-radius:3px;font-size:11px;font-weight:600;">TEMPO SHIFT</span>`;
    } else if (softRepl.trim() !== hardRepl.trim()) {
      diffLabel = `<span style="background:#3a5cb0;color:#fff;padding:1px 6px;border-radius:3px;font-size:11px;font-weight:600;">REPHRASED</span>`;
    } else {
      diffLabel = `<span style="color:#999;font-size:11px">unchanged</span>`;
    }

    return `<tr>
      <td class="id">${escape(id)}</td>
      <td class="text og">${escape(current)}</td>
      <td class="side">${renderSide(soft)}</td>
      <td class="side">${renderSide(hard)}</td>
      <td class="diff">${diffLabel}</td>
    </tr>`;
  }).join("\n");

  sections.push(`<section>
    <h2>3. Intent-strip rewrite loop (3 LLM agents: Sonnet extractor → Opus generator → Sonnet validator)</h2>
    <p class="explain">Each shipped string is reverse-engineered into job/intent (no phrasing leak), then Opus writes a replacement from intent + character spec only (never sees the shipped text), then Sonnet blind-classifies the replacement. <b>Soft</b> = validator allows all 12 tempi. <b>Hardened</b> = validator restricted to 5 main tempi. Both runs constrain the generator to 5 main tempi.</p>
    <table>
      <thead><tr><th>ID</th><th>Current</th><th>Soft regen</th><th>Hardened regen</th><th>Diff</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </section>`);
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Infinex voice — soft vs hardened</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    color: #1a1a1a;
    background: #fafaf9;
    margin: 0;
    padding: 32px 24px 80px;
    line-height: 1.45;
  }
  h1 { font-size: 22px; margin: 0 0 8px; }
  .lead { color: #555; margin: 0 0 32px; font-size: 14px; }
  h2 { font-size: 16px; margin: 32px 0 4px; }
  .explain { color: #555; font-size: 13px; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; background: #fff; border: 1px solid #ddd; table-layout: fixed; }
  th, td { padding: 10px 12px; vertical-align: top; text-align: left; border-bottom: 1px solid #eee; }
  th { background: #f3f3f1; font-weight: 600; color: #333; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; position: sticky; top: 0; z-index: 1; }
  td.id { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-weight: 600; color: #444; width: 44px; }
  td.job { color: #555; width: 130px; font-size: 11px; }
  td.text { width: 220px; }
  td.text.og { font-style: italic; color: #1a1a1a; background: #fdfaf3; border-left: 3px solid #f0c870; padding-left: 10px; }
  td.side { width: auto; }
  td.drive { width: 96px; text-align: center; }
  td.diff { width: 90px; text-align: center; }
  .tempo-row { font-size: 11px; color: #333; margin-bottom: 4px; line-height: 1.6; }
  .tempo-row code { background: #eef0f3; padding: 1px 5px; border-radius: 3px; font-size: 11px; color: #1a3a6b; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  .tempo-row .arrow { color: #999; }
  .label { color: #777; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
  .conf { color: #888; font-size: 10px; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  .verdict-row { margin-bottom: 6px; }
  .rationale { color: #333; font-size: 11px; line-height: 1.5; background: #fafafa; padding: 6px 8px; border-left: 2px solid #ddd; border-radius: 2px; }
  .intent { color: #555; font-size: 11px; margin-bottom: 6px; line-height: 1.5; background: #fafafa; padding: 6px 8px; border-left: 2px solid #c0d0e0; }
  .replacement { color: #0a0a0a; font-size: 13px; line-height: 1.45; background: #f3fbf3; padding: 8px 10px; border-left: 3px solid #4caf7a; margin-top: 6px; }
  .meta { color: #888; font-size: 10px; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  section { margin-bottom: 28px; }
  footer { color: #999; font-size: 11px; margin-top: 40px; }
</style>
</head>
<body>
<h1>Infinex voice validator — soft vs hardened</h1>
<p class="lead">2026-05-15 · Soft = validator allows all 12 Mirodan tempi as primary classifications. Hardened = restricted to the 5 main locked tempi (Commanding · Practical · Sombre · Irradiant · Sociable). Reserve / beat-only tempi (Self-contained, Receptive, Overpowering, Diffused, Egocentric, Altruistic, Unsociable) only pass under Soft.</p>
${sections.join("\n")}
<footer>Generated by scripts/build-soft-vs-hardened-html.ts · sources: research/infinex-homepage-tempo-fit.llm.{cleaned,hardened}.md · infinex-dogfood-pipeline.llm.{cleaned,hardened}.md · infinex-homepage-rewrite{,.hardened}.md</footer>
</body>
</html>`;

process.stdout.write(html);
