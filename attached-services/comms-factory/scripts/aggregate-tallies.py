#!/usr/bin/env python3
"""
Aggregate v2 classifications into tallies.json for the 3-shell Laban viz.

Reads 9 per-surface JSONs from research/{phantom,infinex}-classifications-*.json
and emits research/laban-viz/data/tallies.json — the data source consumed by
research/laban-viz/app.jsx.

Aggregation rules (deterministic):
- innerCounts / tempoCounts: primary attitude/tempo + outer_action_inners/tempi
  (multi-count: a Stable-D sample flashing an Unsociable outer beat lights up
  both Stable AND Remote inner attitudes). Unknowns excluded.
- aspectCounts: primary aspect only (no outer-aspect concept in the framework).
- driveAxisCounts: primary drive_axis only (drive is per placement).
- driveByInner: per primary inner attitude, count of drive_primary observations.
- driveByTempo: per primary tempo, count of drive_axis observations.
- exemplars: top 3 samples where this is the primary tempo, ranked by
  classification.confidence DESC then by id ASC, text truncated to 150 chars.

Usage:
    python3 scripts/aggregate-tallies.py
"""

import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESEARCH = ROOT / "research"
OUT = RESEARCH / "laban-viz" / "data" / "tallies.json"

INNER_TEMPI = {
    "Stable": ["Commanding", "Receptive", "Practical", "Self-Contained"],
    "Near":   ["Materialistic", "Human", "Warm", "Cool"],
    "Adream": ["Sombre", "Irradiant", "Overpowering", "Diffused"],
    "Mobile": ["Unacknowledged", "Acknowledged", "Revealed", "Concealed"],
    "Remote": ["Egocentric", "Altruistic", "Sociable", "Unsociable"],
    "Awake":  ["Acute", "Doubting", "Certain", "Uncertain"],
}
INNERS = list(INNER_TEMPI.keys())
TEMPO_INNER = {t: inner for inner, ts in INNER_TEMPI.items() for t in ts}

ASPECTS = ["enclosing", "penetrating", "radiating", "circumscribing"]
DRIVES = ["doing", "spell", "passion", "vision"]

SURFACES = [
    ("Phantom website",       RESEARCH / "phantom-classifications-website.json"),
    ("Phantom tweets",        RESEARCH / "phantom-classifications-tweets.json"),
    ("Phantom app-adjacent",  RESEARCH / "phantom-classifications-app-adjacent.json"),
    ("Phantom app",           RESEARCH / "phantom-classifications-app.json"),
    ("Infinex marketing",     RESEARCH / "infinex-classifications-marketing.json"),
    ("Infinex utility",       RESEARCH / "infinex-classifications-utility.json"),
    ("Infinex emergency",     RESEARCH / "infinex-classifications-emergency.json"),
    ("Infinex tweets",        RESEARCH / "infinex-classifications-tweets.json"),
    ("Infinex blog",          RESEARCH / "infinex-classifications-blog.json"),
]

EXEMPLAR_MAX = 150
EXEMPLAR_PER_TEMPO = 3


def _norm_inner(value):
    if not value or not isinstance(value, str):
        return None
    cap = value.strip().capitalize()
    return cap if cap in INNERS else None


def _norm_tempo(value):
    if not value or not isinstance(value, str):
        return None
    key = value.strip()
    return key if key in TEMPO_INNER else None


def _norm_aspect(value):
    if not value or not isinstance(value, str):
        return None
    key = value.strip().lower()
    return key if key in ASPECTS else None


def _norm_drive(value):
    if not value or not isinstance(value, str):
        return None
    key = value.strip().lower()
    return key if key in DRIVES else None


def _truncate(text, n=EXEMPLAR_MAX):
    text = " ".join((text or "").split())
    return text if len(text) <= n else text[:n - 1].rstrip() + "…"


def aggregate(label, samples):
    inner_counts = Counter()
    tempo_counts = Counter()
    aspect_counts = Counter()
    drive_axis_counts = Counter()
    drive_by_inner = {inner: Counter() for inner in INNERS}
    drive_by_tempo = defaultdict(Counter)
    exemplars_pool = defaultdict(list)

    for s in samples:
        c = s.get("classification") or {}
        text = s.get("text") or ""

        # Primary inner attitude
        inner = _norm_inner(c.get("inner_attitude"))
        if inner:
            inner_counts[inner] += 1
            drive = _norm_drive(c.get("drive_primary"))
            if drive:
                drive_by_inner[inner][drive] += 1

        # Primary tempo
        tempo = _norm_tempo(c.get("tempo_primary") or c.get("tempo_name"))
        if tempo:
            tempo_counts[tempo] += 1
            drive_axis = c.get("drive_axis")
            if isinstance(drive_axis, str) and "→" in drive_axis and drive_axis != "n/a":
                drive_axis_counts[drive_axis] += 1
                drive_by_tempo[tempo][drive_axis] += 1
            exemplars_pool[tempo].append({
                "text": _truncate(text),
                "confidence": c.get("confidence") or 0,
                "id": s.get("id") or "",
            })

        # Outer action beats — lights up secondary tempi + their inners,
        # but does NOT contribute to drive aggregates (drive is per placement).
        for ot in c.get("outer_action_tempi") or []:
            t = _norm_tempo(ot)
            if t:
                tempo_counts[t] += 1
        for oi in c.get("outer_action_inners") or []:
            i = _norm_inner(oi)
            if i:
                inner_counts[i] += 1

        # Primary aspect
        aspect = _norm_aspect(c.get("aspect"))
        if aspect:
            aspect_counts[aspect] += 1

    # Rank exemplars: by confidence DESC, then id ASC. Top N per tempo.
    exemplars = {}
    for tempo, pool in exemplars_pool.items():
        ranked = sorted(pool, key=lambda x: (-(x["confidence"] or 0), x["id"]))
        exemplars[tempo] = [e["text"] for e in ranked[:EXEMPLAR_PER_TEMPO]]

    # Compact drive_by_tempo: only emit tempi with observations
    drive_by_tempo_out = {t: dict(d) for t, d in drive_by_tempo.items() if d}

    return {
        "label": label,
        "total": len(samples),
        "innerCounts": dict(inner_counts),
        "tempoCounts": dict(tempo_counts),
        "aspectCounts": dict(aspect_counts),
        "exemplars": exemplars,
        "driveAxisCounts": dict(drive_axis_counts),
        "driveByInner": {k: dict(v) for k, v in drive_by_inner.items() if v},
        "driveByTempo": drive_by_tempo_out,
    }


def main():
    out = []
    for label, path in SURFACES:
        if not path.exists():
            print(f"WARN: missing {path}", flush=True)
            continue
        samples = json.loads(path.read_text())
        out.append(aggregate(label, samples))
        s = out[-1]
        print(
            f"  {label:<24} total={s['total']:>3}  "
            f"inners={sum(s['innerCounts'].values()):>3}  "
            f"tempi={sum(s['tempoCounts'].values()):>3}  "
            f"aspects={sum(s['aspectCounts'].values()):>3}  "
            f"drives={sum(s['driveAxisCounts'].values()):>3}  "
            f"({len(s['driveAxisCounts'])} axes)",
            flush=True,
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False))
    print(f"\nWrote {OUT.relative_to(ROOT)}  ({len(out)} surfaces)")


if __name__ == "__main__":
    main()
