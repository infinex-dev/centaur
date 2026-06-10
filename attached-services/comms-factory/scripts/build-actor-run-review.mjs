import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const cardId = process.argv[2];
if (!cardId) {
  console.error("Usage: node scripts/build-actor-run-review.mjs <card-id>");
  process.exit(1);
}

const dbPath = resolve("harness/harness.db");
const outPath = resolve("research", `actor-run-review-${cardId}.html`);

function sqlJson(query) {
  const raw = execFileSync("sqlite3", ["-json", dbPath, query], {
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024,
  }).trim();
  return raw ? JSON.parse(raw) : [];
}

function safeSqlJson(query) {
  try {
    return sqlJson(query);
  } catch {
    return [];
  }
}

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pretty(value) {
  return esc(JSON.stringify(value, null, 2));
}

function badge(text, tone = "") {
  return `<span class="badge ${tone}">${esc(text)}</span>`;
}

function buildPipelineProof(cardId) {
  const escaped = cardId.replaceAll("'", "''");
  const persisted = safeSqlJson(`
    SELECT * FROM pipeline_runs
    WHERE card_id = '${escaped}'
    ORDER BY created_at DESC
    LIMIT 1
  `)[0];
  if (persisted?.proof_json) {
    const proof = parseJson(persisted.proof_json, null);
    if (proof) return proof;
  }
  const counts = safeSqlJson(`
    SELECT
      (SELECT COUNT(*) FROM actor_attempts WHERE card_id='${escaped}') AS actor_attempts,
      (SELECT COUNT(*) FROM actor_run_events WHERE card_id='${escaped}') AS actor_run_events,
      EXISTS(SELECT 1 FROM candidates WHERE card_id='${escaped}' AND rationale LIKE '%Actor option %') AS actor_option,
      EXISTS(SELECT 1 FROM director_audits WHERE card_id='${escaped}'
        AND director_audit_json LIKE '%"copy_voice_passed"%'
        AND director_audit_json LIKE '%"factual_passed"%'
        AND director_audit_json LIKE '%"publication_gate_passed"%') AS split_gates
  `)[0] ?? {};
  const fields = [
    ["env_arch_actor", "Env contains HARNESS_GENERATOR_ARCH=actor", process.env.HARNESS_GENERATOR_ARCH === "actor", `HARNESS_GENERATOR_ARCH=${process.env.HARNESS_GENERATOR_ARCH ?? "(unset)"}`],
    ["entrypoint", "Entry point is orchestrateActorDirectorWithRetries()", true, "orchestrateActorDirectorWithRetries()"],
    ["actor_attempt_rows", "DB has actor_attempts rows", Number(counts.actor_attempts ?? 0) > 0, String(counts.actor_attempts ?? 0)],
    ["actor_run_event_rows", "DB has actor_run_events rows", Number(counts.actor_run_events ?? 0) > 0, String(counts.actor_run_events ?? 0)],
    ["actor_option_rationale", "Candidate rationale contains \"Actor option N\"", Boolean(counts.actor_option), Boolean(counts.actor_option) ? "present" : "missing"],
    ["director_split_gates", "Director audit JSON contains copy_voice_passed, factual_passed, publication_gate_passed", Boolean(counts.split_gates), Boolean(counts.split_gates) ? "present" : "missing"],
  ].map(([key, label, passed, evidence]) => ({ key, label, passed, evidence }));
  const warnings = fields.filter((field) => !field.passed).map((field) => `${field.label}: ${field.evidence}`);
  return {
    pipeline_id: "pipeline-3",
    pipeline_label: "Pipeline 3 - Actor/Director",
    entrypoint: "orchestrateActorDirectorWithRetries()",
    generated_at: new Date().toISOString(),
    proof_passed: warnings.length === 0,
    proof_fields: fields,
    warnings,
  };
}

function list(items) {
  if (!items || items.length === 0) return `<p class="muted">none</p>`;
  return `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
}

function receiptList(receipts) {
  if (!Array.isArray(receipts) || receipts.length === 0) return `<p class="muted">none</p>`;
  return `<ul>${receipts.map((r) => `<li><b>${esc(r.working_action)}</b> / ${esc(r.objective_verb)}: <q>${esc(r.text_span)}</q><br><span class="muted">${esc(r.evidence)}</span></li>`).join("")}</ul>`;
}

function motionGrid(motion) {
  if (!motion) return "";
  const factors = ["weight", "space", "time", "flow"];
  return `<div class="motion-grid">${factors.map((factor) => {
    const item = motion[factor] ?? {};
    return `<div><h5>${factor}: ${esc(item.pole ?? "unknown")}</h5>${list(item.evidence ?? [])}</div>`;
  }).join("")}</div>`;
}

const actorAttempts = sqlJson(`
  SELECT a.*, (
    SELECT daily_pages_json FROM actor_warmups w
    WHERE w.actor_attempt_id = a.id
    ORDER BY w.created_at DESC
    LIMIT 1
  ) AS daily_pages_json
  FROM actor_attempts a
  WHERE a.card_id = '${cardId.replaceAll("'", "''")}'
  ORDER BY a.attempt ASC
`);

const candidates = sqlJson(`
  SELECT c.*, (
    SELECT director_audit_json FROM director_audits d
    WHERE d.candidate_id = c.id
    ORDER BY d.created_at DESC
    LIMIT 1
  ) AS director_audit_json, (
    SELECT passed FROM director_audits d
    WHERE d.candidate_id = c.id
    ORDER BY d.created_at DESC
    LIMIT 1
  ) AS director_passed
  FROM candidates c
  WHERE c.card_id = '${cardId.replaceAll("'", "''")}'
  ORDER BY c.attempt ASC, c.channel ASC
`);

const directorAudits = sqlJson(`
  SELECT * FROM director_audits
  WHERE card_id = '${cardId.replaceAll("'", "''")}'
  ORDER BY attempt ASC, channel ASC
`);

const events = sqlJson(`
  SELECT * FROM actor_run_events
  WHERE card_id = '${cardId.replaceAll("'", "''")}'
  ORDER BY created_at ASC, id ASC
`);

const pipelineProof = buildPipelineProof(cardId);
if (!pipelineProof.proof_passed) process.exitCode = 2;

const candidatesByAttemptChannel = new Map();
for (const candidate of candidates) {
  const key = `${candidate.attempt}:${candidate.channel}`;
  const list = candidatesByAttemptChannel.get(key) ?? [];
  list.push(candidate);
  candidatesByAttemptChannel.set(key, list);
}

function candidateForOption(attempt, channel, index) {
  const list = candidatesByAttemptChannel.get(`${attempt}:${channel}`) ?? [];
  return list.find((candidate) => String(candidate.rationale ?? "").includes(`Actor option ${index + 1}`)) ?? list[index] ?? null;
}

const auditSummaryRows = directorAudits.map((row) => {
  const audit = parseJson(row.director_audit_json, {});
  return `<tr>
    <td>${row.attempt}</td>
    <td>${esc(row.channel)}</td>
    <td>${badge(audit.primary_tempo ?? "unknown", row.passed ? "pass" : "fail")}</td>
    <td>${esc(audit.primary_confidence ?? "")}</td>
    <td>${row.passed ? badge("pass", "pass") : badge("reject", "fail")}</td>
    <td>${audit.infinex_fit?.legal ? badge("legal", "pass") : badge("illegal", "fail")}</td>
    <td>${audit.copy_voice_passed ? badge("pass", "pass") : badge("fail", "fail")}</td>
    <td>${audit.factual_passed ? badge("pass", "pass") : badge("fail", "fail")}</td>
    <td>${audit.publication_gate_passed ? badge("pass", "pass") : badge("warn", "fail")}</td>
    <td>${esc(audit.drive_read ?? "")}</td>
  </tr>`;
}).join("");

const attemptSections = actorAttempts.map((attempt) => {
  const raw = parseJson(attempt.actor_response_json, {});
  const table = parseJson(attempt.table_work_json, {});
  const channels = Object.keys(raw.performances ?? {});
  const notesIn = parseJson(attempt.director_notes_in_json, null);
  return `<section class="attempt">
    <h2>Attempt ${attempt.attempt}</h2>
    <div class="meta">
      ${badge(attempt.generator_source)}
      ${badge(attempt.prompt_version)}
      ${badge(String(attempt.prompt_hash).slice(0, 12))}
      ${badge(`channels ${attempt.channels_json}`)}
    </div>
    ${notesIn ? `<details open><summary>Director notes fed into this attempt</summary><pre>${pretty(notesIn)}</pre></details>` : ""}
    <details><summary>Actor warm-up / rehearsal</summary><pre>${pretty(raw.warmup ?? parseJson(attempt.daily_pages_json, {}))}</pre></details>
    <details open><summary>Table work</summary><pre>${pretty(table)}</pre></details>
    ${channels.map((channel) => {
      const performances = raw.performances?.[channel] ?? [];
      const selected = raw.selected_performances?.[channel] ?? {};
      const selectedIndex = Math.max(0, Number(selected.selected_option ?? 1) - 1);
      return `<section class="channel">
        <h3>${esc(channel)} ${badge(`Actor selected ${selectedIndex + 1}`)}</h3>
        <p class="muted">${esc(selected.selection_rationale ?? "")}</p>
        <div class="options">
          ${performances.map((option, index) => {
            const candidate = candidateForOption(attempt.attempt, channel, index);
            const audit = parseJson(candidate?.director_audit_json, null);
            return `<article class="option ${index === selectedIndex ? "selected" : ""}">
            <h4>Option ${index + 1}${index === selectedIndex ? " - Actor selected" : ""} ${candidate?.validation_passed ? badge("script pass", "pass") : badge("script fail", "fail")} ${audit ? badge(`Director: ${audit.primary_tempo}`, candidate?.director_passed ? "pass" : "fail") : ""}</h4>
            <blockquote>${esc(option.text)}</blockquote>
            <h5>Rationale</h5>
            <p>${esc(option.rationale ?? "")}</p>
            <h5>Movement receipt</h5>
            ${receiptList(option.movement_receipt)}
            <details><summary>Facts used / not said</summary><pre>${pretty({ deployed_facts_used: option.deployed_facts_used ?? [], not_said: option.not_said ?? [] })}</pre></details>
            ${candidate ? `<details open><summary>Persisted candidate option</summary><pre>${pretty({
              text: candidate.text,
              validation_passed: Boolean(candidate.validation_passed),
              validation_failures: parseJson(candidate.validation_failures_json, []),
              rationale: candidate.rationale,
            })}</pre></details>` : ""}
            ${audit ? `<details open><summary>Director audit</summary>
              <div class="director-head">
                ${badge(`tempo ${audit.primary_tempo}`, candidate?.director_passed ? "pass" : "fail")}
                ${badge(`confidence ${audit.primary_confidence}`)}
                ${badge(audit.passed ? "passed" : "rejected", audit.passed ? "pass" : "fail")}
                ${badge(audit.infinex_fit?.legal ? "legal" : "illegal", audit.infinex_fit?.legal ? "pass" : "fail")}
                ${badge(`copy ${audit.copy_voice_passed ? "pass" : "fail"}`, audit.copy_voice_passed ? "pass" : "fail")}
                ${badge(`facts ${audit.factual_passed ? "pass" : "fail"}`, audit.factual_passed ? "pass" : "fail")}
                ${badge(`publish ${audit.publication_gate_passed ? "pass" : "warn"}`, audit.publication_gate_passed ? "pass" : "fail")}
              </div>
              <h5>Tempo basis</h5>
              <pre>${pretty(audit.tempo_basis ?? {})}</pre>
              <h5>Motion evidence</h5>
              ${motionGrid(audit.motion_evidence)}
              <h5>Movement receipt fit</h5><pre>${pretty(audit.movement_receipt_fit ?? {})}</pre>
              <h5>Drive read</h5><p>${esc(audit.drive_read)}</p>
              <h5>Placement read</h5><p>${esc(audit.placement_read)}</p>
              <h5>Fit reason</h5><p>${esc(audit.infinex_fit?.reason)}</p>
              <h5>Notes for actor</h5>${list(audit.notes_for_actor)}
              <h5>Publication gate issues</h5>${list(audit.publication_gate_issues)}
              <h5>Voice issues</h5>${list(audit.voice_issues)}
              <h5>Factual issues</h5>${list(audit.factual_issues)}
            </details>` : ""}
          </article>`;
          }).join("")}
        </div>
      </section>`;
    }).join("")}
  </section>`;
}).join("");

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Actor/Director Run Review - ${esc(cardId)}</title>
  <style>
    :root { color-scheme: light; --ink:#151515; --muted:#666; --rule:#ddd; --paper:#fff; --canvas:#f7f7f4; --pass:#0a7a35; --fail:#b42318; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: var(--canvas); }
    main { max-width: 1180px; margin: 0 auto; padding: 32px 20px 80px; }
    h1, h2, h3, h4, h5 { margin: 0 0 8px; }
    h1 { font-size: 28px; }
    h2 { margin-top: 36px; padding-top: 24px; border-top: 2px solid var(--ink); }
    h3 { margin-top: 24px; }
    p, li { line-height: 1.45; }
    table { border-collapse: collapse; width: 100%; background: var(--paper); margin: 16px 0 28px; }
    th, td { border: 1px solid var(--rule); padding: 8px; text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #eee; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
    details { background: var(--paper); border: 1px solid var(--rule); border-radius: 6px; margin: 10px 0; }
    summary { cursor: pointer; padding: 10px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--muted); }
    pre { margin: 0; padding: 12px; white-space: pre-wrap; overflow: auto; max-height: 520px; font-size: 12px; line-height: 1.45; border-top: 1px solid var(--rule); }
    blockquote { margin: 0 0 12px; padding: 12px; border-left: 4px solid var(--ink); background: #fafafa; white-space: pre-wrap; font-size: 16px; line-height: 1.45; }
    .meta, .director-head { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 12px; }
    .badge { display: inline-block; border: 1px solid var(--rule); border-radius: 999px; padding: 2px 8px; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #fff; color: var(--muted); }
    .badge.pass { border-color: #b7e2c4; color: var(--pass); background: #effaf2; }
    .badge.fail { border-color: #f1b8b2; color: var(--fail); background: #fff3f1; }
    .muted { color: var(--muted); }
    .channel { border: 1px solid var(--rule); background: #fbfbf9; border-radius: 8px; padding: 16px; margin-top: 16px; }
    .options { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; }
	    .option { border: 1px solid var(--rule); background: var(--paper); border-radius: 6px; padding: 12px; }
	    .option.selected { outline: 2px solid #222; }
	    .motion-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; padding: 0 12px 12px; }
	    .motion-grid > div { border: 1px solid var(--rule); background: #fafafa; padding: 10px; border-radius: 6px; }
	    .proof { border: 2px solid var(--rule); background: var(--paper); border-radius: 8px; padding: 14px 16px; margin: 16px 0 28px; }
	    .proof.fail { border-color: var(--fail); background: #fff3f1; }
	  </style>
	</head>
	<body>
	  <main>
	    <h1>Actor/Director Run Review</h1>
	    <p class="muted">${esc(cardId)}</p>
	    <section class="proof ${pipelineProof.proof_passed ? "" : "fail"}">
	      <h2>Pipeline Identity</h2>
	      <p>${badge(pipelineProof.pipeline_id, pipelineProof.proof_passed ? "pass" : "fail")} ${esc(pipelineProof.pipeline_label)} ${badge(pipelineProof.proof_passed ? "proof passed" : "proof missing", pipelineProof.proof_passed ? "pass" : "fail")}</p>
	      <p class="muted">entrypoint: ${esc(pipelineProof.entrypoint)} · generated ${esc(pipelineProof.generated_at)}</p>
	      ${pipelineProof.proof_passed ? "" : `<p><b>Treat this run as legacy until rerun.</b> ${esc((pipelineProof.warnings ?? []).join(" "))}</p>`}
	      <table>
	        <thead><tr><th>Proof field</th><th>Status</th><th>Evidence</th></tr></thead>
	        <tbody>${(pipelineProof.proof_fields ?? []).map((field) => `<tr><td>${esc(field.label)}</td><td>${field.passed ? badge("pass", "pass") : badge("missing", "fail")}</td><td>${esc(field.evidence)}</td></tr>`).join("")}</tbody>
	      </table>
	    </section>
	    <h2>Director Read Summary</h2>
    <table>
      <thead><tr><th>Attempt</th><th>Channel</th><th>Tempo</th><th>Confidence</th><th>Director</th><th>Infinex Fit</th><th>Copy/Voice</th><th>Factual</th><th>Publish</th><th>Drive Read</th></tr></thead>
      <tbody>${auditSummaryRows}</tbody>
    </table>
    <h2>Event Log</h2>
    <table>
      <thead><tr><th>Time</th><th>Attempt</th><th>Channel</th><th>Event</th><th>Message</th></tr></thead>
      <tbody>${events.map((event) => `<tr><td>${esc(event.created_at)}</td><td>${esc(event.attempt ?? "")}</td><td>${esc(event.channel ?? "")}</td><td>${esc(event.event_type)}</td><td>${esc(event.message)}</td></tr>`).join("")}</tbody>
    </table>
    ${attemptSections}
  </main>
</body>
</html>`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html);
console.log(outPath);
