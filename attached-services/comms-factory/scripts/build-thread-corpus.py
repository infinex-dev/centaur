#!/usr/bin/env python3
"""Reconstruct multi-tweet THREADS from the on-disk wave-1.5 harvest.

A thread = a maximal chain of an author replying to their OWN previous tweet
(referenced_tweets type 'replied_to', parent present in the same author's set).
Output: research/thread-corpus/<brand>.json (ordered tweets[] + count) +
length-distribution.json. Feeds x-thread length variety (cadence-by-observation)
+ few-shot. No X API — pure disk reconstruction.

  python3 scripts/build-thread-corpus.py
"""
import json, os, collections, re

SRC = "research/wave-1.5-tweets"
OUT = "research/thread-corpus"
BRANDS = ["infinex", "Polymarket", "phantom", "HyperliquidX"]

URL_RE = re.compile(r"https?://\S+")
DISCLAIMER_RE = re.compile(
    r"listing is not an endorsement|past performance|do not trade|not financial advice|\bnfa\b|terms apply",
    re.I,
)


def is_thin(text):
    """A trivial append: a bare link or a boilerplate disclaimer, not editorial content."""
    core = URL_RE.sub("", text).strip()
    return len(core) < 50 or bool(DISCLAIMER_RE.search(text))


def is_editorial(thread):
    """Real multi-beat thread, not announcement+link/disclaimer. Drops the trap pairs."""
    tw = thread["tweets"]
    if thread["tweet_count"] == 2 and is_thin(tw[1]["text"]):
        return False
    return True


def load_tweets(brand):
    d = json.load(open(f"{SRC}/{brand}.full.json"))
    if isinstance(d, list):
        return d
    return d.get("data") or next((v for v in d.values() if isinstance(v, list)), [])


def replied_parent(tweet, idset):
    for ref in tweet.get("referenced_tweets") or []:
        if ref.get("type") == "replied_to" and ref.get("id") in idset:
            return ref["id"]
    return None


def build_threads(tweets):
    by_id = {t["id"]: t for t in tweets if "id" in t}
    idset = set(by_id)
    parent = {tid: replied_parent(t, idset) for tid, t in by_id.items()}
    children = collections.defaultdict(list)
    for tid, pid in parent.items():
        if pid:
            children[pid].append(tid)
    # roots: in-set tweets with >=1 in-set self-reply child and no in-set self-reply parent
    roots = [tid for tid in by_id if children[tid] and not parent[tid]]
    threads = []
    for root in roots:
        chain, cur = [], root
        while cur:
            chain.append(cur)
            kids = sorted(children.get(cur, []), key=lambda k: by_id[k].get("created_at", ""))
            cur = kids[0] if kids else None  # main line = earliest child
        if len(chain) < 2:
            continue
        tw = [by_id[c] for c in chain]
        threads.append({
            "root_id": root,
            "tweet_count": len(chain),
            "tweets": [{
                "id": t["id"],
                "text": t.get("text", ""),
                "chars": len(t.get("text", "")),
                "likes": (t.get("public_metrics") or {}).get("like_count"),
            } for t in tw],
        })
    threads.sort(key=lambda x: -x["tweet_count"])
    return threads


def main():
    os.makedirs(OUT, exist_ok=True)
    raw_lengths, edi_lengths = [], []
    for brand in BRANDS:
        if not os.path.exists(f"{SRC}/{brand}.full.json"):
            continue
        threads = build_threads(load_tweets(brand))
        for t in threads:
            t["editorial"] = is_editorial(t)
        json.dump(threads, open(f"{OUT}/{brand.lower()}.json", "w"), indent=2)
        edi = [t for t in threads if t["editorial"]]
        raw_lengths += [t["tweet_count"] for t in threads]
        edi_lengths += [t["tweet_count"] for t in edi]
        print(f"{brand}: {len(threads)} raw / {len(edi)} editorial | editorial lengths "
              f"{dict(sorted(collections.Counter(t['tweet_count'] for t in edi).items()))}")

    def dist(lengths):
        c = collections.Counter(lengths)
        tot = sum(c.values()) or 1
        return tot, {str(k): {"count": v, "weight": round(v / tot, 4)} for k, v in sorted(c.items())}

    raw_tot, raw_d = dist(raw_lengths)
    edi_tot, edi_d = dist(edi_lengths)
    json.dump({
        "source": "wave-1.5 on-disk harvest (2026-05-12), self-reply reconstruction",
        "note": "Use EDITORIAL distribution for x-thread length variety. Raw is polluted by "
                "announcement+link/disclaimer 2-tweet pairs (not real threads).",
        "raw": {"total_threads": raw_tot, "by_length": raw_d},
        "editorial": {"total_threads": edi_tot, "by_length": edi_d},
    }, open(f"{OUT}/length-distribution.json", "w"), indent=2)
    print(f"\nEDITORIAL length distribution ({edi_tot} threads) — the variety basis:")
    for k, v in edi_d.items():
        print(f"  {k} tweets: {v['count']} ({v['weight']*100:.0f}%)")


if __name__ == "__main__":
    main()
