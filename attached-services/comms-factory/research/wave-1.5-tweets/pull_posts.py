#!/usr/bin/env python3
"""Pull last 100 posts (7-day window) for each handle, save as structured markdown."""
import json, subprocess, time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

CLI = "/Users/opaque/.local/bin/projectjin"
WORK_DIR = Path("/Users/opaque/.superset/projects/comms-factory/research/wave-1.5-tweets")

HANDLES = ["infinex", "phantom", "HyperliquidX", "pendle_fi", "Polymarket", "berachain", "monad_xyz"]

def log(m):
    print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)

def call_search(handle):
    payload = {
        "context": f"comms-factory wave-1.5: pull recent X posts from @{handle} for visual/tonal recon",
        "query": f"from:{handle}",
        "maxResults": 100,
        "hoursBack": 168,
        "sortOrder": "recency",
    }
    res = subprocess.run(
        [CLI, "--agent", "--json", "tool", "call", "infinex_search_recent_posts", "--input", json.dumps(payload)],
        capture_output=True, text=True, timeout=120,
    )
    try:
        return json.loads(res.stdout)
    except json.JSONDecodeError:
        return {"error": True, "stdout": res.stdout[:1000], "stderr": res.stderr[:1000]}

def write_handle(handle, data):
    out_path = WORK_DIR / f"{handle}.md"
    raw_path = WORK_DIR / f"{handle}.raw.json"
    raw_path.write_text(json.dumps(data, indent=2, default=str))
    if data.get("error"):
        out_path.write_text(f"# @{handle} — pull failed\n\n```\n{json.dumps(data, indent=2, default=str)}\n```\n")
        return f"@{handle}: ERROR"
    tweets = data.get("tweets", []) or []
    count = len(tweets)
    next_tok = data.get("nextToken")
    lines = []
    lines.append(f"# @{handle} — last {count} posts")
    lines.append("")
    lines.append(f"**Source:** `infinex_search_recent_posts` (X API via ProjectJin) · query `from:{handle}` · 168-hour window · sorted recency")
    lines.append(f"**Returned:** {count} posts · `nextToken` {'present (more available)' if next_tok else 'none (all in window)'}")
    lines.append(f"**Limitation:** response has NO media URLs or media-type flags — text + engagement only. Visual recon must be inferred from copy patterns or done in browser.")
    lines.append("")
    lines.append("## Posts (newest first)")
    lines.append("")
    if count == 0:
        lines.append("_No posts in this 7-day window. Account may be inactive, posts may be replies/retweets that don't surface in `from:` query, or rate-limit/auth issue._")
    else:
        for i, t in enumerate(tweets, 1):
            ts = (t.get("createdAt") or "").replace("T", " ").replace("+00:00", "Z")[:19]
            text = (t.get("text") or "").replace("\n", " ").replace("|", "\\|")
            if len(text) > 280:
                text = text[:277] + "..."
            likes = t.get("likeCount") or 0
            rts = t.get("retweetCount") or 0
            reps = t.get("replyCount") or 0
            quotes = t.get("quoteCount") or 0
            imps = t.get("impressionCount") or 0
            tid = t.get("id", "")
            lines.append(f"### {i}. {ts} · ❤ {likes:,} · 🔁 {rts:,} · 💬 {reps:,} · 💭 {quotes:,} · 👁 {imps:,}")
            lines.append(f"[x.com/{handle}/status/{tid}](https://x.com/{handle}/status/{tid})")
            lines.append("")
            lines.append(f"> {text}")
            lines.append("")
    out_path.write_text("\n".join(lines) + "\n")
    return f"@{handle}: {count} posts saved"

def main():
    log(f"Pulling posts for {len(HANDLES)} handles in parallel")
    with ThreadPoolExecutor(max_workers=len(HANDLES)) as ex:
        futs = {ex.submit(call_search, h): h for h in HANDLES}
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
