#!/usr/bin/env python3
"""
Generate 72 voice samples (24 tempi × 3 scenarios) for a brand via the Anthropic
API, then build a clickable HTML classifier for the operator to pick which
samples feel like the brand. Backward-derives placement from picks.

Usage:
    export ANTHROPIC_API_KEY=...
    python3 gen-samples-and-classifier.py <brand-config.json> <output-dir>

brand-config.json shape:
{
    "brand_name": "Cream of the Crop",
    "brand_slug": "cream",
    "Q1": "The newspaper guy who fucking loves memes...",
    "scenarios": [
        {"idx": 1, "title": "...", "fact": "..."},
        {"idx": 2, "title": "...", "fact": "..."},
        {"idx": 3, "title": "...", "fact": "..."}
    ],
    "model": "claude-sonnet-4-5"  // optional, defaults to Sonnet
}

Outputs to <output-dir>/:
- <slug>-samples.json    # 72 samples + tempi table
- <slug>-classifier.html # clickable UI, opens locally

Open the HTML to pick samples that feel like the brand. Live placement
derivation appears after 5+ picks. Export JSON when done; feed that to
derive-placement.py for the final spec.

Methodology refs:
- methodology-inside-out-interview (sample-recognition > abstract Qs)
- methodology-cadence-by-observation (even initial cadence)
"""
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

# The 24 tempi — constants across all brands. Don't modify here; if you need
# to extend, do it once and propagate.
TEMPI = [
    {"bucket": "near", "name": "materialistic", "motor": "Punching→Slashing", "feel": "Strong/Quick — sudden aggressive intent, sharp declarative"},
    {"bucket": "near", "name": "human", "motor": "Floating→Gliding", "feel": "Light/Sustained — slow tenderness, patient observation"},
    {"bucket": "near", "name": "warm", "motor": "Pressing→Wringing", "feel": "Strong/Sustained — warm consent, extended welcome"},
    {"bucket": "near", "name": "cool", "motor": "Dabbing→Flicking", "feel": "Light/Quick — pert intimacy, brisk one-liner"},
    {"bucket": "stable", "name": "commanding", "motor": "Pressing→Punching", "feel": "Strong/Direct — bold resolve, position-taking"},
    {"bucket": "stable", "name": "receptive", "motor": "Floating→Flicking", "feel": "Light/Flexible — welcoming tenderness"},
    {"bucket": "stable", "name": "practical", "motor": "Wringing→Slashing", "feel": "Strong/Flexible — spell-binding power, analytical"},
    {"bucket": "stable", "name": "self-contained", "motor": "Gliding→Dabbing", "feel": "Light/Direct — gentle deference, neutral note"},
    {"bucket": "adream", "name": "sombre", "motor": "Pressing→Punching", "feel": "Strong/Bound — heavy contained emotion, gravity"},
    {"bucket": "adream", "name": "irradiant", "motor": "Floating→Flicking", "feel": "Light/Free — sympathetic exultation, visible delight"},
    {"bucket": "adream", "name": "overpowering", "motor": "Wringing→Slashing", "feel": "Strong/Free — full-conviction-with-emotion, manifesto"},
    {"bucket": "adream", "name": "diffused", "motor": "Gliding→Dabbing", "feel": "Light/Bound — soft contained welcome"},
    {"bucket": "mobile", "name": "unacknowledged", "motor": "Punching/Slashing", "feel": "Quick/Bound — self-concealed aggression"},
    {"bucket": "mobile", "name": "acknowledged", "motor": "Floating/Gliding", "feel": "Sustained/Free — easy disclosure"},
    {"bucket": "mobile", "name": "revealed", "motor": "Dabbing/Flicking", "feel": "Quick/Free — sudden bright disclosure"},
    {"bucket": "mobile", "name": "concealed", "motor": "Pressing/Wringing", "feel": "Sustained/Bound — withheld weight"},
    {"bucket": "remote", "name": "egocentric", "motor": "Pressing→Punching", "feel": "Direct/Bound — unsociable solitude, cold position"},
    {"bucket": "remote", "name": "altruistic", "motor": "Floating→Flicking", "feel": "Flexible/Free — warm-distant cordiality"},
    {"bucket": "remote", "name": "sociable", "motor": "Gliding→Dabbing", "feel": "Direct/Free — partner credit, ecosystem warmth"},
    {"bucket": "remote", "name": "unsociable", "motor": "Wringing→Slashing", "feel": "Flexible/Bound — withdrawal-as-discipline"},
    {"bucket": "awake", "name": "acute", "motor": "Punching→Dabbing", "feel": "Direct/Quick — acute idea-decision, sharp insight cut"},
    {"bucket": "awake", "name": "doubting", "motor": "Floating→Wringing", "feel": "Flexible/Sustained — slowly dawning doubt"},
    {"bucket": "awake", "name": "certain", "motor": "Pressing→Gliding", "feel": "Direct/Sustained — certain awareness, settled judgement"},
    {"bucket": "awake", "name": "uncertain", "motor": "Flicking→Slashing", "feel": "Flexible/Quick — sudden new idea, what-if framing"},
]


def gen_samples(api_key: str, brand_name: str, q1: str, scenarios: list, model: str = "claude-sonnet-4-5") -> list:
    tempi_block = "\n".join([f"- **{t['name']}** ({t['motor']}) — {t['feel']}" for t in TEMPI])
    scenarios_block = "\n".join([f"{s['idx']}. {s['title']}: {s['fact']}" for s in scenarios])

    system = f"""You are generating brand voice samples for {brand_name} using Veronica Mirodan's voice tempo framework.

CHARACTER (constant across ALL samples):
{q1}

THE 24 TEMPI (each varies the motor signature; the character voice stays the SAME):
{tempi_block}

SCENARIOS:
{scenarios_block}

YOUR JOB: Generate 24 samples PER SCENARIO (= 72 samples total).
Each sample is 2-4 sentences in {brand_name}'s voice, expressing the motor signature of its tempo.
Do NOT pre-commit to any placement. Voice anchor is constant. Motor varies only.

Output STRICT JSON: an array of {{scenario, tempo, sample}} entries — 72 total.
- scenario: 1, 2, or 3
- tempo: one of the 24 names exactly
- sample: 2-4 sentences

No preamble, no markdown fences. Just the JSON array."""

    payload = {
        "model": model,
        "max_tokens": 16000,
        "system": system,
        "messages": [{"role": "user", "content": "Generate all 72 samples now. Output the JSON array."}],
    }

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(payload).encode(),
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            body = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode()[:500]}")

    text = body["content"][0]["text"].strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    try:
        samples = json.loads(text)
    except json.JSONDecodeError as e:
        sys.exit(f"Parse fail: {e}\nFirst 500 chars: {text[:500]}")

    print(f"Got {len(samples)} samples · tokens in={body['usage']['input_tokens']} out={body['usage']['output_tokens']}", file=sys.stderr)
    return samples


def build_html(samples: list, scenarios: list, q1: str, brand_name: str, brand_slug: str) -> str:
    data = {"scenarios": scenarios, "tempi": TEMPI, "samples": samples, "Q1": q1, "brand_name": brand_name}
    samples_json = json.dumps(data).replace("</", "<\\/")
    q1_escaped = q1.replace("\n", " ").replace('"', '&quot;')

    return '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>''' + brand_name + ''' · 24 tempi × 3 scenarios</title>
<style>
  :root { --bg:#0d0e10; --card:#1a1c20; --border:#2a2d33; --text:#e7e8ea; --muted:#8e9197;
          --accent:#FE6F39; --near:#4ade80; --stable:#60a5fa; --adream:#c084fc;
          --mobile:#fb923c; --remote:#94a3b8; --awake:#fde047; }
  * { box-sizing:border-box; }
  body { font:14px/1.5 -apple-system,system-ui,sans-serif; background:var(--bg); color:var(--text); margin:0; }
  header { position:sticky; top:0; z-index:10; background:rgba(13,14,16,0.95); backdrop-filter:blur(8px);
           border-bottom:1px solid var(--border); padding:12px 20px; }
  header h1 { margin:0 0 4px; font-size:16px; font-weight:600; }
  header .q1 { color:var(--muted); font-size:12px; font-style:italic; max-width:900px; }
  .stats { padding:10px 20px; background:#14161a; border-bottom:1px solid var(--border);
           font-family:ui-monospace,monospace; font-size:12px; white-space:pre-wrap; color:var(--muted); }
  .stats strong { color:var(--accent); }
  .controls { padding:8px 20px; border-bottom:1px solid var(--border);
              display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  .controls button { background:var(--card); border:1px solid var(--border); color:var(--text);
                     padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; }
  .controls button:hover { background:#25272d; }
  .controls .danger { color:#ef4444; }
  main { padding:16px 20px 80px; max-width:1400px; margin:0 auto; }
  .scenario { margin-bottom:40px; }
  .scenario h2 { font-size:14px; font-weight:600; margin:0 0 4px; color:var(--accent); }
  .scenario .fact { font-size:12px; color:var(--muted); margin-bottom:14px; font-style:italic; }
  .sample-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
  @media (min-width:1100px) { .sample-grid { grid-template-columns:repeat(3,1fr); } }
  .sample { background:var(--card); border:1px solid var(--border); border-radius:6px; padding:10px;
            cursor:pointer; transition:all 0.15s; }
  .sample:hover { background:#25272d; border-color:#3a3d43; }
  .sample.selected { border-width:2px; padding:9px; }
  .sample.selected[data-bucket="near"] { border-color:var(--near); background:rgba(74,222,128,0.08); }
  .sample.selected[data-bucket="stable"] { border-color:var(--stable); background:rgba(96,165,250,0.08); }
  .sample.selected[data-bucket="adream"] { border-color:var(--adream); background:rgba(192,132,252,0.08); }
  .sample.selected[data-bucket="mobile"] { border-color:var(--mobile); background:rgba(251,146,60,0.08); }
  .sample.selected[data-bucket="remote"] { border-color:var(--remote); background:rgba(148,163,184,0.08); }
  .sample.selected[data-bucket="awake"] { border-color:var(--awake); background:rgba(253,224,71,0.08); }
  .sample-tempo { font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:0.08em;
                  font-family:ui-monospace,monospace; }
  .sample-tempo[data-bucket="near"] { color:var(--near); }
  .sample-tempo[data-bucket="stable"] { color:var(--stable); }
  .sample-tempo[data-bucket="adream"] { color:var(--adream); }
  .sample-tempo[data-bucket="mobile"] { color:var(--mobile); }
  .sample-tempo[data-bucket="remote"] { color:var(--remote); }
  .sample-tempo[data-bucket="awake"] { color:var(--awake); }
  .sample-text { font-size:13px; margin-top:6px; line-height:1.45; }
  .legend-dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:4px; vertical-align:middle; }
</style>
</head>
<body>
<header>
  <h1>''' + brand_name + ''' — voice recon · 3 scenarios × 24 tempi</h1>
  <div class="q1">Q1: ''' + q1_escaped + '''</div>
</header>
<div class="controls">
  <span id="progressText" style="color:var(--muted)">0 selected</span>
  <button onclick="exportJSON()">Export JSON</button>
  <button onclick="resetAll()" class="danger">Reset</button>
  <span style="margin-left:auto;color:var(--muted);font-size:11px">
    <span class="legend-dot" style="background:var(--near)"></span>Near
    <span class="legend-dot" style="background:var(--stable);margin-left:8px"></span>Stable
    <span class="legend-dot" style="background:var(--adream);margin-left:8px"></span>Adream
    <span class="legend-dot" style="background:var(--mobile);margin-left:8px"></span>Mobile
    <span class="legend-dot" style="background:var(--remote);margin-left:8px"></span>Remote
    <span class="legend-dot" style="background:var(--awake);margin-left:8px"></span>Awake
  </span>
</div>
<div class="stats" id="stats">Click samples that feel like the brand's voice. Backward-derived placement appears once you've picked at least 5 across all 3 scenarios.</div>
<main id="main"></main>
<script>
const DATA = ''' + samples_json + ''';
const BUCKETS = ["near","stable","adream","mobile","remote","awake"];
const BUCKET_LABEL = {near:"Near",stable:"Stable",adream:"Adream",mobile:"Mobile",remote:"Remote",awake:"Awake"};
const BUCKET_OF = Object.fromEntries(DATA.tempi.map(t => [t.name, t.bucket]));

const STORE = "''' + brand_slug + '''-picks-v1";
let picks = JSON.parse(localStorage.getItem(STORE) || "{}");

function save(){ localStorage.setItem(STORE, JSON.stringify(picks)); recompute(); }

function toggle(scenario, tempo){
  const key = scenario + "-" + tempo;
  if (picks[key]) delete picks[key]; else picks[key] = true;
  save();
  document.getElementById("sample-" + key).classList.toggle("selected", !!picks[key]);
}

function recompute(){
  const total = Object.keys(picks).length;
  document.getElementById("progressText").textContent = `${total} selected`;
  const counts = {};
  DATA.tempi.forEach(t => counts[t.name] = 0);
  Object.keys(picks).forEach(k => {
    const tempo = k.split("-").slice(1).join("-");
    counts[tempo] = (counts[tempo]||0) + 1;
  });
  const bucketTotal = {};
  BUCKETS.forEach(b => bucketTotal[b] = DATA.tempi.filter(t=>t.bucket===b).reduce((s,t)=>s+(counts[t.name]||0),0));
  let txt = `<strong>Selections (${total} total):</strong>\\n\\n`;
  txt += `  Near: ${bucketTotal.near}  ·  Stable: ${bucketTotal.stable}  ·  Adream: ${bucketTotal.adream}\\n`;
  txt += `  Mobile: ${bucketTotal.mobile}  ·  Remote: ${bucketTotal.remote}  ·  Awake: ${bucketTotal.awake}\\n`;
  if (total >= 5) {
    const baselines = {near:bucketTotal.near, stable:bucketTotal.stable, adream:bucketTotal.adream};
    const baseline = Object.entries(baselines).sort((a,b)=>b[1]-a[1])[0][0];
    const outers = {mobile:bucketTotal.mobile, remote:bucketTotal.remote, awake:bucketTotal.awake};
    const STRESS = {
      "near-stable":"space","near-awake":"space","near-adream":"flow","near-mobile":"flow",
      "stable-near":"time","stable-awake":"time","stable-adream":"flow","stable-remote":"flow",
      "adream-near":"time","adream-mobile":"time","adream-stable":"space","adream-remote":"space",
    };
    const fires = [];
    Object.entries(outers).forEach(([k,v]) => { if (v>0) fires.push({a:k,c:v}); });
    Object.entries(baselines).forEach(([k,v]) => { if (v>0 && k !== baseline) fires.push({a:k,c:v}); });
    const votes = {};
    fires.forEach(f => { const s = STRESS[`${baseline}-${f.a}`]; if (s) votes[s] = (votes[s]||0)+f.c; });
    const stress = Object.entries(votes).sort((a,b)=>b[1]-a[1])[0]?.[0] || "?";
    const top5 = Object.entries(counts).filter(([k,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,5);
    txt += `\\n<strong>Derived: ${baseline.toUpperCase()} + ${stress.toUpperCase()}-STRESSED</strong>\\n`;
    txt += `  Top tempi: ${top5.map(([k,v])=>k+" "+v).join(" · ")}\\n`;
  }
  document.getElementById("stats").innerHTML = txt;
}

function exportJSON(){
  const out = {brand:"''' + brand_slug + '''", picks, picked_tempi_per_scenario: (() => {
    const out = {1:[], 2:[], 3:[]};
    Object.keys(picks).forEach(k => { const [sc, ...rest] = k.split("-"); out[sc].push(rest.join("-")); });
    return out;
  })()};
  const blob = new Blob([JSON.stringify(out,null,2)],{type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "''' + brand_slug + '''-picks.json";
  a.click();
}

function resetAll(){
  if (!confirm("Reset all picks?")) return;
  picks = {}; save();
  document.querySelectorAll(".sample").forEach(s => s.classList.remove("selected"));
}

function renderAll(){
  const main = document.getElementById("main");
  main.innerHTML = DATA.scenarios.map(sc => {
    const scSamples = DATA.samples.filter(s => s.scenario === sc.idx);
    const tempiOrder = Object.fromEntries(DATA.tempi.map((t,i) => [t.name,i]));
    scSamples.sort((a,b) => (tempiOrder[a.tempo]||999) - (tempiOrder[b.tempo]||999));
    return `<section class="scenario">
      <h2>Scenario ${sc.idx}: ${sc.title}</h2>
      <div class="fact">${sc.fact}</div>
      <div class="sample-grid">
        ${scSamples.map(s => {
          const t = DATA.tempi.find(t => t.name === s.tempo);
          const bucket = t ? t.bucket : "skip";
          const motor = t ? t.motor : "";
          const key = sc.idx + "-" + s.tempo;
          const isSelected = !!picks[key];
          return `<div class="sample ${isSelected?'selected':''}" id="sample-${key}" data-bucket="${bucket}" onclick="toggle(${sc.idx},'${s.tempo}')">
            <div class="sample-tempo" data-bucket="${bucket}">${s.tempo} · ${motor}</div>
            <div class="sample-text">${s.sample.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
          </div>`;
        }).join("")}
      </div>
    </section>`;
  }).join("");
}
renderAll(); recompute();
</script>
</body>
</html>'''


def main():
    if len(sys.argv) != 3:
        sys.exit("usage: gen-samples-and-classifier.py <brand-config.json> <output-dir>")
    config_path, out_dir = sys.argv[1], sys.argv[2]
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        sys.exit("ANTHROPIC_API_KEY not set")

    config = json.load(open(config_path))
    brand_name = config["brand_name"]
    brand_slug = config["brand_slug"]
    q1 = config["Q1"]
    scenarios = config["scenarios"]
    model = config.get("model", "claude-sonnet-4-5")
    if len(scenarios) != 3:
        sys.exit(f"need exactly 3 scenarios; got {len(scenarios)}")

    Path(out_dir).mkdir(parents=True, exist_ok=True)
    print(f"Generating 72 samples for {brand_name} via {model}...", file=sys.stderr)
    samples = gen_samples(api_key, brand_name, q1, scenarios, model)

    samples_out = Path(out_dir) / f"{brand_slug}-samples.json"
    with open(samples_out, "w") as f:
        json.dump({"scenarios": scenarios, "tempi": TEMPI, "samples": samples, "Q1": q1, "brand_name": brand_name}, f, indent=2)
    print(f"Wrote {samples_out}", file=sys.stderr)

    html = build_html(samples, scenarios, q1, brand_name, brand_slug)
    html_out = Path(out_dir) / f"{brand_slug}-classifier.html"
    with open(html_out, "w") as f:
        f.write(html)
    print(f"Wrote {html_out}", file=sys.stderr)

    print(f"\nOpen the classifier: open {html_out}", file=sys.stderr)
    print(f"Or run: python3 -m http.server -d {out_dir}", file=sys.stderr)


if __name__ == "__main__":
    main()
