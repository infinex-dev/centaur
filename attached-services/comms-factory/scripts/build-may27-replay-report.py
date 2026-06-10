#!/usr/bin/env python3
"""Classify OLD rejection reasons, cross with NEW verdicts, build matrix + dark HTML report."""
import json, html, re

DIR = "research/director-may27-replay-2026-06-03"
results = json.load(open(f"{DIR}/results.json"))

# --- OLD-reason classification --------------------------------------------------
# canon-inverted: rejection turns on demanding visible Vision/Spell as the SURFACE,
#   demanding the Lining be performed/revealed on the surface, or treating a reserve
#   (beat-only, ON-palette) tempo like self-contained as illegal-as-primary.
# substantive: tempo genuinely OFF the palette entirely (acute, certain = Awake-outer,
#   not even reserve), or a real factual issue as the deciding gate.
# mixed: both a canon-inverted clause AND a substantive clause materially present.

PALETTE_MAIN = {"commanding","practical","sombre","irradiant","sociable"}
PALETTE_RESERVE = {"self-contained","receptive","overpowering","diffused","egocentric","altruistic","unsociable"}
# acute, certain, etc -> NOT in palette at all (Awake-outer Action Attitudes)

CANON_PHRASES = [
    "extravert slot must be vision", "visible projection is doing", "visible drive surface reads as doing",
    "extravert projection must be vision", "must be vision", "vision is the required extravert",
    "does not perform dissolution", "does not reveal the dissolution", "dissolution not",
    "lining ('the bank wall", "lining is absent", "lining (bank", "never sur", "never surfaces",
    "through-action is not performed", "through-action ('reveal", "does not perform",
    "the required extravert projection", "doing belongs in the secondary slot",
]
RESERVE_AS_PRIMARY = "beat-only"  # phrase used to reject on-palette reserve tempo

def classify_old(item):
    old = item["old_audit"]
    fit = old.get("infinex_fit") or {}
    reason = (fit.get("reason") or "").lower().replace("—","-").replace("→","->")
    tempo = (old.get("primary_tempo") or "").lower()
    factual = old.get("factual_issues") or []
    # Determine whether a real factual blocker fired (not a "no errors" note).
    real_factual = any(
        not re.search(r"no factual|no deployed-fact|no unsupported|factually (accurate|grounded)|correctly|no factual errors", f.lower())
        and re.search(r"factual|present.tense|not yet|has not|overclaim|inflat|beta|without any.*qualif|live\b", f.lower())
        for f in factual
    )

    has_canon = any(p in reason for p in CANON_PHRASES) or ("doing" in reason and "vision" in reason and "must" in reason)
    reserve_as_primary = (tempo in PALETTE_RESERVE) and (RESERVE_AS_PRIMARY in reason or "not a primary" in reason or "reserve" in reason)
    truly_offpalette = tempo not in PALETTE_MAIN and tempo not in PALETTE_RESERVE and tempo not in ("","unknown")
    # 'not in the Infinex allowed palette' phrasing for acute/certain
    offpalette_phrase = ("not in the infinex" in reason or "not on the infinex palette" in reason or "not in the infinex allowed palette" in reason or "is not in the infinex permitted palette" in reason or "awake outer" in reason) and truly_offpalette

    canon = has_canon or reserve_as_primary
    substantive = offpalette_phrase or real_factual

    # deciding quote
    quote = ""
    if reserve_as_primary:
        m = re.search(r"[^.]*beat-only[^.]*\.", fit.get("reason") or "")
        quote = (m.group(0) if m else (fit.get("reason") or "")[:240]).strip()
    elif has_canon:
        for p in ["extravert", "must be vision", "dissolution", "lining", "does not perform", "visible projection", "visible drive surface"]:
            m = re.search(r"[^.]*"+re.escape(p)+r"[^.]*\.", fit.get("reason") or "", re.I)
            if m: quote = m.group(0).strip(); break
        if not quote: quote = (fit.get("reason") or "")[:240]
    if offpalette_phrase:
        m = re.search(r"[^.]*(not (in|on) the [Ii]nfinex|Awake outer)[^.]*\.", fit.get("reason") or "")
        oq = (m.group(0).strip() if m else "")
        quote = (quote + "  ||  " + oq) if quote else oq
    if real_factual:
        fq = next((f for f in factual if re.search(r"present.tense|not yet|has not|overclaim", f.lower())), factual[0] if factual else "")
        quote = (quote + "  ||  FACTUAL: " + fq[:200]) if quote else ("FACTUAL: " + fq[:200])

    if canon and substantive:
        cls = "mixed"
    elif canon:
        cls = "canon-inverted"
    elif substantive:
        cls = "substantive"
    else:
        cls = "unclassified"
    return cls, quote.strip(), {"tempo": tempo, "real_factual": real_factual, "reserve_as_primary": reserve_as_primary, "offpalette": offpalette_phrase, "has_canon": has_canon}

# --- Manual adjudication overrides ----------------------------------------------
# The regex auto-classifier over-counts soft factual *notes* (SPEI-beta, present-tense,
# FPS-sort-code) as substantive gates and mis-handles tempo-READING disagreements.
# After reading every old fit-reason in full, the deciding gate is reassigned below.
# Each value: (class, deciding_quote).
MANUAL = {
  # OLD reject turned ENTIRELY on Vision-as-surface / lining-absent / "too fast = Doing"
  # — all canon-inversion. The attached factual lines were "no violation" / soft observations,
  # NOT the deciding gate (old infinex_fit.legal=false came from the drive-slot inversion).
  "warmup-none-x-X728G2": ("canon-inverted", "the Drive read is Doing ... not Spell ... or Vision; the through-action ('reveal that the bank wall just dissolved') calls for a sombre or irradiant register underneath the commanding surface — demanded the Lining be performed."),
  "warmup-daily_pages-x-5J4F5S": ("canon-inverted", "Commanding is legal but the Sustained quality ... is absent. The piece is too fast. — rejected legal tempo for not projecting Spell-as-surface; factual notes were 'defensible omission', not the gate."),
  "warmup-scene_rehearsal-x-XTSEK2": ("canon-inverted", "The reader is not allowed to feel the wall dissolve; they are told the wall is missing. That is Doing, not Spell. — demanded visible Lining; FPS-sort-code note was a soft observation, not the deciding gate."),
  "run-att1-web-BFJ8F4": ("canon-inverted", "the extravert slot must be Vision ... the lining ('the bank-vs-wallet wall just stopped existing') is entirely absent from the prose — demanded per-line Vision projection + visible Lining."),
  # OLD reject = off-palette tempo, but old READ the SAME prose as acute/certain (Awake-outer);
  # new Director reads it as commanding. Tempo-reading disagreement on identical text, not a
  # real palette defect the new gate disabled. Keep as substantive (off-palette) but note it.
  "warmup-daily_pages-web-A9NSVJ": ("substantive", "Acute (Awake outer / Direct + Quick) is not on the Infinex palette. — but the new Director re-reads identical prose as commanding (legal); old verdict was a tempo-reading call, not a text defect."),
  "warmup-daily_pages-web-BBQHM2": ("substantive", "acute is an Awake outer tempo ... not in the Infinex permitted palette. — new Director re-reads identical prose as commanding (legal); tempo-reading disagreement."),
  "run-att3-x-6Z9KSX": ("substantive", "The tempo 'certain' (Awake outer) ... is not in the Infinex allowed palette. — new Director re-reads identical prose as commanding (legal); tempo-reading disagreement, plus old also demanded visible release beat (canon-inverted secondary)."),
  # unclassified-3: all old tempo commanding (legal); deciding gate was the revelation/Lining demand.
  "warmup-daily_pages-x-PSD2DY": ("canon-inverted", "the prose attempts this but seals the revelation inside Bound flow — the wall dissolves, but the sentence reporting it is itself a wall — demanded the Lining be performed; factual = 'no inflation detected'."),
  "warmup-scene_rehearsal-web-MSVQ9J": ("canon-inverted", "The copy does not reveal — it instructs ... not a perception-shift — demanded visible revelation; also wrongly called commanding 'not on palette'. Factual = 'no breach'."),
  "run-att4-web-0J90BJ": ("canon-inverted", "OLD: 'commanding is in the primary allowed tempi ... tempo itself is not the failure' — copy clean (legal=true, no voice/factual issues) yet old passed=false on a non-copy gate; the rejection was not a substantive copy defect."),
}

for r in results:
    cls, quote, dbg = classify_old(r)
    if r["item_id"] in MANUAL:
        cls, quote = MANUAL[r["item_id"]]
    r["old_class"] = cls
    r["old_quote"] = quote
    r["_dbg"] = dbg
    na = r.get("new_audit")
    r["new_pass"] = bool(na and na.get("passed"))

# --- Matrix ---------------------------------------------------------------------
matrix = {}
for r in results:
    key = (r["old_class"], "PASS" if r["new_pass"] else "FAIL")
    matrix[key] = matrix.get(key, 0) + 1

overcorrections = [r for r in results if r["old_class"] in ("substantive","mixed") and r["new_pass"]]
gate_alive = [r for r in results if r["old_class"] in ("substantive","mixed") and not r["new_pass"]]
correct_fix = [r for r in results if r["old_class"] == "canon-inverted" and r["new_pass"]]
canon_still_fail = [r for r in results if r["old_class"] == "canon-inverted" and not r["new_pass"]]

summary = {
    "total": len(results),
    "matrix": {f"{k[0]} x new-{k[1]}": v for k, v in sorted(matrix.items())},
    "old_class_counts": {c: sum(1 for r in results if r["old_class"]==c) for c in ["canon-inverted","substantive","mixed","unclassified"]},
    "new_pass_count": sum(1 for r in results if r["new_pass"]),
    "new_fail_count": sum(1 for r in results if not r["new_pass"]),
    "correct_fix_canon_to_pass": len(correct_fix),
    "canon_still_fail": len(canon_still_fail),
    "gate_alive_substantive_still_fail": len(gate_alive),
    "overcorrections_substantive_to_pass": len(overcorrections),
}
json.dump({"summary": summary, "results": results}, open(f"{DIR}/results-classified.json","w"), indent=2)
print(json.dumps(summary, indent=2))
print("\nOVERCORRECTIONS:")
for o in overcorrections:
    print(" ", o["item_id"], "| old_class", o["old_class"], "| old tempo", o["old_audit"]["primary_tempo"])

# --- HTML -----------------------------------------------------------------------
def esc(s): return html.escape(str(s if s is not None else ""))
def lst(xs):
    xs = xs or []
    return "<ul>"+"".join(f"<li>{esc(x)}</li>" for x in xs)+"</ul>" if xs else "<span class=dim>—</span>"

CLS_COLOR = {"canon-inverted":"#5b8cff","substantive":"#e0a13c","mixed":"#c061cb","unclassified":"#888"}

rows_html = ""
order = {"canon-inverted":0,"mixed":1,"substantive":2,"unclassified":3}
for r in sorted(results, key=lambda x:(order.get(x["old_class"],9), x["set"], x["item_id"])):
    na = r.get("new_audit") or {}
    old = r["old_audit"]
    oldfit = old.get("infinex_fit") or {}
    new_verdict = "PASS" if r["new_pass"] else ("ERROR" if r.get("audit_error") else "FAIL")
    vcolor = "#3fb950" if new_verdict=="PASS" else ("#888" if new_verdict=="ERROR" else "#f85149")
    flag = ""
    if r["old_class"] in ("substantive","mixed") and r["new_pass"]:
        flag = "<span class='flag over'>OVERCORRECTION</span>"
    elif r["old_class"] in ("substantive","mixed") and not r["new_pass"]:
        flag = "<span class='flag alive'>GATE ALIVE</span>"
    elif r["old_class"]=="canon-inverted" and r["new_pass"]:
        flag = "<span class='flag fix'>CORRECT FIX</span>"
    elif r["old_class"]=="canon-inverted" and not r["new_pass"]:
        flag = "<span class='flag stillfail'>CANON STILL-FAIL</span>"
    rows_html += f"""
    <div class="row">
      <div class="rowhead">
        <span class="iid">{esc(r['item_id'])}</span>
        <span class="chan">{esc(r['channel'])}</span>
        <span class="oldcls" style="background:{CLS_COLOR.get(r['old_class'],'#888')}22;color:{CLS_COLOR.get(r['old_class'],'#888')};border-color:{CLS_COLOR.get(r['old_class'],'#888')}">{esc(r['old_class'])}</span>
        <span class="verdict" style="color:{vcolor}">new: {new_verdict}</span>
        {flag}
      </div>
      <div class="text">{esc(r['text'])}</div>
      <div class="cols">
        <div class="col old">
          <div class="lbl">OLD (2026-05-27) — FAIL · tempo <b>{esc(old.get('primary_tempo'))}</b> · drive <b>{esc(old.get('drive_read'))}</b> · legal <b>{esc(oldfit.get('legal'))}</b></div>
          <div class="quote"><b>deciding:</b> {esc(r['old_quote'])}</div>
          <details><summary>old fit reason</summary><div class="reason">{esc(oldfit.get('reason'))}</div></details>
        </div>
        <div class="col new">
          <div class="lbl">NEW (current) — tempo <b>{esc(na.get('primary_tempo'))}</b> · drive <b>{esc(na.get('drive_read'))}</b> · legal <b>{esc(na.get('infinex_fit_legal'))}</b> · voice <b>{esc(na.get('copy_voice_passed'))}</b> · fact <b>{esc(na.get('factual_passed'))}</b></div>
          <div class="quote"><b>placement_read:</b> {esc(na.get('placement_read'))}</div>
          <details><summary>new fit reason + issues</summary>
            <div class="reason">{esc(na.get('infinex_fit_reason'))}</div>
            <div class="lbl">voice_issues</div>{lst(na.get('voice_issues'))}
            <div class="lbl">factual_issues</div>{lst(na.get('factual_issues'))}
          </details>
        </div>
      </div>
    </div>"""

mtx = summary["matrix"]
def mc(k): return mtx.get(k,0)
html_doc = f"""<!doctype html><html><head><meta charset=utf-8><title>Director May-27 Replay</title>
<style>
:root{{color-scheme:dark}}
body{{background:#0d1117;color:#c9d1d9;font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:32px;max-width:1180px;margin:0 auto}}
h1{{font-size:22px;margin:0 0 4px}} h2{{font-size:16px;margin:28px 0 10px;color:#8b949e;border-bottom:1px solid #21262d;padding-bottom:6px}}
.sub{{color:#8b949e;margin:0 0 20px}}
.headline{{background:#161b22;border:1px solid #30363d;border-left:4px solid #3fb950;border-radius:8px;padding:16px 20px;margin:18px 0;font-size:15px}}
.headline b{{color:#fff}}
table.mtx{{border-collapse:collapse;margin:12px 0;font-size:13px}}
table.mtx th,table.mtx td{{border:1px solid #30363d;padding:8px 14px;text-align:center}}
table.mtx th{{background:#161b22;color:#8b949e}}
.cell-pass{{color:#3fb950;font-weight:700}} .cell-fail{{color:#f85149;font-weight:700}}
.cell-good{{background:#0f2417}} .cell-bad{{background:#2b1416}}
.row{{background:#0f141b;border:1px solid #21262d;border-radius:8px;padding:14px 16px;margin:10px 0}}
.rowhead{{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px}}
.iid{{font-family:ui-monospace,monospace;font-size:12px;color:#79c0ff}}
.chan{{font-size:11px;background:#21262d;padding:1px 7px;border-radius:10px;color:#8b949e}}
.oldcls{{font-size:11px;padding:1px 8px;border-radius:10px;border:1px solid}}
.verdict{{font-weight:700;font-size:13px;margin-left:auto}}
.flag{{font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;letter-spacing:.04em}}
.flag.over{{background:#5a1e1e;color:#ffb4b4}} .flag.alive{{background:#1e4d2b;color:#9be8af}}
.flag.fix{{background:#1c3a5e;color:#9ecbff}} .flag.stillfail{{background:#4a3a12;color:#f0d088}}
.text{{font-size:15px;color:#e6edf3;background:#161b22;border-radius:6px;padding:10px 12px;margin-bottom:10px;white-space:pre-wrap}}
.cols{{display:grid;grid-template-columns:1fr 1fr;gap:14px}}
.col{{background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:10px 12px}}
.col.old{{border-left:3px solid #f85149}} .col.new{{border-left:3px solid #3fb950}}
.lbl{{font-size:11px;color:#8b949e;text-transform:uppercase;letter-spacing:.04em;margin:8px 0 3px}}
.lbl:first-child{{margin-top:0}}
.quote{{font-size:13px;color:#c9d1d9}} .quote b{{color:#d2a8ff}}
.reason{{font-size:12.5px;color:#adbac7;margin:6px 0;white-space:pre-wrap}}
details summary{{cursor:pointer;color:#58a6ff;font-size:12px;margin-top:6px}}
ul{{margin:4px 0;padding-left:18px}} li{{margin:2px 0;font-size:12.5px}}
.dim{{color:#6e7681}}
@media(max-width:820px){{.cols{{grid-template-columns:1fr}}}}
</style></head><body>
<h1>Director May-27 Replay — did the rewiring fix the inversion, or lobotomize the gate?</h1>
<p class="sub">21 candidates the pre-rewiring Director rejected on 2026-05-27 for Bridge.xyz card <code>infinex-bridge-fiat-deposit-2026-05-22</code> (run id 01KS6QJNEGFYP6X048V8Y900DM), replayed through the CURRENT Director (src/actor-director.ts, default model claude-sonnet-4-6). Live-source path; card + fact receipts reconstructed from stored director_prompt_json. {summary['total']} items: 14 warmup + 7 run.</p>

<div class="headline">
  <b>Headline:</b> Of {summary['old_class_counts']['canon-inverted']} canon-inverted rejections, {summary['correct_fix_canon_to_pass']} now PASS (correct fix).
  Of {summary['old_class_counts']['substantive']+summary['old_class_counts']['mixed']} substantive/mixed rejections, {summary['gate_alive_substantive_still_fail']} still FAIL (gate alive) and {summary['overcorrections_substantive_to_pass']} now PASS (overcorrection).
  Current Director total: {summary['new_pass_count']} PASS / {summary['new_fail_count']} FAIL.
</div>

<h2>Matrix: old-reason class × new verdict</h2>
<table class="mtx">
<tr><th>old reason ↓ / new →</th><th>new PASS</th><th>new FAIL</th></tr>
<tr><td>canon-inverted</td><td class="cell-pass cell-good">{mc('canon-inverted x new-PASS')}</td><td class="cell-fail">{mc('canon-inverted x new-FAIL')}</td></tr>
<tr><td>substantive</td><td class="cell-pass cell-bad">{mc('substantive x new-PASS')}</td><td class="cell-fail cell-good">{mc('substantive x new-FAIL')}</td></tr>
<tr><td>mixed</td><td class="cell-pass">{mc('mixed x new-PASS')}</td><td class="cell-fail">{mc('mixed x new-FAIL')}</td></tr>
<tr><td>unclassified</td><td>{mc('unclassified x new-PASS')}</td><td>{mc('unclassified x new-FAIL')}</td></tr>
</table>
<p class="sub">Green = expected/healthy (canon→PASS = fix landed; substantive→FAIL = gate alive). Red-bg = the diagnostic we care about (substantive→PASS = overcorrection).</p>

<h2>Per-item ({summary['total']})</h2>
{rows_html}
</body></html>"""
open(f"{DIR}/report.html","w").write(html_doc)
print(f"\nWrote {DIR}/report.html and results-classified.json")
