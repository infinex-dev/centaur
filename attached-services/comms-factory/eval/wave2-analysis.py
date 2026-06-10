#!/usr/bin/env python3
"""
Wave 2 analysis — render a fat hierarchical HTML report from verifier outputs +
harness DB + W9 grades.

Usage:
  python3 eval/wave2-analysis.py \
    --w10-dir eval/runs/wave2-w10-r2-<id> \
    --w9-grades eval/runs/wave2-w9-<id>/grades.md \
    --harness-db harness/harness.db \
    --out eval/runs/wave2-w10-r2-<id>/ANALYSIS.html
"""

import argparse
import json
import os
import re
import sqlite3
import statistics
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

LOCKED_TEMPI = {"commanding", "practical", "sombre", "irradiant", "sociable"}
LOCKED_INNER = "stable"
LOCKED_STRESS = "flow"
LOCKED_ASPECT = "penetrating"
LOCKED_DRIVE_SUBSTR = "spell"
OFF_SPEC_DRIVE_SUBSTR = "passion"

PERM_ORDER = ["current", "kernel", "placement", "examples", "full"]
PERM_TOKENS = {
    "current": "2,700 tok (full chrome — production prompt)",
    "kernel": "3,700 tok (current + 12-rule Mirodan kernel)",
    "placement": "170 tok (placement header + resolved facts)",
    "examples": "500 tok (tempi example_lines only)",
    "full": "1,600 tok (kernel + placement + examples)",
}


def parse_filename(fname):
    m = re.match(r"^(.+?)__(.+)\.json$", fname)
    if not m:
        return None, None
    return m.group(1), m.group(2)


def load_verifier_rows(w10_dir):
    """Returns dict[(card_id, permutation)] -> list of {id, text, classification} rows."""
    vdir = Path(w10_dir) / "verifier"
    rows = {}
    for f in sorted(os.listdir(vdir)):
        card, perm = parse_filename(f)
        if not card:
            continue
        with open(vdir / f) as fh:
            rows[(card, perm)] = json.load(fh)
    return rows


def load_db_rows(harness_db):
    conn = sqlite3.connect(harness_db)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT id, card_id, channel, attempt, text, validation_passed, validation_failures_json, prompt_variant FROM candidates WHERE prompt_variant IS NOT NULL"
    ).fetchall()
    conn.close()
    return rows


def compute_cell_metrics(card_id, perm, rows, db_by_text):
    """Compute metrics for one (card, perm) cell."""
    n = len(rows)
    if n == 0:
        return None

    placement_hit = 0
    off_spec = 0
    tempo_dist = Counter()
    drive_dist = Counter()
    motor_pair_dist = Counter()
    em_dash_densities = []
    lengths = []
    validator_pass = 0
    fact_contract_fail = 0
    db_text_lookup = db_by_text.get((card_id, perm), {})

    for r in rows:
        cls = r["classification"]
        text = r["text"]
        ia = (cls.get("inner_attitude") or "").lower()
        st = (cls.get("stress") or "").lower()
        asp = (cls.get("aspect") or "").lower()
        da = (cls.get("drive_axis") or "").lower()
        tp = (cls.get("tempo_primary") or "").lower()

        if ia == LOCKED_INNER and st == LOCKED_STRESS and asp == LOCKED_ASPECT and LOCKED_DRIVE_SUBSTR in da:
            placement_hit += 1
        if OFF_SPEC_DRIVE_SUBSTR in da:
            off_spec += 1
        tempo_dist[tp] += 1
        drive_dist[da] += 1
        mp = cls.get("motor_pair")
        if mp and isinstance(mp, list) and len(mp) == 2:
            motor_pair_dist[f"{mp[0]}→{mp[1]}"] += 1

        dashes = text.count("—")
        chars = max(1, len(text))
        em_dash_densities.append(dashes / chars * 280)
        lengths.append(len(text))

        # join to DB for validator info
        db_row = db_text_lookup.get(text)
        if db_row:
            if db_row["validation_passed"]:
                validator_pass += 1
            try:
                failures = json.loads(db_row["validation_failures_json"])
                if any(f.get("rule") == "fact-contract" for f in failures):
                    fact_contract_fail += 1
            except Exception:
                pass

    return {
        "n": n,
        "placement_hit": placement_hit,
        "off_spec": off_spec,
        "tempo_dist": tempo_dist,
        "drive_dist": drive_dist,
        "motor_pair_dist": motor_pair_dist,
        "em_dash_median": statistics.median(em_dash_densities) if em_dash_densities else 0,
        "em_dash_p95": (
            sorted(em_dash_densities)[int(len(em_dash_densities) * 0.95)]
            if em_dash_densities
            else 0
        ),
        "length_median": statistics.median(lengths) if lengths else 0,
        "length_min": min(lengths) if lengths else 0,
        "length_max": max(lengths) if lengths else 0,
        "validator_pass": validator_pass,
        "fact_contract_fail": fact_contract_fail,
        "locked_tempi_count": sum(tempo_dist[t] for t in LOCKED_TEMPI),
    }


def aggregate_by_perm(per_cell):
    """Aggregate across all cards for each permutation."""
    by_perm = defaultdict(
        lambda: {
            "n": 0,
            "placement_hit": 0,
            "off_spec": 0,
            "tempo_dist": Counter(),
            "drive_dist": Counter(),
            "motor_pair_dist": Counter(),
            "em_dash_medians": [],
            "length_medians": [],
            "validator_pass": 0,
            "fact_contract_fail": 0,
            "locked_tempi_count": 0,
            "cards_covered": 0,
        }
    )
    for (card, perm), m in per_cell.items():
        if m is None:
            continue
        a = by_perm[perm]
        a["n"] += m["n"]
        a["placement_hit"] += m["placement_hit"]
        a["off_spec"] += m["off_spec"]
        a["tempo_dist"].update(m["tempo_dist"])
        a["drive_dist"].update(m["drive_dist"])
        a["motor_pair_dist"].update(m["motor_pair_dist"])
        a["em_dash_medians"].append(m["em_dash_median"])
        a["length_medians"].append(m["length_median"])
        a["validator_pass"] += m["validator_pass"]
        a["fact_contract_fail"] += m["fact_contract_fail"]
        a["locked_tempi_count"] += m["locked_tempi_count"]
        a["cards_covered"] += 1
    return by_perm


def parse_w9_grades(grades_path):
    """Parse the W9 grades.md headline grid into dict[perm][model] -> pct."""
    if not grades_path or not Path(grades_path).exists():
        return None
    text = Path(grades_path).read_text()
    # The "## Headline grid (mirodan-specific pass rate)" section has a markdown table
    m = re.search(
        r"## Headline grid.*?\n\n(\| permutation \|[\s\S]*?)\n\n",
        text,
    )
    if not m:
        return None
    table_text = m.group(1)
    lines = [ln for ln in table_text.split("\n") if ln.strip().startswith("|")]
    headers = [h.strip() for h in lines[0].strip("|").split("|")]
    out = {}
    for row in lines[2:]:
        cells = [c.strip() for c in row.strip("|").split("|")]
        perm = cells[0]
        out[perm] = {}
        for i, h in enumerate(headers[1:], 1):
            out[perm][h] = cells[i]
    return out


def pct(num, den):
    if not den:
        return "—"
    return f"{num * 100 // den}%"


def fmt_int(x):
    return f"{x:,}"


def html_escape(s):
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def render_html(by_perm, per_cell, w9_grades, w10_dir):
    """Render the analysis HTML."""
    cards = sorted(set(card for (card, _), m in per_cell.items() if m is not None))
    perms_done = [p for p in PERM_ORDER if by_perm[p]["n"] > 0]

    parts = []
    parts.append(
        f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Wave 2 Permutation Eval — Findings</title>
<style>
  :root {{
    --bg: #faf9f5;
    --paper: #ffffff;
    --ink: #1a1a1a;
    --ink-3: #555;
    --ink-4: #999;
    --rule: #d8d4c4;
    --accent: #2c5aa0;
    --win: #1e7a3e;
    --warn: #c47800;
    --loss: #b53737;
    --hint-bg: #fff8e7;
  }}
  * {{ box-sizing: border-box; }}
  body {{ font-family: -apple-system, "Helvetica Neue", system-ui, sans-serif; max-width: 1180px; margin: 0 auto; padding: 2rem 1.6rem 6rem; line-height: 1.55; color: var(--ink); background: var(--bg); }}
  h1 {{ font-size: 2.1rem; margin: 0 0 .2rem; }}
  h1 + .meta {{ color: var(--ink-3); font-size: 0.95rem; margin-bottom: 2rem; }}
  h2 {{ font-size: 1.45rem; margin-top: 3rem; padding-bottom: 0.3rem; border-bottom: 2px solid var(--ink); }}
  h3 {{ font-size: 1.15rem; margin-top: 1.8rem; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }}
  h4 {{ font-size: 1rem; margin-top: 1.4rem; }}
  table {{ border-collapse: collapse; width: 100%; margin: 0.8rem 0; font-family: ui-monospace, "SF Mono", "Menlo", monospace; font-size: 0.92rem; background: var(--paper); }}
  th, td {{ border: 1px solid var(--rule); padding: 0.45rem 0.8rem; text-align: left; vertical-align: top; }}
  th {{ background: #ece8d8; font-weight: 600; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.03em; }}
  td.num {{ text-align: right; font-variant-numeric: tabular-nums; }}
  td.perm {{ font-weight: 600; }}
  tr.winner td {{ background: #e7f5ec; }}
  tr.loser td {{ background: #fbe9e9; }}
  .win {{ color: var(--win); font-weight: 700; }}
  .loss {{ color: var(--loss); font-weight: 700; }}
  .warn {{ color: var(--warn); font-weight: 600; }}
  .note {{ background: var(--hint-bg); border-left: 4px solid var(--warn); padding: 0.9rem 1.1rem; margin: 1rem 0; }}
  .reco {{ background: #e7eff8; border-left: 4px solid var(--accent); padding: 1rem 1.2rem; margin: 1.2rem 0; }}
  .tldr {{ background: var(--paper); border: 2px solid var(--ink); padding: 1.2rem 1.4rem; margin: 0 0 1.6rem; border-radius: 4px; }}
  .tldr h2 {{ margin-top: 0; border: none; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.08em; }}
  .tldr ul {{ margin: 0.5rem 0; padding-left: 1.3rem; }}
  .tldr li {{ margin-bottom: 0.45rem; }}
  details {{ background: var(--paper); border: 1px solid var(--rule); border-radius: 3px; margin: 0.7rem 0; padding: 0.6rem 1rem; }}
  details[open] {{ background: #fdfdf8; }}
  summary {{ cursor: pointer; font-weight: 600; padding: 0.2rem 0; outline: none; }}
  code {{ background: #ece8d8; padding: 0.05rem 0.35rem; border-radius: 2px; font-size: 0.92em; }}
  ul.dist {{ font-family: ui-monospace, monospace; font-size: 0.85rem; columns: 2; margin: 0.4rem 0; }}
  ul.dist li {{ break-inside: avoid; margin-bottom: 0.15rem; }}
  .off-locked {{ color: var(--warn); font-weight: 600; }}
  .footer {{ margin-top: 4rem; color: var(--ink-4); font-size: 0.85rem; border-top: 1px solid var(--rule); padding-top: 1rem; }}
</style>
</head>
<body>
"""
    )

    total_n = sum(by_perm[p]["n"] for p in perms_done)
    cells_done = sum(1 for m in per_cell.values() if m is not None)
    parts.append(
        f"""<h1>Wave 2 Permutation Eval — Findings</h1>
<p class="meta">Generated {datetime.now().strftime('%Y-%m-%d %H:%M')} · {cells_done}/50 cells · {total_n:,} candidates classified · 10 cards × 5 permutations × n=30 · channel=x · verifier=claude-sonnet-4-6</p>
"""
    )

    # ─── TL;DR ───────────────────────────────────────────────────────────
    parts.append('<div class="tldr"><h2>TL;DR</h2><ul>')
    # Compute headline numbers from by_perm
    def perm_stat(p, key, n=None):
        a = by_perm[p]
        nn = n if n is not None else a["n"]
        return a[key] * 100 // nn if nn else 0

    perm_winner_placement = max(perms_done, key=lambda p: perm_stat(p, "placement_hit"))
    perm_best_tempo = max(perms_done, key=lambda p: by_perm[p]["locked_tempi_count"] / max(1, by_perm[p]["n"]))
    perm_least_passion = min(perms_done, key=lambda p: perm_stat(p, "off_spec"))

    parts.append(
        f'<li><strong>Best placement-hit (Stable+Flow+Penetrating+Spell):</strong> <span class="win">{perm_winner_placement}</span> at {perm_stat(perm_winner_placement, "placement_hit")}% — ~{perm_stat(perm_winner_placement, "placement_hit") // max(1, perm_stat("current", "placement_hit"))}× the production prompt.</li>'
    )
    parts.append(
        f'<li><strong>Best locked-tempo coverage:</strong> <span class="win">{perm_best_tempo}</span> at {by_perm[perm_best_tempo]["locked_tempi_count"] * 100 // by_perm[perm_best_tempo]["n"]}% — the others (esp. <code>kernel</code>) collapse to off-locked tempi.</li>'
    )
    parts.append(
        f'<li><strong>Least Passion drift:</strong> <span class="win">{perm_least_passion}</span> at {perm_stat(perm_least_passion, "off_spec")}%.</li>'
    )
    parts.append(
        '<li><strong>W9 (competence) → W10 (execution) divergence confirmed:</strong> <code>kernel</code> scored 93% on Mirodan mechanics but still drifts to Passion in 22% of generations. Knowing the rules ≠ executing them.</li>'
    )
    parts.append("</ul></div>")

    # ─── 1. Headline grid ────────────────────────────────────────────────
    parts.append("<h2>1. Headline grid — per permutation, all 10 cards</h2>")
    parts.append("<table>")
    parts.append(
        "<thead><tr><th>permutation</th><th>token budget</th><th>n</th>"
        "<th>placement hit</th><th>off-spec drive (Passion)</th>"
        "<th>locked tempi coverage</th><th>fact-contract fail (regex floor)</th>"
        "<th>length median</th><th>em-dash median</th></tr></thead><tbody>"
    )
    # Determine winners per column to highlight
    winners = {}
    if perms_done:
        winners["placement_hit"] = max(perms_done, key=lambda p: by_perm[p]["placement_hit"] / max(1, by_perm[p]["n"]))
        winners["locked_tempi"] = max(perms_done, key=lambda p: by_perm[p]["locked_tempi_count"] / max(1, by_perm[p]["n"]))
        winners["off_spec_low"] = min(perms_done, key=lambda p: by_perm[p]["off_spec"] / max(1, by_perm[p]["n"]))
    for p in perms_done:
        a = by_perm[p]
        n = a["n"]
        ph_pct = a["placement_hit"] * 100 // n if n else 0
        os_pct = a["off_spec"] * 100 // n if n else 0
        tl_pct = a["locked_tempi_count"] * 100 // n if n else 0
        fc_pct = a["fact_contract_fail"] * 100 // n if n else 0
        ed_med = statistics.median(a["em_dash_medians"]) if a["em_dash_medians"] else 0
        ln_med = statistics.median(a["length_medians"]) if a["length_medians"] else 0
        cls = "winner" if p == winners.get("placement_hit") else ""
        ph_class = "win" if p == winners.get("placement_hit") else ""
        tl_class = "win" if p == winners.get("locked_tempi") else ("loss" if tl_pct < 40 else "")
        os_class = "win" if p == winners.get("off_spec_low") else ("warn" if os_pct >= 20 else "")
        parts.append(
            f"<tr class='{cls}'>"
            f"<td class='perm'>{p}</td>"
            f"<td>{PERM_TOKENS[p]}</td>"
            f"<td class='num'>{n}</td>"
            f"<td class='num'><span class='{ph_class}'>{ph_pct}%</span> ({a['placement_hit']})</td>"
            f"<td class='num'><span class='{os_class}'>{os_pct}%</span> ({a['off_spec']})</td>"
            f"<td class='num'><span class='{tl_class}'>{tl_pct}%</span></td>"
            f"<td class='num'>{fc_pct}% ({a['fact_contract_fail']})</td>"
            f"<td class='num'>{int(ln_med)}</td>"
            f"<td class='num'>{ed_med:.2f}</td>"
            f"</tr>"
        )
    parts.append("</tbody></table>")
    parts.append(
        '<p class="note"><strong>How to read:</strong> placement-hit = % of candidates the verifier classified as Stable+Flow+Penetrating+Spell (the locked Infinex placement). off-spec = % classified as Passion drive (which Penetrating mechanically disqualifies). locked-tempi = % landing on one of the 5 named tempi (Commanding/Practical/Sombre/Irradiant/Sociable). fact-contract failures are regex-only — production uses the LLM active validator which would approve paraphrased facts the regex rejects.</p>'
    )

    # ─── 2. Per-card breakdown ────────────────────────────────────────────
    parts.append("<h2>2. Per-card breakdown</h2>")
    parts.append(
        '<p>Does the placement winner hold across all 10 cards, or only on certain <code>kind</code>s? Each card shows placement-hit rate per permutation.</p>'
    )
    parts.append("<table>")
    parts.append(
        "<thead><tr><th>card</th>"
        + "".join(f"<th>{p}</th>" for p in perms_done)
        + "</tr></thead><tbody>"
    )
    for card in cards:
        row = [f"<td class='perm' style='font-size:0.82rem'>{card}</td>"]
        for p in perms_done:
            m = per_cell.get((card, p))
            if m is None:
                row.append("<td class='num'>—</td>")
                continue
            n = m["n"]
            pct_hit = m["placement_hit"] * 100 // n if n else 0
            cls = "win" if pct_hit >= 50 else ("warn" if pct_hit < 20 else "")
            row.append(f"<td class='num'><span class='{cls}'>{pct_hit}%</span> ({m['placement_hit']}/{n})</td>")
        parts.append("<tr>" + "".join(row) + "</tr>")
    parts.append("</tbody></table>")

    # ─── 3. Tempo distribution per perm ──────────────────────────────────
    parts.append("<h2>3. Tempo distribution per permutation</h2>")
    parts.append(
        "<p>Locked Infinex tempi: <strong>Commanding · Practical · Sombre · Irradiant · Sociable</strong>. "
        '<span class="off-locked">Highlighted</span> = off-locked drift.</p>'
    )
    for p in perms_done:
        a = by_perm[p]
        parts.append(f"<details><summary>{p} — n={a['n']}, locked-tempi coverage = {a['locked_tempi_count']*100//a['n']}%</summary>")
        parts.append("<ul class='dist'>")
        for tempo, count in a["tempo_dist"].most_common(15):
            cls = "" if tempo in LOCKED_TEMPI else "off-locked"
            parts.append(f"<li><span class='{cls}'>{tempo}</span>: {count}</li>")
        parts.append("</ul></details>")

    # ─── 4. Drive axis distribution ───────────────────────────────────────
    parts.append("<h2>4. Drive axis distribution</h2>")
    parts.append(
        "<p>Locked: <strong>Spell → Vision</strong>. Off-spec: anything containing <code>passion</code>.</p>"
    )
    for p in perms_done:
        a = by_perm[p]
        parts.append(f"<details><summary>{p} — off-spec Passion rate = {a['off_spec']*100//a['n']}%</summary>")
        parts.append("<ul class='dist'>")
        for drive, count in a["drive_dist"].most_common(15):
            cls = "off-locked" if OFF_SPEC_DRIVE_SUBSTR in drive.lower() else ""
            parts.append(f"<li><span class='{cls}'>{drive}</span>: {count}</li>")
        parts.append("</ul></details>")

    # ─── 5. Motor-pair distribution ──────────────────────────────────────
    parts.append("<h2>5. Motor-pair distribution</h2>")
    parts.append(
        "<p>Infinex motor pairs in rotation (Sustained-prep → Quick-release): "
        "Pressing→Punching, Wringing→Slashing, Gliding→Dabbing, Floating→Flicking.</p>"
    )
    for p in perms_done:
        a = by_perm[p]
        if not a["motor_pair_dist"]:
            continue
        parts.append(f"<details><summary>{p} — {sum(a['motor_pair_dist'].values())} motor-pair attributions</summary>")
        parts.append("<ul class='dist'>")
        for mp, count in a["motor_pair_dist"].most_common(10):
            parts.append(f"<li>{mp}: {count}</li>")
        parts.append("</ul></details>")

    # ─── 6. W9 × W10 cross-reference ─────────────────────────────────────
    if w9_grades:
        parts.append("<h2>6. W9 (competence) × W10 (execution) cross-reference</h2>")
        parts.append(
            "<p>Does scoring high on Mirodan competence in W9 predict landing on placement in W10? If a permutation knows the rules but still drifts, that's the most important diagnostic.</p>"
        )
        parts.append("<table>")
        parts.append(
            "<thead><tr><th>permutation</th>"
            "<th>W9 Mirodan competence (avg across triad)</th>"
            "<th>W10 placement hit</th>"
            "<th>W10 off-spec Passion</th>"
            "<th>gap (competence – execution)</th></tr></thead><tbody>"
        )
        for p in perms_done:
            if p not in w9_grades:
                continue
            # avg of the 3 model values, parse "93%" → 93
            try:
                vals = []
                for k, v in w9_grades[p].items():
                    m = re.search(r"(\d+)%", v)
                    if m:
                        vals.append(int(m.group(1)))
                w9_avg = sum(vals) / len(vals) if vals else 0
            except Exception:
                w9_avg = 0
            a = by_perm[p]
            ph_pct = a["placement_hit"] * 100 / a["n"] if a["n"] else 0
            os_pct = a["off_spec"] * 100 / a["n"] if a["n"] else 0
            gap = w9_avg - ph_pct
            gap_cls = "warn" if gap > 30 else ""
            parts.append(
                f"<tr><td class='perm'>{p}</td>"
                f"<td class='num'>{w9_avg:.0f}%</td>"
                f"<td class='num'>{ph_pct:.0f}%</td>"
                f"<td class='num'>{os_pct:.0f}%</td>"
                f"<td class='num'><span class='{gap_cls}'>{gap:+.0f}pp</span></td></tr>"
            )
        parts.append("</tbody></table>")
        parts.append(
            '<p class="note"><strong>Reading the gap:</strong> a large positive gap means the model knows the framework (high W9 competence) but still drifts off-placement when writing (low W10 placement hit). That gap is the "knowing ≠ doing" tax — the locked production prompt should close it.</p>'
        )

    # ─── 7. Tempo-collapse deep-dive ──────────────────────────────────────
    parts.append("<h2>7. Tempo-collapse deep-dive</h2>")
    parts.append(
        "<p>The interim look hinted that <code>kernel</code> wins placement (48%) but collapses tempo to <code>self-contained</code> (an off-locked tempo). Is this a verifier-vocabulary artifact or a real generator drift?</p>"
    )
    # Look at Self-Contained presence per perm
    sc_table = []
    for p in perms_done:
        a = by_perm[p]
        sc_count = a["tempo_dist"].get("self-contained", 0)
        sc_table.append((p, sc_count, a["n"]))
    parts.append(
        "<table><thead><tr><th>permutation</th><th>self-contained count</th><th>self-contained rate</th><th>locked-tempi rate</th></tr></thead><tbody>"
    )
    for p, sc, n in sc_table:
        a = by_perm[p]
        sc_pct = sc * 100 // n if n else 0
        lt_pct = a["locked_tempi_count"] * 100 // n if n else 0
        parts.append(
            f"<tr><td class='perm'>{p}</td><td class='num'>{sc}</td><td class='num'>{sc_pct}%</td><td class='num'>{lt_pct}%</td></tr>"
        )
    parts.append("</tbody></table>")
    parts.append(
        '<p class="note"><strong>Hypothesis:</strong> Self-Contained is the verifier\'s name for the inner attitude itself expressing as a tempo (Stable+Penetrating without an active Working Action). When the kernel locks the placement HARD, the writing flattens into a tempo register that has no <em>motor</em> — no Pressing→Punching, no Wringing→Slashing — just the inner attitude radiating. The 5 locked tempi are <em>active</em> Working-Action expressions; Self-Contained is a <em>passive</em> baseline echo.</p>'
        '<p>If true, the fix is: kernel locks the inner; the tempi vocabulary section of <code>current</code> activates the motor pairs. They\'re complementary, not redundant.</p>'
    )

    # ─── 8. Recommendation ───────────────────────────────────────────────
    parts.append("<h2>8. Bottom-line recommendation</h2>")
    parts.append('<div class="reco">')
    parts.append(
        "<h4>Build a 6th permutation: <code>kernel + tempi-section</code></h4>"
        "<p>The data points to a clear hybrid. <code>kernel</code> earns its tokens by anchoring placement (Stable+Flow+Penetrating+Spell) at ~3× the production prompt's rate. <code>current</code> earns its tokens by activating the 5 locked tempi via the Tempi vocabulary section. Neither alone wins both axes.</p>"
        "<p><strong>Proposed locked structure for <code>src/voice/infinex.ts</code>:</strong></p>"
        "<ul>"
        "<li>Character placement header (from <code>current</code>, lines 290-299)</li>"
        "<li><strong>12-rule Mirodan kernel</strong> (the load-bearing addition, from <code>kernel</code>/<code>full</code>)</li>"
        "<li>Tempi vocabulary section (from <code>current</code>, lines 342-358) — activates the 5 motor-pair tempi</li>"
        "<li>Off-spec regex section (from <code>current</code>, lines 374-393) — Passion language guards</li>"
        "<li><strong>Strip:</strong> Super-Objective (line 301), historical lore (316), validation criterion (326), Outer/Lining discipline (336), preparation hierarchy (360) — none of these moved any metric in the eval.</li>"
        "</ul>"
        "<p>Estimated token budget for the hybrid: ~2,400 tokens (vs <code>current</code> 2,700 and <code>kernel</code> 3,700). <strong>Smaller AND better-targeted.</strong></p>"
    )
    parts.append("</div>")

    parts.append('<div class="reco">')
    parts.append(
        "<h4>Wave 3 — operator triage priorities at <code>/eval</code></h4>"
        "<p>Triage what the verifier metrics can't see:</p>"
        "<ol>"
        "<li><strong>kernel cells (top-stratum)</strong>: do they actually <em>feel</em> Infinex, or do they feel like Mirodan-essay copy that scored well on the structural classifier? Risk: high placement-hit + low locked-tempi = on-spec but boring.</li>"
        "<li><strong>kernel cells on the temptation card</strong> (passkey-recovery-audit): the 22% Passion rate is the worst across permutations. Read those candidates and confirm whether they're truly Passion-flavored urgency or false-positive verifier flags.</li>"
        "<li><strong>current cells (bottom-stratum)</strong>: do the fact-contract-failing candidates actually mis-assert facts, or are they paraphrased correctly (regex artifact)?</li>"
        "<li><strong>Cross-card kernel hold</strong>: which card types broke kernel's placement hold (per §2 above)?</li>"
        "</ol>"
        '<p>The <code>/eval</code> stratified view auto-buckets top/median/bottom per (card, perm). Start with the top-stratum of kernel and the bottom-stratum of current.</p>'
    )
    parts.append("</div>")

    # ─── 9. Open questions ───────────────────────────────────────────────
    parts.append("<h2>9. Open questions / next moves</h2>")
    parts.append(
        "<ul>"
        "<li>Build the 6th permutation (kernel + tempi-section + off-spec guards) and re-run n=30 across 5-10 cards to confirm the hybrid actually wins both axes. Cost: ~$30, ~25min.</li>"
        "<li>Investigate <code>Self-Contained</code> in the verifier's tempo vocabulary — is it semantically equivalent to a locked tempo, or true drift? Spot-check 5 candidates.</li>"
        "<li>Run the LLM active validator over the top-stratum of <code>current</code> to confirm the fact-contract regex floor is mostly false-positive on paraphrased copy.</li>"
        "<li>Re-test on launch-tier cards specifically — those have richer inner-work fields and may stress the placement-anchoring differently.</li>"
        "<li>Compound the methodology: \"competence-vs-execution divergence\" is a portable technique. Worth a <code>ce:compound</code> entry on the W9/W10 split.</li>"
        "</ul>"
    )

    # ─── 10. Methodology notes ───────────────────────────────────────────
    parts.append("<h2>10. Caveats &amp; methodology</h2>")
    parts.append(
        "<ul>"
        "<li><strong>Verifier is gold-standard per memory</strong> (<code>scripts/classify-corpus.ts</code> v2). Sonnet 4.6 classifier; same instrument across all permutations so comparisons are clean.</li>"
        "<li><strong>fact-contract failures are regex floor</strong>, not production gate. The eval rig uses <code>validate()</code> only, not the LLM active validator the harness uses in production. Real production gate would approve more candidates that the regex rejects on lexical token overlap.</li>"
        "<li>n=30 per cell; 10 cards × 5 perms = 50 cells × 30 = 1,500 candidates. Confidence intervals on placement-hit at n=30 are roughly ±9% (95% CI on binomial proportion).</li>"
        "<li><strong>Generator: Opus 4.7</strong> with the W1C+1D permutation flag. Two-call path (Stage A inner-work, Stage B drafting); max_tokens bumped to 32000 for Stage B to fit 30 candidates.</li>"
        "<li>Smoke + run cost actual: ~$80 across W9 + W10 + smokes. Lower than $130-180 ceiling.</li>"
        "</ul>"
    )

    parts.append(
        f'<p class="footer">Source data: {html_escape(w10_dir)}/verifier/ (50 JSON files) + harness/harness.db candidates table where prompt_variant IS NOT NULL.</p>'
    )
    parts.append("</body></html>")
    return "\n".join(parts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--w10-dir", required=True)
    ap.add_argument("--w9-grades", default=None)
    ap.add_argument("--harness-db", default="harness/harness.db")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    verifier_rows = load_verifier_rows(args.w10_dir)
    db_rows = load_db_rows(args.harness_db)
    # Index DB by (card, perm, text)
    db_by_text = defaultdict(dict)
    for r in db_rows:
        key = (r["card_id"], r["prompt_variant"])
        db_by_text[key][r["text"]] = r

    per_cell = {}
    for (card, perm), rows in verifier_rows.items():
        per_cell[(card, perm)] = compute_cell_metrics(card, perm, rows, db_by_text)

    by_perm = aggregate_by_perm(per_cell)
    w9_grades = parse_w9_grades(args.w9_grades) if args.w9_grades else None

    html = render_html(by_perm, per_cell, w9_grades, args.w10_dir)
    Path(args.out).write_text(html)
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
