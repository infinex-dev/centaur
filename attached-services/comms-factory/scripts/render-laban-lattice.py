#!/usr/bin/env python3
"""
⚠ DEPRECATED (2026-05-18) — superseded by `scripts/render-laban-3shell.py`.

This script renders a 6-node hexagon (synthesis topology, not Mirodan-canonical)
with edges showing baseline → action-attitude deviations. The 3-shell viz is
richer — it adds the inner aspect ring + outer 24-tempi fan + stress triangles.
Kept as reusable infrastructure for surfaces where only the hexagon backbone
is needed, but not the primary Laban viz for character analysis.

Original docstring follows.

──────────────────────────────────────────────────────────────────────────

Laban / Mirodan lattice viz (smoke).

Draws the structural 6-node hexagon — 3 baselines (Stable/Near/Adream) + 3
action attitudes (Awake/Mobile/Remote) — with edges between each baseline and
the two action attitudes it can deviate to. Per surface, plots sample counts
at each node + dominant-drive color.

KNOWN LIMITATION (smoke version): the classifier enum that produced the input
JSON only had {awake, near, stable, mobile} on the inner_attitude axis —
adream and remote were dropped. So those nodes will show zero samples for
every surface in this smoke. Re-classify with the corrected enum + re-run
this script to see the real distribution.

Usage:
    python3 scripts/render-laban-lattice.py <output.html> \\
        <label>=<path.json> \\
        ...
"""

import json
import math
import sys
from collections import Counter
from pathlib import Path

# Hexagon vertices — clockwise from top.
# Baselines alternate with action attitudes; each baseline connects to its
# two neighboring action attitudes (the ones it can deviate to under stress).
NODES = [
    ("Stable",  "baseline",  90),    # W+S
    ("Awake",   "action",    30),    # S+T  (lose W from Stable, lose W from Near)
    ("Near",    "baseline",  330),   # W+T
    ("Mobile",  "action",    270),   # T+F  (lose W from Near, lose W from Adream)
    ("Adream",  "baseline",  210),   # W+F
    ("Remote",  "action",    150),   # S+F  (lose W from Adream, lose W from Stable)
]

# Edges — every baseline connects to both adjacent action attitudes.
EDGES = [
    ("Stable", "Awake"),
    ("Stable", "Remote"),
    ("Near",   "Awake"),
    ("Near",   "Mobile"),
    ("Adream", "Mobile"),
    ("Adream", "Remote"),
]

# Each inner attitude lists its motion-factor pair.
INNER_FACTORS = {
    "Stable": {"Weight", "Space"},
    "Near":   {"Weight", "Time"},
    "Adream": {"Weight", "Flow"},
    "Awake":  {"Space",  "Time"},
    "Mobile": {"Time",   "Flow"},
    "Remote": {"Space",  "Flow"},
}

# Aspect = factor-led. Available only when the inner contains that factor.
ASPECT_FACTOR = {
    "enclosing":     "Weight",
    "penetrating":   "Space",
    "radiating":     "Flow",
    "circumscribing":"Time",
}

# Drive colors (small inset; the node BG uses Mirodan Inner-Attitude color).
DRIVE_COLOR = {
    "doing":   "#3b82f6",   # blue
    "spell":   "#10b981",   # green
    "passion": "#ef4444",   # red
    "vision":  "#a855f7",   # purple
    "unknown": "#9ca3af",   # gray
}

# Mirodan canonical colors for each Inner Attitude (derived from Motion Factors).
MIRODAN_COLOR = {
    "Stable": "#7c3aed",   # purple — Weight+Space
    "Near":   "#dc2626",   # red    — Weight+Time
    "Adream": "#f97316",   # orange — Weight+Flow
    "Awake":  "#2563eb",   # blue   — Space+Time
    "Mobile": "#10b981",   # green  — Time+Flow
    "Remote": "#06b6d4",   # turquoise — Space+Flow
}


def load(p):
    return json.loads(Path(p).read_text())


def node_position(angle_deg, cx, cy, r):
    rad = math.radians(angle_deg)
    return (cx + r * math.cos(rad), cy - r * math.sin(rad))


def tally_surface(samples):
    """Return per-node {count, drive_dist, aspect_dist} for one surface."""
    by_node = {n: {"count": 0, "drives": Counter(), "aspects": Counter()} for n, _, _ in NODES}
    for s in samples:
        c = s["classification"]
        inner = c.get("inner_attitude") or "unknown"
        # Map enum to node name. Skill uses lowercase; we display capitalized.
        node = inner.capitalize() if inner != "unknown" else None
        if node not in by_node:
            continue
        by_node[node]["count"] += 1
        d = c.get("drive_primary") or "unknown"
        by_node[node]["drives"][d] += 1
        a = c.get("aspect") or "unknown"
        by_node[node]["aspects"][a] += 1
    return by_node


def render_mini_lattice(label, by_node, total, cx=140, cy=130, r=85, node_r=22):
    """Return SVG for one mini-lattice."""
    svg = []
    svg.append(f'<svg viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg">')

    # Title
    svg.append(f'<text x="140" y="18" text-anchor="middle" font-size="12" font-weight="600" fill="#1a1a1a">{label}</text>')
    svg.append(f'<text x="140" y="32" text-anchor="middle" font-size="10" fill="#777">{total} samples</text>')

    # Build name → position
    pos = {}
    for name, _, angle in NODES:
        pos[name] = node_position(angle, cx, cy, r)

    # Edges
    for a, b in EDGES:
        x1, y1 = pos[a]
        x2, y2 = pos[b]
        svg.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="#d1d5db" stroke-width="1.5"/>')

    # Nodes
    for name, role, angle in NODES:
        x, y = pos[name]
        d = by_node[name]
        count = d["count"]
        # Mirodan canonical Inner Attitude color
        fill = MIRODAN_COLOR.get(name, "#9ca3af")

        # Node circle — radius scales with sample count
        pct = count / total if total > 0 else 0
        scaled_r = node_r * (0.4 + 0.8 * (pct ** 0.5))  # min 0.4, scales sqrt

        # Baseline = solid stroke; action = dashed stroke
        stroke_dash = "" if role == "baseline" else 'stroke-dasharray="3,2"'

        svg.append(
            f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{scaled_r:.1f}" '
            f'fill="{fill}" fill-opacity="0.65" stroke="#374151" stroke-width="1.5" {stroke_dash}/>'
        )

        # Node label + count
        svg.append(f'<text x="{x:.1f}" y="{y+3:.1f}" text-anchor="middle" font-size="11" font-weight="600" fill="#fff" style="paint-order: stroke; stroke: rgba(0,0,0,0.6); stroke-width: 0.5px;">{name}</text>')
        if count > 0:
            svg.append(f'<text x="{x:.1f}" y="{y+15:.1f}" text-anchor="middle" font-size="9" fill="#374151">{count} ({100*pct:.0f}%)</text>')

    svg.append('</svg>')
    return "\n".join(svg)


HTML_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Laban / Mirodan lattice (smoke)</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; margin: 24px; background: #fafaf9; color: #1a1a1a; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  .lead { color: #555; font-size: 13px; max-width: 760px; margin: 0 0 16px; }
  .warning { background: #fef3c7; border-left: 3px solid #f59e0b; padding: 10px 14px; margin: 0 0 20px; font-size: 12px; max-width: 760px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-width: 1200px; }
  .cell { background: #fff; border: 1px solid #e5e5e3; border-radius: 6px; padding: 4px; }
  .cell svg { width: 100%; height: auto; }
  .legend { margin-top: 24px; background: #fff; border: 1px solid #e5e5e3; border-radius: 6px; padding: 16px; font-size: 12px; max-width: 760px; }
  .swatch { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
  td { padding: 4px 8px; border-bottom: 1px solid #f0f0ee; }
  code { background: #f3f4f6; padding: 1px 4px; border-radius: 2px; font-size: 11px; }
</style>
</head>
<body>
<h1>Laban / Mirodan lattice — smoke</h1>
<p class="lead">
  Six-node hexagon: <b>Stable / Near / Adream</b> (baselines, solid stroke) + <b>Awake / Mobile / Remote</b>
  (action attitudes, dashed stroke). Edges connect each baseline to the two action attitudes it can
  deviate to under stress (each pair shares two non-Weight factors). Node size = sample count at that
  inner attitude. Node color = dominant drive at that node for that surface.
</p>
<div class="warning">
  <b>SMOKE LIMITATION:</b> the source classifier used a flat enum
  <code>{awake, near, stable, mobile}</code> for <code>inner_attitude</code> — it never had
  <code>adream</code> or <code>remote</code> as options. So <b>those nodes will be empty
  in this smoke for every surface</b>. Re-classify with the corrected enum (full 6 + factor-coherence
  rules) to see the real lattice distribution. This is here so you can validate the viz shape
  before paying for the re-classification.
</div>
<div class="grid">
__CELLS__
</div>
<div class="legend">
  <b>Lattice reading guide</b>
  <table>
    <tr><td>Node radius</td><td>= % of surface samples that classified at that inner attitude</td></tr>
    <tr><td>Solid stroke</td><td>= baseline inner attitude (only Stable/Near/Adream can be baseline)</td></tr>
    <tr><td>Dashed stroke</td><td>= action attitude (Awake/Mobile/Remote — outer projection only)</td></tr>
    <tr><td>Edge</td><td>= legal deviation from baseline → action under stress (both share their non-Weight factors)</td></tr>
    <tr><td>Node color</td><td>= dominant drive at that node:
      <span class="swatch" style="background:#3b82f6"></span>doing
      <span class="swatch" style="background:#10b981"></span>spell
      <span class="swatch" style="background:#ef4444"></span>passion
      <span class="swatch" style="background:#a855f7"></span>vision
      <span class="swatch" style="background:#9ca3af"></span>unknown
    </td></tr>
  </table>
  <p style="margin-top: 14px; color: #555;">
    <b>Aspects (not yet shown — next iteration):</b> each node has 2 legal aspects (factor-leads):
    Stable→Enclosing/Penetrating · Near→Enclosing/Circumscribing · Adream→Enclosing/Radiating ·
    Awake→Penetrating/Circumscribing · Mobile→Circumscribing/Radiating · Remote→Penetrating/Radiating.
    Will be rendered as sectors around each node once the corrected classifier emits aspect data
    constrained to legal options per inner.
  </p>
</div>
</body>
</html>
"""


def main():
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr)
        sys.exit(1)

    output_path = Path(sys.argv[1])
    surface_args = sys.argv[2:]

    cells = []
    for arg in surface_args:
        if "=" not in arg:
            continue
        label, path_str = arg.split("=", 1)
        path = Path(path_str)
        if not path.exists():
            print(f"Skipping {label}: file not found at {path_str}", file=sys.stderr)
            continue
        samples = load(path)
        by_node = tally_surface(samples)
        svg = render_mini_lattice(label, by_node, len(samples))
        cells.append(f'<div class="cell">{svg}</div>')

    html = HTML_TEMPLATE.replace("__CELLS__", "\n".join(cells))
    output_path.write_text(html)
    print(f"Wrote {output_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
