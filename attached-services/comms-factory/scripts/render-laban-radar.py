#!/usr/bin/env python3
"""
⚠ DEPRECATED (2026-05-18) — superseded by `scripts/render-laban-3shell.py`.

This script renders a Chart.js radar where each axis is a trait percentage
(e.g. "% Stable", "% Penetrating"). It treats Laban axes as independent when
they're structurally a lattice (Inner Attitudes are 2-factor combinations;
Aspects are factor-leads constrained by which factors the inner contains).
The percentage radar flattens that structure.

Kept as reusable infrastructure for percentage-style brand comparisons, but
do not use as the primary viz for Laban character analysis. Use the 3-shell
viz (renders the actual framework topology).

Original docstring follows.

──────────────────────────────────────────────────────────────────────────

Render an interactive Laban radar (spider) HTML from one or more
classification JSON files (output of scripts/classify-corpus.ts).

Each input JSON becomes one polygon on the radar. The radar has 8 trait
axes computed from the Laban distribution; each axis is a 0-1 percentage.
Unknowns count as zero on every axis (an honest read of "no character").

Usage:
    python3 scripts/render-laban-radar.py <output.html> \\
        <label>=<path.json> \\
        <label>=<path.json> \\
        ...

Example:
    python3 scripts/render-laban-radar.py research/phantom-vs-infinex-radar.html \\
        "Phantom website"=research/phantom-classifications-website.json \\
        "Phantom tweets"=research/phantom-classifications-tweets.json \\
        "Phantom app-adjacent"=research/phantom-classifications-app-adjacent.json \\
        "Phantom app"=research/phantom-classifications-app.json \\
        "Infinex marketing"=research/infinex-classifications-marketing.json

The Infinex LOCKED reference polygon (Stable + Flow + Penetrating +
Spell-Vision) is always rendered as a dashed outline for contrast.

The 8 trait axes:

    Each axis is a percentage of a Laban / Mirodan category from the
    classifications:

    1. % Stable                              — inner attitude
    2. % Near                                — inner attitude
    3. % Penetrating                         — aspect
    4. % Circumscribing                      — aspect
    5. % Doing                               — drive (primary)
    6. % Spell+Vision                        — drive family (primary or secondary)
    7. % Passion / Time-stressed             — drive OR stress
    8. % Commanding+Sombre+Awake-Acute tempi — composite of three Laban tempi
                                               (the "decisive / weight-bearing" cluster
                                               where Phantom's friction-copy lives;
                                               can be split or dropped per your call)

"""

import json
import sys
from pathlib import Path

AXIS_LABELS = [
    "% Stable",
    "% Near",
    "% Penetrating",
    "% Circumscribing",
    "% Doing",
    "% Spell+Vision",
    "% Passion / Time-stressed",
    "% Commanding+Sombre+Awake-Acute tempi",
]

# Infinex locked-spec reference shape — what the brand has committed to be.
# Plotted as a dashed outline so the user can see where each surface lands
# relative to the locked aspiration.
INFINEX_LOCKED_REFERENCE = [
    1.0,  # Institutional weight   — Stable
    0.0,  # Relational warmth      — not Near
    1.0,  # Structural clarity     — Penetrating
    0.0,  # Convention reliance    — not Circumscribing
    0.0,  # Action load            — not Doing
    1.0,  # Aspirational reach     — Spell + Vision
    0.0,  # Urgency tolerance      — Spell-Vision rejects urgency
    0.6,  # Decisive-weight tempi  — Commanding + Sombre + Practical are 3/5 of main rotation
]


def load(path: Path) -> list:
    return json.loads(path.read_text())


def compute_traits(samples: list) -> list:
    """Return 8 trait percentages (0.0-1.0) in the AXIS_LABELS order."""
    n = len(samples)
    if n == 0:
        return [0.0] * 8

    inner = [s["classification"].get("inner_attitude") for s in samples]
    stress = [s["classification"].get("stress") for s in samples]
    aspect = [s["classification"].get("aspect") for s in samples]
    drive_p = [s["classification"].get("drive_primary") for s in samples]
    drive_s = [s["classification"].get("drive_secondary") for s in samples]
    tempo = [s["classification"].get("tempo_name") for s in samples]

    pct_stable = sum(1 for v in inner if v == "stable") / n
    pct_near = sum(1 for v in inner if v == "near") / n
    pct_pen = sum(1 for v in aspect if v == "penetrating") / n
    pct_circ = sum(1 for v in aspect if v == "circumscribing") / n
    pct_doing = sum(1 for v in drive_p if v == "doing") / n
    # Aspirational: either drive slot holds spell or vision
    pct_aspir = (
        sum(
            1
            for p, s in zip(drive_p, drive_s)
            if (p in ("spell", "vision")) or (s in ("spell", "vision"))
        )
        / n
    )
    pct_urgency = (
        sum(1 for p, st in zip(drive_p, stress) if p == "passion" or st == "time") / n
    )
    decisive_tempi = {"Commanding", "Awake-Acute", "Sombre"}
    pct_decisive = sum(1 for t in tempo if t in decisive_tempi) / n

    return [
        pct_stable,
        pct_near,
        pct_pen,
        pct_circ,
        pct_doing,
        pct_aspir,
        pct_urgency,
        pct_decisive,
    ]


# Color palette for polygons — Phantom surfaces get warm reds/oranges,
# Infinex surfaces get cool blues/teals. Locked spec is gray-dashed.
COLOR_PALETTE = [
    # warm (Phantom-ish)
    "rgba(254, 111, 57, 0.55)",   # Canteloupe orange
    "rgba(220, 38, 38, 0.45)",    # red
    "rgba(245, 158, 11, 0.45)",   # amber
    "rgba(217, 70, 239, 0.40)",   # fuchsia
    # cool (Infinex-ish)
    "rgba(59, 130, 246, 0.45)",   # blue
    "rgba(16, 185, 129, 0.45)",   # emerald
    "rgba(20, 184, 166, 0.45)",   # teal
    "rgba(99, 102, 241, 0.45)",   # indigo
    "rgba(168, 85, 247, 0.45)",   # purple
    "rgba(236, 72, 153, 0.45)",   # pink
]

BORDER_PALETTE = [
    "rgb(254, 111, 57)",
    "rgb(220, 38, 38)",
    "rgb(245, 158, 11)",
    "rgb(217, 70, 239)",
    "rgb(59, 130, 246)",
    "rgb(16, 185, 129)",
    "rgb(20, 184, 166)",
    "rgb(99, 102, 241)",
    "rgb(168, 85, 247)",
    "rgb(236, 72, 153)",
]


HTML_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Laban / Mirodan brand radar</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    color: #1a1a1a;
    background: #fafaf9;
    margin: 0;
    padding: 32px 24px 80px;
    line-height: 1.5;
  }
  h1 { font-size: 24px; margin: 0 0 4px; }
  .lead { color: #555; margin: 0 0 24px; font-size: 14px; max-width: 760px; }
  .grid {
    display: grid;
    grid-template-columns: minmax(520px, 1fr) minmax(360px, 1fr);
    gap: 32px;
    align-items: start;
  }
  .chart-card {
    background: #fff;
    border: 1px solid #e5e5e3;
    border-radius: 8px;
    padding: 24px;
  }
  .legend-card {
    background: #fff;
    border: 1px solid #e5e5e3;
    border-radius: 8px;
    padding: 20px;
    font-size: 13px;
  }
  .legend-card h2 { font-size: 15px; margin: 0 0 12px; }
  .axis-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .axis-table th, .axis-table td {
    text-align: left;
    padding: 6px 8px;
    border-bottom: 1px solid #f0f0ee;
  }
  .axis-table th { background: #f9f9f7; font-weight: 600; color: #444; }
  .axis-table td.num { text-align: right; font-variant-numeric: tabular-nums; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  .axis-table td.label { color: #555; font-weight: 500; }
  .surface-row td { font-size: 12px; }
  .swatch { display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
  footer { color: #999; font-size: 11px; margin-top: 32px; }
  details { margin: 12px 0; }
  summary { cursor: pointer; font-weight: 600; color: #444; font-size: 13px; }
  details ul { margin: 8px 0; padding-left: 20px; }
  details li { font-size: 12px; color: #555; line-height: 1.6; }
</style>
</head>
<body>
<h1>Laban / Mirodan brand radar</h1>
<p class="lead">
  Each polygon = one brand surface, plotted on 8 trait axes computed from Sonnet
  Laban-classifications. Closer to the rim = stronger trait expression. Click a
  legend entry to toggle that polygon. The dashed gray polygon is Infinex&rsquo;s
  locked spec (Stable + Flow + Penetrating + Spell-Vision) as the contrast
  reference.
</p>

<div class="grid">
  <div class="chart-card">
    <canvas id="radar" width="600" height="600"></canvas>
  </div>
  <div class="legend-card">
    <h2>Axis definitions</h2>
    <table class="axis-table">
      <thead><tr><th>Axis (Laban category)</th><th>Counted from classification field</th></tr></thead>
      <tbody>
        <tr><td class="label"><code>% Stable</code></td><td><code>inner_attitude == "stable"</code></td></tr>
        <tr><td class="label"><code>% Near</code></td><td><code>inner_attitude == "near"</code></td></tr>
        <tr><td class="label"><code>% Penetrating</code></td><td><code>aspect == "penetrating"</code></td></tr>
        <tr><td class="label"><code>% Circumscribing</code></td><td><code>aspect == "circumscribing"</code></td></tr>
        <tr><td class="label"><code>% Doing</code></td><td><code>drive_primary == "doing"</code></td></tr>
        <tr><td class="label"><code>% Spell+Vision</code></td><td><code>drive_primary or drive_secondary ∈ {spell, vision}</code></td></tr>
        <tr><td class="label"><code>% Passion / Time</code></td><td><code>drive_primary == "passion" OR stress == "time"</code></td></tr>
        <tr><td class="label"><code>% Commanding+Sombre+Awake-Acute</code></td><td><code>tempo_name ∈ {Commanding, Sombre, Awake-Acute}</code> — composite (call to keep, split, or drop)</td></tr>
      </tbody>
    </table>

    <details>
      <summary>How to read this</summary>
      <ul>
        <li><b>Tight polygon</b> (peaks on a few axes) = character-coherent surface.</li>
        <li><b>Spread polygon</b> (similar value on many axes) = multi-register or characterless surface.</li>
        <li><b>Low overall amplitude</b> = lots of <code>unknown</code> classifications, i.e. surface is mostly chrome / no character. App chrome surfaces typically look like this.</li>
        <li><b>Compare to the dashed reference</b> to see how close each surface lands to Infinex&rsquo;s locked aspiration.</li>
      </ul>
    </details>

    <h2 style="margin-top: 20px;">Surfaces</h2>
    <table class="axis-table">
      <thead><tr><th>Surface</th><th class="num">N</th></tr></thead>
      <tbody>
__SURFACE_ROWS__
      </tbody>
    </table>
  </div>
</div>

<footer>Generated by scripts/render-laban-radar.py from scripts/classify-corpus.ts output.</footer>

<script>
const radarData = __RADAR_DATA__;

const ctx = document.getElementById('radar').getContext('2d');
new Chart(ctx, {
  type: 'radar',
  data: {
    labels: radarData.axes,
    datasets: radarData.datasets,
  },
  options: {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 14, padding: 12, font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          label: function(ctx) {
            return ctx.dataset.label + ': ' + (ctx.parsed.r * 100).toFixed(0) + '%';
          },
        },
      },
    },
    scales: {
      r: {
        beginAtZero: true,
        min: 0,
        max: 1,
        ticks: { stepSize: 0.2, callback: v => (v * 100).toFixed(0) + '%', font: { size: 10 } },
        pointLabels: { font: { size: 11, weight: '600' } },
        grid: { color: '#e5e5e3' },
        angleLines: { color: '#e5e5e3' },
      },
    },
  },
});
</script>
</body>
</html>
"""


def main():
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr)
        sys.exit(1)

    output_path = Path(sys.argv[1])
    surface_args = sys.argv[2:]

    datasets = []
    surface_rows = []

    for i, arg in enumerate(surface_args):
        if "=" not in arg:
            print(f"Skipping malformed surface arg (missing '='): {arg}", file=sys.stderr)
            continue
        label, path_str = arg.split("=", 1)
        path = Path(path_str)
        if not path.exists():
            print(f"Skipping {label}: file not found at {path_str}", file=sys.stderr)
            continue

        samples = load(path)
        traits = compute_traits(samples)
        color = COLOR_PALETTE[i % len(COLOR_PALETTE)]
        border = BORDER_PALETTE[i % len(BORDER_PALETTE)]

        datasets.append({
            "label": f"{label} (n={len(samples)})",
            "data": traits,
            "backgroundColor": color,
            "borderColor": border,
            "borderWidth": 2,
            "pointBackgroundColor": border,
            "pointBorderColor": "#fff",
            "pointRadius": 3,
            "pointHoverRadius": 5,
        })

        # Surface row for the legend table
        swatch = f'<span class="swatch" style="background:{border}"></span>'
        surface_rows.append(
            f"        <tr class='surface-row'><td class='label'>{swatch}{label}</td>"
            f"<td class='num'>{len(samples)}</td></tr>"
        )

    # Add the Infinex locked reference as a dashed outline
    datasets.append({
        "label": "Infinex locked spec (reference)",
        "data": INFINEX_LOCKED_REFERENCE,
        "backgroundColor": "rgba(80, 80, 80, 0.04)",
        "borderColor": "rgba(60, 60, 60, 0.9)",
        "borderWidth": 2,
        "borderDash": [6, 4],
        "pointBackgroundColor": "rgba(60, 60, 60, 0.9)",
        "pointBorderColor": "#fff",
        "pointRadius": 3,
        "pointHoverRadius": 5,
    })
    surface_rows.append(
        f"        <tr class='surface-row'><td class='label'>"
        f'<span class="swatch" style="background:transparent;border:1px dashed #444"></span>'
        f"Infinex locked spec (reference)</td><td class='num'>n/a</td></tr>"
    )

    radar_data = {
        "axes": AXIS_LABELS,
        "datasets": datasets,
    }

    html = HTML_TEMPLATE.replace("__RADAR_DATA__", json.dumps(radar_data))
    html = html.replace("__SURFACE_ROWS__", "\n".join(surface_rows))
    output_path.write_text(html)
    print(f"Wrote {output_path}", file=sys.stderr)
    print(f"Surfaces rendered: {len(datasets)}", file=sys.stderr)


if __name__ == "__main__":
    main()
