#!/usr/bin/env python3
"""
3-shell Laban / Mirodan viz (operator's architecture, 2026-05-18).

Three concentric shells:
- INNER (4 nodes): Aspects — Enclosing / Penetrating / Radiating / Circumscribing.
  Each connects to its 3 legal Inner Attitudes.
- MIDDLE (6 nodes): Inner Attitudes — Stable / Near / Adream (baselines, solid)
  + Awake / Mobile / Remote (action attitudes, dashed).
- OUTER (24 nodes): Tempi, 4 per Inner Attitude, fanning radially outward.

Each surface gets its own small-multiple lattice. Sample counts shown at
the tempi (outermost) and Inner-Attitude (middle) rings. Mirodan canonical
colors used for Inner Attitudes (Near=red, Stable=purple, Adream=orange,
Awake=blue, Mobile=green, Remote=turquoise).

Usage:
    python3 scripts/render-laban-3shell.py <output.html> <label>=<path.json>...
"""

import json
import math
import sys
from collections import Counter
from pathlib import Path

# ─── Mirodan canonical colors (derived from Motion Factors) ───────────────
INNER_COLOR = {
    "Stable": "#7c3aed",   # purple — Weight+Space
    "Near":   "#dc2626",   # red    — Weight+Time
    "Adream": "#f97316",   # orange — Weight+Flow
    "Awake":  "#2563eb",   # blue   — Space+Time
    "Mobile": "#10b981",   # green  — Time+Flow
    "Remote": "#06b6d4",   # turquoise — Space+Flow
}

ASPECT_COLOR = {
    "enclosing":      "#92400e",  # dark amber — Weight-led
    "penetrating":    "#1e40af",  # dark blue   — Space-led
    "radiating":      "#065f46",  # dark green  — Flow-led
    "circumscribing": "#4b5563",  # dark gray   — Time-led
}

DRIVE_COLOR = {
    "doing":   "#3b82f6",
    "spell":   "#10b981",
    "passion": "#ef4444",
    "vision":  "#a855f7",
    "unknown": "#d1d5db",
}

# ─── Hexagon positions for the 6 Inner Attitudes ──────────────────────────
# Angles in degrees, clockwise from 90° (top).
INNER_ANGLES = {
    "Stable":  90,
    "Awake":   30,
    "Near":    330,
    "Mobile":  270,
    "Adream":  210,
    "Remote":  150,
}

# Baselines vs action attitudes (for stroke styling).
BASELINES = {"Stable", "Near", "Adream"}

# Aspect → list of legal Inner Attitudes (factor membership).
ASPECT_INNERS = {
    "enclosing":      ["Stable", "Near", "Adream"],         # Weight-led
    "penetrating":    ["Stable", "Awake", "Remote"],        # Space-led
    "radiating":      ["Adream", "Remote", "Mobile"],       # Flow-led
    "circumscribing": ["Near",   "Mobile", "Awake"],        # Time-led
}

# 4 aspects placed around a small inner square.
ASPECT_ANGLES = {
    "enclosing":      135,  # top-left
    "penetrating":    45,   # top-right
    "radiating":      315,  # bottom-right
    "circumscribing": 225,  # bottom-left
}

# Canonical pole + motor pair per tempo (Mirodan).
# Each tempo's 2 inner factors give a pole pair; the latent factor is the motor axis.
# Motor pairs are the 4 Sustained → Quick Working Action pairs (see references/working-actions.md).
TEMPO_DETAIL: dict[str, dict[str, str]] = {
    # STABLE tempi (Inner = Weight+Space; pole pair is W-pole + S-pole; motor varies along Time)
    "Commanding":     {"pole": "Strong+Direct",   "motor": "pressing→punching"},
    "Practical":      {"pole": "Strong+Flexible", "motor": "wringing→slashing"},
    "Receptive":      {"pole": "Light+Direct",    "motor": "gliding→dabbing"},
    "Self-Contained": {"pole": "Light+Flexible",  "motor": "floating→flicking"},
    # NEAR tempi (Inner = Weight+Time; pole pair is W-pole + T-pole; motor varies along Space)
    "Materialistic":  {"pole": "Strong+Sustained","motor": "pressing→wringing"},
    "Warm":           {"pole": "Strong+Quick",    "motor": "punching→slashing"},
    "Human":          {"pole": "Light+Sustained", "motor": "gliding→floating"},
    "Cool":           {"pole": "Light+Quick",     "motor": "dabbing→flicking"},
    # ADREAM tempi (Inner = Weight+Flow; pole pair is W-pole + F-pole; motor is canonical per Mirodan)
    "Sombre":         {"pole": "Strong+Bound",    "motor": "pressing→slashing"},
    "Overpowering":   {"pole": "Strong+Free",     "motor": "pressing→punching"},
    "Diffused":       {"pole": "Light+Bound",     "motor": "gliding→floating"},
    "Irradiant":      {"pole": "Light+Free",      "motor": "floating→flicking"},
    # MOBILE tempi (Inner = Time+Flow; outer projection only)
    "Unacknowledged": {"pole": "Sustained+Bound", "motor": "pressing→floating"},
    "Acknowledged":   {"pole": "Sustained+Free",  "motor": "gliding→flicking"},
    "Revealed":       {"pole": "Quick+Free",      "motor": "punching→flicking"},
    "Concealed":      {"pole": "Quick+Bound",     "motor": "slashing→dabbing"},
    # REMOTE tempi (Inner = Space+Flow; outer projection only)
    "Egocentric":     {"pole": "Direct+Bound",    "motor": "pressing→gliding"},
    "Altruistic":     {"pole": "Direct+Free",     "motor": "dabbing→floating"},
    "Sociable":       {"pole": "Flexible+Free",   "motor": "slashing→flicking"},
    "Unsociable":     {"pole": "Flexible+Bound",  "motor": "wringing→floating"},
    # AWAKE tempi (Inner = Space+Time; outer projection only)
    "Acute":          {"pole": "Direct+Quick",    "motor": "punching→dabbing"},
    "Doubting":       {"pole": "Flexible+Quick",  "motor": "slashing→flicking"},
    "Certain":        {"pole": "Direct+Sustained","motor": "pressing→gliding"},
    "Uncertain":      {"pole": "Flexible+Sustained","motor": "wringing→floating"},
}

# 4 tempi per Inner Attitude (from skill / Mirodan).
INNER_TEMPI = {
    "Stable": ["Commanding", "Receptive", "Practical", "Self-Contained"],
    "Near":   ["Materialistic", "Human", "Warm", "Cool"],
    "Adream": ["Sombre", "Irradiant", "Overpowering", "Diffused"],
    "Mobile": ["Unacknowledged", "Acknowledged", "Revealed", "Concealed"],
    "Remote": ["Egocentric", "Altruistic", "Sociable", "Unsociable"],
    "Awake":  ["Acute", "Doubting", "Certain", "Uncertain"],
}

# Tempo → Inner Attitude (reverse lookup).
TEMPO_INNER = {}
for inner, tempi in INNER_TEMPI.items():
    for t in tempi:
        TEMPO_INNER[t.lower()] = inner


def load(p):
    return json.loads(Path(p).read_text())


def polar(angle_deg, cx, cy, r):
    rad = math.radians(angle_deg)
    return (cx + r * math.cos(rad), cy - r * math.sin(rad))


def tally_surface(samples):
    """Return per-Inner-Attitude + per-Tempo counts for one surface."""
    inner_counts = Counter()
    tempo_counts = Counter()
    inner_drives = {inner: Counter() for inner in INNER_ANGLES}
    aspect_counts = Counter()

    for s in samples:
        c = s["classification"]
        # Inner attitude — but classifier enum was broken, so adream/remote may
        # be 0. We still tally what's there.
        inner = c.get("inner_attitude") or "unknown"
        inner_cap = inner.capitalize() if inner != "unknown" else None
        if inner_cap in INNER_ANGLES:
            inner_counts[inner_cap] += 1
            d = c.get("drive_primary") or "unknown"
            inner_drives[inner_cap][d] += 1

        # v2 classifier emits `tempo_primary`; fall back to `tempo_name` (v1)
        tempo = c.get("tempo_primary") or c.get("tempo_name") or ""
        # Strip leading/trailing whitespace and lower for lookup
        tempo_key = tempo.strip().lower()
        if tempo_key in TEMPO_INNER:
            tempo_counts[tempo] += 1

        # v2 also emits outer_action_tempi — count those as additional tempo hits
        # so a Stable-D sample that flashes Unsociable lights up the Remote tempo
        # too (the user's "track outer-action beats" requirement)
        outer_tempi = c.get("outer_action_tempi") or []
        for ot in outer_tempi:
            if not isinstance(ot, str):
                continue
            ot_key = ot.strip().lower()
            if ot_key in TEMPO_INNER:
                tempo_counts[ot] += 1
                # Bump the outer inner-attitude too
                outer_inner = TEMPO_INNER[ot_key]
                if outer_inner in INNER_ANGLES:
                    inner_counts[outer_inner] += 1

        aspect = c.get("aspect") or "unknown"
        if aspect != "unknown":
            aspect_counts[aspect] += 1

    return {
        "inner_counts": inner_counts,
        "tempo_counts": tempo_counts,
        "inner_drives": inner_drives,
        "aspect_counts": aspect_counts,
    }


def render_3shell(label, tally, total, size=560):
    """Return SVG for one 3-shell mini-lattice."""
    cx, cy = size / 2, size / 2
    # Three radii: aspect inner, inner attitude middle, tempi outer.
    r_aspect = 52
    r_inner = 140
    r_tempo = 215

    svg = []
    # ViewBox is wider than tall to give horizontal label room.
    svg.append(f'<svg viewBox="0 0 {size} {size+40}" xmlns="http://www.w3.org/2000/svg">')

    # Title at top.
    svg.append(f'<text x="{cx}" y="18" text-anchor="middle" font-size="13" font-weight="600" fill="#1a1a1a">{label}</text>')
    svg.append(f'<text x="{cx}" y="32" text-anchor="middle" font-size="10" fill="#777">{total} samples</text>')

    # ─── Stress-triangle overlays (drawn first → behind everything else) ──
    # Each triangle = 2 baselines + 1 action attitude. Reached via 2 stress
    # combos. Colored by action attitude (Mirodan canonical).
    STRESS_TRIANGLES = [
        ("Stable", "Near", "Awake"),    # blue
        ("Stable", "Adream", "Remote"), # turquoise
        ("Near", "Adream", "Mobile"),   # green
    ]
    for n1, n2, action in STRESS_TRIANGLES:
        p1 = polar(INNER_ANGLES[n1], cx, cy + 20, r_inner)
        p2 = polar(INNER_ANGLES[n2], cx, cy + 20, r_inner)
        p3 = polar(INNER_ANGLES[action], cx, cy + 20, r_inner)
        pts_str = f"{p1[0]:.1f},{p1[1]:.1f} {p2[0]:.1f},{p2[1]:.1f} {p3[0]:.1f},{p3[1]:.1f}"
        svg.append(
            f'<polygon points="{pts_str}" fill="{INNER_COLOR[action]}" fill-opacity="0.07" '
            f'stroke="{INNER_COLOR[action]}" stroke-opacity="0.30" stroke-width="1"/>'
        )

    # Edges: Aspect → its 3 legal Inner Attitudes.
    for aspect, inners in ASPECT_INNERS.items():
        ax, ay = polar(ASPECT_ANGLES[aspect], cx, cy + 20, r_aspect)
        for inner in inners:
            ix, iy = polar(INNER_ANGLES[inner], cx, cy + 20, r_inner)
            svg.append(
                f'<line x1="{ax:.1f}" y1="{ay:.1f}" x2="{ix:.1f}" y2="{iy:.1f}" '
                f'stroke="{ASPECT_COLOR[aspect]}" stroke-opacity="0.20" stroke-width="1"/>'
            )

    # Tempi spokes: outer arc for each Inner Attitude with 4 tempi dots.
    # Wider angular spread (50°) so labels don't collide horizontally.
    for inner, tempi in INNER_TEMPI.items():
        ix, iy = polar(INNER_ANGLES[inner], cx, cy + 20, r_inner)
        base_angle = INNER_ANGLES[inner]
        spread = 50
        for j, tempo in enumerate(tempi):
            ang = base_angle + (j - 1.5) * (spread / 3)
            tx, ty = polar(ang, cx, cy + 20, r_tempo)
            # Line from inner attitude to tempo
            svg.append(
                f'<line x1="{ix:.1f}" y1="{iy:.1f}" x2="{tx:.1f}" y2="{ty:.1f}" '
                f'stroke="{INNER_COLOR[inner]}" stroke-opacity="0.18" stroke-width="0.8"/>'
            )
            # Tempo dot — size = count, color = Inner Attitude color
            tempo_count = tally["tempo_counts"].get(tempo, 0)
            pct = tempo_count / total if total > 0 else 0
            tr = 2.5 + 11 * (pct ** 0.6)
            opacity = 0.88 if tempo_count > 0 else 0.22
            svg.append(
                f'<circle cx="{tx:.1f}" cy="{ty:.1f}" r="{tr:.1f}" fill="{INNER_COLOR[inner]}" '
                f'fill-opacity="{opacity}" stroke="{INNER_COLOR[inner]}" stroke-width="0.6"/>'
            )
            # Tempo label — RADIAL ROTATION so labels don't pile horizontally.
            # The text rotates with the tempo's radial angle. For the bottom
            # half (angles 180-360) we flip 180° so text reads left-to-right.
            lx, ly = polar(ang, cx, cy + 20, r_tempo + 18)
            # SVG rotation is clockwise; 0° points right. Our angles are
            # math-conventional (0° right, 90° top), so SVG rotation = -ang.
            # Then flip if the label would be upside-down.
            ang_normalized = ang % 360
            flip = 90 < ang_normalized < 270
            label_rot = (-ang + 90) if not flip else (-ang + 90 + 180)
            # When flipped, text-anchor should be END (so it grows toward center, then flips)
            text_anchor = "end" if flip else "start"
            # Tempo name + count (primary line)
            svg.append(
                f'<text x="{lx:.1f}" y="{ly:.1f}" text-anchor="{text_anchor}" '
                f'transform="rotate({label_rot:.1f} {lx:.1f} {ly:.1f})" '
                f'font-size="9" font-weight="600" fill="#1f2937">'
                f'{tempo}{f" ({tempo_count})" if tempo_count else ""}</text>'
            )
            # Canonical pole pair + motor pair (secondary line, smaller, gray)
            detail = TEMPO_DETAIL.get(tempo)
            if detail:
                svg.append(
                    f'<text x="{lx:.1f}" y="{ly+10:.1f}" text-anchor="{text_anchor}" '
                    f'transform="rotate({label_rot:.1f} {lx:.1f} {ly+10:.1f})" '
                    f'font-size="7" fill="#6b7280">{detail["pole"]}</text>'
                )
                svg.append(
                    f'<text x="{lx:.1f}" y="{ly+19:.1f}" text-anchor="{text_anchor}" '
                    f'transform="rotate({label_rot:.1f} {lx:.1f} {ly+19:.1f})" '
                    f'font-size="6.5" font-style="italic" fill="#9ca3af">{detail["motor"]}</text>'
                )

    # Hexagon edges between Inner Attitudes (baseline → action attitude deviations).
    INNER_EDGES = [
        ("Stable", "Awake"), ("Stable", "Remote"),
        ("Near",   "Awake"), ("Near",   "Mobile"),
        ("Adream", "Mobile"), ("Adream", "Remote"),
    ]
    for a, b in INNER_EDGES:
        ax, ay = polar(INNER_ANGLES[a], cx, cy + 15, r_inner)
        bx, by = polar(INNER_ANGLES[b], cx, cy + 15, r_inner)
        svg.append(
            f'<line x1="{ax:.1f}" y1="{ay:.1f}" x2="{bx:.1f}" y2="{by:.1f}" '
            f'stroke="#9ca3af" stroke-width="1" stroke-opacity="0.5"/>'
        )

    # Inner Attitude nodes (middle ring).
    for inner, angle in INNER_ANGLES.items():
        ix, iy = polar(angle, cx, cy + 20, r_inner)
        count = tally["inner_counts"].get(inner, 0)
        pct = count / total if total > 0 else 0
        node_r = 12 + 18 * (pct ** 0.5)
        is_baseline = inner in BASELINES
        dash = "" if is_baseline else 'stroke-dasharray="4,3"'
        svg.append(
            f'<circle cx="{ix:.1f}" cy="{iy:.1f}" r="{node_r:.1f}" fill="{INNER_COLOR[inner]}" '
            f'fill-opacity="0.45" stroke="{INNER_COLOR[inner]}" stroke-width="2" {dash}/>'
        )
        svg.append(
            f'<text x="{ix:.1f}" y="{iy+3:.1f}" text-anchor="middle" font-size="10" '
            f'font-weight="700" fill="#fff" style="paint-order: stroke; stroke: rgba(0,0,0,0.6); stroke-width: 0.6px;">'
            f'{inner}</text>'
        )
        if count > 0:
            svg.append(
                f'<text x="{ix:.1f}" y="{iy+14:.1f}" text-anchor="middle" font-size="9" '
                f'fill="#1f2937">{count}</text>'
            )

    # Aspect nodes (inner core).
    for aspect, angle in ASPECT_ANGLES.items():
        ax, ay = polar(angle, cx, cy + 20, r_aspect)
        a_count = tally["aspect_counts"].get(aspect, 0)
        a_pct = a_count / total if total > 0 else 0
        a_r = 8 + 8 * (a_pct ** 0.5)
        svg.append(
            f'<circle cx="{ax:.1f}" cy="{ay:.1f}" r="{a_r:.1f}" fill="{ASPECT_COLOR[aspect]}" '
            f'fill-opacity="0.55" stroke="{ASPECT_COLOR[aspect]}" stroke-width="1.5"/>'
        )
        svg.append(
            f'<text x="{ax:.1f}" y="{ay+3:.1f}" text-anchor="middle" font-size="7" '
            f'font-weight="700" fill="#fff" style="paint-order: stroke; stroke: rgba(0,0,0,0.6); stroke-width: 0.6px;">'
            f'{aspect[:4].title()}</text>'
        )

    svg.append('</svg>')
    return "\n".join(svg)


HTML_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>3-shell Laban viz — operator architecture</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; margin: 24px; background: #fafaf9; color: #1a1a1a; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  .lead { color: #555; font-size: 13px; max-width: 800px; margin: 0 0 16px; }
  .warning { background: #fef3c7; border-left: 3px solid #f59e0b; padding: 10px 14px; margin: 0 0 20px; font-size: 12px; max-width: 800px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-width: 1500px; }
  .cell { background: #fff; border: 1px solid #e5e5e3; border-radius: 6px; padding: 4px; }
  .cell svg { width: 100%; height: auto; }
  .legend { margin-top: 24px; background: #fff; border: 1px solid #e5e5e3; border-radius: 6px; padding: 16px; font-size: 12px; max-width: 800px; }
  .swatch { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
  .swatch.dash { border: 2px dashed; background: transparent; box-sizing: border-box; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
  td { padding: 4px 8px; border-bottom: 1px solid #f0f0ee; }
</style>
</head>
<body>
<h1>3-shell Laban viz — operator's architecture (2026-05-18)</h1>
<p class="lead">
  <b>Inner core (4 small nodes)</b>: Aspects — Enclosing (Weight-led) / Penetrating (Space-led) / Radiating (Flow-led) / Circumscribing (Time-led). Each connects to its 3 legal Inner Attitudes.<br>
  <b>Middle ring (6 hexagon nodes)</b>: Inner Attitudes — Stable / Near / Adream (baselines, solid stroke) + Awake / Mobile / Remote (action attitudes, dashed stroke). Mirodan canonical colors.<br>
  <b>Outer ring (24 dots)</b>: Tempi — 4 per Inner Attitude, fanning radially outward. Dot size = sample count.
</p>
<div class="warning">
  <b>Note:</b> the source classifier was missing <code>adream</code> and <code>remote</code> from the inner_attitude enum, and missing <code>enclosing</code> and <code>radiating</code> from the aspect enum. So those nodes/sectors will read as empty in this smoke. Tempi populated where Sonnet emitted a recognized tempo name. Re-classify with corrected enum to see full distribution.
</div>
<div class="grid">
__CELLS__
</div>
<div class="legend">
  <b>Reading guide</b>
  <table>
    <tr><td><span class="swatch" style="background:#7c3aed"></span>Stable</td><td>Weight+Space baseline (purple)</td></tr>
    <tr><td><span class="swatch" style="background:#dc2626"></span>Near</td><td>Weight+Time baseline (red)</td></tr>
    <tr><td><span class="swatch" style="background:#f97316"></span>Adream</td><td>Weight+Flow baseline (orange)</td></tr>
    <tr><td><span class="swatch" style="background:#2563eb"></span>Awake</td><td>Space+Time action attitude (blue)</td></tr>
    <tr><td><span class="swatch" style="background:#10b981"></span>Mobile</td><td>Time+Flow action attitude (green)</td></tr>
    <tr><td><span class="swatch" style="background:#06b6d4"></span>Remote</td><td>Space+Flow action attitude (turquoise)</td></tr>
    <tr><td><span class="swatch dash" style="border-color:#374151"></span>dashed stroke</td><td>action attitude (outer-only)</td></tr>
    <tr><td><span class="swatch" style="background:#92400e"></span>Enclosing</td><td>Weight-led aspect → Stable, Near, Adream</td></tr>
    <tr><td><span class="swatch" style="background:#1e40af"></span>Penetrating</td><td>Space-led aspect → Stable, Awake, Remote</td></tr>
    <tr><td><span class="swatch" style="background:#065f46"></span>Radiating</td><td>Flow-led aspect → Adream, Mobile, Remote</td></tr>
    <tr><td><span class="swatch" style="background:#4b5563"></span>Circumscribing</td><td>Time-led aspect → Near, Mobile, Awake</td></tr>
  </table>

  <p style="margin-top: 14px;"><b>Stress-triangle overlays (light filled triangles):</b></p>
  <table>
    <tr><td><span class="swatch" style="background:#2563eb;opacity:0.45"></span><b>Awake triangle</b> {Stable, Near, Awake}</td><td>reached via Stable+Time-stress OR Near+Space-stress</td></tr>
    <tr><td><span class="swatch" style="background:#06b6d4;opacity:0.45"></span><b>Remote triangle</b> {Stable, Adream, Remote}</td><td>reached via Stable+Flow-stress OR Adream+Space-stress</td></tr>
    <tr><td><span class="swatch" style="background:#10b981;opacity:0.45"></span><b>Mobile triangle</b> {Near, Adream, Mobile}</td><td>reached via Near+Flow-stress OR Adream+Time-stress</td></tr>
  </table>
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
        svg = render_3shell(label, tally, len(samples))
        cells.append(f'<div class="cell">{svg}</div>')

    html = HTML_TEMPLATE.replace("__CELLS__", "\n".join(cells))
    output_path.write_text(html)
    print(f"Wrote {output_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
