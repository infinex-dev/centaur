#!/usr/bin/env python3
"""Render scorecard.html from results.json. Self-contained dark HTML."""
import json, html
from collections import defaultdict

import os
DIR = "research/director-mutation-battery-2026-06-03"
if os.path.exists(f"{DIR}/results.json"):
    results = json.load(open(f"{DIR}/results.json"))
else:
    results = [json.loads(line) for line in open(f"{DIR}/results.jsonl") if line.strip()]

CLASS_LABELS = {
    'A': 'A · passion-urgency',
    'B': 'B · hype-theatre',
    'C': 'C · listicle / headline-bait',
    'D': 'D · competitor antagonism',
    'E': 'E · surfaced lining',
    'F': 'F · off-palette tempo as primary',
}
CHANNELS = ['x', 'x-thread', 'web', 'in-product', 'modal', 'blog', 'carousel']

errored = [r for r in results if r.get('audit_error')]
muts = [r for r in results if r['kind'] == 'mutation' and not r.get('audit_error')]
ctrls = [r for r in results if r['kind'] == 'control' and not r.get('audit_error')]

# Voice catch rate excludes fact-only fires (mutation leaked a fact error)
voice_eval = [r for r in muts if not r['only_factual_fired']]
caught = [r for r in voice_eval if r['voice_caught']]
fact_only = [r for r in muts if r['only_factual_fired']]
overall_rate = (len(caught) / len(voice_eval) * 100) if voice_eval else 0

# director-missed AND regex-missed
dir_missed = [r for r in muts if not r['voice_caught'] and not r['only_factual_fired']]
dir_and_regex_missed = [r for r in dir_missed if r['regex']['passed']]

# control stability
ctrl_pass = [c for c in ctrls if c['director']['passed']]

def rate_cell(num, den):
    if den == 0:
        return '<td class="na">n/a</td>'
    pct = num / den * 100
    cls = 'good' if pct >= 80 else ('mid' if pct >= 40 else 'bad')
    return f'<td class="{cls}">{num}/{den}<br><b>{pct:.0f}%</b></td>'

# per class
class_rows = ''
for c in 'ABCDEF':
    rows = [r for r in muts if r['defect_class'] == c]
    ev = [r for r in rows if not r['only_factual_fired']]
    cc = [r for r in ev if r['voice_caught']]
    class_rows += f'<tr><td class="lbl">{CLASS_LABELS[c]}</td>{rate_cell(len(cc), len(ev))}'
    class_rows += f'<td>{sum(1 for r in rows if r["only_factual_fired"])}</td>'
    class_rows += f'<td>{sum(1 for r in rows if not r["regex"]["passed"])}</td></tr>'

# per channel
chan_rows = ''
for ch in CHANNELS:
    rows = [r for r in muts if r['channel'] == ch]
    ev = [r for r in rows if not r['only_factual_fired']]
    cc = [r for r in ev if r['voice_caught']]
    chan_rows += f'<tr><td class="lbl">{ch}</td>{rate_cell(len(cc), len(ev))}'
    chan_rows += f'<td>{sum(1 for r in rows if not r["regex"]["passed"])}</td></tr>'

# class x channel grid
grid = defaultdict(dict)
for r in muts:
    grid[r['defect_class']][r['channel']] = r
grid_head = '<tr><th>class \\ channel</th>' + ''.join(f'<th>{c}</th>' for c in CHANNELS) + '</tr>'
grid_body = ''
for c in 'ABCDEF':
    grid_body += f'<tr><td class="lbl">{CLASS_LABELS[c]}</td>'
    for ch in CHANNELS:
        r = grid[c].get(ch)
        if not r:
            grid_body += '<td class="na">·</td>'
        elif r['only_factual_fired']:
            grid_body += '<td class="factonly" title="fact-only fire">F!</td>'
        elif r['voice_caught']:
            grid_body += '<td class="good" title="caught">✓</td>'
        else:
            extra = '' if r['regex']['passed'] else ' (regex✓)'
            grid_body += f'<td class="bad" title="MISSED{extra}">✗</td>'
    grid_body += '</tr>'

# miss table
miss_rows = ''
for r in dir_missed:
    regex_note = 'regex MISSED too' if r['regex']['passed'] else 'regex caught: ' + ', '.join(f['rule'] for f in r['regex']['failures'])
    regex_cls = 'bad' if r['regex']['passed'] else 'mid'
    notes = ' '.join(r['director']['notes_for_actor'])[:400]
    miss_rows += f'''<tr>
      <td>{r['item_id']}</td>
      <td class="lbl">{CLASS_LABELS[r['defect_class']]}</td>
      <td>{r['channel']}</td>
      <td class="{regex_cls}">{html.escape(regex_note)}</td>
      <td class="txt">{html.escape(r['text'])}</td>
      <td class="read"><b>placement_read:</b> {html.escape(r['director']['placement_read'])}<br><b>tempo:</b> {r['director']['primary_tempo']} ({r['director']['primary_confidence']:.2f}) · <b>drive:</b> {r['director']['drive_read']}<br><b>fit:</b> {html.escape(r['director']['infinex_fit_reason'])}<br><b>notes:</b> {html.escape(notes)}</td>
    </tr>'''

# full per-item detail
def detail_block(r):
    klass = 'control' if r['kind'] == 'control' else CLASS_LABELS[r['defect_class']]
    verdict = 'PASS' if r['director']['passed'] else 'FAIL'
    if r['kind'] == 'mutation':
        if r['voice_caught']:
            outcome = '<span class="good">CAUGHT (voice)</span>'
        elif r['only_factual_fired']:
            outcome = '<span class="factonly">FACT-ONLY fired (excluded from voice rate)</span>'
        else:
            outcome = '<span class="bad">MISSED</span>'
    else:
        outcome = '<span class="good">stable</span>' if r['director']['passed'] else '<span class="bad">flipped</span>'
    d = r['director']
    return f'''<details>
      <summary>{r['item_id']} · {r['channel']} · {klass} · director={verdict} · {outcome}</summary>
      <div class="dt">
        <div class="txt2">{html.escape(r['text'])}</div>
        <table class="kv">
          <tr><td>copy_voice_passed</td><td>{d['copy_voice_passed']}</td></tr>
          <tr><td>factual_passed</td><td>{d['factual_passed']}</td></tr>
          <tr><td>infinex_fit.legal</td><td>{d['infinex_fit_legal']}</td></tr>
          <tr><td>publication_gate_passed</td><td>{d['publication_gate_passed']}</td></tr>
          <tr><td>primary_tempo</td><td>{d['primary_tempo']} ({d['primary_confidence']:.2f})</td></tr>
          <tr><td>drive_read</td><td>{d['drive_read']}</td></tr>
          <tr><td>placement_read</td><td>{html.escape(d['placement_read'])}</td></tr>
          <tr><td>infinex_fit.reason</td><td>{html.escape(d['infinex_fit_reason'])}</td></tr>
          <tr><td>voice_issues</td><td>{html.escape('; '.join(d['voice_issues']) or '—')}</td></tr>
          <tr><td>factual_issues</td><td>{html.escape('; '.join(d['factual_issues']) or '—')}</td></tr>
          <tr><td>notes_for_actor</td><td>{html.escape(' / '.join(d['notes_for_actor']) or '—')}</td></tr>
          <tr><td>regex validator</td><td>{'PASS' if r['regex']['passed'] else 'FAIL: ' + html.escape('; '.join(f['rule']+': '+f['reason'] for f in r['regex']['failures']))}</td></tr>
        </table>
      </div>
    </details>'''

details_html = ''.join(detail_block(r) for r in sorted(results, key=lambda x: (x['kind'], x.get('defect_class') or '', x['channel'])))

big_rate_cls = 'good' if overall_rate >= 80 else ('mid' if overall_rate >= 40 else 'bad')

HTML = f'''<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Director voice-axis mutation battery · 2026-06-03</title>
<style>
:root{{--bg:#0e1014;--panel:#171a21;--panel2:#1e222b;--line:#2a2f3a;--fg:#dfe3ea;--mut:#8b93a3;--good:#3ddc84;--bad:#ff5470;--mid:#f5b82e;--fact:#7aa2f7;}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;padding:32px max(24px,4vw)}}
h1{{font-size:24px;margin:0 0 4px}} h2{{font-size:17px;margin:34px 0 12px;color:var(--fg);border-bottom:1px solid var(--line);padding-bottom:6px}}
.sub{{color:var(--mut);margin-bottom:24px;font-size:13px}}
.hero{{display:flex;gap:20px;flex-wrap:wrap;align-items:stretch}}
.card{{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px 22px}}
.bignum{{font-size:54px;font-weight:700;line-height:1}}
.bignum.good{{color:var(--good)}} .bignum.bad{{color:var(--bad)}} .bignum.mid{{color:var(--mid)}}
.card .lab{{color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin-top:6px}}
table{{border-collapse:collapse;width:100%;background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:13px}}
th,td{{padding:8px 11px;border-bottom:1px solid var(--line);text-align:center;vertical-align:top}}
th{{background:var(--panel2);color:var(--mut);font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.05em}}
td.lbl{{text-align:left;color:var(--fg);font-weight:600}}
td.good,.good{{color:var(--good)}} td.bad,.bad{{color:var(--bad)}} td.mid,.mid{{color:var(--mid)}} td.na{{color:#555}}
td.factonly,.factonly{{color:var(--fact)}}
td.txt{{text-align:left;max-width:380px;font-size:12px;color:var(--mut);white-space:pre-wrap}}
td.read{{text-align:left;max-width:420px;font-size:12px}}
details{{background:var(--panel);border:1px solid var(--line);border-radius:8px;margin:6px 0;padding:4px 12px}}
summary{{cursor:pointer;font-size:13px;padding:6px 0}}
.dt{{padding:8px 0 14px}}
.txt2,.txt2 *{{white-space:pre-wrap}}
.txt2{{background:var(--panel2);border-radius:8px;padding:12px;font-size:13px;margin-bottom:10px;color:#cdd3dd}}
table.kv td{{text-align:left;font-size:12px}} table.kv td:first-child{{color:var(--mut);width:170px;white-space:nowrap}}
.legend{{font-size:12px;color:var(--mut);margin-top:8px}}
code{{background:var(--panel2);padding:1px 5px;border-radius:4px}}
</style></head><body>
<h1>Director voice-axis mutation battery</h1>
<div class="sub">card 01KT5FTDJVCCE8ZG5DX4CXAG15 (Hyperliquid Spot V1) · Director model <code>claude-sonnet-4-6</code> (default, unset) · 42 mutations + 14 controls · 2026-06-03<br>
"Caught" = <code>copy_voice_passed=false</code> OR <code>infinex_fit.legal=false</code>. Fact-only fires (factual gate the sole catcher) excluded from the voice rate.</div>

<div class="hero">
  <div class="card"><div class="bignum {big_rate_cls}">{overall_rate:.0f}%</div><div class="lab">voice-axis catch rate<br>({len(caught)}/{len(voice_eval)} judged)</div></div>
  <div class="card"><div class="bignum {'good' if len(dir_and_regex_missed)==0 else 'bad'}">{len(dir_and_regex_missed)}</div><div class="lab">Director-missed AND regex-missed<br>(slipped both gates)</div></div>
  <div class="card"><div class="bignum {'good' if len(ctrl_pass)==len(ctrls) else 'mid'}">{len(ctrl_pass)}/{len(ctrls)}</div><div class="lab">control stability<br>(unmutated still passing)</div></div>
  <div class="card"><div class="bignum factonly">{len(fact_only)}</div><div class="lab">fact-only fires<br>(excluded from rate)</div></div>
</div>

<h2>Catch rate per defect class</h2>
<table><tr><th>defect class</th><th>voice catch</th><th>fact-only fires</th><th>regex would catch</th></tr>{class_rows}</table>

<h2>Catch rate per channel</h2>
<table><tr><th>channel</th><th>voice catch</th><th>regex would catch</th></tr>{chan_rows}</table>

<h2>Class × channel grid</h2>
<table>{grid_head}{grid_body}</table>
<div class="legend">✓ caught (voice) · ✗ missed · <span class="bad">✗ (regex✓)</span> = Director missed but deterministic validator would have caught · <span class="factonly">F!</span> fact-only fire · · no item</div>

<h2>Full miss table — every uncaught mutation</h2>
<div class="sub">The most damning artifact: copy the Director read carefully and passed. Sorted by class.</div>
<table><tr><th>id</th><th>class</th><th>chan</th><th>regex</th><th>mutated text</th><th>Director read + notes</th></tr>{miss_rows if miss_rows else '<tr><td colspan=6 class="good">No Director misses.</td></tr>'}</table>

<h2>Per-item detail (all {len(results)})</h2>
{details_html}

</body></html>'''

open(f"{DIR}/scorecard.html", "w").write(HTML)
print(f"wrote {DIR}/scorecard.html")
print(f"voice catch rate {overall_rate:.0f}% ({len(caught)}/{len(voice_eval)}) · dir+regex missed {len(dir_and_regex_missed)} · controls {len(ctrl_pass)}/{len(ctrls)} · fact-only {len(fact_only)}")
