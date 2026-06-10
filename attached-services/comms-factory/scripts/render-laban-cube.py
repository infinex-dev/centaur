#!/usr/bin/env python3
"""
⚠ DEPRECATED (2026-05-18) — operator chose the 3-shell viz over this one.

The Effort Cube IS Mirodan's actual canonical topology (vol 2 pp. 358-364),
but it caps at 12 of 24 tempi as edges (the 3 non-Flow inner attitudes:
Stable, Near, Awake). The other 12 tempi (Adream, Mobile, Remote — all
Flow-involving) live in a "Flow-cloud" side panel since Flow isn't a cube
axis. This loss of half the tempi to abstraction makes it less practical
for brand-voice analysis than the 3-shell viz, which carries all 24 tempi
as outer dots.

Kept as reference (the cube IS what Mirodan herself uses), but use the
3-shell for production Laban analysis.

Original docstring follows.

──────────────────────────────────────────────────────────────────────────

Mirodan canonical viz: the Effort Cube.

Per Mirodan vol 2 (chapters 1-3 + pp. 358-486): a single cube is the topology
for the whole framework. 8 vertices = the 8 Working Actions. 12 edges = the
combinations of 2-factor participation. 6 Inner Attitudes = different
edge-highlight overlays on the same cube. Aspects = labels on highlighted
edges. 24 tempi = highlighted edges across all 6 Inner Attitudes' overlays.

Cube axes (Mirodan-canonical):
  - x = Time         (Sustained ← → Quick)
  - y = Space        (Flexible ← → Direct)
  - z = Weight       (Light ← → Strong)
  - Flow = a cloud pervading the cube — not a cube axis

8 Working Actions at vertices:
  Pressing  (Strong, Direct,   Sustained)   Punching  (Strong, Direct,   Quick)
  Wringing  (Strong, Flexible, Sustained)   Slashing  (Strong, Flexible, Quick)
  Gliding   (Light,  Direct,   Sustained)   Dabbing   (Light,  Direct,   Quick)
  Floating  (Light,  Flexible, Sustained)   Flicking  (Light,  Flexible, Quick)

Inner Attitude → edge-highlight overlays:
  Stable (W+S, purple)  → 4 Time-edges
  Near   (W+T, red)     → 4 Space-edges
  Awake  (S+T, blue)    → 4 Weight-edges
  Adream (W+F, orange)  → Flow-cloud at high-Weight vertices
  Mobile (T+F, green)   → Flow-cloud across all vertices
  Remote (S+F, turquoise) → Flow-cloud at low-Weight vertices

Each surface gets a small-multiple cube. Sample counts plotted at edges
where the sample's tempo lives; Flow-cloud Inner Attitudes shown as
adjacent annotation panels.

Usage:
    python3 scripts/render-laban-cube.py <output.html> <label>=<path.json>...
"""

import json
import math
import sys
from collections import Counter
from pathlib import Path

INNER_COLOR = {
    "Stable": "#7c3aed",   "Near":   "#dc2626",   "Adream": "#f97316",
    "Awake":  "#2563eb",   "Mobile": "#10b981",   "Remote": "#06b6d4",
}

# 8 Working Actions at cube vertices.
# Coordinates: (x_time, y_space, z_weight) — each ∈ {-1, +1}.
# x=+1 → Quick, x=-1 → Sustained
# y=+1 → Direct, y=-1 → Flexible
# z=+1 → Strong, z=-1 → Light
WORKING_ACTIONS = {
    "Pressing": (-1, +1, +1),
    "Punching": (+1, +1, +1),
    "Wringing": (-1, -1, +1),
    "Slashing": (+1, -1, +1),
    "Gliding":  (-1, +1, -1),
    "Dabbing":  (+1, +1, -1),
    "Floating": (-1, -1, -1),
    "Flicking": (+1, -1, -1),
}

# 12 edges, with the Inner Attitude they participate in.
# An edge varies along ONE axis; the OTHER two factors are fixed.
# Stable (W+S) edges: the 4 where Time varies (W and S fixed) → between Sus/Quick pairs.
# Near (W+T) edges:   the 4 where Space varies (W and T fixed) → between Direct/Flex pairs.
# Awake (S+T) edges:  the 4 where Weight varies (S and T fixed) → between Strong/Light pairs.
EDGES = [
    # Time-edges (Stable's 4 tempi)
    ("Pressing", "Punching", "Stable", "Commanding"),       # Strong-Direct
    ("Wringing", "Slashing", "Stable", "Practical"),        # Strong-Flexible
    ("Gliding",  "Dabbing",  "Stable", "Receptive"),        # Light-Direct
    ("Floating", "Flicking", "Stable", "Self-Contained"),   # Light-Flexible
    # Space-edges (Near's 4 tempi)
    ("Pressing", "Wringing", "Near", "Materialistic"),      # Strong-Sustained
    ("Punching", "Slashing", "Near", "Warm"),               # Strong-Quick
    ("Gliding",  "Floating", "Near", "Human"),              # Light-Sustained
    ("Dabbing",  "Flicking", "Near", "Cool"),               # Light-Quick
    # Weight-edges (Awake's 4 tempi)
    ("Pressing", "Gliding",  "Awake", "Acute"),             # Direct-Sustained
    ("Punching", "Dabbing",  "Awake", "Certain"),           # Direct-Quick
    ("Wringing", "Floating", "Awake", "Doubting"),          # Flexible-Sustained
    ("Slashing", "Flicking", "Awake", "Uncertain"),         # Flexible-Quick
]

# Tempo → (Inner Attitude, edge_key) lookup.
TEMPO_LOOKUP = {}
for a, b, inner, tempo in EDGES:
    TEMPO_LOOKUP[tempo.lower()] = (inner, (a, b))

# Flow-cloud Inner Attitudes (no cube-edge mapping).
FLOW_INNERS = ["Adream", "Mobile", "Remote"]
FLOW_INNER_TEMPI = {
    "Adream": ["Sombre", "Irradiant", "Overpowering", "Diffused"],
    "Mobile": ["Unacknowledged", "Acknowledged", "Revealed", "Concealed"],
    "Remote": ["Egocentric", "Altruistic", "Sociable", "Unsociable"],
}


def load(p):
    return json.loads(Path(p).read_text())


def iso_project(x, y, z, scale=58, cx=185, cy=200):
    """
    Isometric projection. Returns (screen_x, screen_y).
    Standard 30°/30° isometric:
      screen_x = x*cos(30) + y*cos(150) = x*0.866 - y*0.866
      screen_y = -z + (x+y)*sin(30) = -z + (x+y)*0.5
    Scaled + offset to fit viewport.
    """
    sx = (x * 0.866 - y * 0.866) * scale + cx
    sy = (-z + (x + y) * 0.5) * scale + cy
    return (sx, sy)


def tally_surface(samples):
    """Tally per-edge sample counts + Flow-cloud Inner Attitude counts."""
    edge_counts = Counter()      # keyed by (inner, vertex_a, vertex_b)
    edge_drives = {}             # keyed by edge → Counter of drives
    flow_inner_counts = Counter()  # keyed by Adream/Mobile/Remote
    flow_inner_drives = {n: Counter() for n in FLOW_INNERS}
    flow_tempo_counts = Counter()  # keyed by Flow tempo name

    for s in samples:
        c = s["classification"]
        tempo = (c.get("tempo_name") or "").strip()
        drive = c.get("drive_primary") or "unknown"

        tempo_key = tempo.lower()
        if tempo_key in TEMPO_LOOKUP:
            inner, edge = TEMPO_LOOKUP[tempo_key]
            edge_counts[(inner, edge[0], edge[1])] += 1
            edge_drives.setdefault((inner, edge[0], edge[1]), Counter())[drive] += 1
            continue

        # Check Flow-Inner tempi
        for inner, tempi in FLOW_INNER_TEMPI.items():
            if tempo in tempi:
                flow_inner_counts[inner] += 1
                flow_inner_drives[inner][drive] += 1
                flow_tempo_counts[tempo] += 1
                break

    return {
        "edge_counts": edge_counts,
        "edge_drives": edge_drives,
        "flow_inner_counts": flow_inner_counts,
        "flow_inner_drives": flow_inner_drives,
        "flow_tempo_counts": flow_tempo_counts,
    }


def render_cube(label, tally, total, size_w=440, size_h=380):
    """Return SVG for one cube small-multiple."""
    svg = []
    svg.append(f'<svg viewBox="0 0 {size_w} {size_h}" xmlns="http://www.w3.org/2000/svg">')

    # Title
    svg.append(f'<text x="{size_w/2}" y="18" text-anchor="middle" font-size="13" font-weight="600" fill="#1a1a1a">{label}</text>')
    svg.append(f'<text x="{size_w/2}" y="32" text-anchor="middle" font-size="10" fill="#777">{total} samples</text>')

    # Project all 8 vertices
    pts = {name: iso_project(*coord) for name, coord in WORKING_ACTIONS.items()}

    # Draw edges (sorted so back edges drawn first; rough: by -z then by -y)
    edges_with_back = sorted(EDGES, key=lambda e: (
        WORKING_ACTIONS[e[0]][2] + WORKING_ACTIONS[e[1]][2],  # combined weight (lower = back)
        WORKING_ACTIONS[e[0]][1] + WORKING_ACTIONS[e[1]][1],  # combined space
    ))

    for a, b, inner, tempo in edges_with_back:
        x1, y1 = pts[a]
        x2, y2 = pts[b]
        color = INNER_COLOR[inner]
        # Edge thickness encodes sample count at this edge
        cnt = tally["edge_counts"].get((inner, a, b), 0)
        pct = cnt / total if total > 0 else 0
        thickness = 1.5 + 8 * (pct ** 0.5)
        opacity = 0.85 if cnt > 0 else 0.35
        svg.append(
            f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
            f'stroke="{color}" stroke-width="{thickness:.1f}" stroke-opacity="{opacity}" stroke-linecap="round"/>'
        )
        # Edge label (tempo) — midpoint of edge, small offset
        if cnt > 0:
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            svg.append(
                f'<text x="{mx:.1f}" y="{my-3:.1f}" text-anchor="middle" font-size="8" '
                f'fill="{color}" font-weight="600">{tempo} ({cnt})</text>'
            )

    # Draw vertices (8 working actions)
    for name, (x, y) in pts.items():
        # Larger dot at vertices that are part of high-traffic edges
        svg.append(
            f'<circle cx="{x:.1f}" cy="{y:.1f}" r="5" fill="#1f2937" stroke="#fff" stroke-width="1.5"/>'
        )
        # Vertex label — position offset based on which "side" of cube
        ax, ay, az = WORKING_ACTIONS[name]
        # Push label outward
        lx_off = 8 if ay > 0 else -8
        ly_off = -8 if az > 0 else 14
        anchor = "start" if lx_off > 0 else "end"
        svg.append(
            f'<text x="{x + lx_off:.1f}" y="{y + ly_off:.1f}" font-size="9" '
            f'text-anchor="{anchor}" fill="#1f2937" font-weight="600">{name}</text>'
        )

    # Flow-cloud Inner Attitude panel on right side
    panel_x = size_w - 100
    panel_y = 60
    svg.append(
        f'<rect x="{panel_x-6}" y="{panel_y-12}" width="100" height="180" '
        f'fill="none" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="3,2" rx="6"/>'
    )
    svg.append(
        f'<text x="{panel_x+44}" y="{panel_y}" text-anchor="middle" font-size="10" '
        f'font-weight="600" fill="#6b7280">Flow-cloud</text>'
    )
    svg.append(
        f'<text x="{panel_x+44}" y="{panel_y+12}" text-anchor="middle" font-size="8" '
        f'fill="#9ca3af">(Adream/Mobile/Remote)</text>'
    )

    yoff = panel_y + 28
    for inner in FLOW_INNERS:
        cnt = tally["flow_inner_counts"].get(inner, 0)
        pct = cnt / total if total > 0 else 0
        # circle for inner
        radius = 6 + 14 * (pct ** 0.5)
        svg.append(
            f'<circle cx="{panel_x+18}" cy="{yoff+12}" r="{radius:.1f}" fill="{INNER_COLOR[inner]}" '
            f'fill-opacity="0.6" stroke="{INNER_COLOR[inner]}" stroke-width="1.5" stroke-dasharray="3,2"/>'
        )
        svg.append(
            f'<text x="{panel_x+38}" y="{yoff+9}" font-size="10" fill="#1f2937" '
            f'font-weight="600">{inner}</text>'
        )
        svg.append(
            f'<text x="{panel_x+38}" y="{yoff+22}" font-size="9" fill="#6b7280">{cnt} samples</text>'
        )
        yoff += 38

    svg.append('</svg>')
    return "\n".join(svg)


HTML_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Mirodan Effort Cube — canonical viz</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; margin: 24px; background: #fafaf9; color: #1a1a1a; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  .lead { color: #555; font-size: 13px; max-width: 820px; margin: 0 0 16px; }
  .warning { background: #fef3c7; border-left: 3px solid #f59e0b; padding: 10px 14px; margin: 0 0 20px; font-size: 12px; max-width: 820px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-width: 1500px; }
  .cell { background: #fff; border: 1px solid #e5e5e3; border-radius: 6px; padding: 4px; }
  .cell svg { width: 100%; height: auto; }
  .legend { margin-top: 24px; background: #fff; border: 1px solid #e5e5e3; border-radius: 6px; padding: 16px; font-size: 12px; max-width: 820px; }
  .swatch { display: inline-block; width: 14px; height: 14px; margin-right: 6px; vertical-align: middle; border-radius: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
  td { padding: 4px 8px; border-bottom: 1px solid #f0f0ee; vertical-align: top; }
  code { background: #f3f4f6; padding: 1px 4px; border-radius: 2px; font-size: 11px; }
</style>
</head>
<body>
<h1>Mirodan Effort Cube — canonical viz (per vol 2 chapters 1-3)</h1>
<p class="lead">
  One cube, 3 axes (Weight × Space × Time), 8 vertices = 8 Working Actions, 12 edges. Flow is a cloud
  around the cube, not an axis. Each Inner Attitude highlights 4 specific edges in its canonical color.
  Tempi are edge labels. Edge thickness encodes sample count for that tempo at this surface. The three
  Inner Attitudes involving Flow (Adream / Mobile / Remote) live as a side panel since they aren't
  cube edges.
</p>
<div class="warning">
  <b>Note:</b> classifier enum was missing <code>adream</code> and <code>remote</code> from
  <code>inner_attitude</code>, so the Flow-cloud panel will read low. Tempi labels are derived
  from <code>tempo_name</code> field, which IS populated for most samples — so the edge
  weights are real even where inner_attitude is "unknown".
</div>
<div class="grid">
__CELLS__
</div>
<div class="legend">
  <b>Reading guide</b>
  <table>
    <tr><td><b>Cube axes</b></td><td>x = Time (Sustained ↔ Quick) · y = Space (Flexible ↔ Direct) · z = Weight (Light ↔ Strong)</td></tr>
    <tr><td><b>8 vertices</b></td><td>Pressing / Punching / Wringing / Slashing / Gliding / Dabbing / Floating / Flicking (the Working Actions)</td></tr>
    <tr><td><span class="swatch" style="background:#7c3aed"></span><b>Stable</b></td><td>4 Time-edges (W+S fixed, T varies) → Commanding · Receptive · Practical · Self-Contained</td></tr>
    <tr><td><span class="swatch" style="background:#dc2626"></span><b>Near</b></td><td>4 Space-edges (W+T fixed, S varies) → Materialistic · Human · Warm · Cool</td></tr>
    <tr><td><span class="swatch" style="background:#2563eb"></span><b>Awake</b></td><td>4 Weight-edges (S+T fixed, W varies) → Acute · Doubting · Certain · Uncertain</td></tr>
    <tr><td><span class="swatch" style="background:#f97316"></span><b>Adream</b></td><td>Flow-cloud (W+F) → Sombre · Irradiant · Overpowering · Diffused (panel)</td></tr>
    <tr><td><span class="swatch" style="background:#10b981"></span><b>Mobile</b></td><td>Flow-cloud (T+F) → Unacknowledged · Acknowledged · Revealed · Concealed (panel)</td></tr>
    <tr><td><span class="swatch" style="background:#06b6d4"></span><b>Remote</b></td><td>Flow-cloud (S+F) → Egocentric · Altruistic · Sociable · Unsociable (panel)</td></tr>
    <tr><td><b>Edge thickness</b></td><td>encodes sample count at that tempo for this surface</td></tr>
    <tr><td><b>Edge label</b></td><td>tempo name + sample count where count > 0</td></tr>
  </table>
  <p style="margin-top: 12px; color: #555;">
    Per Mirodan: she never uses hexagon, lattice, or wheel topology. Cube + Planes (Table/Door/Wheel) +
    Action axis is the entire visual vocabulary.
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
            continue
        samples = load(path)
        tally = tally_surface(samples)
        svg = render_cube(label, tally, len(samples))
        cells.append(f'<div class="cell">{svg}</div>')

    html = HTML_TEMPLATE.replace("__CELLS__", "\n".join(cells))
    output_path.write_text(html)
    print(f"Wrote {output_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
