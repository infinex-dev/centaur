#!/usr/bin/env python3
"""Render top-tweets views from saved .full.json files. No API recalls."""
import json, glob, os
from pathlib import Path
from datetime import datetime

ROOT = Path("/Users/opaque/.superset/projects/comms-factory/research")
SOURCES = [
    ROOT / "wave-1.5-tweets",           # 7 brand handles
    ROOT / "wave-1.5-tweets/thought-leaders",  # 9 thought-leader handles
]
TOP_N = None  # None = render all

def render(handle, data, out_path):
    tweets = data.get("tweets", []) or []
    media_map = {m["media_key"]: m for m in (data.get("media") or [])}
    ud = (data.get("user") or {}).get("data", {})
    # rank by impressions; ignore RTs (they show original-author metrics)
    def metric(t):
        if any(r.get("type") == "retweeted" for r in (t.get("referenced_tweets") or [])):
            return -1  # demote retweets to bottom
        return (t.get("public_metrics") or {}).get("impression_count", 0)
    ranked = sorted(tweets, key=metric, reverse=True)
    if TOP_N is not None:
        ranked = ranked[:TOP_N]
    lines = [
        f"# @{handle} — all {len(ranked)} posts, sorted by impressions",
        "",
        f"**User:** {ud.get('name','?')} (@{ud.get('username','?')}) · id `{ud.get('id','?')}`",
        f"**Sample size:** {len(tweets)} posts · {len(media_map)} media",
        f"**Sorted by:** impression_count desc (retweets demoted to bottom — they show the original author's metrics, not the RT-er's)",
        "",
        "---",
        "",
    ]
    for i, t in enumerate(ranked, 1):
        ts = (t.get("created_at") or "").replace("T"," ").replace("Z","")[:19]
        text = ((t.get("note_tweet") or {}) or {}).get("text") or t.get("text","") or ""
        m = t.get("public_metrics") or {}
        keys = (t.get("attachments") or {}).get("media_keys") or []
        msum = []
        for k in keys:
            mo = media_map.get(k, {})
            tp = mo.get("type","?")
            if tp == "video":
                msum.append(f"video[{int((mo.get('duration_ms') or 0)/1000)}s]")
            elif tp == "animated_gif": msum.append("gif")
            else: msum.append(tp)
        media_str = ",".join(msum) if msum else "—"
        refs = t.get("referenced_tweets") or []
        ref_str = " · " + ",".join(r.get("type","?") for r in refs) if refs else ""
        tid = t.get("id","")
        lines.append(f"## {i}. {ts} — 👁 {m.get('impression_count',0):,}")
        lines.append(f"❤ {m.get('like_count',0):,} · 🔁 {m.get('retweet_count',0):,} · 💬 {m.get('reply_count',0):,} · 💭 {m.get('quote_count',0):,} · 🎞 {media_str}{ref_str}")
        lines.append(f"[x.com/{handle}/status/{tid}](https://x.com/{handle}/status/{tid})")
        lines.append("")
        lines.append(f"> {text}")
        for k in keys:
            mo = media_map.get(k, {})
            if mo.get("type") == "photo" and mo.get("url"):
                lines.append(f"![]({mo['url']})")
            elif mo.get("type") in ("video","animated_gif") and mo.get("preview_image_url"):
                lines.append(f"![preview]({mo['preview_image_url']})")
                vs = sorted([v for v in (mo.get("variants") or []) if v.get("content_type")=="video/mp4"], key=lambda v: v.get("bit_rate",0), reverse=True)
                if vs: lines.append(f"  ↳ video: {vs[0].get('url')}")
        lines.append("")
        lines.append("---")
        lines.append("")
    out_path.write_text("\n".join(lines) + "\n")
    return ud.get("username","?"), len(tweets)

# index.html data
all_handles = []

for src in SOURCES:
    out_dir = src / "top"
    out_dir.mkdir(exist_ok=True)
    for f in sorted(src.glob("*.full.json")):
        handle = f.stem.replace(".full","")
        data = json.loads(f.read_text())
        out_md = out_dir / f"{handle}.top.md"
        username, n = render(handle, data, out_md)
        category = "thought-leader" if "thought-leaders" in str(src) else "brand"
        # compute top-3 metrics for index
        tweets = data.get("tweets") or []
        ud = (data.get("user") or {}).get("data", {})
        def imp(t):
            if any(r.get("type")=="retweeted" for r in (t.get("referenced_tweets") or [])):
                return -1
            return (t.get("public_metrics") or {}).get("impression_count",0)
        top_imp = max((imp(t) for t in tweets), default=0)
        all_handles.append({
            "handle": handle, "username": username, "category": category,
            "name": ud.get("name","?"),
            "posts": n, "top_imp": top_imp,
            "md_rel": str(out_md.relative_to(ROOT)),
        })
        print(f"  rendered {handle}: {n} posts -> {out_md.relative_to(ROOT)}")

# Single index.html linking everything
INDEX = ROOT / "top-tweets-index.html"
brand_rows = sorted([h for h in all_handles if h["category"]=="brand"], key=lambda x: -x["top_imp"])
tl_rows = sorted([h for h in all_handles if h["category"]=="thought-leader"], key=lambda x: -x["top_imp"])

def row(h):
    return f'<tr><td><a href="{h["md_rel"]}">@{h["handle"]}</a></td><td>{h["name"]}</td><td style="text-align:right">{h["posts"]:,}</td><td style="text-align:right">{h["top_imp"]:,}</td></tr>'

html = f"""<!doctype html>
<html><head>
<meta charset="utf-8" />
<title>Top tweets — comms-factory reference set</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  body {{ background:#0B0B0D; color:#F0EDE6; font-family:Inter,system-ui,sans-serif; padding:4rem 2rem 6rem; max-width:980px; margin:0 auto; line-height:1.55; }}
  h1 {{ font-family:Fraunces,serif; font-weight:350; font-size:3rem; letter-spacing:-0.02em; margin:0 0 0.4rem; }}
  .lede {{ color:#7E7B73; font-style:italic; font-family:Fraunces,serif; font-size:1.15rem; margin:0 0 3rem; }}
  h2 {{ font-family:Fraunces,serif; font-weight:400; font-style:italic; font-size:1.6rem; color:#E8E0CC; margin:3rem 0 1rem; padding-top:2rem; border-top:1px solid #26252A; }}
  table {{ width:100%; border-collapse:collapse; margin:1rem 0; }}
  th,td {{ padding:0.7rem 0.8rem; text-align:left; border-bottom:1px solid #26252A; font-size:0.95rem; }}
  th {{ font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:0.1em; color:#7E7B73; text-transform:uppercase; font-weight:500; }}
  a {{ color:#E8E0CC; text-decoration:none; border-bottom:1px solid #4E4C48; }}
  a:hover {{ border-color:#E8E0CC; }}
  td:first-child a {{ font-family:'JetBrains Mono',monospace; font-size:13px; }}
  .meta {{ font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:0.05em; color:#7E7B73; text-transform:uppercase; }}
</style>
</head>
<body>
<p class="meta">comms-factory · reference set · top tweets by impressions</p>
<h1>Top tweets.</h1>
<p class="lede">Per-handle, top {TOP_N} by impressions. Sorted desc by top-post reach. Retweets demoted. All offline.</p>

<h2>Thought-leadership reference set</h2>
<table>
  <tr><th>handle</th><th>name</th><th style="text-align:right">posts pulled</th><th style="text-align:right">top imp</th></tr>
  {"".join(row(h) for h in tl_rows)}
</table>

<h2>Brand reference set (Wave 1.5)</h2>
<table>
  <tr><th>handle</th><th>name</th><th style="text-align:right">posts pulled</th><th style="text-align:right">top imp</th></tr>
  {"".join(row(h) for h in brand_rows)}
</table>

<p class="meta" style="margin-top:4rem">Raw API JSON in <code style="color:#E8E0CC">wave-1.5-tweets/*.full.json</code> + <code style="color:#E8E0CC">wave-1.5-tweets/thought-leaders/*.full.json</code></p>
</body></html>
"""
INDEX.write_text(html)
print()
print(f"Index → {INDEX}")
print(f"Total handles: {len(all_handles)} ({len(brand_rows)} brands, {len(tl_rows)} thought-leaders)")
