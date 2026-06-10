#!/usr/bin/env python3
"""Pull all 7 handles via direct X API v2 user-timeline endpoint.
Bypasses ProjectJin's filtered search; gets media URLs (which search didn't return).
Reads consumer key/secret from 1Password (X API Internal Yaprun)."""
import json, subprocess, time, urllib.request, urllib.parse, base64, sys, os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

WORK_DIR = Path("/Users/opaque/.superset/projects/comms-factory/research/wave-1.5-tweets")
ITEM_ID = "afrdgdgqhfzp5au54alvx3ygv4"
VAULT = "Openclaw"

HANDLES = ["infinex", "phantom", "HyperliquidX", "pendle_fi", "Polymarket", "berachain", "monad"]

def log(m):
    print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)

def op_get(field):
    r = subprocess.run(
        ["op", "item", "get", ITEM_ID, "--vault", VAULT, "--format", "json"],
        capture_output=True, text=True, timeout=20,
    )
    if r.returncode != 0:
        return None
    try:
        data = json.loads(r.stdout)
    except json.JSONDecodeError:
        return None
    for f in data.get("fields", []):
        if f.get("label") == field or f.get("id") == field:
            return f.get("value")
    return None

def get_bearer(key, secret):
    creds = base64.b64encode(f"{key}:{secret}".encode()).decode()
    req = urllib.request.Request(
        "https://api.x.com/oauth2/token",
        data=b"grant_type=client_credentials",
        headers={
            "Authorization": f"Basic {creds}",
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.loads(resp.read())
    return body.get("access_token")

def api_get(url, bearer):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {bearer}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": True, "status": e.code, "body": e.read().decode()[:500]}
    except Exception as e:
        return {"error": True, "exception": str(e)}

def pull_handle(handle, bearer):
    user_resp = api_get(f"https://api.x.com/2/users/by/username/{handle}", bearer)
    if user_resp.get("error") or "data" not in user_resp:
        return handle, {"error": "user lookup failed", "resp": user_resp}, None
    user_id = user_resp["data"]["id"]

    params = {
        "max_results": 100,
        "tweet.fields": "created_at,public_metrics,attachments,entities,referenced_tweets,note_tweet,lang",
        "expansions": "attachments.media_keys,referenced_tweets.id,referenced_tweets.id.author_id",
        "media.fields": "type,url,preview_image_url,alt_text,duration_ms,public_metrics,variants,width,height",
    }
    tweets_url = f"https://api.x.com/2/users/{user_id}/tweets?" + urllib.parse.urlencode(params)
    tweets_resp = api_get(tweets_url, bearer)
    return handle, user_resp, tweets_resp

def format_md(handle, user, tweets):
    if not tweets or tweets.get("error"):
        return f"# @{handle} — X API pull failed\n\n```\n{json.dumps(tweets, indent=2)}\n```\n"
    data = tweets.get("data", []) or []
    media_map = {}
    for m in (tweets.get("includes", {}).get("media", []) or []):
        media_map[m["media_key"]] = m
    user_data = user.get("data", {})
    lines = [
        f"# @{handle} — last {len(data)} posts (via X API v2 user-timeline)",
        "",
        f"**Source:** X API v2 `/2/users/{user_data.get('id')}/tweets` via 1Password Yaprun credentials",
        f"**User:** {user_data.get('name','?')} (@{user_data.get('username','?')}) · id={user_data.get('id','?')}",
        f"**Returned:** {len(data)} posts · next_token: {'yes' if tweets.get('meta',{}).get('next_token') else 'none'}",
        f"**Media expansion:** {len(media_map)} media objects included (image/video/animated_gif URLs available)",
        "",
        "## Posts (newest first)",
        "",
    ]
    if not data:
        lines.append("_No posts in this pull. Check user lookup / API response above._")
    for i, t in enumerate(data, 1):
        ts = (t.get("created_at") or "").replace("T", " ").replace("Z", "")[:19]
        text = t.get("note_tweet", {}).get("text") or t.get("text") or ""
        text_short = text.replace("\n", " ").replace("|", "\\|")
        if len(text_short) > 280:
            text_short = text_short[:277] + "..."
        m = t.get("public_metrics", {}) or {}
        media_keys = t.get("attachments", {}).get("media_keys", []) or []
        media_summary = []
        for mk in media_keys:
            obj = media_map.get(mk, {})
            mtype = obj.get("type", "?")
            if mtype == "video":
                dur_s = (obj.get("duration_ms", 0) or 0) / 1000
                media_summary.append(f"video[{dur_s:.0f}s]")
            elif mtype == "animated_gif":
                media_summary.append("gif")
            elif mtype == "photo":
                media_summary.append("photo")
            else:
                media_summary.append(mtype)
        media_str = ",".join(media_summary) if media_summary else "—"
        ref = t.get("referenced_tweets", [])
        ref_str = ""
        if ref:
            kinds = [r.get("type", "?") for r in ref]
            ref_str = " · " + ",".join(kinds)
        tid = t.get("id", "")
        lines.append(f"### {i}. {ts} · ❤ {m.get('like_count',0):,} · 🔁 {m.get('retweet_count',0):,} · 💬 {m.get('reply_count',0):,} · 💭 {m.get('quote_count',0):,} · 👁 {m.get('impression_count',0):,} · 🎞 {media_str}{ref_str}")
        lines.append(f"[x.com/{handle}/status/{tid}](https://x.com/{handle}/status/{tid})")
        lines.append("")
        lines.append(f"> {text_short}")
        if media_summary and media_keys:
            for mk in media_keys:
                obj = media_map.get(mk, {})
                if obj.get("type") == "photo":
                    url = obj.get("url")
                    if url:
                        lines.append(f"![]({url})")
                elif obj.get("type") in ("video", "animated_gif"):
                    preview = obj.get("preview_image_url")
                    if preview:
                        lines.append(f"![video preview]({preview})")
                    # Add highest-bitrate variant URL
                    variants = obj.get("variants", []) or []
                    mp4s = [v for v in variants if v.get("content_type") == "video/mp4"]
                    if mp4s:
                        mp4s.sort(key=lambda v: v.get("bit_rate", 0), reverse=True)
                        lines.append(f"video: {mp4s[0].get('url')}")
        lines.append("")
    return "\n".join(lines) + "\n"

def main():
    key = os.environ.get("TWITTER_KEY") or op_get("username")
    secret = os.environ.get("TWITTER_SECRET") or op_get("credential")
    if not key or not secret:
        log("ERROR: could not read credentials from env or 1Password")
        sys.exit(1)
    log(f"Credentials loaded from {'env vars' if os.environ.get('TWITTER_KEY') else '1Password'}")
    log(f"key length: {len(key)}, secret length: {len(secret)}")
    log("Exchanging for bearer token")
    bearer = get_bearer(key, secret)
    if not bearer:
        log("ERROR: bearer exchange failed")
        sys.exit(1)
    log(f"Bearer received: {bearer[:25]}...")

    log(f"Pulling {len(HANDLES)} handles in parallel")
    with ThreadPoolExecutor(max_workers=4) as ex:  # rate-limit safer at 4 concurrent
        futs = {ex.submit(pull_handle, h, bearer): h for h in HANDLES}
        for fut in as_completed(futs):
            handle = futs[fut]
            try:
                h, user, tweets = fut.result()
                raw_path = WORK_DIR / f"{h}.api.json"
                raw_path.write_text(json.dumps({"user": user, "tweets": tweets}, indent=2, default=str))
                md_path = WORK_DIR / f"{h}.api.md"
                md_path.write_text(format_md(h, user or {}, tweets or {}))
                tweet_count = len((tweets or {}).get("data", []) or []) if tweets else 0
                media_count = len((tweets or {}).get("includes", {}).get("media", []) or []) if tweets else 0
                log(f"@{h}: {tweet_count} posts, {media_count} media saved")
            except Exception as e:
                log(f"@{handle}: exception {e}")
    log("DONE")

if __name__ == "__main__":
    main()
