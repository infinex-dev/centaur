# X API recipe — how to fetch tweets from this machine

**Last working 2026-05-13** (carried over from yesterday's wave-1.5 recon run on 2026-05-12).

This doc exists because I went down a multi-turn rabbit hole searching for the X bearer token before finding the working recipe was already on disk. Keep this doc updated when anything breaks.

## TL;DR

1. **1Password item:** `ag4euuusf3olddxllmzxljsfpu` ("X API", vault `Employee`, updated 2026-05-12)
2. **Field to use:** `password` (length 116 — a standard X API v2 app-only bearer token starting `AAAAAA...`)
3. **Auth mode:** **app-only Bearer** (NOT OAuth 1.0a user-context, NOT OAuth 2.0 PKCE). Read-only across any public account.
4. **Touch ID:** `op` requires biometric confirmation per call. Cache the JSON locally once, read from disk after.

## The working extraction (cache JSON, parse with Python)

```bash
# Run this ONCE, accept Touch ID. Yesterday's snapshot at /tmp/xapi.json is fine if recent enough.
op item get ag4euuusf3olddxllmzxljsfpu --vault Employee --format json > /tmp/xapi.json

# From any subsequent shell:
BEARER=$(python3 -c "import json; print(next(f['value'] for f in json.load(open('/tmp/xapi.json'))['fields'] if f.get('label')=='password'))")
```

**Length check:** `echo ${#BEARER}` should print `116`. If it's 30 or some other length, something's wrong with the extraction.

## What does NOT work

- ❌ `op item get $ID --fields password` — appears to return a malformed/wrapped value; got HTTP 401 from X on every call. Use the JSON-cache method above instead.
- ❌ Item `gq3x2ohalpi4qe5qzxffbuh5kq` ("x Bearer Token", Core Working Group vault). Different bearer, also 401s. Not the right one.
- ❌ Item `afrdgdgqhfzp5au54alvx3ygv4` ("X API Internal Yaprun", Openclaw vault) has consumer key/secret for OAuth client-credentials → use this path only if you need a FRESH bearer minted via `POST /oauth2/token` (see `research/wave-1.5-tweets/pull_via_xapi.py`).
- ❌ ProjectJin's `infinex_search_recent_posts` MCP tool — works for some search use cases but has a `hoursBack ≤ 168` schema limit, so you can't pull older history. Bypass with direct X API.

## The endpoints we actually use

| Purpose | Endpoint |
|---|---|
| Resolve handle → user ID | `GET /2/users/by/username/{handle}` |
| Last N tweets | `GET /2/users/{user_id}/tweets?max_results=100&tweet.fields=created_at,public_metrics,attachments,entities,referenced_tweets,note_tweet,lang&expansions=attachments.media_keys,referenced_tweets.id&media.fields=type,url,preview_image_url` |
| Next page | append `&pagination_token=<next_token>` from previous response's `meta.next_token` |

Single call returns up to 100 tweets. Pagination supports multiple pages (each ≤ 100). The bearer's tier seems to permit ≥ 3 pages per handle without being rate-limited (yesterday's run pulled 300/handle across 7 handles in parallel without errors).

## Minimal fetch script

```python
#!/usr/bin/env python3
import json, urllib.request, urllib.parse, sys
BEARER = open("/tmp/xapi.json").read()  # or os.environ.get("BEARER")
BEARER = next(f["value"] for f in json.loads(BEARER)["fields"] if f.get("label") == "password")

def call(url):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {BEARER}"})
    return json.loads(urllib.request.urlopen(req, timeout=30).read())

handle = sys.argv[1]
u = call(f"https://api.x.com/2/users/by/username/{handle}")
uid = u["data"]["id"]
params = {
    "max_results": 100,
    "tweet.fields": "created_at,public_metrics,attachments,entities,referenced_tweets,note_tweet,lang",
    "expansions": "attachments.media_keys,referenced_tweets.id",
    "media.fields": "type,url,preview_image_url",
}
t = call(f"https://api.x.com/2/users/{uid}/tweets?" + urllib.parse.urlencode(params))
print(json.dumps({"user": u["data"], "tweets": t.get("data", []), "meta": t.get("meta", {})}, indent=2))
```

## Known partial failures (not blockers)

X v2 includes `errors` array for any referenced_tweets that:
- Resource not found (deleted tweets)
- Authorization error (private accounts, blocked)

These are SAFE to ignore. The main `data[]` array still returns the full timeline; only the expansion of referenced threads might be incomplete.

## Reference

- Working script: `research/wave-1.5-tweets/pull_via_xapi.py` (uses consumer key/secret + mints bearer fresh)
- Simpler version using cached bearer: see Minimal fetch script above.
- Yesterday's pagination run: `research/wave-1.5-tweets/paginate.py` (300 tweets/handle × 7 handles)

## Future maintenance

- If the bearer rotates: re-run `op item get ag4euuusf3olddxllmzxljsfpu --vault Employee --format json > /tmp/xapi.json` to refresh `/tmp/xapi.json` and re-extract.
- If `op` Touch ID fails: ensure 1Password app is unlocked, then `op signin` interactively.
- If X tier changes and the bearer loses read access on user-timeline endpoints, the script will return HTTP 401 — check the X developer portal (apps.twitter.com) for the Infinex app's current tier.
