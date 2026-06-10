#!/usr/bin/env python3
"""Render harness blog/changelog candidates as infinex.xyz/news-style article pages.

Reads the attempt-2 blog candidates for a card and produces a single dark-themed
HTML file with tabs to switch between candidates, so the operator can judge the
copy as a rendered page instead of raw markdown. Handles the Infinex shortcodes
({% cloud-image %}, {% toggle %}) and basic markdown.
"""
import html
import re
import sqlite3
import sys

DB = "harness/harness.db"
CARD = sys.argv[1] if len(sys.argv) > 1 else "01KT8T3ZCX27C5AXY3X5F697C9"
ATTEMPT = int(sys.argv[2]) if len(sys.argv) > 2 else 2
OUT = sys.argv[3] if len(sys.argv) > 3 else "research/bridge-news-mockup-2026-06-05.html"


def parse_frontmatter(md):
    fm, body = {}, md
    if md.startswith("---"):
        end = md.find("\n---", 3)
        if end != -1:
            raw = md[3:end].strip("\n")
            body = md[end + 4:].lstrip("\n")
            key = None
            for line in raw.splitlines():
                if re.match(r"^\s+", line) and key == "coverImage":
                    m = re.match(r"\s+(\w+):\s*(.*)", line)
                    if m:
                        fm.setdefault("coverImage", {})[m.group(1)] = m.group(2).strip()
                else:
                    m = re.match(r"(\w+):\s*(.*)", line)
                    if m:
                        key = m.group(1)
                        val = m.group(2).strip()
                        fm[key] = {} if (key == "coverImage" and not val) else val
    return fm, body


def inline(text):
    text = html.escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\[(.+?)\]\((.+?)\)", r'<a href="\2">\1</a>', text)
    return text


def render_cloud_image(attrs):
    src = re.search(r'src="([^"]*)"', attrs)
    alt = re.search(r'alt="([^"]*)"', attrs)
    src = src.group(1) if src else ""
    alt = alt.group(1) if alt else "image"
    placeholder = src.startswith("<") or not src
    inner = (
        f'<div class="imgph"><span class="imgph-tag">cover image (from designer)</span>'
        f'<span class="imgph-alt">{html.escape(alt)}</span></div>'
        if placeholder
        else f'<img src="{html.escape(src)}" alt="{html.escape(alt)}">'
    )
    return f'<figure class="cloud-image">{inner}</figure>'


def render_body(body):
    # Pull toggles out first (they span multiple lines).
    def toggle_repl(m):
        title = re.search(r'title="([^"]*)"', m.group(1))
        title = title.group(1) if title else "Details"
        inner = render_body(m.group(2).strip())
        return f"\n<details class='toggle'><summary>{html.escape(title)}</summary><div class='toggle-body'>{inner}</div></details>\n"

    body = re.sub(r"\{%\s*toggle(.*?)%\}(.*?)\{%\s*/toggle\s*%\}", toggle_repl, body, flags=re.S)
    body = re.sub(r"\{%\s*cloud-image(.*?)/%\}", lambda m: render_cloud_image(m.group(1)), body)

    out, lines, i = [], body.split("\n"), 0
    para, ul = [], []

    def flush_para():
        if para:
            out.append("<p>" + inline(" ".join(para)) + "</p>")
            para.clear()

    def flush_ul():
        if ul:
            out.append("<ul>" + "".join(f"<li>{inline(x)}</li>" for x in ul) + "</ul>")
            ul.clear()

    while i < len(lines):
        line = lines[i].rstrip()
        s = line.strip()
        if s.startswith("<details") or s.startswith("<figure") or s.startswith("</details") or s.startswith("<div class='toggle-body'") or s.startswith("<summary"):
            flush_para(); flush_ul(); out.append(line)
        elif not s:
            flush_para(); flush_ul()
        elif s == "---":
            flush_para(); flush_ul(); out.append("<hr>")
        elif s.startswith("### "):
            flush_para(); flush_ul(); out.append(f"<h3>{inline(s[4:])}</h3>")
        elif s.startswith("## "):
            flush_para(); flush_ul(); out.append(f"<h2>{inline(s[3:])}</h2>")
        elif s.startswith("- "):
            flush_para(); ul.append(s[2:])
        else:
            flush_ul(); para.append(s)
        i += 1
    flush_para(); flush_ul()
    return "\n".join(out)


def render_article(md):
    fm, body = parse_frontmatter(md)
    cover = fm.get("coverImage", {}) if isinstance(fm.get("coverImage"), dict) else {}
    cover_alt = cover.get("alt", "")
    head = [
        f'<div class="badge">{html.escape(fm.get("category", "changelogs"))}</div>',
        f'<h1>{html.escape(fm.get("title", "Untitled"))}</h1>',
    ]
    if fm.get("subtitle"):
        head.append(f'<p class="subtitle">{html.escape(fm["subtitle"])}</p>')
    head.append(f'<div class="meta">{html.escape(fm.get("date", ""))} · Infinex News</div>')
    head.append(
        f'<div class="cover"><span class="cover-tag">cover image</span>'
        f'<span class="cover-alt">{html.escape(cover_alt)}</span></div>'
    )
    return '<article class="post">' + "".join(head) + render_body(body) + "</article>"


def main():
    con = sqlite3.connect(DB)
    rows = con.execute(
        "SELECT text FROM candidates WHERE card_id=? AND channel='blog' AND attempt=? ORDER BY rowid",
        (CARD, ATTEMPT),
    ).fetchall()
    if not rows:
        print(f"No blog candidates for {CARD} attempt {ATTEMPT}")
        sys.exit(1)

    tabs, panels = [], []
    for i, (md,) in enumerate(rows, 1):
        tabs.append(f'<button class="tab{" active" if i==1 else ""}" data-i="{i}">candidate {i}</button>')
        panels.append(f'<section class="panel{" active" if i==1 else ""}" data-i="{i}">{render_article(md)}</section>')

    page = TEMPLATE.replace("__TABS__", "".join(tabs)).replace("__PANELS__", "".join(panels)).replace("__CARD__", CARD).replace("__N__", str(len(rows)))
    with open(OUT, "w") as f:
        f.write(page)
    print(f"wrote {OUT} ({len(rows)} candidates)")


TEMPLATE = r"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Infinex News — bridge.xyz changelog mockup</title>
<style>
  :root{ --bg:#0a0b0e; --panel:#111319; --rule:#23262f; --ink:#eceef2; --ink2:#a6abb6; --ink3:#6f7480; --accent:#3b6bff; }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif;-webkit-font-smoothing:antialiased}
  .topbar{position:sticky;top:0;background:rgba(10,11,14,.9);backdrop-filter:blur(8px);border-bottom:1px solid var(--rule);padding:10px 20px;display:flex;align-items:center;gap:14px;z-index:10}
  .brand{font-weight:700;letter-spacing:.02em}
  .brand .x{color:var(--ink3);font-weight:400}
  .pathhint{color:var(--ink3);font-size:13px;font-family:ui-monospace,Menlo,monospace}
  .tabs{display:flex;gap:6px;flex-wrap:wrap;padding:14px 20px;border-bottom:1px solid var(--rule);background:var(--panel)}
  .tab{background:transparent;color:var(--ink2);border:1px solid var(--rule);border-radius:999px;padding:5px 14px;font-size:13px;cursor:pointer}
  .tab:hover{color:var(--ink)}
  .tab.active{background:var(--accent);border-color:var(--accent);color:#fff}
  .wrap{max-width:720px;margin:0 auto;padding:48px 24px 120px}
  .panel{display:none} .panel.active{display:block}
  .badge{display:inline-block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);border:1px solid var(--accent);border-radius:4px;padding:3px 9px;margin-bottom:20px}
  h1{font-size:38px;line-height:1.15;letter-spacing:-.02em;margin:0 0 14px}
  .subtitle{font-size:20px;color:var(--ink2);margin:0 0 18px;line-height:1.4}
  .meta{color:var(--ink3);font-size:14px;margin-bottom:28px}
  .cover{height:300px;border:1px dashed var(--rule);border-radius:14px;background:linear-gradient(135deg,#141826,#0e1016);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;margin-bottom:40px}
  .cover-tag{font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:var(--ink3)}
  .cover-alt{color:var(--ink2);font-size:14px;max-width:80%;text-align:center}
  .post h2{font-size:26px;margin:40px 0 12px;letter-spacing:-.01em}
  .post h3{font-size:21px;margin:38px 0 12px;letter-spacing:-.01em}
  .post p{margin:0 0 18px;color:#dce0e8}
  .post a{color:var(--accent);text-decoration:none;border-bottom:1px solid rgba(59,107,255,.4)}
  .post ul{margin:0 0 18px;padding-left:22px;color:#dce0e8}
  .post li{margin:6px 0}
  .post hr{border:0;border-top:1px solid var(--rule);margin:34px 0}
  .cloud-image .imgph{height:240px;border:1px dashed var(--rule);border-radius:12px;background:linear-gradient(135deg,#10131c,#0c0e13);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;margin:8px 0 24px}
  .imgph-tag{font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:var(--ink3)}
  .imgph-alt{color:var(--ink2);font-size:13px;max-width:80%;text-align:center}
  .cloud-image img{width:100%;border-radius:12px;margin:8px 0 24px}
  details.toggle{border:1px solid var(--rule);border-radius:10px;padding:4px 16px;margin:0 0 22px;background:#0d0f15}
  details.toggle summary{cursor:pointer;padding:12px 0;font-weight:600;color:var(--ink);list-style:none}
  details.toggle summary::-webkit-details-marker{display:none}
  details.toggle summary::before{content:"+ ";color:var(--accent)}
  details.toggle[open] summary::before{content:"– "}
  .toggle-body{padding:0 0 14px;color:var(--ink2)}
  .note{max-width:720px;margin:0 auto;padding:0 24px 60px;color:var(--ink3);font-size:13px}
</style></head>
<body>
  <div class="topbar"><span class="brand">infinex<span class="x"> · news</span></span><span class="pathhint">infinex.xyz/news/&lt;slug&gt; — rendered mockup of __N__ candidates (card __CARD__, attempt 2)</span></div>
  <div class="tabs">__TABS__</div>
  <div class="wrap">__PANELS__</div>
  <div class="note">Mockup only. Cover + inline images are designer placeholders. Shortcodes rendered: {% cloud-image %} → image block, {% toggle %} → collapsible. Approximate styling for copy review, not pixel-exact brand.</div>
  <script>
    document.querySelectorAll('.tab').forEach(function(t){
      t.addEventListener('click', function(){
        var i=t.dataset.i;
        document.querySelectorAll('.tab').forEach(function(x){x.classList.toggle('active', x.dataset.i===i)});
        document.querySelectorAll('.panel').forEach(function(p){p.classList.toggle('active', p.dataset.i===i)});
        window.scrollTo(0,0);
      });
    });
  </script>
</body></html>"""

if __name__ == "__main__":
    main()
