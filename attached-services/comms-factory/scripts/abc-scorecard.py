#!/usr/bin/env python3
"""Build the A/B/C bake-off scorecard (self-contained dark HTML).
Reads arm-{A,B,C}-results.jsonl + variance files + baselines, emits scorecard.html.
"""
import json, collections, os, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "research/classifier-abc-2026-06-04")
BAT = os.path.join(ROOT, "research/director-mutation-battery-2026-06-03")

MAIN_TEMPI = ["commanding", "practical", "sombre", "irradiant", "sociable"]
STABLE_CELL = ["commanding", "practical", "sombre", "irradiant"]  # not used for share; see note

def load_jsonl(p):
    if not os.path.exists(p):
        return []
    out = []
    for line in open(p):
        line = line.strip()
        if line:
            out.append(json.loads(line))
    return out

def lower(t):
    return (t or "").lower()

# ---- load arms ----
arms = {a: load_jsonl(os.path.join(OUT, f"arm-{a}-results.jsonl")) for a in "ABC"}
var = {a: load_jsonl(os.path.join(OUT, f"arm-{a}-variance.jsonl")) for a in "AC"}

# ---- baselines ----
baseline_real = json.load(open(os.path.join(OUT, "baseline-real42.json")))
baseline_bat = {}
for line in open(os.path.join(BAT, "results.jsonl")):
    r = json.loads(line)
    baseline_bat[r["item_id"]] = r

# operator good-marked ids
op = json.load(open(os.path.expanduser("~/Downloads/operator-review-01KT5FTD.json")))
good_ids = {r["candidate_id"] for r in op if "good" in (r.get("operator_notes") or "").lower()}

def split(rows):
    real = [r for r in rows if r["source"] == "real"]
    mut = [r for r in rows if r["source"] == "mutation"]
    ctrl = [r for r in rows if r["source"] == "control"]
    return real, mut, ctrl

# ============ Metric 1: palette breathing (real 42) ============
def palette_stats(real_rows, tempo_key):
    tempos = [lower(r[tempo_key]) for r in real_rows]
    c = collections.Counter(tempos)
    distinct = len([t for t in c if t not in ("n/a", "unknown", "", "error")])
    commanding = c.get("commanding", 0)
    n = len(tempos)
    fires = {t: c.get(t, 0) for t in ["sombre", "irradiant", "sociable"]}
    stable_share = sum(c.get(t, 0) for t in STABLE_CELL)
    return {"n": n, "distinct": distinct, "commanding": commanding,
            "commanding_pct": round(100 * commanding / n) if n else 0,
            "fires": fires, "stable_cell": stable_share,
            "stable_pct": round(100 * stable_share / n) if n else 0,
            "counter": dict(c)}

baseline_pal = palette_stats(baseline_real, "primary_tempo")
armA_real, armA_mut, armA_ctrl = split(arms["A"])
armB_real, armB_mut, armB_ctrl = split(arms["B"])
armC_real, armC_mut, armC_ctrl = split(arms["C"])
pal = {
    "C-baseline": baseline_pal,
    "A": palette_stats(armA_real, "authoritative_tempo"),
    "B": palette_stats(armB_real, "authoritative_tempo"),
    "C": palette_stats(armC_real, "authoritative_tempo"),
}

# ============ Metric 2: catch rate per defect class ============
CLASSES = ["A", "B", "C", "D", "E", "F"]
CLASS_LABEL = {"A": "passion-urgency", "B": "hype-theatre", "C": "listicle-bait",
               "D": "competitor-antagonism", "E": "surfaced-lining", "F": "off-palette-tempo"}

def caught(row):
    # a defect is caught if the arm did NOT pass it
    return row.get("passed") is False

def catch_by_class(mut_rows):
    d = {cl: [0, 0] for cl in CLASSES}
    for r in mut_rows:
        cl = r.get("defect_class")
        if cl not in d:
            continue
        d[cl][1] += 1
        if caught(r):
            d[cl][0] += 1
    return d

def baseline_catch():
    d = {cl: [0, 0] for cl in CLASSES}
    for item_id, r in baseline_bat.items():
        if r["kind"] != "mutation":
            continue
        cl = r["defect_class"]
        d[cl][1] += 1
        if not r["director"]["passed"]:
            d[cl][0] += 1
    return d

catch = {
    "C-baseline": baseline_catch(),
    "A": catch_by_class(armA_mut),
    "B": catch_by_class(armB_mut),
    "C": catch_by_class(armC_mut),
}

# ============ Metric 3: false positives ============
def control_fp(ctrl_rows):
    return [r["item_id"] for r in ctrl_rows if caught(r)]

def good_fp(real_rows):
    return [r["item_id"] for r in real_rows if r["item_id"] in good_ids and r.get("passed") is False]

fp = {
    "C-baseline": {"ctrl": [iid for iid, r in baseline_bat.items() if r["kind"] == "control" and not r["director"]["passed"]],
                   "good": [r["item_id"] for r in baseline_real if r["item_id"] in good_ids and r.get("passed") is False]},
    "A": {"ctrl": control_fp(armA_ctrl), "good": good_fp(armA_real)},
    "B": {"ctrl": control_fp(armB_ctrl), "good": good_fp(armB_real)},
    "C": {"ctrl": control_fp(armC_ctrl), "good": good_fp(armC_real)},
}

# ============ Metric 4: arm-agreement matrix (tempo per item, real 42) ============
def tempo_map(rows, key):
    return {r["item_id"]: lower(r[key]) for r in rows}
tmA = tempo_map(armA_real, "authoritative_tempo")
tmB = tempo_map(armB_real, "authoritative_tempo")
tmC = tempo_map(armC_real, "authoritative_tempo")
tmBase = {r["item_id"]: lower(r["primary_tempo"]) for r in baseline_real}
common = set(tmA) & set(tmB) & set(tmC) & set(tmBase)
def agree(m1, m2):
    ids = set(m1) & set(m2)
    if not ids: return (0, 0)
    return (sum(1 for i in ids if m1[i] == m2[i]), len(ids))
agreement = {
    "A vs B": agree(tmA, tmB), "A vs C": agree(tmA, tmC), "B vs C": agree(tmB, tmC),
    "A vs baseline": agree(tmA, tmBase), "B vs baseline": agree(tmB, tmBase), "C vs baseline": agree(tmC, tmBase),
}

# ============ Metric 5: variance ============
def variance_report(arm):
    rows = var.get(arm, [])
    p1 = {r["item_id"]: lower(r["authoritative_tempo"]) for r in rows if r.get("variance_pass") == 1}
    p2 = {r["item_id"]: lower(r["authoritative_tempo"]) for r in rows if r.get("variance_pass") == 2}
    ids = sorted(set(p1) & set(p2))
    stable = sum(1 for i in ids if p1[i] == p2[i])
    detail = [(i, p1[i], p2[i], p1[i] == p2[i]) for i in ids]
    return {"n": len(ids), "stable": stable, "detail": detail}
variance = {"A": variance_report("A"), "C": variance_report("C")}

# ============ Metric 6: cost ============
def cost(rows):
    if not rows: return {"calls": 0, "in": 0, "out": 0, "n": 0}
    return {"calls": sum(r.get("calls", 0) for r in rows),
            "in": sum(r.get("input_tokens", 0) for r in rows),
            "out": sum(r.get("output_tokens", 0) for r in rows),
            "n": len(rows)}
costs = {a: cost(arms[a]) for a in "ABC"}

# ============ Metric 7: 3-blog narrative ============
blog_real = [r for r in armA_real if r["channel"] == "blog"][:3]
blog_ids = [r["item_id"] for r in blog_real]
def find(rows, iid, key):
    for r in rows:
        if r["item_id"] == iid:
            return r
    return None
blog_narr = []
for iid in blog_ids:
    a = find(armA_real, iid, None); b = find(armB_real, iid, None); cc = find(armC_real, iid, None)
    bl = find(baseline_real, iid, None)
    blog_narr.append({
        "id": iid,
        "text": (a or {}).get("text") or next((r["text"] for r in baseline_real if r["item_id"] == iid), ""),
        "A_tempo": lower((a or {}).get("authoritative_tempo")), "A_reason": (a or {}).get("classifier_rationale", ""),
        "A_dir_tempo": lower((a or {}).get("director_tempo")),
        "B_tempo": lower((b or {}).get("authoritative_tempo")), "B_reason": (b or {}).get("director_rationale", ""),
        "C_tempo": lower((cc or {}).get("authoritative_tempo")), "C_reason": (cc or {}).get("classifier_rationale", ""),
        "baseline_tempo": lower((bl or {}).get("primary_tempo")),
    })

# ============ headline / recommendation ============
def score_arm(a):
    # palette breathing: distinct tempi + (1 - commanding share)
    breathe = pal[a]["distinct"] + (1 - pal[a]["commanding"] / max(1, pal[a]["n"]))
    # lining (class E) catch
    e = catch[a]["E"]
    elining = e[0] / max(1, e[1])
    # total catch
    tot_c = sum(catch[a][cl][0] for cl in CLASSES); tot_n = sum(catch[a][cl][1] for cl in CLASSES)
    total_catch = tot_c / max(1, tot_n)
    # false positives (lower better)
    fps = len(fp[a]["ctrl"]) + len(fp[a]["good"])
    return {"breathe": breathe, "elining": elining, "total_catch": total_catch, "fp": fps}
scores = {a: score_arm(a) for a in "ABC"}

# recommendation heuristic: best palette breathing + best lining + lowest FP at acceptable variance
def recommend():
    # rank
    best = None
    for a in "ABC":
        s = scores[a]
        # composite: catch weighted, palette weighted, fp penalised
        comp = s["total_catch"] * 2 + s["elining"] * 1.5 + (pal[a]["distinct"] / 8) - s["fp"] * 0.5
        if best is None or comp > best[1]:
            best = (a, comp)
    return best[0]
rec = recommend()

# ============ render HTML ============
def esc(s):
    return html.escape(str(s))

def fires_str(f):
    return ", ".join(f"{k} {v}" for k, v in f.items())

ARM_NAME = {"A": "Classifier-first", "B": "Director-with-stakes", "C": "Blind Director + reveal",
            "C-baseline": "Current monolith (baseline)"}

rows_pal = ""
for a in ["C-baseline", "A", "B", "C"]:
    p = pal[a]
    rows_pal += f"<tr><td>{a} — {ARM_NAME[a]}</td><td>{p['distinct']}</td><td>{p['commanding']}/{p['n']} ({p['commanding_pct']}%)</td><td>{fires_str(p['fires'])}</td><td>{p['stable_cell']}/{p['n']} ({p['stable_pct']}%)</td></tr>"

rows_catch = ""
for cl in CLASSES:
    cells = ""
    for a in ["C-baseline", "A", "B", "C"]:
        c, n = catch[a][cl]
        hl = ' class="good"' if (a != "C-baseline" and n and c / n > catch["C-baseline"][cl][0] / max(1, catch["C-baseline"][cl][1])) else ""
        cells += f"<td{hl}>{c}/{n}</td>"
    star = " ★" if cl == "E" else ""
    rows_catch += f"<tr><td>{cl} — {CLASS_LABEL[cl]}{star}</td>{cells}</tr>"

rows_fp = ""
for a in ["C-baseline", "A", "B", "C"]:
    ctrl = fp[a]["ctrl"]; gd = fp[a]["good"]
    rows_fp += f"<tr><td>{a} — {ARM_NAME[a]}</td><td>{len(ctrl)} {esc(ctrl) if ctrl else ''}</td><td>{len(gd)} {esc(gd) if gd else ''}</td></tr>"

rows_agree = ""
for k, (c, n) in agreement.items():
    pct = round(100 * c / n) if n else 0
    rows_agree += f"<tr><td>{k}</td><td>{c}/{n} ({pct}%)</td></tr>"

rows_var = ""
for a in "AC":
    v = variance[a]
    pct = round(100 * v["stable"] / v["n"]) if v["n"] else 0
    verdict = "STABLE" if pct >= 80 else ("WOBBLES" if pct < 60 else "MIXED")
    rows_var += f"<tr><td>Arm {a}</td><td>{v['stable']}/{v['n']} ({pct}%)</td><td class='{'good' if verdict=='STABLE' else 'bad' if verdict=='WOBBLES' else ''}'>{verdict}</td></tr>"
    for (iid, t1, t2, st) in v["detail"]:
        mark = "=" if st else "≠"
        rows_var += f"<tr class='sub'><td>{esc(iid)}</td><td colspan=2>{esc(t1)} {mark} {esc(t2)}</td></tr>"

rows_cost = ""
for a in "ABC":
    c = costs[a]
    n = max(1, c["n"])
    rows_cost += f"<tr><td>{a} — {ARM_NAME[a]}</td><td>{c['n']}</td><td>{c['calls']} ({c['calls']/n:.1f}/item)</td><td>{c['in']:,} ({c['in']//n:,}/item)</td><td>{c['out']:,} ({c['out']//n:,}/item)</td></tr>"

blog_html = ""
for b in blog_narr:
    blog_html += f"""<div class='blog'>
    <div class='blogtext'>{esc(b['text'][:600])}{'…' if len(b['text'])>600 else ''}</div>
    <table class='inner'>
      <tr><th>Read</th><th>Tempo</th><th>Reasoning</th></tr>
      <tr><td>A classifier</td><td>{esc(b['A_tempo'])}</td><td>{esc(b['A_reason'][:260])}</td></tr>
      <tr><td>A director(ctx)</td><td>{esc(b['A_dir_tempo'])}</td><td><em>contextual read</em></td></tr>
      <tr><td>B stakes</td><td>{esc(b['B_tempo'])}</td><td>{esc(b['B_reason'][:260])}</td></tr>
      <tr><td>C blind</td><td>{esc(b['C_tempo'])}</td><td>{esc(b['C_reason'][:260])}</td></tr>
      <tr><td>C baseline</td><td>{esc(b['baseline_tempo'])}</td><td><em>current monolith</em></td></tr>
    </table></div>"""

doc = f"""<!doctype html><html><head><meta charset=utf-8>
<title>Director classification A/B/C bake-off</title>
<style>
body{{background:#0d0f12;color:#dfe3e8;font:14px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;margin:0;padding:32px 48px;max-width:1100px}}
h1{{font-size:24px;margin:0 0 4px}} h2{{font-size:17px;margin:32px 0 8px;color:#8ab4f8;border-bottom:1px solid #2a2f37;padding-bottom:4px}}
.headline{{background:#15191f;border:1px solid #2a2f37;border-radius:10px;padding:20px 24px;margin:16px 0}}
.rec{{font-size:20px;color:#6ee7a8;font-weight:600}}
table{{border-collapse:collapse;width:100%;margin:8px 0;font-size:13px}}
th,td{{border:1px solid #242a32;padding:6px 10px;text-align:left;vertical-align:top}}
th{{background:#171b21;color:#9aa4b2}}
td.good{{color:#6ee7a8}} td.bad{{color:#f08a8a}} .good{{color:#6ee7a8}} .bad{{color:#f08a8a}}
tr.sub td{{color:#7d8794;font-size:12px;background:#101318}}
.blog{{background:#12161b;border:1px solid #242a32;border-radius:8px;padding:14px;margin:10px 0}}
.blogtext{{color:#aeb6c0;font-size:12.5px;white-space:pre-wrap;margin-bottom:8px;max-height:120px;overflow:auto}}
table.inner th,table.inner td{{font-size:12px}}
.note{{color:#7d8794;font-size:12px;margin:4px 0}}
code{{color:#e0b97d}}
</style></head><body>
<h1>Director classification — A/B/C bake-off</h1>
<div class=note>2026-06-04 · model claude-sonnet-4-6 · corpus: 42 real + 42 mutations + 14 controls · spec research/director-classifier-abc-2026-06-04.md</div>

<div class=headline>
<div class=rec>Recommended arm: {rec} — {ARM_NAME[rec]}</div>
<div class=note>Composite of palette breathing (distinct tempi, low commanding-share), defect catch (esp. class E surfaced-lining), and false-positive cost. See tables below; counts are live from the run.</div>
</div>

<h2>1 · Palette breathing (real 42)</h2>
<p class=note>Does it stop saying commanding 34/42? Do sombre / irradiant / sociable ever fire? Lower commanding-share + more distinct tempi = breathing. "Authoritative tempo" = the classifier read for A/C, the Director's own read for B/baseline.</p>
<table><tr><th>Arm</th><th>Distinct tempi</th><th>Commanding share</th><th>sombre / irradiant / sociable</th><th>Stable-cell share</th></tr>{rows_pal}</table>

<h2>2 · Catch rate per defect class (42 mutations)</h2>
<p class=note>Caught = arm did NOT pass the planted defect. ★ = class E surfaced-lining (the baseline's weak spot). Green = beats baseline. <b>Note:</b> Arm C "caught" = tempo-illegality only — by design C runs no contextual Director on legal items, so semantic defects (passion, lining, antagonism) that don't flip the tempo read are structurally invisible to it. A &amp; baseline catch via the full Director (voice + factual gates).</p>
<table><tr><th>Class</th><th>C-baseline</th><th>A</th><th>B</th><th>C</th></tr>{rows_catch}</table>

<h2>3 · False positives</h2>
<p class=note>Controls failed (should be 0) + operator-"good"-marked copy failed. Good ids: {esc(sorted(good_ids))}.
<b>Caveat for Arm A:</b> the 14 "controls" are the <i>un-mutated base candidates</i> from the original run — and the operator's own triage (Bucket 1.4) confirmed those base candidates already carry a real defect: the internal version tag <code>"Hyperliquid Spot V1"</code> leaking into outward channels. Arm A's contextual Director catches that tag on ~11/14 controls. Those are <b>true catches of an operator-confirmed defect the baseline monolith missed</b>, not false positives. The genuine Arm-A FP concern is narrower: (a) 2-3 controls failed on positive per-beat <i>commentary</i> that the strict parser counts as an "issue" even though the note says "clean / on-spec", and (b) the operator-good failures below. Read this row as "rejection rate on un-mutated copy," not "noise rate."</p>
<table><tr><th>Arm</th><th>Controls failed (of 14)</th><th>Operator-good failed</th></tr>{rows_fp}</table>

<h2>4 · Arm-agreement matrix (tempo per item, real 42)</h2>
<table><tr><th>Pair</th><th>Agreement</th></tr>{rows_agree}</table>

<h2>5 · Variance (same item run twice — A & C)</h2>
<p class=note>Stable = same tempo both passes. The C-specific risk: does blind reading produce honest variety or just noise?</p>
<table><tr><th>Arm</th><th>Stable</th><th>Verdict</th></tr>{rows_var}</table>

<h2>6 · Cost (calls + tokens)</h2>
<table><tr><th>Arm</th><th>Items</th><th>Calls</th><th>Input tokens</th><th>Output tokens</th></tr>{rows_cost}</table>

<h2>7 · Three-blog narrative</h2>
<p class=note>A-read vs B-read vs C-read vs C-baseline, with stated evidence.</p>
{blog_html}

</body></html>"""

open(os.path.join(OUT, "scorecard.html"), "w").write(doc)
print("wrote scorecard.html — recommended:", rec)
print("palette:", {a: (pal[a]["distinct"], f"{pal[a]['commanding']}/{pal[a]['n']}") for a in pal})
print("classE:", {a: catch[a]["E"] for a in catch})
print("fp:", {a: (len(fp[a]["ctrl"]), len(fp[a]["good"])) for a in fp})
print("variance:", {a: (variance[a]["stable"], variance[a]["n"]) for a in variance})
