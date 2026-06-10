import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outPath = path.join(root, "research", "validator-flow-review-2026-05-27.html");

const groups = [
  {
    title: "Harness Entry Points",
    note: "Where Superset chooses the old generator/active-validator path or the Actor/Director path.",
    open: true,
    files: [
      "harness/app/actions/generate.ts",
      "harness/lib/classifier-wrapper.ts",
    ],
  },
  {
    title: "Actor / Director Pipeline",
    note: "The new generation loop: Actor produces candidates, Director classifies and returns notes, deterministic validator still records hygiene results.",
    open: true,
    files: [
      "src/actor-orchestrator.ts",
      "src/actor-director.ts",
      "src/actor-memory.ts",
    ],
  },
  {
    title: "Deterministic Validator",
    note: "Regex, fact tripwires, deterministic beat audit, blind tempo scoring, and the shared voice tables it consumes.",
    open: true,
    files: [
      "src/validator.ts",
      "src/voice/infinex.ts",
      "src/voice/types.ts",
      "src/voice/laban.ts",
    ],
  },
  {
    title: "LLM / Active Validator",
    note: "The older/current non-Actor path: LLM voice classifier, active factual audit, research tools, and orchestrator composition.",
    open: true,
    files: [
      "src/validator-llm.ts",
      "src/validator-active.ts",
      "src/research-tools.ts",
      "src/orchestrator.ts",
    ],
  },
  {
    title: "Tests",
    note: "The guardrails that currently lock validator and Director behavior.",
    open: false,
    files: [
      "src/__tests__/actor-director.test.ts",
      "src/__tests__/validator.test.ts",
      "src/__tests__/validator-llm.test.ts",
      "src/__tests__/validator-active.test.ts",
      "src/__tests__/orchestrator.test.ts",
      "src/__tests__/voice.test.ts",
    ],
  },
];

const flowBullets = [
  "`runGenerator()` in `harness/app/actions/generate.ts` is the top-level Superset action.",
  "If `HARNESS_GENERATOR_ARCH=actor`, the harness enters `runActorGenerator()` and then `orchestrateActorDirectorWithRetries()`.",
  "Actor/Director candidates still run through deterministic `validate()` before being persisted, but not through `validator-llm.ts`.",
  "If `HARNESS_GENERATOR_ARCH` is not `actor`, the old path calls `generateForChannel()` and normally gates with the active LLM validator.",
  "`validator-llm.ts` and `actor-director.ts` are separate LLM classifiers. They now share the Infinex kernel and drive table, but their schemas and roles differ.",
];

function readFile(rel) {
  const abs = path.join(root, rel);
  const text = fs.readFileSync(abs, "utf8");
  return { rel, abs, text, lines: text.split(/\r?\n/) };
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function renderCodeFile(file) {
  const id = slug(file.rel);
  const rows = file.lines.map((line, index) => {
    const lineNo = index + 1;
    return `<tr id="${id}-L${lineNo}"><td class="ln"><a href="#${id}-L${lineNo}">${lineNo}</a></td><td class="code"><pre>${escapeHtml(line || " ")}</pre></td></tr>`;
  }).join("\n");

  return `
    <section class="file" id="${id}">
      <div class="file-head">
        <h3>${escapeHtml(file.rel)}</h3>
        <div class="meta">${file.lines.length} lines</div>
      </div>
      <table class="code-table" aria-label="${escapeHtml(file.rel)} source">
        <tbody>
          ${rows}
        </tbody>
      </table>
    </section>
  `;
}

const loadedGroups = groups.map((group) => ({
  ...group,
  loadedFiles: group.files.map(readFile),
}));

const totalLines = loadedGroups.reduce(
  (sum, group) => sum + group.loadedFiles.reduce((inner, file) => inner + file.lines.length, 0),
  0,
);

const toc = loadedGroups.map((group) => {
  const links = group.loadedFiles.map((file) =>
    `<li><a href="#${slug(file.rel)}">${escapeHtml(file.rel)}</a> <span>${file.lines.length} lines</span></li>`,
  ).join("\n");
  return `<li><a href="#${slug(group.title)}">${escapeHtml(group.title)}</a><ul>${links}</ul></li>`;
}).join("\n");

const body = loadedGroups.map((group) => {
  const files = group.loadedFiles.map(renderCodeFile).join("\n");
  return `
    <details class="group" id="${slug(group.title)}" ${group.open ? "open" : ""}>
      <summary>
        <h2>${escapeHtml(group.title)}</h2>
        <p>${escapeHtml(group.note)}</p>
      </summary>
      ${files}
    </details>
  `;
}).join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Validator Flow Review - 2026-05-27</title>
  <style>
    :root {
      --bg: #f7f4ee;
      --panel: #fffdfa;
      --ink: #181512;
      --muted: #6f665d;
      --line: #ded6ca;
      --code-bg: #171717;
      --code: #eee9df;
      --accent: #0f6b5c;
      --warn: #a84e16;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    header {
      padding: 28px 32px 20px;
      border-bottom: 1px solid var(--line);
      background: var(--panel);
      position: sticky;
      top: 0;
      z-index: 5;
    }
    h1 { margin: 0 0 8px; font-size: 24px; letter-spacing: 0; }
    h2, h3 { letter-spacing: 0; }
    .sub { color: var(--muted); max-width: 980px; }
    main {
      display: grid;
      grid-template-columns: minmax(260px, 360px) minmax(0, 1fr);
      gap: 24px;
      padding: 24px 32px 60px;
    }
    nav {
      align-self: start;
      position: sticky;
      top: 116px;
      max-height: calc(100vh - 140px);
      overflow: auto;
      padding: 16px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    nav h2 { margin: 0 0 10px; font-size: 14px; }
    nav ul { margin: 0; padding-left: 18px; }
    nav li { margin: 6px 0; }
    nav a { color: var(--accent); text-decoration: none; }
    nav a:hover { text-decoration: underline; }
    nav span { color: var(--muted); font-size: 12px; }
    .flow {
      margin-bottom: 18px;
      padding: 16px;
      background: #fff7e8;
      border: 1px solid #e8cfa1;
      border-radius: 8px;
    }
    .flow h2 { margin: 0 0 8px; font-size: 16px; }
    .flow li { margin: 6px 0; }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      font-size: 0.95em;
    }
    details.group {
      margin-bottom: 18px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }
    summary {
      cursor: pointer;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
      list-style-position: outside;
    }
    summary h2 { display: inline; margin: 0; font-size: 18px; }
    summary p { margin: 8px 0 0; color: var(--muted); }
    .file { border-top: 1px solid var(--line); }
    .file:first-of-type { border-top: 0; }
    .file-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 16px;
      background: #f1ece4;
      border-bottom: 1px solid var(--line);
    }
    .file-head h3 {
      margin: 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    .meta { color: var(--muted); white-space: nowrap; }
    .code-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--code-bg);
      color: var(--code);
      table-layout: fixed;
      font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    }
    .ln {
      width: 62px;
      padding: 0 10px;
      text-align: right;
      vertical-align: top;
      user-select: none;
      background: #101010;
      border-right: 1px solid #2a2a2a;
    }
    .ln a {
      color: #948c80;
      text-decoration: none;
      display: block;
      padding: 1px 0;
    }
    .code {
      vertical-align: top;
      overflow-wrap: anywhere;
    }
    .code pre {
      margin: 0;
      padding: 1px 12px;
      white-space: pre-wrap;
      tab-size: 2;
    }
    tr:target .ln,
    tr:target .code pre {
      background: #3a2a11;
    }
    .content { min-width: 0; }
    @media (max-width: 980px) {
      header { position: static; }
      main { grid-template-columns: 1fr; padding: 18px; }
      nav { position: static; max-height: none; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Validator Flow Review</h1>
    <div class="sub">Generated from current workspace files on ${escapeHtml(new Date().toISOString())}. ${loadedGroups.reduce((sum, group) => sum + group.loadedFiles.length, 0)} files, ${totalLines} total lines.</div>
  </header>
  <main>
    <nav>
      <h2>Contents</h2>
      <ul>${toc}</ul>
    </nav>
    <div class="content">
      <section class="flow">
        <h2>Read This First</h2>
        <ul>${flowBullets.map((item) => `<li>${escapeHtml(item).replace(/`([^`]+)`/g, "<code>$1</code>")}</li>`).join("\n")}</ul>
      </section>
      ${body}
    </div>
  </main>
</body>
</html>
`;

fs.writeFileSync(outPath, html, "utf8");
console.log(outPath);
