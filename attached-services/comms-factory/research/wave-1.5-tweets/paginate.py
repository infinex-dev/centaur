#!/usr/bin/env python3
"""Paginate all 7 handles to ~300 posts each. Bearer in 1Password X API > password."""
import json, urllib.request, urllib.parse, urllib.error, time, os, sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

WORK = Path("/Users/opaque/.superset/projects/comms-factory/research/wave-1.5-tweets")
HANDLES = ["infinex", "phantom", "HyperliquidX", "pendle_fi", "Polymarket", "berachain", "monad"]
TARGET_POSTS = 300  # ~3 pages

BEARER = os.environ.get("BEARER")
if not BEARER:
    print("ERROR: BEARER env var not set", file=sys.stderr)
    sys.exit(1)

def log(m): print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)

def get(url):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {BEARER}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"error": True, "code": e.code, "body": e.read().decode()[:300]}

def lookup_user(handle):
    return get(f"https://api.x.com/2/users/by/username/{handle}")

def fetch_page(uid, next_token=None):
    params = {
        "max_results": 100,
        "tweet.fields": "created_at,public_metrics,attachments,entities,referenced_tweets,note_tweet,lang",
        "expansions": "attachments.media_keys",
        "media.fields": "type,url,preview_image_url,alt_text,duration_ms,variants",
    }
    if next_token:
        params["pagination_token"] = next_token
    return get(f"https://api.x.com/2/users/{uid}/tweets?" + urllib.parse.urlencode(params))

def pull(handle):
    u = lookup_user(handle)
    if u.get("error") or "data" not in u:
        return handle, u, [], []
    uid = u["data"]["id"]
    all_tweets, all_media = [], []
    next_token = None
    while len(all_tweets) < TARGET_POSTS:
        page = fetch_page(uid, next_token)
        if page.get("error"):
            log(f"@{handle}: page error {page}")
            break
        all_tweets.extend(page.get("data", []) or [])
        all_media.extend((page.get("includes", {}) or {}).get("media", []) or [])
        next_token = (page.get("meta", {}) or {}).get("next_token")
        if not next_token:
            break
        time.sleep(0.3)  # gentle pacing
    return handle, u, all_tweets, all_media

log(f"Paginating {len(HANDLES)} handles to ~{TARGET_POSTS} posts each")
results = {}
with ThreadPoolExecutor(max_workers=3) as ex:  # rate-limit safer
    futs = {ex.submit(pull, h): h for h in HANDLES}
    for f in as_completed(futs):
        h = futs[f]
        try:
            handle, user, tweets, media = f.result()
            results[handle] = {"user": user, "tweets": tweets, "media": media}
            (WORK / f"{handle}.full.json").write_text(json.dumps(results[handle], indent=2, default=str))
            log(f"@{handle}: {len(tweets)} posts, {len(media)} media")
        except Exception as e:
            log(f"@{h}: exception {e}")

# Now compute cadence stats
from datetime import datetime, timezone
log("Computing cadence stats")
stats = {}
for h, d in results.items():
    tweets = d.get("tweets", [])
    if not tweets:
        stats[h] = {"posts": 0}
        continue
    times = []
    for t in tweets:
        ca = t.get("created_at")
        if ca:
            try:
                times.append(datetime.fromisoformat(ca.replace("Z", "+00:00")))
            except Exception:
                pass
    if not times:
        stats[h] = {"posts": len(tweets)}
        continue
    times.sort()
    span_days = (times[-1] - times[0]).total_seconds() / 86400 or 0.01
    posts_per_day = len(times) / span_days
    # original vs replies vs RTs
    rt_count = 0
    reply_count = 0
    quote_count = 0
    original_count = 0
    media_attached = 0
    for t in tweets:
        refs = t.get("referenced_tweets", []) or []
        kinds = [r.get("type") for r in refs]
        if "retweeted" in kinds:
            rt_count += 1
        elif "replied_to" in kinds:
            reply_count += 1
        elif "quoted" in kinds:
            quote_count += 1
        else:
            original_count += 1
        if t.get("attachments", {}).get("media_keys"):
            media_attached += 1
    # engagement stats (originals only — replies/RTs distort)
    originals = [t for t in tweets if not any(r.get("type") in ("retweeted","replied_to") for r in (t.get("referenced_tweets") or []))]
    if originals:
        avg_likes = sum((t.get("public_metrics", {}) or {}).get("like_count", 0) for t in originals) / len(originals)
        avg_imps = sum((t.get("public_metrics", {}) or {}).get("impression_count", 0) for t in originals) / len(originals)
        top = max(originals, key=lambda t: (t.get("public_metrics", {}) or {}).get("impression_count", 0))
        top_imps = (top.get("public_metrics", {}) or {}).get("impression_count", 0)
    else:
        avg_likes = avg_imps = top_imps = 0
    stats[h] = {
        "posts": len(tweets),
        "span_days": round(span_days, 1),
        "posts_per_day": round(posts_per_day, 2),
        "originals": original_count,
        "replies": reply_count,
        "retweets": rt_count,
        "quotes": quote_count,
        "media_attached_pct": round(100 * media_attached / len(tweets), 1),
        "avg_likes_originals": round(avg_likes, 0),
        "avg_impressions_originals": round(avg_imps, 0),
        "top_post_impressions": top_imps,
    }

(WORK / "cadence_stats.json").write_text(json.dumps(stats, indent=2))
log("Saved cadence_stats.json")

# Print summary table
print()
print(f"{'handle':<16} {'posts':>6} {'span':>7} {'per_day':>8} {'orig':>5} {'rpl':>5} {'rt':>5} {'qt':>5} {'media%':>7} {'avg_imp':>10} {'top_imp':>10}")
for h, s in sorted(stats.items(), key=lambda x: -(x[1].get("posts_per_day", 0))):
    print(f"{h:<16} {s.get('posts',0):>6} {s.get('span_days',0):>6.1f}d {s.get('posts_per_day',0):>8.2f} {s.get('originals',0):>5} {s.get('replies',0):>5} {s.get('retweets',0):>5} {s.get('quotes',0):>5} {s.get('media_attached_pct',0):>6.1f}% {s.get('avg_impressions_originals',0):>10,.0f} {s.get('top_post_impressions',0):>10,}")
