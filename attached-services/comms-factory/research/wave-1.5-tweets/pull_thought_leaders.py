#!/usr/bin/env python3
"""Pull thought-leadership reference set — non-swap-product accounts."""
import json, urllib.request, urllib.parse, urllib.error, time, os, sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

WORK = Path("/Users/opaque/.superset/projects/comms-factory/research/wave-1.5-tweets")
OUT = WORK / "thought-leaders"
OUT.mkdir(exist_ok=True)
TARGET_POSTS = 300

HANDLES = [
    "__tinygrad__",   # George Hotz
    "karpathy",       # Andrej Karpathy
    "jackkkonline",   # Jack (user said jackkk; trying jackkkonline first)
    "notthreadguy",   # thread guy
    "OSF_rekt",       # OSF
    "rektdrinks",     # rekt drinks
    "sportfun",       # sport fun
    "AnthropicAI",    # Anthropic
    "claudeai",       # Claude product
]

BEARER = os.environ.get("BEARER")
if not BEARER:
    print("ERROR: BEARER env var not set", file=sys.stderr); sys.exit(1)

def log(m): print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)

def api(url):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {BEARER}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"error": True, "code": e.code, "body": e.read().decode()[:300]}

def pull(handle):
    u = api(f"https://api.x.com/2/users/by/username/{handle}")
    if u.get("error") or "data" not in u:
        # Try fallback handles for likely-wrong ones
        alts = {"jackkkonline": ["jackkk", "jack_kk"]}.get(handle, [])
        for alt in alts:
            u2 = api(f"https://api.x.com/2/users/by/username/{alt}")
            if "data" in u2:
                log(f"@{handle} not found, using @{alt}")
                u = u2
                handle = alt
                break
    if u.get("error") or "data" not in u:
        return handle, u, [], []
    uid = u["data"]["id"]
    all_tweets, all_media = [], []
    next_token = None
    pages = 0
    while len(all_tweets) < TARGET_POSTS and pages < 4:
        params = {
            "max_results": 100,
            "tweet.fields": "created_at,public_metrics,attachments,entities,referenced_tweets,note_tweet,lang",
            "expansions": "attachments.media_keys",
            "media.fields": "type,url,preview_image_url,alt_text,duration_ms,variants",
        }
        if next_token:
            params["pagination_token"] = next_token
        page = api(f"https://api.x.com/2/users/{uid}/tweets?" + urllib.parse.urlencode(params))
        if page.get("error"):
            log(f"@{handle}: page {pages} error {page.get('code')}")
            break
        all_tweets.extend(page.get("data", []) or [])
        all_media.extend((page.get("includes", {}) or {}).get("media", []) or [])
        next_token = (page.get("meta", {}) or {}).get("next_token")
        pages += 1
        if not next_token:
            break
        time.sleep(0.3)
    return handle, u, all_tweets, all_media

log(f"Pulling {len(HANDLES)} thought-leadership handles")
results = {}
with ThreadPoolExecutor(max_workers=3) as ex:
    futs = {ex.submit(pull, h): h for h in HANDLES}
    for f in as_completed(futs):
        original_h = futs[f]
        try:
            handle, user, tweets, media = f.result()
            results[handle] = {"user": user, "tweets": tweets, "media": media}
            (OUT / f"{handle}.full.json").write_text(json.dumps(results[handle], indent=2, default=str))
            log(f"@{handle}: {len(tweets)} posts, {len(media)} media")
        except Exception as e:
            log(f"@{original_h}: exception {e}")

# Cadence stats — same shape as before
log("Computing cadence stats")
stats = {}
for h, d in results.items():
    tweets = d.get("tweets", []) or []
    if not tweets:
        stats[h] = {"posts": 0}; continue
    times = []
    for t in tweets:
        ca = t.get("created_at")
        if ca:
            try: times.append(datetime.fromisoformat(ca.replace("Z","+00:00")))
            except: pass
    if not times:
        stats[h] = {"posts": len(tweets)}; continue
    times.sort()
    span = (times[-1]-times[0]).total_seconds()/86400 or 0.01
    rt=reply=quote=orig=media_n=0
    for t in tweets:
        kinds = [r.get("type") for r in (t.get("referenced_tweets") or [])]
        if "retweeted" in kinds: rt+=1
        elif "replied_to" in kinds: reply+=1
        elif "quoted" in kinds: quote+=1
        else: orig+=1
        if (t.get("attachments",{}) or {}).get("media_keys"): media_n+=1
    originals = [t for t in tweets if not any(r.get("type") in ("retweeted","replied_to") for r in (t.get("referenced_tweets") or []))]
    if originals:
        avg_l = sum((t.get("public_metrics",{}) or {}).get("like_count",0) for t in originals)/len(originals)
        avg_i = sum((t.get("public_metrics",{}) or {}).get("impression_count",0) for t in originals)/len(originals)
        top = max(originals, key=lambda t: (t.get("public_metrics",{}) or {}).get("impression_count",0))
        top_i = (top.get("public_metrics",{}) or {}).get("impression_count",0)
    else:
        avg_l=avg_i=top_i=0
    stats[h] = dict(
        posts=len(tweets), span_days=round(span,1), posts_per_day=round(len(tweets)/span,2),
        originals=orig, replies=reply, retweets=rt, quotes=quote,
        media_pct=round(100*media_n/len(tweets),1),
        avg_likes=round(avg_l,0), avg_imp=round(avg_i,0), top_imp=top_i,
    )

(OUT / "cadence_stats.json").write_text(json.dumps(stats, indent=2))
log("DONE")
print()
print(f"{'handle':<18} {'posts':>6} {'span':>7} {'per_day':>8} {'orig':>5} {'rpl':>5} {'rt':>5} {'qt':>5} {'media%':>7} {'avg_imp':>10} {'top_imp':>11}")
for h, s in sorted(stats.items(), key=lambda x: -(x[1].get("posts_per_day",0))):
    print(f"{h:<18} {s.get('posts',0):>6} {s.get('span_days',0):>6.1f}d {s.get('posts_per_day',0):>8.2f} {s.get('originals',0):>5} {s.get('replies',0):>5} {s.get('retweets',0):>5} {s.get('quotes',0):>5} {s.get('media_pct',0):>6.1f}% {s.get('avg_imp',0):>10,.0f} {s.get('top_imp',0):>11,}")
