#!/usr/bin/env python3
"""For handles where infinex_search_recent_posts returned 0 (or very few), use Grok directly."""
import json, subprocess, time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

CLI = "/Users/opaque/.local/bin/projectjin"
WORK_DIR = Path("/Users/opaque/.superset/projects/comms-factory/research/wave-1.5-tweets")

# Handles with insufficient data from infinex_search_recent_posts
HANDLES = ["infinex", "berachain", "monad_xyz", "HyperliquidX"]

def log(m):
    print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)

def grok_query(handle):
    query = (
        f"Pull the most recent ~30 posts from @{handle} on X/Twitter. For each post, list: "
        f"the date, the full post text (don't summarize — verbatim if possible), whether it has "
        f"media (image/video/gif/none) and a short description of the media if present, and "
        f"engagement (likes/RTs/replies/impressions if available). "
        f"After the list, write a 4-paragraph synthesis: "
        f"(1) THEMES — what is @{handle} actually talking about over the past month? "
        f"(2) FORMATS — do they prefer single tweets, threads, replies, retweets, quote-RTs? "
        f"(3) VISUAL VOCABULARY — what do their assets look like (motion language if videos, "
        f"image style, recurring asset patterns)? "
        f"(4) WHAT'S NOTABLE — what jumps out as a launch artifact, a meme template, or a "
        f"recurring discipline? "
        f"This is for comms-factory, a video-and-text comms pipeline being built for Infinex "
        f"(crypto wallet). Be specific and concrete; don't hedge."
    )
    payload = {
        "context": f"wave-1.5 fallback recon on @{handle} — search_recent_posts returned 0 or very few",
        "query": query,
        "mode": "x",
    }
    res = subprocess.run(
        [CLI, "--agent", "--json", "tool", "call", "infinex_grok_search", "--input", json.dumps(payload)],
        capture_output=True, text=True, timeout=180,
    )
    try:
        return json.loads(res.stdout)
    except json.JSONDecodeError:
        return {"error": True, "stdout": res.stdout[:500], "stderr": res.stderr[:500]}

def write_handle(handle, data):
    out_path = WORK_DIR / f"{handle}.grok.md"
    if data.get("error"):
        out_path.write_text(f"# @{handle} grok fallback — failed\n\n```\n{json.dumps(data, indent=2)}\n```\n")
        return f"@{handle}: ERROR"
    body = data.get("text", "") or ""
    citations = data.get("citations", []) or []
    sc = data.get("searchCount", "?")
    lines = []
    lines.append(f"# @{handle} — Grok-routed X recon (fallback)")
    lines.append("")
    lines.append(f"**Source:** `infinex_grok_search` (mode=x) · `search_recent_posts` returned insufficient data ({'0' if handle != 'HyperliquidX' else '2'} posts in 7 days)")
    lines.append(f"**Grok search count:** {sc}")
    lines.append("")
    lines.append("## Findings")
    lines.append("")
    lines.append(body)
    lines.append("")
    if citations:
        lines.append("## Citations")
        for c in citations:
            lines.append(f"- {c}")
    out_path.write_text("\n".join(lines) + "\n")
    return f"@{handle}: saved ({len(body)} chars)"

def main():
    log(f"Grok fallback for {len(HANDLES)} handles in parallel")
    with ThreadPoolExecutor(max_workers=len(HANDLES)) as ex:
        futs = {ex.submit(grok_query, h): h for h in HANDLES}
        for fut in as_completed(futs):
            h = futs[fut]
            try:
                data = fut.result()
                msg = write_handle(h, data)
                log(msg)
            except Exception as e:
                log(f"@{h}: exception {e}")
    log("DONE")

if __name__ == "__main__":
    main()
