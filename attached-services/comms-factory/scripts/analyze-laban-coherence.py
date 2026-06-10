#!/usr/bin/env python3
"""
Laban / Mirodan coherence analyzer.

Given 1+ classification JSON files (output of scripts/classify-corpus.ts),
compute per-surface character placement, cluster tightness, and cross-surface
coherence. Reusable across brands.

Usage:
    python3 scripts/analyze-laban-coherence.py <brand> <classifications.json>...

Example:
    python3 scripts/analyze-laban-coherence.py phantom \\
        research/phantom-classifications-website.json \\
        research/phantom-classifications-tweets.json \\
        research/phantom-classifications-app-adjacent.json \\
        > research/phantom-laban-coherence.md
"""

import json
import sys
from collections import Counter
from pathlib import Path

# Infinex locked placement, as the contrast reference.
INFINEX_LOCKED = {
    "inner_attitude": "stable",
    "stress": "flow",
    "pole": "bound",
    "aspect": "penetrating",
    "drive_primary": "spell",
    "drive_secondary": "vision",
}

AXES = [
    "inner_attitude",
    "stress",
    "pole",
    "aspect",
    "drive_primary",
    "drive_secondary",
]


def load(path: Path) -> list:
    return json.loads(path.read_text())


def surface_name_from_path(path: Path) -> str:
    """research/phantom-classifications-website.json -> 'website'."""
    stem = path.stem  # phantom-classifications-website
    # Find substring after '-classifications-'
    marker = "-classifications-"
    if marker in stem:
        return stem.split(marker, 1)[1]
    return stem


def get_axis(sample: dict, axis: str):
    return sample["classification"].get(axis)


def drive_combo(sample: dict) -> str:
    c = sample["classification"]
    p = c.get("drive_primary") or "unknown"
    s = c.get("drive_secondary")
    return f"{p}+{s}" if s else p


def fmt_counter(counter: Counter, total: int, top_n: int = 6) -> str:
    parts = []
    for k, v in counter.most_common(top_n):
        pct = 100 * v / total if total else 0
        parts.append(f"`{k}` {v} ({pct:.0f}%)")
    return ", ".join(parts)


def cluster_tightness(samples: list, axis: str) -> tuple:
    """
    Return (mode, mode_count, total, pct, entropy_normalized).

    Entropy_normalized: 0.0 = perfectly clustered, 1.0 = perfectly uniform.
    """
    c = Counter(get_axis(s, axis) for s in samples)
    total = sum(c.values())
    if total == 0:
        return ("(none)", 0, 0, 0.0, 0.0)
    mode, mode_count = c.most_common(1)[0]
    pct = 100 * mode_count / total
    # Shannon entropy normalized by log(k)
    import math
    k = len(c)
    if k <= 1:
        return (mode, mode_count, total, pct, 0.0)
    h = -sum((v / total) * math.log(v / total) for v in c.values() if v > 0)
    h_norm = h / math.log(k)
    return (mode, mode_count, total, pct, h_norm)


def per_surface_section(name: str, samples: list) -> str:
    lines = []
    lines.append(f"### `{name}` — {len(samples)} samples\n")

    # Per-axis distribution
    lines.append("**Per-axis distribution** (mode shown in **bold**, top 6 shown):\n")
    lines.append("| Axis | Distribution | Mode % | Cluster tightness (0=tight) |")
    lines.append("|---|---|---|---|")
    for axis in AXES:
        counter = Counter(get_axis(s, axis) for s in samples)
        mode, mode_count, total, pct, h_norm = cluster_tightness(samples, axis)
        # Bold the mode in distribution
        parts = []
        for k, v in counter.most_common(6):
            p = 100 * v / total if total else 0
            tok = f"`{k}` {v} ({p:.0f}%)"
            if k == mode:
                tok = f"**{tok}**"
            parts.append(tok)
        dist = ", ".join(parts)
        lines.append(f"| `{axis}` | {dist} | {pct:.0f}% | {h_norm:.2f} |")
    lines.append("")

    # Drive combos
    combos = Counter(drive_combo(s) for s in samples)
    total = sum(combos.values())
    lines.append("**Drive combinations** (full primary+secondary signature):\n")
    for k, v in combos.most_common(8):
        p = 100 * v / total if total else 0
        lines.append(f"- `{k}` — {v} ({p:.0f}%)")
    lines.append("")

    # Tempi
    tempi = Counter(s["classification"].get("tempo_name") for s in samples)
    total = sum(tempi.values())
    lines.append("**Tempo distribution**:\n")
    for k, v in tempi.most_common(8):
        p = 100 * v / total if total else 0
        lines.append(f"- `{k}` — {v} ({p:.0f}%)")
    lines.append("")

    # Confidence
    confs = [s["classification"].get("confidence", 0) for s in samples]
    if confs:
        avg = sum(confs) / len(confs)
        hi = sum(1 for c in confs if c >= 0.7)
        lo = sum(1 for c in confs if c < 0.5)
        lines.append(
            f"**Confidence**: avg {avg:.2f}; high-conf (≥0.70) = {hi}/{len(confs)}; "
            f"low-conf (<0.50) = {lo}/{len(confs)}."
        )
    lines.append("")

    # Dominant placement (the modal combo of all axes)
    placement = tuple(cluster_tightness(samples, ax)[0] for ax in AXES)
    drive_combo_dom = combos.most_common(1)[0] if combos else ("(none)", 0)
    lines.append(
        f"**Dominant placement (mode-of-modes)**: "
        f"inner=`{placement[0]}` · stress=`{placement[1]}` (`{placement[2]}` pole) · "
        f"aspect=`{placement[3]}` · drive=`{drive_combo_dom[0]}`"
    )
    lines.append("")

    return "\n".join(lines)


def cross_surface_table(surfaces: dict) -> str:
    """Compare modes across surfaces. Flag agreement vs divergence."""
    lines = []
    lines.append("| Axis | " + " | ".join(surfaces.keys()) + " | Agreement |")
    lines.append("|---|" + "|".join(["---"] * len(surfaces)) + "|---|")
    for axis in AXES:
        modes = {}
        for sname, samples in surfaces.items():
            mode, _, _, _, _ = cluster_tightness(samples, axis)
            modes[sname] = mode
        all_same = len(set(modes.values())) == 1
        # Count "unknown" modes
        non_unknown = [m for m in modes.values() if m not in ("unknown", "n/a", None)]
        all_legible_same = len(set(non_unknown)) <= 1
        if all_same and "unknown" not in modes.values():
            agreement = "✅ UNIFIED"
        elif all_legible_same:
            agreement = "🟡 partial (legible surfaces agree, some unknown)"
        else:
            agreement = "❌ DIVERGENT"
        row = [f"| `{axis}`"]
        for sname in surfaces:
            row.append(f"`{modes[sname]}`")
        row.append(agreement)
        lines.append(" | ".join(row) + " |")
    return "\n".join(lines)


def anchor_check(surfaces: dict) -> str:
    """
    Check whether ANY axis shows consistent placement across all surfaces.
    Also check drive-family coherence (doing/passion vs spell/vision).
    """
    lines = []
    lines.append("**Per-axis anchor check** (does any single dimension hold across all surfaces?):\n")
    for axis in AXES:
        modes = [cluster_tightness(s, axis)[0] for s in surfaces.values()]
        unique = set(modes)
        if len(unique) == 1 and "unknown" not in unique:
            lines.append(f"- ✅ `{axis}` is consistent across all surfaces: **`{modes[0]}`**")
        elif len(unique) <= 2 and "unknown" in unique:
            non_u = [m for m in unique if m != "unknown"]
            if len(non_u) == 1:
                lines.append(
                    f"- 🟡 `{axis}` is consistent where legible: **`{non_u[0]}`** (some surfaces unknown)"
                )
            else:
                lines.append(f"- ❌ `{axis}` divergent: {', '.join(f'`{m}`' for m in modes)}")
        else:
            lines.append(f"- ❌ `{axis}` divergent: {', '.join(f'`{m}`' for m in modes)}")
    lines.append("")

    # Drive family check: doing/passion vs spell/vision share
    DOING_PASSION = {"doing", "passion"}
    SPELL_VISION = {"spell", "vision"}
    lines.append("**Drive-family share** (across all samples in each surface):\n")
    lines.append("| Surface | Doing-Passion family | Spell-Vision family | Unknown | N |")
    lines.append("|---|---|---|---|---|")
    for sname, samples in surfaces.items():
        n = len(samples)
        dp = 0
        sv = 0
        un = 0
        mixed = 0
        for s in samples:
            c = s["classification"]
            p = c.get("drive_primary")
            sec = c.get("drive_secondary")
            drives_in_sample = {d for d in (p, sec) if d and d != "unknown"}
            if not drives_in_sample:
                un += 1
            elif drives_in_sample.issubset(DOING_PASSION):
                dp += 1
            elif drives_in_sample.issubset(SPELL_VISION):
                sv += 1
            else:
                mixed += 1
        lines.append(
            f"| `{sname}` | {dp} ({100*dp/n:.0f}%) | {sv} ({100*sv/n:.0f}%) | {un} ({100*un/n:.0f}%) | {n} |"
        )
        if mixed:
            lines.append(f"  *Plus {mixed} mixed-family samples not counted in either column.*")
    lines.append("")
    return "\n".join(lines)


def vs_infinex(surfaces: dict) -> str:
    lines = []
    lines.append("**Phantom vs Infinex (locked: stable + flow + bound + penetrating + spell-vision):**\n")
    lines.append("| Axis | Infinex | " + " | ".join(surfaces.keys()) + " | Phantom anywhere matches Infinex? |")
    lines.append("|---|" + "|".join(["---"] * (len(surfaces) + 2)) + "|")
    for axis in AXES:
        inf = INFINEX_LOCKED.get(axis)
        modes = [cluster_tightness(s, axis)[0] for s in surfaces.values()]
        matches_any = any(m == inf for m in modes)
        row = [f"| `{axis}`", f"`{inf}`"]
        for m in modes:
            tok = f"`{m}`" + (" ✅" if m == inf else "")
            row.append(tok)
        row.append("✅" if matches_any else "❌")
        lines.append(" | ".join(row) + " |")
    return "\n".join(lines)


def main():
    if len(sys.argv) < 3:
        print("Usage: analyze-laban-coherence.py <brand> <classifications.json>...", file=sys.stderr)
        sys.exit(1)

    brand = sys.argv[1]
    surface_paths = [Path(p) for p in sys.argv[2:]]
    surfaces = {}
    for p in surface_paths:
        name = surface_name_from_path(p)
        surfaces[name] = load(p)

    out = []
    out.append(f"# Laban / Mirodan coherence analysis — {brand}")
    out.append("")
    out.append(
        f"Generated by `scripts/analyze-laban-coherence.py`. "
        f"Surfaces analyzed: {', '.join(f'`{n}` ({len(s)} samples)' for n, s in surfaces.items())}."
    )
    out.append("")

    out.append("## 1. Per-surface character\n")
    for name, samples in surfaces.items():
        out.append(per_surface_section(name, samples))

    out.append("## 2. Cross-surface comparison\n")
    out.append("**Modes per axis across surfaces:**\n")
    out.append(cross_surface_table(surfaces))
    out.append("")

    out.append("## 3. Coherence verdict\n")
    out.append(anchor_check(surfaces))

    out.append("## 4. Contrast against Infinex\n")
    out.append(vs_infinex(surfaces))
    out.append("")

    out.append("## 5. Methodology notes\n")
    out.append(
        "- Classifications via `scripts/classify-corpus.ts` (Sonnet 4.6, batched, "
        "system prompt teaches the Mirodan framework with 5 worked literary anchors).\n"
        "- Cluster tightness column: 0.00 = perfectly clustered (one value covers everything), "
        "1.00 = perfectly uniform (no dominant value). Below 0.50 = clear modal placement; "
        "above 0.70 = scattered / multi-register.\n"
        "- Drive-family share: a sample counts as Doing-Passion family if all its legible drives "
        "(primary + secondary) are in `{doing, passion}`; same for Spell-Vision. Mixed samples "
        "are reported separately.\n"
    )

    print("\n".join(out))


if __name__ == "__main__":
    main()
